/**
 * Pi v3 session projection aligned to session-manager.ts at upstream
 * a40abecaaf39e5a11e6c4850ee5cd8ecda4958cc.
 * Raw source entries are kept separately and are never mutated by context_edit.
 */
import { selectPiBranch } from "./pi-lineage.mjs";

function toMessages(entry) {
  if (entry.type === "message") {
    if (!entry.message || typeof entry.message.role !== "string") return [];
    const m = entry.message;
    if (m.content == null) {
      if (m.role === "system") return [{ ...m, content: "" }];
      if (m.role === "user" || m.role === "assistant" || m.role === "toolResult") return [{ ...m, content: [] }];
    }
    return [m];
  }
  if (entry.type === "compaction") {
    const msg = { role: "compactionSummary", summary: entry.summary,
      tokensBefore: entry.tokensBefore, timestamp: Date.parse(entry.timestamp) };
    return entry.systemMessage ? [entry.systemMessage, msg] : [msg];
  }
  if (entry.type === "branch_summary" && entry.summary) {
    return [{ role: "branchSummary", summary: entry.summary,
      fromId: entry.fromId, timestamp: Date.parse(entry.timestamp) }];
  }
  if (entry.type === "custom_message") {
    return [{ role: "custom", customType: entry.customType,
      content: entry.content ?? [], display: entry.display,
      details: entry.details, timestamp: Date.parse(entry.timestamp) }];
  }
  return [];
}

function applyEdit(entry, edit) {
  const messages = toMessages(entry);
  if (!edit) return messages;
  if (edit.replacement === null) return [];
  if (!edit.replacement || !Object.hasOwn(edit.replacement, "content")) return messages;
  return messages.map(msg => {
    if (!["user", "assistant", "toolResult", "custom"].includes(msg.role)) return msg;
    let content = edit.replacement.content;
    if (typeof content === "string" && ["assistant", "toolResult"].includes(msg.role)) {
      content = [{ type: "text", text: content }];
    }
    return { ...msg, content };
  });
}

/**
 * @param {Array<object>} entries
 * @param {{leafId?:string|null, observed?:boolean}} [options]
 */
export function projectPiSession(entries, options = {}) {
  const branch = selectPiBranch(entries, options);
  const path = branch.path;
  let model = null;
  let thinkingLevel = "off";
  for (const entry of path) {
    if (entry.type === "model_change") model = { provider: entry.provider, modelId: entry.modelId };
    else if (entry.type === "thinking_level_change") thinkingLevel = entry.thinkingLevel;
    else if (entry.type === "message" && entry.message?.role === "assistant") {
      model = { provider: entry.message.provider, modelId: entry.message.model };
    }
  }

  // Pi keeps the most recent compaction in the selected tree path.
  const compactionIdx = path.findLastIndex(e => e.type === "compaction");
  let contextEntries = path;
  const warnings = [...branch.issues];
  if (compactionIdx >= 0) {
    const compaction = path[compactionIdx];
    const kept = [];
    let retain = false;
    for (const entry of path.slice(0, compactionIdx)) {
      if (entry.id === compaction.firstKeptEntryId) retain = true;
      if (retain && !(entry.type === "message" && entry.message?.role === "system")) kept.push(entry);
    }
    // A self-retaining compaction uses its own ID to keep nothing before it.
    if (!retain && compaction.firstKeptEntryId !== compaction.id) {
      warnings.push({ code: "missing_first_kept_entry", entryId: compaction.id, targetId: compaction.firstKeptEntryId });
    }
    contextEntries = [compaction, ...kept, ...path.slice(compactionIdx + 1)];
  }

  const edits = new Map();
  for (const e of contextEntries) {
    if (e.type === "context_edit") edits.set(e.targetId, e);
  }
  const projectedEntries = contextEntries.map((sourceEntry, index) => ({
    sourceEntry,
    // Older compaction entries can be retained, but do not emit a second summary.
    messages: sourceEntry.type === "compaction" && index !== 0
      ? [] : applyEdit(sourceEntry, edits.get(sourceEntry.id))
  }));
  return {
    leafId: branch.leafId,
    leafSource: branch.leafSource,
    pathEntryIds: path.map(e => e.id),
    contextEntryIds: contextEntries.map(e => e.id),
    projectedEntries,
    messages: projectedEntries.flatMap(x => x.messages),
    model,
    thinkingLevel,
    warnings
  };
}
