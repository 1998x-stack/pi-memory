import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, copyFile, readFile, writeFile, appendFile, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { openMemoryStore } from "../../src/store/sqlite-store.mjs";
import { ingestPiSession } from "../../src/transcripts/pi-indexer.mjs";

const fixture=fileURLToPath(new URL("../fixtures/pi-v3/branched-compacted.jsonl",import.meta.url));
const scope={ownerId:"unit-test-owner",projectId:"unit-test-repo"};
const sourceNamespace="unit-test-pi-install";

async function setup() {
  const root=await mkdtemp(join(tmpdir(),"pi-memory-index-"));
  const sessions=join(root,"sessions");
  const privateData=join(root,"state");
  await mkdir(sessions);
  await mkdir(privateData);
  const source=join(sessions,"session.jsonl");
  await copyFile(fixture,source);
  const store=openMemoryStore(join(privateData,"memory.sqlite"));
  return {
    root,sessions,source,store,
    options:{...scope,sourceNamespace,allowedSessionRoot:sessions,captureApproved:true},
    async cleanup(){store.close();await rm(root,{force:true,recursive:true});}
  };
}

test("P1 FTS indexes Pi tool output, enforces owner/project scope, and replays idempotently",async()=>{
  const x=await setup();
  try {
    const first=await ingestPiSession(x.store,x.source,x.options);
    assert.equal(first.mode,"full");
    assert.equal(first.processed,13);
    assert.equal(x.store.countEvents(scope),13);
    const hits=x.store.search("All 14 tests passed",scope,10);
    assert.ok(hits.some(h=>h.entryId==="t7r"));
    assert.equal(hits[0].layer,"transcript");
    assert.equal(hits[0].status,"raw");
    assert.ok(!x.store.search("All 14 tests passed",{ownerId:"someone-else",projectId:scope.projectId}).length);
    assert.ok(!x.store.search("All 14 tests passed",{ownerId:scope.ownerId,projectId:"another-project"}).length);
    assert.throws(()=>x.store.search("All 14 tests passed",{ownerId:"",projectId:scope.projectId}),/required/);
    const again=await ingestPiSession(x.store,x.source,x.options);
    assert.equal(again.mode,"unchanged");
    assert.equal(x.store.countEvents(scope),13);
    await assert.rejects(()=>ingestPiSession(x.store,x.source,{...x.options,projectId:"other"}),/scope mismatch/);
  } finally {await x.cleanup();}
});

test("P1 incremental indexing consumes only complete newly appended Pi JSONL lines",async()=>{
  const x=await setup();
  try {
    await ingestPiSession(x.store,x.source,x.options);
    const original=x.store.getSession(sourceNamespace,"session-p1-v3-fixture");
    const event={type:"message",id:"u14",parentId:"tl12",timestamp:"2026-11-12T00:00:14Z",
      message:{role:"user",content:"New session checkpoint"}};
    await appendFile(x.source,JSON.stringify(event));
    const partial=await ingestPiSession(x.store,x.source,x.options);
    assert.equal(partial.mode,"incremental");
    assert.equal(partial.processed,0);
    assert.ok(partial.pendingBytes>0);
    assert.equal(x.store.getSession(sourceNamespace,"session-p1-v3-fixture").last_complete_offset,original.last_complete_offset);
    await appendFile(x.source,"\n");
    const complete=await ingestPiSession(x.store,x.source,x.options);
    assert.equal(complete.mode,"incremental");
    assert.equal(complete.processed,1);
    assert.equal(x.store.countEvents(scope),14);
    assert.equal(x.store.search("New session checkpoint",scope).length,1);
  } finally {await x.cleanup();}
});

test("P1 same-size rewrite triggers full reconciliation and removes stale FTS tokens",async()=>{
  const x=await setup();
  try {
    await ingestPiSession(x.store,x.source,x.options);
    const original=await readFile(x.source,"utf8");
    const edited=original.replace("All 14 tests passed","All 99 tests passed");
    assert.equal(edited.length,original.length);
    await writeFile(x.source,edited);
    const refreshed=await ingestPiSession(x.store,x.source,x.options);
    assert.equal(refreshed.mode,"full");
    assert.equal(x.store.countEvents(scope),13);
    assert.equal(x.store.search("All 99 tests passed",scope).length,1);
    assert.equal(x.store.search("All 14 tests passed",scope).length,0);
  } finally {await x.cleanup();}
});

test("P1 denies source paths outside trusted session root and rejects capture without opt-in",async()=>{
  const x=await setup();
  try {
    await assert.rejects(()=>ingestPiSession(x.store,x.source,{...x.options,captureApproved:false}),/opt-in/);
    await assert.rejects(()=>ingestPiSession(x.store,x.source,{...x.options,allowedSessionRoot:join(x.root,"state")}),/outside permitted/);
    const path=join(x.sessions,"escape.jsonl");
    await symlink(join(x.root,"state","memory.sqlite"),path);
    await assert.rejects(()=>ingestPiSession(x.store,path,x.options),/outside permitted/);
  } finally {await x.cleanup();}
});

test("P1 scrubs known secret patterns before FTS persistence and never indexes system text",async()=>{
  const x=await setup();
  try {
    const header={type:"session",version:3,id:"secrets",cwd:"/synthetic",timestamp:"2026-11-12T00:00:00Z"};
    const system={type:"message",id:"s",parentId:null,timestamp:"2026-11-12T00:00:00Z",message:{role:"system",content:"SYSTEM_SECRET_PRIVATE_DO_NOT_INDEX"}};
    const result={type:"message",id:"t",parentId:"s",timestamp:"2026-11-12T00:00:01Z",message:{
      role:"toolResult",toolCallId:"fake",toolName:"bash",isError:false,
      content:[{type:"text",text:"DATABASE_POOL_TIMEOUT OPENAI_API_KEY=top-secret-value Bearer abcdefghijklmnopqrstuvwxyz sk-abcdef1234567890qwerty"}]
    }};
    await writeFile(x.source,[header,system,result].map(JSON.stringify).join("\n")+"\n");
    await ingestPiSession(x.store,x.source,x.options);
    const hits=x.store.search("DATABASE_POOL_TIMEOUT",scope);
    assert.equal(hits.length,1);
    const str=JSON.stringify(hits);
    assert.ok(!str.includes("top-secret-value"));
    assert.ok(!str.includes("abcdefghijklmnopqrstuvwxyz"));
    assert.ok(!str.includes("sk-abcdef1234567890qwerty"));
    assert.equal(x.store.search("SYSTEM_SECRET_PRIVATE_DO_NOT_INDEX",scope).length,0);
  } finally {await x.cleanup();}
});
