import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, mkdir, copyFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { openMemoryStore } from "../../src/store/sqlite-store.mjs";
import { ingestPiSession } from "../../src/transcripts/pi-indexer.mjs";
const fixture=fileURLToPath(new URL("../fixtures/pi-v3/branched-compacted.jsonl",import.meta.url));
const worker=fileURLToPath(new URL("../../scripts/sqlite-crash-worker.mjs",import.meta.url));
const scope={ownerId:"crash-owner",projectId:"crash-project",sourceNamespace:"crash-install"};

test("SIGKILL during SQLite transaction leaves FTS and checkpoint intact after restart",{
  skip:process.platform==="win32"?"POSIX SIGKILL is required for this fault test":false
},async()=>{
  const root=await mkdtemp(join(tmpdir(),"pi-memory-sigkill-"));
  const sessions=join(root,"sessions");await mkdir(sessions);
  const file=join(sessions,"session.jsonl");await copyFile(fixture,file);
  const db=join(root,"memory.sqlite");
  let store;
  try {
    store=openMemoryStore(db);
    await ingestPiSession(store,file,{...scope,allowedSessionRoot:sessions,captureApproved:true});
    assert.equal(store.countEvents(scope),13);
    store.close();store=null;
    const child=spawnSync(process.execPath,[worker,db,scope.sourceNamespace,"session-p1-v3-fixture"],{
      encoding:"utf8",timeout:10000
    });
    assert.equal(child.signal,"SIGKILL","worker must die mid-transaction");
    store=openMemoryStore(db);
    assert.equal(store.countEvents(scope),13,"rolled-back transaction cannot remove source events");
    assert.equal(store.search("All 14 tests passed",scope).length,1,"FTS5 still consistent");
    assert.equal(store.verifyIndex(),true);
    assert.ok(store.getSession(scope.sourceNamespace,"session-p1-v3-fixture"),"checkpoint remains available");
  }finally {store?.close();await rm(root,{recursive:true,force:true});}
});
