import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, copyFile, readFile, writeFile, rm, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { openMemoryStore } from "../../src/store/sqlite-store.mjs";
import { openNoteRepository, noteToMarkdown } from "../../src/notes/notes.mjs";
import { ingestPiSession } from "../../src/transcripts/pi-indexer.mjs";
import { reconcileMissingSessions } from "../../src/store/integrity.mjs";
const fixture=fileURLToPath(new URL("../fixtures/pi-v3/branched-compacted.jsonl",import.meta.url));
const scope={ownerId:"notes-owner",projectId:"notes-project",sourceNamespace:"notes-install"};

async function setup(){
 const root=await mkdtemp(join(tmpdir(),"pi-memory-notes-"));const sessions=join(root,"sessions");
 await mkdir(sessions);const file=join(sessions,"fixture.jsonl");await copyFile(fixture,file);
 const db=join(root,"state.sqlite");const store=openMemoryStore(db);
 await ingestPiSession(store,file,{...scope,allowedSessionRoot:sessions,captureApproved:true});
 return {root,file,sessions,store,repo:openNoteRepository(store),async cleanup(){store.close();await rm(root,{recursive:true,force:true});}};
}
const evidence=[{sessionId:"session-p1-v3-fixture",entryId:"t7r"}];
const candidate={type:"fact",title:"Database repair",content:"Tests passed after repair",evidence};

test("L2 candidate -> explicit approve -> revoke, with evidence and markdown",async()=>{
 const t=await setup();
 try{
  const n=t.repo.createCandidate(candidate,scope);
  assert.equal(n.status,"candidate");
  assert.equal(t.repo.approvedIndex(scope).length,0);
  const item=t.repo.get(n.id,scope);
  assert.equal(item.evidenceComplete,true);
  assert.equal(item.sourceTrust,"user_explicit");
  assert.match(noteToMarkdown(item),/# Database repair/);
  assert.throws(()=>t.repo.approve(n.id,scope,99),/revision conflict/);
  const approved=t.repo.approve(n.id,scope,1);
  assert.equal(approved.status,"verified");
  assert.equal(t.repo.approvedIndex(scope).length,1);
  assert.equal(t.repo.get(n.id,scope).sourceTrust,"human_reviewed");
  const revoked=t.repo.revoke(n.id,scope);
  assert.equal(revoked.status,"revoked");
  assert.equal(t.repo.approvedIndex(scope).length,0);
  assert.throws(()=>t.repo.approve(n.id,scope),/Only candidate\/disputed/);
  assert.equal(t.repo.revoke(n.id,scope).revision,revoked.revision,"idempotent revoke");
 }finally{await t.cleanup();}
});

test("L2 Notes cannot attach evidence from another project or a missing event",async()=>{
 const t=await setup();
 try {
  assert.throws(()=>t.repo.createCandidate(candidate,{...scope,projectId:"attacker-project"}),/Evidence not available/);
  assert.throws(()=>t.repo.createCandidate({...candidate,evidence:[{sessionId:"session-p1-v3-fixture",entryId:"nope"}]},scope),/Evidence not available/);
  assert.throws(()=>t.repo.createCandidate({...candidate,evidence:[...evidence,...evidence]},scope),/Duplicate evidence/);
  const n=t.repo.createCandidate(candidate,scope);
  assert.equal(t.repo.get(n.id,{...scope,projectId:"attacker-project"}),null);
  assert.throws(()=>t.repo.revoke(n.id,{...scope,projectId:"attacker-project"}),/not found/);
 }finally{await t.cleanup();}
});

test("L2 approved Note becomes unavailable immediately if source file is changed or deleted",async()=>{
 const t=await setup();
 try{
  const n=t.repo.createCandidate(candidate,scope);
  t.repo.approve(n.id,scope);
  const text=await readFile(t.file,"utf8");
  await writeFile(t.file,text.replace("All 14 tests passed","All 99 tests passed"));
  assert.equal(t.repo.approvedIndex(scope).length,0,"wrong hash cannot remain in L4");
  assert.throws(()=>t.repo.approve(n.id,scope),/Only candidate\/disputed/);
  await unlink(t.file);
  assert.equal(t.repo.approvedIndex(scope).length,0);
  const outcome=await reconcileMissingSessions(t.store,{...scope,allowedSessionRoot:t.sessions});
  assert.equal(outcome.removed,1);
  assert.equal(t.repo.get(n.id,scope).status,"disputed");
  assert.equal(t.repo.get(n.id,scope).evidenceComplete,false);
 }finally{await t.cleanup();}
});

test("L2 full reindex preserves evidence FKs when stable event ID is unchanged",async()=>{
 const t=await setup();
 try{
  const n=t.repo.createCandidate(candidate,scope);
  t.repo.approve(n.id,scope);
  const text=await readFile(t.file,"utf8");
  await writeFile(t.file,text+"\n");
  const outcome=await ingestPiSession(t.store,t.file,{...scope,allowedSessionRoot:t.sessions,captureApproved:true,forceFull:true});
  assert.equal(outcome.mode,"full");
  assert.equal(t.repo.get(n.id,scope).status,"verified");
  assert.equal(t.repo.get(n.id,scope).evidenceComplete,true);
 }finally{await t.cleanup();}
});
