/**
 * P1 Governance: deliberately scoped derived-data erasure.
 *
 * Native Pi JSONL, unrelated projects, external backups, and already-sent
 * model prompts remain outside this tool's authority. This is NOT forensic
 * deletion. A hashed tombstone blocks silent re-ingestion.
 */
import { createHash } from "node:crypto";
import { unlink, lstat } from "node:fs/promises";
import { dirname, join } from "node:path";
import { assertScope } from "../store/sqlite-store.mjs";

const NOTE_ID=/^mem_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const hash=(kind,scope,id)=>createHash("sha256").update(JSON.stringify([
  "pi-memory-forget-v1",kind,scope.ownerId,scope.projectId,id
])).digest("hex");

function validateId(id,label) {
  if(typeof id!=="string"||!id.trim()||id.length>300||
     /[\x00-\x1f]/.test(id))throw new Error("Invalid "+label);
  return id;
}

export function openForgetRepository(store) {
  const db=store.database;
  function tombstoneExists(kind,scope,id){
    assertScope(scope);
    return Boolean(db.prepare(
      "SELECT 1 FROM memory_tombstones WHERE owner_id=? AND project_id=? AND kind=? AND item_hash=?"
    ).get(scope.ownerId,scope.projectId,kind,hash(kind,scope,id)));
  }
  function insertTombstone(kind,scope,id) {
    db.prepare(
      "INSERT OR IGNORE INTO memory_tombstones(owner_id,project_id,kind,item_hash,created_at) VALUES(?,?,?,?,?)"
    ).run(scope.ownerId,scope.projectId,kind,hash(kind,scope,id),new Date().toISOString());
  }
  function queueExport(scope,id){
    db.prepare("INSERT OR IGNORE INTO memory_cleanup_outbox(owner_id,project_id,note_id,created_at) VALUES(?,?,?,?)").run(scope.ownerId,scope.projectId,id,new Date().toISOString());
  }
  async function removeExports(scope){
    assertScope(scope);
    const pending=db.prepare("SELECT note_id FROM memory_cleanup_outbox WHERE owner_id=? AND project_id=? ORDER BY note_id").all(scope.ownerId,scope.projectId).map(x=>x.note_id);
    const directory=join(dirname(store.databasePath),"notes");
    try {
      const st=await lstat(directory);
      if(!st.isDirectory() || st.isSymbolicLink()) return {removedExports:0,exportCleanupFailures:pending.length,failedNoteIds:pending};
    } catch(err) {
      if(err?.code!=="ENOENT") return {removedExports:0,exportCleanupFailures:pending.length,failedNoteIds:pending};
    }
    const removed=[],errors=[];
    for(const id of pending){
      if(!NOTE_ID.test(id)){errors.push(id);continue;}
      const path=join(directory,id+".md");
      try {
        const st=await lstat(path);
        if(!st.isFile()&&!st.isSymbolicLink()){errors.push(id);continue;}
        await unlink(path);removed.push(id);
      }catch(err){
        if(err?.code==="ENOENT")removed.push(id);
        else errors.push(id);
      }
      if(!errors.includes(id))db.prepare("DELETE FROM memory_cleanup_outbox WHERE owner_id=? AND project_id=? AND note_id=?").run(scope.ownerId,scope.projectId,id);
    }
    return {removedExports:removed.length,exportCleanupFailures:errors.length,failedNoteIds:errors};
  }
  function afterCommit(){
    // secure_delete=ON overwrites SQLite free cells; checkpoint may be busy
    // with other readers. Do not claim physical purging when busy.
    const result=db.prepare("PRAGMA wal_checkpoint(TRUNCATE)").get();
    return {walCheckpointBusy:Boolean(result?.busy)};
  }
  return {
    cleanupPending(scope){assertScope(scope);return Number(db.prepare("SELECT count(*) AS n FROM memory_cleanup_outbox WHERE owner_id=? AND project_id=?").get(scope.ownerId,scope.projectId).n);},
    async drainCleanup(scope){return {...await removeExports(scope),...afterCommit()};},
    isSessionForgotten(sessionId,scope) {
      validateId(sessionId,"session ID");
      if(!scope.sourceNamespace)throw new Error("Explicit sourceNamespace required");
      return tombstoneExists("session",scope,scope.sourceNamespace+"\u0000"+sessionId);
    },
    isNoteForgotten(noteId,scope) {
      if(!NOTE_ID.test(noteId))throw new Error("Invalid Note ID");
      return tombstoneExists("note",scope,noteId);
    },
    async forgetNote(noteId,scope) {
      assertScope(scope);
      if(!NOTE_ID.test(noteId))throw new Error("Invalid Note ID");
      const existing=db.prepare(
        "SELECT id FROM memory_notes WHERE id=? AND owner_id=? AND project_id=?"
      ).get(noteId,scope.ownerId,scope.projectId);
      if(!existing&&!tombstoneExists("note",scope,noteId))
        throw new Error("Note not found in this project");
      store.transaction(()=>{
        insertTombstone("note",scope,noteId);
        queueExport(scope,noteId);
        db.prepare(
          "DELETE FROM memory_notes WHERE id=? AND owner_id=? AND project_id=?"
        ).run(noteId,scope.ownerId,scope.projectId);
      });
      const files=await removeExports(scope);
      return {kind:"note",forgotten:true,noteId,sourcePiUntouched:true,...files,...afterCommit()};
    },
    async forgetSession(sessionId,scope) {
      assertScope(scope);
      validateId(sessionId,"session ID");
      if(!scope.sourceNamespace)throw new Error("Explicit sourceNamespace required");
      const current=store.getSession(scope.sourceNamespace,sessionId);
      if(current&&(current.owner_id!==scope.ownerId||current.project_id!==scope.projectId))
        throw new Error("Session belongs to a different project");
      if(!current&&!this.isSessionForgotten(sessionId,scope))
        throw new Error("Indexed Session not found in this project");
      const dependent=current?db.prepare(
        "SELECT DISTINCT n.id FROM memory_notes n "+
        "JOIN memory_note_evidence ne ON ne.note_id=n.id "+
        "JOIN events e ON e.id=ne.event_id "+
        "WHERE n.owner_id=? AND n.project_id=? AND e.source_namespace=? AND e.session_id=?"
      ).all(scope.ownerId,scope.projectId,scope.sourceNamespace,sessionId).map(x=>x.id):[];
      store.transaction(()=>{
        insertTombstone("session",scope,scope.sourceNamespace+"\u0000"+sessionId);
        for(const id of dependent){
          insertTombstone("note",scope,id);
          queueExport(scope,id);
          db.prepare("DELETE FROM memory_notes WHERE id=? AND owner_id=? AND project_id=?")
            .run(id,scope.ownerId,scope.projectId);
        }
        db.prepare(
          "DELETE FROM events WHERE source_namespace=? AND session_id=? AND owner_id=? AND project_id=?"
        ).run(scope.sourceNamespace,sessionId,scope.ownerId,scope.projectId);
        db.prepare(
          "DELETE FROM sessions WHERE source_namespace=? AND session_id=? AND owner_id=? AND project_id=?"
        ).run(scope.sourceNamespace,sessionId,scope.ownerId,scope.projectId);
      });
      const files=await removeExports(scope);
      return {kind:"session",forgotten:true,sessionId,dependentNotesPurged:dependent.length,
        sourcePiUntouched:true,...files,...afterCommit()};
    }
  };
}
