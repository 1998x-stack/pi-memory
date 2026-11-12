import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, copyFile, rm, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { openMemoryStore } from "../../src/store/sqlite-store.mjs";
import { ingestPiSession } from "../../src/transcripts/pi-indexer.mjs";
import { reconcileMissingSessions } from "../../src/store/integrity.mjs";
const fixture=fileURLToPath(new URL("../fixtures/pi-v3/branched-compacted.jsonl",import.meta.url));
const scope={ownerId:"maintenance-owner",projectId:"maintenance-project",sourceNamespace:"maintenance-install"};

async function setup() {
  const root=await mkdtemp(join(tmpdir(),"pi-memory-integrity-"));
  const sessions=join(root,"sessions");await mkdir(sessions);
  const file=join(sessions,"fixture.jsonl");await copyFile(fixture,file);
  const db=join(root,"state.sqlite");
  const store=openMemoryStore(db);
  const opts={...scope,allowedSessionRoot:sessions,captureApproved:true};
  return {root,sessions,file,db,store,opts,async cleanup(){store.close();await rm(root,{recursive:true,force:true});}};
}

test("deleted Pi JSONL removes FTS derived index and session checkpoint without touching source",async()=>{
  const t=await setup();
  try {
    await ingestPiSession(t.store,t.file,t.opts);
    assert.equal(t.store.search("All 14 tests passed",scope).length,1);
    await unlink(t.file);
    assert.equal(t.store.search("All 14 tests passed",scope).length,0,"search fails closed on a missing native file");
    const result=await reconcileMissingSessions(t.store,t.opts);
    assert.deepEqual(result,{checked:1,removed:1,unverified:0});
    assert.equal(t.store.countEvents(scope),0);
    assert.equal(t.store.getSession(scope.sourceNamespace,"session-p1-v3-fixture"),null);
    assert.equal((await reconcileMissingSessions(t.store,t.opts)).removed,0);
  }finally{await t.cleanup();}
});

test("checkpoint compare-and-swap prevents stale concurrent writers",async()=>{
  const t=await setup();
  try {
    await ingestPiSession(t.store,t.file,t.opts);
    const before=t.store.getSession(scope.sourceNamespace,"session-p1-v3-fixture");
    const other=openMemoryStore(t.db);
    try {
      const changed={...before,sourceSize:before.source_size+100};
      other.transaction(()=>other.saveSession({
        sourceNamespace:scope.sourceNamespace,sessionId:before.session_id,
        ownerId:scope.ownerId,projectId:scope.projectId,sourceFile:t.file,
        header:JSON.parse(before.header_json),completeOffset:before.last_complete_offset,
        completeLines:before.last_complete_line,sourceSize:changed.sourceSize,
        sourceMtimeMs:before.source_mtime_ms,sourceDev:before.source_dev,sourceIno:before.source_ino,
        lastRecordOffset:before.last_record_offset,lastRecordBytes:before.last_record_bytes,lastRecordHash:before.last_record_hash
      }));
      assert.throws(()=>t.store.transaction(()=>t.store.checkCheckpoint(scope.sourceNamespace,before.session_id,before)),e=>e.code==="INGESTION_CONFLICT");
    }finally{other.close();}
  }finally{await t.cleanup();}
});

test("SQLite rollback undoes event and FTS changes, rebuild passes integrity check",async()=>{
  const t=await setup();
  try {
    await ingestPiSession(t.store,t.file,t.opts);
    assert.equal(t.store.verifyIndex(),true);
    assert.throws(()=>t.store.transaction(()=>{
      t.store.deleteSessionEvents(scope.sourceNamespace,"session-p1-v3-fixture");
      throw Error("synthetic crash before commit");
    }),/synthetic crash/);
    assert.equal(t.store.countEvents(scope),13);
    assert.equal(t.store.search("All 14 tests passed",scope).length,1);
    t.store.rebuildFts();
    assert.equal(t.store.search("All 14 tests passed",scope).length,1);
  }finally{await t.cleanup();}
});
