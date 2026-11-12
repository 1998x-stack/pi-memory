import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile, appendFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { readPiSessionFile } from "../../src/transcripts/pi-reader.mjs";
import { validateLineage, selectPiBranch } from "../../src/transcripts/pi-lineage.mjs";
import { projectPiSession } from "../../src/transcripts/pi-projection.mjs";
import { normalizePiRecords } from "../../src/transcripts/pi-normalize.mjs";

const fixture = fileURLToPath(new URL("../fixtures/pi-v3/branched-compacted.jsonl", import.meta.url));

test("P1 streaming fixture: exact offsets, source hashes, no malformed lines", async () => {
  const content = await readFile(fixture);
  const doc = await readPiSessionFile(fixture, { highWaterMark: 7 });
  assert.equal(doc.header.id, "session-p1-v3-fixture");
  assert.equal(doc.entries.length, 13);
  assert.equal(doc.completeOffset, content.length);
  assert.equal(doc.pendingBytes, 0);
  assert.deepEqual(doc.issues, []);
  assert.equal(doc.records[0].offset, Buffer.byteLength(JSON.stringify(doc.header) + "\n"));
  assert.match(doc.records[0].rawHash, /^[0-9a-f]{64}$/);
});

test("P1 branch selection distinguishes failed and recovered branches", async () => {
  const { entries } = await readPiSessionFile(fixture);
  assert.deepEqual(selectPiBranch(entries, { leafId: "a4" }).path.map(x => x.id), ["u1","a2","t3","a4"]);
  assert.deepEqual(selectPiBranch(entries, { leafId: "tl12", observed: true }).path.map(x => x.id),
    ["u1","bs5","u6","a7","t7r","c8","e9","cm10","mc11","tl12"]);
  assert.equal(selectPiBranch(entries).leafSource, "inferred");
  assert.equal(selectPiBranch(entries, {leafId:"tl12",observed:true}).leafSource, "observed");
  assert.deepEqual(selectPiBranch(entries, {leafId:null}).path, []);
  assert.throws(() => selectPiBranch(entries, {leafId:"unrecognized"}), /Unknown Pi session leaf/);
});

test("P1 projection follows Pi compaction and context_edit rules", async () => {
  const { entries } = await readPiSessionFile(fixture);
  const rawAssistant = entries.find(x => x.id === "a7").message;
  const projected = projectPiSession(entries, { leafId: "tl12" });
  assert.deepEqual(projected.contextEntryIds, ["c8","u6","a7","t7r","e9","cm10","mc11","tl12"]);
  assert.equal(projected.messages[0].role, "system");
  assert.equal(projected.messages[1].role, "compactionSummary");
  assert.equal(projected.messages.filter(x => x.role === "toolResult").length, 1);
  assert.equal(projected.messages.filter(x => x.role === "assistant").length, 0);
  assert.equal(rawAssistant.content[0].type, "toolCall", "raw source must not be mutated");
  assert.equal(projected.model.modelId, "synthetic-model-2");
  assert.equal(projected.thinkingLevel, "high");
  assert.equal(projected.warnings.length, 0);
  const beforeEdit = projectPiSession(entries, { leafId: "t7r" });
  assert.ok(beforeEdit.messages.some(x => x.role === "assistant"), "edit only applies after its branch entry");
  const abandoned = projectPiSession(entries, { leafId: "a4" });
  assert.ok(abandoned.messages.some(x => JSON.stringify(x).includes("Initial wrong diagnosis")));
  assert.ok(!abandoned.messages.some(x => x.role === "compactionSummary"));
});

test("P1 lineage catches orphan, duplicate and cycles instead of silently approving", () => {
  const entries = [
    {id:"a", parentId:"b"}, {id:"b",parentId:"a"},
    {id:"c",parentId:"missing"}, {id:"c",parentId:null}
  ];
  const { issues } = validateLineage(entries);
  assert.ok(issues.some(x => x.code === "cycle"));
  assert.ok(issues.some(x => x.code === "duplicate_entry_id"));
  assert.ok(issues.some(x => x.code === "missing_parent"));
  assert.throws(() => selectPiBranch(entries,{leafId:"a"}),/Cycle/);
  assert.throws(() => selectPiBranch(entries,{leafId:"c"}),/Missing parent/);
});

