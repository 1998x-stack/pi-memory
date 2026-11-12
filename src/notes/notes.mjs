/**
 * L2 manual Notes. SQLite is authoritative; Markdown is an optional derived export.
 * Every approved Note has real, current, project-scoped Pi event evidence.
 * User approval is an explicit command; the LLM cannot mutate status.
 */
import { randomUUID } from "node:crypto";
import { sourceEventStillValid } from "../security/source-proof.mjs";
export { sourceEventStillValid } from "../security/source-proof.mjs";
import { assertScope } from "../store/sqlite-store.mjs";
import { redactSecrets } from "../security/redact.mjs";

const validTypes = new Set(["fact","procedure","decision","preference","failure"]);
const idPattern = /^mem_[0-9a-f-]{36}$/i;

function requireText(v, field, max) {
  if (typeof v !== "string" || !v.trim() || v.length > max || /[\x00-\x08\x0B\x0E-\x1F]/.test(v)) {
    throw new Error("Invalid "+field+" (1–"+max+" printable characters)");
  }
  return redactSecrets(v.trim());
}

const selectEvidenceSql =
  "SELECT ne.event_id,ne.source_hash,e.raw_hash,e.session_id,e.entry_id,e.source_offset,s.source_file " +
  "FROM memory_note_evidence ne LEFT JOIN events e ON e.id=ne.event_id " +
  "LEFT JOIN sessions s ON s.source_namespace=e.source_namespace AND s.session_id=e.session_id " +
  "WHERE ne.note_id=? ORDER BY ne.event_id";

function evidenceComplete(db, note) {
  const records=db.prepare(selectEvidenceSql).all(note.id);
  if (!note.evidence_count || records.length !== note.evidence_count) return false;
  return records.every(e => e.raw_hash === e.source_hash && sourceEventStillValid(e));
}

