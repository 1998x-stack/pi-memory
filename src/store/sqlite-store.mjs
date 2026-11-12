/**
 * Local-first P1 SQLite FTS5 store. Designed for explicit trusted scope only.
 * node:sqlite is currently experimental on Node 22; verify host compatibility.
 */
import { DatabaseSync } from "node:sqlite";
import { mkdirSync, chmodSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { homedir } from "node:os";

const SCHEMA = [
  "PRAGMA journal_mode=WAL;",
  "PRAGMA busy_timeout=5000;",
  "PRAGMA foreign_keys=ON;",
  "CREATE TABLE IF NOT EXISTS sessions (source_namespace TEXT NOT NULL, session_id TEXT NOT NULL, owner_id TEXT NOT NULL, project_id TEXT NOT NULL, source_file TEXT NOT NULL, header_json TEXT NOT NULL, last_complete_offset INTEGER NOT NULL, last_complete_line INTEGER NOT NULL, source_size INTEGER NOT NULL, source_mtime_ms REAL NOT NULL, source_dev TEXT NOT NULL, source_ino TEXT NOT NULL, last_record_offset INTEGER, last_record_bytes INTEGER, last_record_hash TEXT, updated_at TEXT NOT NULL, PRIMARY KEY (source_namespace,session_id));",
  "CREATE TABLE IF NOT EXISTS events (id TEXT PRIMARY KEY, source_namespace TEXT NOT NULL, session_id TEXT NOT NULL, entry_id TEXT NOT NULL, parent_id TEXT, owner_id TEXT NOT NULL, project_id TEXT NOT NULL, entry_type TEXT NOT NULL, role TEXT, tool_call_id TEXT, tool_name TEXT, is_error INTEGER NOT NULL DEFAULT 0, raw_hash TEXT NOT NULL, source_offset INTEGER NOT NULL, source_line INTEGER NOT NULL, snippet TEXT NOT NULL DEFAULT '', UNIQUE(source_namespace,session_id,entry_id));",
  "CREATE INDEX IF NOT EXISTS events_scope ON events(owner_id,project_id,source_namespace,session_id);",
  "CREATE VIRTUAL TABLE IF NOT EXISTS events_fts USING fts5(snippet,content='events',content_rowid='rowid');",
  "CREATE TRIGGER IF NOT EXISTS events_fts_insert AFTER INSERT ON events BEGIN INSERT INTO events_fts(rowid,snippet) VALUES (new.rowid,new.snippet); END;",
  "CREATE TRIGGER IF NOT EXISTS events_fts_delete AFTER DELETE ON events BEGIN INSERT INTO events_fts(events_fts,rowid,snippet) VALUES ('delete',old.rowid,old.snippet); END;",
  "CREATE TRIGGER IF NOT EXISTS events_fts_update AFTER UPDATE ON events BEGIN INSERT INTO events_fts(events_fts,rowid,snippet) VALUES ('delete',old.rowid,old.snippet); INSERT INTO events_fts(rowid,snippet) VALUES (new.rowid,new.snippet); END;",
  "CREATE TABLE IF NOT EXISTS memory_notes (id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, project_id TEXT NOT NULL, status TEXT NOT NULL CHECK (status IN ('candidate','verified','disputed','revoked')), note_type TEXT NOT NULL CHECK (note_type IN ('fact','procedure','decision','preference','failure')), title TEXT NOT NULL, content TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, verified_at TEXT, revision INTEGER NOT NULL DEFAULT 1, source_trust TEXT NOT NULL DEFAULT 'user_explicit');",
  "CREATE INDEX IF NOT EXISTS memory_notes_scope ON memory_notes(owner_id,project_id,status);",
  "CREATE TABLE IF NOT EXISTS memory_note_evidence (note_id TEXT NOT NULL REFERENCES memory_notes(id) ON DELETE CASCADE, event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE, source_hash TEXT NOT NULL, PRIMARY KEY (note_id,event_id));",
  "CREATE TABLE IF NOT EXISTS memory_project_settings (owner_id TEXT NOT NULL, project_id TEXT NOT NULL, l4_enabled INTEGER NOT NULL DEFAULT 0, l4_runs INTEGER NOT NULL DEFAULT 0, l4_changes INTEGER NOT NULL DEFAULT 0, l4_last_hash TEXT, l4_last_bytes INTEGER NOT NULL DEFAULT 0, PRIMARY KEY(owner_id,project_id));"
].join("\n");

export function defaultMemoryDatabasePath() {
  const dir = process.env.PI_CODING_AGENT_DIR ?? join(homedir(), ".pi", "agent");
  return join(dir, "memory", "pi-memory.sqlite");
}

export function openMemoryStore(databasePath = defaultMemoryDatabasePath()) {
  mkdirSync(dirname(databasePath), { recursive: true, mode: 0o700 });
  const db = new DatabaseSync(databasePath);
  try {
    chmodSync(databasePath, 0o600); // protect contents from other local users
  } catch { /* Windows filesystems may not support POSIX modes */ }
  db.exec(SCHEMA);
  const getSessionStatement = db.prepare("SELECT * FROM sessions WHERE source_namespace=? AND session_id=?");
  const upsertSessionStatement = db.prepare(
    "INSERT INTO sessions (source_namespace,session_id,owner_id,project_id,source_file,header_json,last_complete_offset,last_complete_line,source_size,source_mtime_ms,source_dev,source_ino,last_record_offset,last_record_bytes,last_record_hash,updated_at) " +
    "VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) " +
    "ON CONFLICT(source_namespace,session_id) DO UPDATE SET owner_id=excluded.owner_id,project_id=excluded.project_id,source_file=excluded.source_file,header_json=excluded.header_json,last_complete_offset=excluded.last_complete_offset,last_complete_line=excluded.last_complete_line,source_size=excluded.source_size,source_mtime_ms=excluded.source_mtime_ms,source_dev=excluded.source_dev,source_ino=excluded.source_ino,last_record_offset=excluded.last_record_offset,last_record_bytes=excluded.last_record_bytes,last_record_hash=excluded.last_record_hash,updated_at=excluded.updated_at"
  );
  const upsertEventStatement = db.prepare(
    "INSERT INTO events (id,source_namespace,session_id,entry_id,parent_id,owner_id,project_id,entry_type,role,tool_call_id,tool_name,is_error,raw_hash,source_offset,source_line,snippet) " +
    "VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) " +
    "ON CONFLICT(id) DO UPDATE SET parent_id=excluded.parent_id,entry_type=excluded.entry_type,role=excluded.role,tool_call_id=excluded.tool_call_id,tool_name=excluded.tool_name,is_error=excluded.is_error,raw_hash=excluded.raw_hash,source_offset=excluded.source_offset,source_line=excluded.source_line,snippet=excluded.snippet"
  );
  return {
    databasePath,
    // Internal only. Notes and integrity repos share this handle for atomic transactions.
    database: db,
    getSession(namespace, sessionId) { return getSessionStatement.get(namespace, sessionId) ?? null; },
    saveSession(state) {
      return upsertSessionStatement.run(
        state.sourceNamespace,state.sessionId,state.ownerId,state.projectId,state.sourceFile,
        JSON.stringify(state.header),state.completeOffset,state.completeLines,state.sourceSize,
        state.sourceMtimeMs,String(state.sourceDev),String(state.sourceIno),
        state.lastRecordOffset ?? null,state.lastRecordBytes ?? null,state.lastRecordHash ?? null,
        new Date().toISOString()
      );
    },
    putEvent(event, snippet, scope) {
      return upsertEventStatement.run(
        event.id,event.sourceNamespace,event.sessionId,event.entryId,event.parentId,
        scope.ownerId,scope.projectId,event.entryType,event.role,event.toolCallId,event.toolName,
        event.toolError ? 1 : 0,event.rawHash,event.sourceOffset,event.sourceLine,snippet
      );
    },
    deleteSessionEvents(namespace, sessionId) {
      return db.prepare("DELETE FROM events WHERE source_namespace=? AND session_id=?").run(namespace, sessionId);
    },
    listSessions(scope, namespace) {
      assertScope(scope);
      return db.prepare("SELECT * FROM sessions WHERE owner_id=? AND project_id=? AND source_namespace=?")
        .all(scope.ownerId, scope.projectId, namespace);
    },
    checkCheckpoint(namespace, sessionId, expected) {
      const current = getSessionStatement.get(namespace,sessionId) ?? null;
      const old = expected ?? null;
      // Used *inside* BEGIN IMMEDIATE. Reject stale parse results from racing writers.
      if (!old && !current) return;
      if (!old || !current || current.last_complete_offset !== old.last_complete_offset ||
          current.source_size !== old.source_size ||
          current.source_mtime_ms !== old.source_mtime_ms ||
          current.source_ino !== old.source_ino || current.source_file !== old.source_file) {
        const err = new Error("Concurrent ingestion conflict; retry with a fresh checkpoint");
        err.code = "INGESTION_CONFLICT";
        throw err;
      }
    },
    pruneMissingSession(scope, namespace, sessionId) {
      assertScope(scope);
      const current = getSessionStatement.get(namespace,sessionId);
      if (!current || current.owner_id !== scope.ownerId || current.project_id !== scope.projectId) return false;
      // A deleted raw source invalidates every approved note depending on it.
      const sql = "UPDATE memory_notes SET status='disputed',updated_at=?,verified_at=NULL,revision=revision+1 WHERE status='verified' AND owner_id=? AND project_id=? AND id IN (SELECT ne.note_id FROM memory_note_evidence ne JOIN events e ON e.id=ne.event_id WHERE e.source_namespace=? AND e.session_id=?)";
      db.prepare(sql).run(new Date().toISOString(),scope.ownerId,scope.projectId,namespace,sessionId);
      this.deleteSessionEvents(namespace,sessionId);
      db.prepare("DELETE FROM sessions WHERE source_namespace=? AND session_id=? AND owner_id=? AND project_id=?")
        .run(namespace,sessionId,scope.ownerId,scope.projectId);
      return true;
    },
    verifyIndex() {
      const check = db.prepare("PRAGMA quick_check").get();
      if (!check || Object.values(check)[0] !== "ok") throw new Error("SQLite integrity check failed");
      db.prepare("INSERT INTO events_fts(events_fts) VALUES ('integrity-check')").run();
      return true;
    },
    rebuildFts() {
      return this.transaction(() => {
        db.prepare("INSERT INTO events_fts(events_fts) VALUES ('rebuild')").run();
        this.verifyIndex();
      });
    },
    countEvents(scope) {
      assertScope(scope);
      return Number(db.prepare("SELECT count(*) AS n FROM events WHERE owner_id=? AND project_id=?")
        .get(scope.ownerId,scope.projectId).n);
    },
    search(query, scope, limit=5) {
      assertScope(scope);
      if (typeof query !== "string" || !query.trim() || query.length > 256) throw new Error("Invalid search query");
      const bounded = Number.isInteger(limit) ? Math.min(20, Math.max(1, limit)) : 5;
      const tokens = query.match(/[\p{L}\p{N}_./:-]+/gu)?.slice(0, 8) ?? [];
      if (!tokens.length) return [];
      // Quoted phrases avoid raw FTS query operators and error-prone user syntax.
      const match = tokens.map(t => '"' + t.replaceAll('"','') + '"').join(" AND ");
      const rows = db.prepare(
        "SELECT e.id,e.source_namespace,e.session_id,e.entry_id,e.entry_type,e.role,e.tool_name,e.is_error,e.raw_hash,e.snippet,s.source_file,bm25(events_fts) AS rank " +
        "FROM events_fts JOIN events e ON events_fts.rowid=e.rowid JOIN sessions s ON s.source_namespace=e.source_namespace AND s.session_id=e.session_id " +
        "WHERE events_fts MATCH ? AND e.owner_id=? AND e.project_id=? " +
        "ORDER BY rank ASC LIMIT ?"
      ).all(match,scope.ownerId,scope.projectId,bounded);
      // Fail closed on missing native Pi sources even before scheduled reconciliation.
      return rows.filter(r => {
        try { return statSync(r.source_file).isFile(); } catch { return false; }
      }).map(r => ({
        id:r.id,sourceNamespace:r.source_namespace,sessionId:r.session_id,
        entryId:r.entry_id,layer:"transcript",status:"raw",
        entryType:r.entry_type,role:r.role,toolName:r.tool_name,
        isError:Boolean(r.is_error),sourceHash:r.raw_hash,
        snippet:r.snippet.slice(0,500),rank:r.rank
      }));
    },
    transaction(task) {
      db.exec("BEGIN IMMEDIATE");
      try {
        const result = task();
        if (result && typeof result.then === "function") throw new Error("SQLite transaction callback must be synchronous");
        db.exec("COMMIT"); return result;
      }
      catch(err) { db.exec("ROLLBACK"); throw err; }
    },
    close(){ db.close(); }
  };
}

export function assertScope(scope) {
  if (!scope || typeof scope.ownerId !== "string" || !scope.ownerId.trim() ||
      typeof scope.projectId !== "string" || !scope.projectId.trim()) {
    throw new Error("Explicit ownerId and projectId are required");
  }
}