test("P1 incomplete trailing JSONL is ignored until newline, including split unicode", async () => {
  const dir = await mkdtemp(join(tmpdir(), "pi-memory-jsonl-"));
  const path = join(dir, "s.jsonl");
  try {
    const header = { type:"session",version:3,id:"transient",cwd:"/synthetic",timestamp:"2026-11-12T00:00:00Z" };
    const event = { type:"message",id:"u1",parentId:null,timestamp:"2026-11-12T00:00:01Z",message:{role:"user",content:"你好 🌍"} };
    const first = JSON.stringify(header) + "\r\n";
    const second = JSON.stringify(event);
    await writeFile(path, first + second);
    const partial = await readPiSessionFile(path, {highWaterMark:2});
    assert.equal(partial.entries.length, 0);
    assert.equal(partial.pendingBytes, Buffer.byteLength(second));
    assert.equal(partial.completeOffset, Buffer.byteLength(first));
    await appendFile(path, "\n");
    const complete = await readPiSessionFile(path, {highWaterMark:2});
    assert.equal(complete.entries.length, 1);
    assert.equal(complete.entries[0].message.content, "你好 🌍");
    assert.equal(complete.pendingBytes, 0);
  } finally { await rm(dir,{recursive:true,force:true}); }
});

test("P1 invalid lines are quarantined by position without leaking plaintext", async () => {
  const dir = await mkdtemp(join(tmpdir(), "pi-memory-bad-"));
  const path = join(dir, "s.jsonl");
  try {
    const header = JSON.stringify({type:"session",version:3,id:"bad",timestamp:"x",cwd:"/synthetic"});
    const good = JSON.stringify({type:"custom",id:"ok",parentId:null,timestamp:"x",customType:"a"});
    await writeFile(path, header + "\n" + "THIS_IS_PRIVATE_NOT_JSON" + "\n" + good + "\n");
    const doc = await readPiSessionFile(path);
    assert.deepEqual(doc.entries.map(e=>e.id),["ok"]);
    assert.equal(doc.issues[0].code,"invalid_json");
    assert.ok(!JSON.stringify(doc.issues).includes("THIS_IS_PRIVATE_NOT_JSON"));
  } finally { await rm(dir,{recursive:true,force:true}); }
});

test("P1 canonical source identity remains stable across append and payload change", async () => {
  const doc = await readPiSessionFile(fixture);
  const scope = {sourceNamespace:"local-pi-v3",projectId:"synthetic-project"};
  const events = normalizePiRecords(doc,scope);
  assert.equal(events.length,doc.entries.length);
  assert.equal(events[0].entryId,"u1");
  assert.equal(events[1].toolCalls[0].toolCallId,"call-failed");
  assert.ok(!JSON.stringify(events).includes("DATABASE_POOL_TIMEOUT"), "canonical metadata must not expose tool text");
  const changed = {...doc, records:doc.records.map((r,i)=> i===0 ? {...r,rawHash:"f".repeat(64)} : r)};
  const events2 = normalizePiRecords(changed,scope);
  assert.equal(events2[0].id,events[0].id);
  assert.notEqual(events2[0].rawHash,events[0].rawHash);
  const other = normalizePiRecords(doc,{sourceNamespace:"another-install",projectId:"synthetic-project"});
  assert.notEqual(other[0].id,events[0].id);
  assert.throws(() => normalizePiRecords(doc,{sourceNamespace:"",projectId:"a"}),/required/);
});

test("P1 malformed compaction pointer warns and does not fabricate kept evidence", () => {
  const entries = [
    {type:"message",id:"u",parentId:null,timestamp:"2026-11-12T00:00:00Z",message:{role:"user",content:"hi"}},
    {type:"compaction",id:"c",parentId:"u",timestamp:"2026-11-12T00:00:01Z",summary:"s",firstKeptEntryId:"missing",tokensBefore:10}
  ];
  const p = projectPiSession(entries);
  assert.equal(p.contextEntryIds.join(","),"c");
  assert.ok(p.warnings.some(w=>w.code === "missing_first_kept_entry"));
});
