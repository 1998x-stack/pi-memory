/**
 * Pi JSONL tree integrity and selected-leaf navigation.
 * A file's last entry is an INFERRED leaf, not a guarantee about a transient
 * SessionManager.branch() selection observed in the running Pi process.
 */

/** @param {Array<{id:string,parentId:string|null}>} entries */
export function validateLineage(entries) {
  const byId = new Map();
  const issues = [];
  for (const entry of entries) {
    if (byId.has(entry.id)) {
      issues.push({ code: "duplicate_entry_id", entryId: entry.id });
      continue;
    }
    byId.set(entry.id, entry);
  }
  for (const entry of byId.values()) {
    if (entry.parentId !== null && !byId.has(entry.parentId)) {
      issues.push({ code: "missing_parent", entryId: entry.id, parentId: entry.parentId });
    }
  }
  const states = new Map();
  const reported = new Set();
  for (const root of byId.values()) {
    if (states.get(root.id) === 2) continue;
    let current = root;
    const chain = [];
    while (current && !states.has(current.id)) {
      states.set(current.id, 1);
      chain.push(current.id);
      current = current.parentId ? byId.get(current.parentId) : null;
    }
    if (current && states.get(current.id) === 1 && !reported.has(current.id)) {
      issues.push({ code: "cycle", entryId: current.id });
      reported.add(current.id);
    }
    for (const id of chain) states.set(id, 2);
  }
  return { byId, issues };
}

/**
 * @param {Array<{id:string,parentId:string|null}>} entries
 * @param {{leafId?: string|null, observed?: boolean}} [options]
 */
export function selectPiBranch(entries, options = {}) {
  const { byId, issues } = validateLineage(entries);
  const explicit = Object.hasOwn(options, "leafId");
  const leafId = explicit ? options.leafId : entries.at(-1)?.id ?? null;
  if (leafId === null) {
    return { path: [], leafId: null, leafSource: explicit ? "specified" : "inferred", issues };
  }
  if (typeof leafId !== "string" || !byId.has(leafId)) {
    throw new Error("Unknown Pi session leaf: " + String(leafId));
  }
  const path = [];
  const seen = new Set();
  let entry = byId.get(leafId);
  while (entry) {
    if (seen.has(entry.id)) throw new Error("Cycle in active Pi branch at entry " + entry.id);
    seen.add(entry.id);
    path.push(entry);
    if (entry.parentId && !byId.has(entry.parentId)) {
      throw new Error("Missing parent in Pi branch: " + entry.parentId);
    }
    entry = entry.parentId ? byId.get(entry.parentId) : null;
  }
  path.reverse();
  return {
    path,
    leafId,
    leafSource: options.observed ? "observed" : explicit ? "specified" : "inferred",
    issues
  };
}
