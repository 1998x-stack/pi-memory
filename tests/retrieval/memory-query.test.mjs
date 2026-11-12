import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp,mkdir,copyFile,rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { openMemoryStore } from "../../src/store/sqlite-store.mjs";
import { ingestPiSession } from "../../src/transcripts/pi-indexer.mjs";
import { openNoteRepository } from "../../src/notes/notes.mjs";
import { resolveMemoryQuery } from "../../src/retrieval/memory-query.mjs";
const fixture=fileURLToPath(new URL("../fixtures/pi-v3/branched-compacted.jsonl",import.meta.url));
const scope={ownerId:"retrieval-owner",projectId:"retrieval-project",sourceNamespace:"retrieval-install"};

test("L4 pointer can resolve approved L2 note as lower-trust sourced data, not unapproved notes",async()=>{
  const root=await mkdtemp(join(tmpdir(),"pi-memory-query-"));const dir=join(root,"sessions");
  await mkdir(dir);const src=join(dir,"source.jsonl");await copyFile(fixture,src);
  const store=openMemoryStore(join(root,"memory.sqlite"));
  try{
    await ingestPiSession(store,src,{...scope,allowedSessionRoot:dir,captureApproved:true});
    const repo=openNoteRepository(store);
    const n=repo.createCandidate({type:"procedure",title:"Keep pool healthy",content:"Check pool connection settings",evidence:[{sessionId:"session-p1-v3-fixture",entryId:"t7r"}]},scope);
    assert.equal(resolveMemoryQuery(store,n.id,scope).hits.length,0);
    repo.approve(n.id,scope);
    const r=resolveMemoryQuery(store,n.id,scope);
    assert.equal(r.kind,"human_approved_memory_note_untrusted_tool_data");
    assert.equal(r.hits[0].id,n.id);
    assert.equal(r.hits[0].evidence[0].entryId,"t7r");
    assert.equal(resolveMemoryQuery(store,n.id,{...scope,projectId:"foreign"}).hits.length,0);
    const raw=resolveMemoryQuery(store,"All 14 tests passed",scope);
    assert.equal(raw.kind,"unverified_transcript_evidence");
    assert.ok(raw.hits.some(h=>h.entryId==="t7r"));
    repo.revoke(n.id,scope);
    assert.equal(resolveMemoryQuery(store,n.id,scope).hits.length,0);
  }finally{store.close();await rm(root,{recursive:true,force:true});}
});
