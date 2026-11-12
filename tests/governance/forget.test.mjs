import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp,mkdir,rmdir,copyFile,readFile,writeFile,access,rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { openMemoryStore } from "../../src/store/sqlite-store.mjs";
import { ingestPiSession } from "../../src/transcripts/pi-indexer.mjs";
import { openNoteRepository } from "../../src/notes/notes.mjs";
import { openForgetRepository } from "../../src/governance/forget.mjs";
import { openL4Controller } from "../../src/injection/l4-index.mjs";
import { resolveMemoryQuery } from "../../src/retrieval/memory-query.mjs";

const fixture=fileURLToPath(new URL("../fixtures/pi-v3/branched-compacted.jsonl",import.meta.url));
const scope={ownerId:"govern-owner",projectId:"govern-project",sourceNamespace:"govern-install"};
const sourceId="session-p1-v3-fixture";
async function setup(){
  const dir=await mkdtemp(join(tmpdir(),"pi-memory-forget-"));
  const sessions=join(dir,"sessions");await mkdir(sessions);
  const source=join(sessions,"src.jsonl");await copyFile(fixture,source);
  const db=join(dir,"pi-memory.sqlite");const store=openMemoryStore(db);
  const options={...scope,allowedSessionRoot:sessions,captureApproved:true};
  await ingestPiSession(store,source,options);
  const notes=openNoteRepository(store),forget=openForgetRepository(store),l4=openL4Controller(store);
  return {dir,sessions,source,db,store,options,notes,forget,l4,
    makeNote(title="Project note"){
      const created=notes.createCandidate({
        type:"fact",title,content:"These facts derive from source evidence",
        evidence:[{sessionId:sourceId,entryId:"t7r"}]
      },scope);
      notes.approve(created.id,scope);
      return created.id;
    },
    async cleanup(){store.close();await rm(dir,{recursive:true,force:true});}
  };
}
test("Note forget removes content, derived Markdown, and L4 pointer without altering native Pi JSONL",async()=>{
  const t=await setup();
  try {
    const id=t.makeNote();
    const mdDir=join(t.dir,"notes");await mkdir(mdDir);
    await writeFile(join(mdDir,id+".md"),"Private note content");
    t.l4.setEnabled(scope,true);
    assert.equal(t.l4.render(scope).count,1);
    const native=await readFile(t.source);
    const result=await t.forget.forgetNote(id,scope);
    assert.equal(result.forgotten,true);
    assert.equal(result.removedExports,1);
    assert.equal(result.exportCleanupFailures,0);
    assert.equal(t.notes.get(id,scope),null);
    assert.equal(resolveMemoryQuery(t.store,id,scope).hits.length,0);
    assert.equal(t.l4.render(scope).count,0);
    assert.equal(t.forget.isNoteForgotten(id,scope),true);
    await assert.rejects(access(join(mdDir,id+".md")),{code:"ENOENT"});
    assert.deepEqual(await readFile(t.source),native,"Pi native source is never modified");
    assert.equal(t.store.verifyIndex(),true);
    // A retry after an interrupted cleanup remains idempotent.
    assert.equal((await t.forget.forgetNote(id,scope)).exportCleanupFailures,0);
    await assert.rejects(
      t.forget.forgetNote(id,{...scope,projectId:"foreign"}),
      /not found/);
  }finally{await t.cleanup();}
});

test("Session forget purges all dependent Notes, leaves native Pi source, and blocks later reindex",async()=>{
  const t=await setup();
  try {
    const id=t.makeNote("Forget with session");
    const mdDir=join(t.dir,"notes");await mkdir(mdDir);
    await writeFile(join(mdDir,id+".md"),"Do not retain");
    const second=openMemoryStore(t.db);
    try {
      const r=await t.forget.forgetSession(sourceId,scope);
      assert.equal(r.dependentNotesPurged,1);
      assert.equal(r.removedExports,1);
      assert.equal(t.store.countEvents(scope),0);
      assert.equal(second.countEvents(scope),0);
      assert.equal(t.notes.get(id,scope),null);
      assert.equal(t.store.getSession(scope.sourceNamespace,sourceId),null);
      assert.equal(t.forget.isSessionForgotten(sourceId,scope),true);
      assert.equal(t.forget.isNoteForgotten(id,scope),true);
      assert.equal((await readFile(t.source,"utf8")).includes("session-p1-v3-fixture"),true);
      assert.equal(t.store.search("All 14 tests passed",scope).length,0);
      assert.equal(t.store.verifyIndex(),true);
      await assert.rejects(
        ingestPiSession(second,t.source,t.options),
        /intentionally forgotten/);
      // Even explicit repair may not resurrect an intentionally forgotten source.
      await assert.rejects(
        ingestPiSession(t.store,t.source,{...t.options,forceFull:true}),
        /intentionally forgotten/);
      assert.equal((await t.forget.forgetSession(sourceId,scope)).forgotten,true);
      await assert.rejects(
        t.forget.forgetSession(sourceId,{...scope,projectId:"foreign"}),
        /not found/);
    } finally {second.close();}
  }finally{await t.cleanup();}
});

test("SQLite secure_delete is enabled for erasure best-effort; archive/backups remain out of scope",async()=>{
  const t=await setup();
  try{
    assert.equal(t.store.database.prepare("PRAGMA secure_delete").get().secure_delete,1);
    const id=t.makeNote();
    await t.forget.forgetNote(id,scope);
    assert.equal(t.store.database.prepare("SELECT count(*) as n FROM memory_notes").get().n,0);
    assert.equal(t.store.database.prepare("SELECT count(*) as n FROM memory_note_evidence").get().n,0);
  }finally{await t.cleanup();}
});


test("Export cleanup outbox preserves failed deletion and supports safe retry",async()=>{
  const t=await setup();
  try {
    const id=t.makeNote("Pending export cleanup");
    const directory=join(t.dir,"notes");await mkdir(directory);
    const unusual=join(directory,id+".md");
    await mkdir(unusual);
    const result=await t.forget.forgetNote(id,scope);
    assert.equal(result.exportCleanupFailures,1);
    assert.equal(t.forget.cleanupPending(scope),1);
    assert.equal(t.notes.get(id,scope),null,"SQLite erase is committed even if file cleanup fails");
    await rmdir(unusual);
    const retry=await t.forget.drainCleanup(scope);
    assert.equal(retry.exportCleanupFailures,0);
    assert.equal(t.forget.cleanupPending(scope),0);
    assert.equal(t.forget.isNoteForgotten(id,scope),true);
  } finally {await t.cleanup();}
});
