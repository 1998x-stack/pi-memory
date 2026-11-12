/**
 * Reconcile deleted native Pi Session files against explicitly authorized scope.
 * Never delete the user's original Session file. Keep all writes in one DB txn.
 */
import { stat } from "node:fs/promises";
import { relative, isAbsolute, sep } from "node:path";
import { realpath } from "node:fs/promises";
import { assertScope } from "./sqlite-store.mjs";

export async function reconcileMissingSessions(store, options) {
  assertScope(options);
  if (!options?.sourceNamespace || !options?.allowedSessionRoot) throw new Error("Explicit source namespace and session root required");
  const root = await realpath(options.allowedSessionRoot);
  const known = store.listSessions(options, options.sourceNamespace);
  const missing = [];
  let unverified = 0;
  for (const session of known) {
    const rel = relative(root,session.source_file);
    if (rel === ".." || rel.startsWith(".." + sep) || isAbsolute(rel)) {
      // Don't follow suspicious, now-outside-root paths; redact from search.
      missing.push(session); continue;
    }
    try {
      const current = await realpath(session.source_file);
      const nowRel = relative(root,current);
      if (current !== session.source_file || nowRel === ".." || nowRel.startsWith(".." + sep) || isAbsolute(nowRel)) {
        missing.push(session);
        continue;
      }
      const file = await stat(session.source_file);
      if (!file.isFile()) missing.push(session);
    } catch(e) {
      if (e?.code === "ENOENT") missing.push(session);
      else unverified++; // EACCES or transient error is not proof of deletion.
    }
  }
  if (missing.length) {
    store.transaction(() => {
      for (const s of missing) store.pruneMissingSession(options,options.sourceNamespace,s.session_id);
    });
  }
  return { checked: known.length, removed: missing.length, unverified };
}
