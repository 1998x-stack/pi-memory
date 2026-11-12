/**
 * Opt-in, scope-bound Pi session → SQLite FTS5 indexer.
 *
 * Safety: NEVER writes to source JSONL, and NEVER scans an unapproved path.
 * Source checkpoint advances with DB changes in one SQLite transaction.
 */
import { open, realpath, stat } from "node:fs/promises";
import { relative, isAbsolute, resolve, sep } from "node:path";
import { createHash } from "node:crypto";
import { readPiSessionFile } from "./pi-reader.mjs";
import { normalizePiRecords } from "./pi-normalize.mjs";
import { indexablePiText } from "../security/redact.mjs";
import { assertScope } from "../store/sqlite-store.mjs";

function sha(bytes) { return createHash("sha256").update(bytes).digest("hex"); }

async function validateSourcePath(sourceFile, allowedSessionRoot) {
  if (!allowedSessionRoot || typeof allowedSessionRoot !== "string") {
    throw new Error("allowedSessionRoot must be explicitly supplied");
  }
  const source = await realpath(sourceFile);
  const root = await realpath(allowedSessionRoot);
  const rel = relative(root, source);
  if (rel === ".." || rel.startsWith(".." + sep) || isAbsolute(rel)) {
    throw new Error("Source file is outside permitted Pi Session root");
  }
  if (!source.endsWith(".jsonl")) throw new Error("Not a Pi JSONL Session file");
  return source;
}

async function readHeader(source) {
  const fh = await open(source, "r");
  try {
    const buffer = Buffer.alloc(65536);
    const { bytesRead } = await fh.read(buffer, 0, buffer.length, 0);
    const newline = buffer.subarray(0,bytesRead).indexOf(10);
    if (newline < 0) throw new Error("Pi Session header is incomplete or exceeds 64 KiB");
    let text = buffer.subarray(0,newline).toString("utf8");
    text = text.replace(/^\ufeff/,"").replace(/\r$/,"");
    let header;
    try { header = JSON.parse(text); } catch { throw new Error("Invalid Pi Session header JSON"); }
    if (header?.type !== "session" || typeof header.id !== "string" || !header.id) {
      throw new Error("Pi Session file has invalid header");
    }
    if (header.version !== 3) throw new Error("Pi Session v3 required; legacy format needs explicit migration");
    return header;
  } finally { await fh.close(); }
}

async function anchorMatches(source, previous) {
  if (previous.last_record_offset == null || previous.last_record_bytes == null || !previous.last_record_hash) return false;
  const fh = await open(source, "r");
  try {
    const bytes = Number(previous.last_record_bytes);
    if (!Number.isSafeInteger(bytes) || bytes < 0 || bytes > 2*1024*1024) return false;
    const buffer = Buffer.alloc(bytes);
    const { bytesRead } = await fh.read(buffer, 0, bytes, Number(previous.last_record_offset));
    return bytesRead === bytes && sha(buffer) === previous.last_record_hash;
  } finally { await fh.close(); }
}

/**
 * @param {ReturnType<import('../store/sqlite-store.mjs').openMemoryStore>} store
 * @param {string} inputPath
 * @param {{ownerId:string,projectId:string,sourceNamespace:string,allowedSessionRoot:string,captureApproved:boolean}} options
 */
export async function ingestPiSession(store, inputPath, options) {
  assertScope(options);
  if (options?.captureApproved !== true) throw new Error("Capture is opt-in; project not approved");
  if (typeof options.sourceNamespace !== "string" || !options.sourceNamespace.trim()) {
    throw new Error("sourceNamespace required");
  }
  const source = await validateSourcePath(inputPath, options.allowedSessionRoot);
  const header = await readHeader(source);
  if (options.expectedSessionCwd) {
    const expected = await realpath(options.expectedSessionCwd);
    const sessionCwd = await realpath(header.cwd).catch(() => null);
    if (!sessionCwd || sessionCwd !== expected) {
      throw new Error("Pi Session cwd does not match trusted project scope");
    }
  }
  const before = await stat(source);
  const previous = store.getSession(options.sourceNamespace, header.id);
  if (previous && (previous.owner_id !== options.ownerId || previous.project_id !== options.projectId)) {
    throw new Error("Pi Session scope mismatch: refusing cross-project overwrite");
  }
  if (previous && previous.source_size === before.size &&
      previous.source_mtime_ms === before.mtimeMs &&
      previous.source_file === source &&
      previous.source_ino === String(before.ino) &&
      previous.source_dev === String(before.dev)) {
    return { mode:"unchanged", sessionId:header.id, processed:0, issues:[] };
  }

  const canResume = Boolean(previous &&
    previous.source_file === source &&
    previous.source_size < before.size &&
    previous.last_complete_offset > 0 &&
    previous.source_ino === String(before.ino) &&
    previous.source_dev === String(before.dev) &&
    await anchorMatches(source, previous));
  const mode = canResume ? "incremental" : "full";
  const oldHeader = canResume ? JSON.parse(previous.header_json) : undefined;
  const doc = await readPiSessionFile(source, {
    startOffset: canResume ? Number(previous.last_complete_offset) : 0,
    initialLineNumber: canResume ? Number(previous.last_complete_line) : 0,
    header: oldHeader
  });
  if (!doc.header || doc.header.id !== header.id) throw new Error("Pi Session header changed while indexing");
  const after = await stat(source);
  if (after.size !== before.size || after.mtimeMs !== before.mtimeMs ||
      after.ino !== before.ino || after.dev !== before.dev) {
    throw new Error("Pi Session file changed during ingestion; retry safely");
  }
  const canonical = normalizePiRecords(doc, {
    sourceNamespace: options.sourceNamespace,
    projectId: options.projectId
  });
  const last = doc.records.at(-1);
  const state = {
    sourceNamespace:options.sourceNamespace,sessionId:header.id,
    ownerId:options.ownerId,projectId:options.projectId,sourceFile:source,
    header,completeOffset:doc.completeOffset,completeLines:doc.completeLines,
    sourceSize:after.size,sourceMtimeMs:after.mtimeMs,sourceDev:after.dev,sourceIno:after.ino,
    lastRecordOffset:last?.offset ?? (canResume ? previous.last_record_offset : null),
    lastRecordBytes:last?.bytes ?? (canResume ? previous.last_record_bytes : null),
    lastRecordHash:last?.rawHash ?? (canResume ? previous.last_record_hash : null)
  };
  // Ensure event ingestion, FTS triggers and durable checkpoint commit together.
  store.transaction(() => {
    store.checkCheckpoint(options.sourceNamespace,header.id,previous);
    if (mode === "full") store.deleteSessionEvents(options.sourceNamespace,header.id);
    for (let i=0;i<canonical.length;i++) {
      const event=canonical[i];
      const raw=doc.records[i].entry;
      const snippet=indexablePiText(raw);
      store.putEvent(event,snippet,options);
    }
    store.saveSession(state);
  });
  return {
    mode,sessionId:header.id,processed:canonical.length,
    completeOffset:doc.completeOffset,pendingBytes:doc.pendingBytes,
    issues:doc.issues
  };
}