export function openNoteRepository(store) {
  const db=store.database;
  function get(id,scope) {
    assertScope(scope);
    if (!idPattern.test(id)) throw new Error("Invalid Note ID");
    const note=db.prepare("SELECT * FROM memory_notes WHERE id=? AND owner_id=? AND project_id=?")
      .get(id,scope.ownerId,scope.projectId);
    return note ?? null;
  }
  function findEvidence(sessionId,entryId,scope) {
    const row=db.prepare(
      "SELECT e.id,e.raw_hash,e.session_id,e.entry_id,e.source_offset,s.source_file " +
      "FROM events e JOIN sessions s ON s.source_namespace=e.source_namespace AND s.session_id=e.session_id " +
      "WHERE e.owner_id=? AND e.project_id=? AND e.source_namespace=? AND e.session_id=? AND e.entry_id=?"
    ).get(scope.ownerId,scope.projectId,scope.sourceNamespace,sessionId,entryId);
    if (!row || !sourceEventStillValid(row)) throw new Error("Evidence not available or source has changed; reindex first");
    return row;
  }
  return {
    createCandidate({type,title,content,evidence},scope) {
      assertScope(scope);
      if (!scope.sourceNamespace) throw new Error("Source namespace required");
      if (!validTypes.has(type)) throw new Error("Unsupported note type");
      title=requireText(title,"title",160);
      content=requireText(content,"content",4000);
      if (!Array.isArray(evidence) || evidence.length<1 || evidence.length>10) throw new Error("Evidence is required");
      const unique=new Set(evidence.map(e=>e.sessionId+"#"+e.entryId));
      if (unique.size!==evidence.length) throw new Error("Duplicate evidence");
      const matched=evidence.map(e=>{
        if(typeof e?.sessionId!=="string"||typeof e.entryId!=="string")throw new Error("Evidence ref must include sessionId and entryId");
        return findEvidence(e.sessionId,e.entryId,scope);
      });
      const id="mem_"+randomUUID(), now=new Date().toISOString();
      store.transaction(()=>{
        db.prepare(
          "INSERT INTO memory_notes(id,owner_id,project_id,status,note_type,title,content,created_at,updated_at,revision,evidence_count,source_trust) " +
          "VALUES (?,?,?,'candidate',?,?,?,?,?,1,?,'user_explicit')"
        ).run(id,scope.ownerId,scope.projectId,type,title,content,now,now,matched.length);
        for (const e of matched) db.prepare(
          "INSERT INTO memory_note_evidence(note_id,event_id,source_hash) VALUES (?,?,?)"
        ).run(id,e.id,e.raw_hash);
      });
      return {id,status:"candidate",revision:1};
    },
    get(id,scope) {
      const note=get(id,scope);
      if(!note)return null;
      const refs=db.prepare(selectEvidenceSql).all(id);
      return {
        id:note.id,type:note.note_type,status:note.status,
        title:note.title,content:note.content,revision:note.revision,
        createdAt:note.created_at,updatedAt:note.updated_at,verifiedAt:note.verified_at,
        sourceTrust:note.source_trust,evidenceComplete:evidenceComplete(db,note),
        evidence:refs.map(e=>({sessionId:e.session_id,entryId:e.entry_id,sourceHash:e.source_hash}))
      };
    },
    list(scope) {
      assertScope(scope);
      return db.prepare(
        "SELECT id,status,note_type AS type,title,revision,created_at AS createdAt,updated_at AS updatedAt FROM memory_notes " +
        "WHERE owner_id=? AND project_id=? ORDER BY updated_at DESC,id LIMIT 100"
      ).all(scope.ownerId,scope.projectId);
    },
    approve(id,scope,expectedRevision) {
      const note=get(id,scope);
      if (!note) throw new Error("Note not found in this project");
      if (note.status!=="candidate"&&note.status!=="disputed") throw new Error("Only candidate/disputed Notes may be approved");
      if (expectedRevision!=null&&note.revision!==expectedRevision) throw new Error("Note revision conflict");
      if (!evidenceComplete(db,note)) throw new Error("Evidence is missing/modified; reindex and revalidate");
      return store.transaction(()=>{
        // Re-check inside the locked transaction so concurrent writers cannot change refs.
        const current=get(id,scope);
        if(!current||current.revision!==note.revision||!evidenceComplete(db,current)) throw new Error("Concurrent Note update or evidence changed");
        const now=new Date().toISOString();
        db.prepare(
          "UPDATE memory_notes SET status='verified',source_trust='human_reviewed',verified_at=?,updated_at=?,revision=revision+1 " +
          "WHERE id=? AND owner_id=? AND project_id=?"
        ).run(now,now,id,scope.ownerId,scope.projectId);
        return {id,status:"verified",revision:note.revision+1};
      });
    },
    revoke(id,scope) {
      const note=get(id,scope);
      if (!note) throw new Error("Note not found in this project");
      if (note.status==="revoked") return {id,status:"revoked",revision:note.revision};
      return store.transaction(()=>{
        const current=get(id,scope);
        if(!current)throw new Error("Note not found");
        db.prepare(
          "UPDATE memory_notes SET status='revoked',verified_at=NULL,updated_at=?,revision=revision+1 WHERE id=? AND owner_id=? AND project_id=?"
        ).run(new Date().toISOString(),id,scope.ownerId,scope.projectId);
        return {id,status:"revoked",revision:current.revision+1};
      });
    },
    /** Only stable non-user text fields are exposed to the privileged L4 index. */
    approvedIndex(scope,limit=16) {
      assertScope(scope);
      const rows=db.prepare(
        "SELECT * FROM memory_notes WHERE owner_id=? AND project_id=? AND status='verified' ORDER BY verified_at DESC,id ASC LIMIT ?"
      ).all(scope.ownerId,scope.projectId,Math.min(50,Math.max(1,limit)));
      return rows.filter(note=>evidenceComplete(db,note)).map(note=>({
        id:note.id,type:note.note_type,revision:note.revision,evidenceCount:note.evidence_count
      }));
    }
  };
}

export function noteToMarkdown(note) {
  if (!note) throw new Error("Note missing");
  const clean = s => String(s).replaceAll("\r","").replaceAll("\u0000","");
  // Derived export only, not a file format parsed back into the database.
  return [
    "---",
    "schema_version: 1.0.0",
    "id: "+note.id,
    "status: "+note.status,
    "type: "+note.type,
    "revision: "+note.revision,
    "source_trust: "+note.sourceTrust,
    "---",
    "",
    "# "+clean(note.title).replaceAll("\n"," "),
    "",
    clean(note.content),
    "",
    "## Evidence",
    ...note.evidence.map(e => "- "+String(e.sessionId)+"#"+String(e.entryId)+" (sha256:"+String(e.sourceHash)+")"),
    "",
  ].join("\n");
}
