/**
 * Streaming, non-mutating Pi Session JSONL reader.
 * Incomplete trailing lines are NEVER committed; records retain byte offsets.
 * No automatic indexing, network calls, or persistence is performed.
 */
import { createReadStream } from "node:fs";
import { createHash } from "node:crypto";

export const DEFAULT_MAX_LINE_BYTES = 2 * 1024 * 1024;

/**
 * @param {string} filePath
 * @param {{maxLineBytes?: number, highWaterMark?: number, startOffset?:number, header?:object, initialLineNumber?:number}} [options]
 */
export async function readPiSessionFile(filePath, options = {}) {
  const maxLineBytes = options.maxLineBytes ?? DEFAULT_MAX_LINE_BYTES;
  if (!Number.isSafeInteger(maxLineBytes) || maxLineBytes < 128) throw new RangeError("Invalid maxLineBytes");
  const startOffset = options.startOffset ?? 0;
  if (!Number.isSafeInteger(startOffset) || startOffset < 0) throw new RangeError("Invalid startOffset");
  if (startOffset > 0 && !options.header?.id) throw new Error("Incremental reader requires a previously validated header");
  const header = { value: options.header ?? null };
  const entries = [];
  const records = [];
  const issues = [];
  let pending = [];
  let pendingLength = 0;
  let discardingOversized = false;
  let completeOffset = startOffset;
  let lineNumber = options.initialLineNumber ?? 0;
  let sawRecord = Boolean(options.header);

  function consumeLine() {
    lineNumber += 1;
    const offset = completeOffset;
    completeOffset += pendingLength + 1; // includes LF
    if (discardingOversized) {
      issues.push({ code: "line_too_large", line: lineNumber, offset });
      pending = []; pendingLength = 0; discardingOversized = false;
      return;
    }
    const raw = Buffer.concat(pending, pendingLength);
    pending = []; pendingLength = 0;
    const withoutCR = raw.length && raw[raw.length - 1] === 13 ? raw.subarray(0, -1) : raw;
    let line = withoutCR.toString("utf8");
    if (lineNumber === 1 && line.charCodeAt(0) === 0xfeff) line = line.slice(1);
    if (!line.trim()) return;
    let value;
    try { value = JSON.parse(line); }
    catch {
      issues.push({ code: "invalid_json", line: lineNumber, offset });
      return;
    }
    if (!value || typeof value !== "object" || Array.isArray(value) || typeof value.type !== "string") {
      issues.push({ code: "invalid_entry_shape", line: lineNumber, offset });
      return;
    }
    if (!sawRecord) {
      sawRecord = true;
      if (value.type !== "session" || typeof value.id !== "string" || !value.id) {
        issues.push({ code: "missing_or_invalid_header", line: lineNumber, offset });
        return;
      }
      header.value = value;
      if (value.version !== 3) issues.push({ code: "non_v3_session", line: lineNumber, offset });
      return;
    }
    if (value.type === "session") {
      issues.push({ code: "duplicate_header", line: lineNumber, offset });
      return;
    }
    if (!header.value) {
      issues.push({ code: "entry_without_header", line: lineNumber, offset });
      return;
    }
    if (typeof value.id !== "string" || !value.id ||
        !(value.parentId === null || typeof value.parentId === "string") ||
        typeof value.timestamp !== "string") {
      issues.push({ code: "invalid_tree_entry", line: lineNumber, offset });
      return;
    }
    const record = {
      entry: value,
      offset,
      line: lineNumber,
      bytes: withoutCR.length,
      rawHash: createHash("sha256").update(withoutCR).digest("hex")
    };
    records.push(record);
    entries.push(value);
  }

  const stream = createReadStream(filePath, { start: startOffset, highWaterMark: options.highWaterMark ?? 64 * 1024 });
  for await (const chunk of stream) {
    let start = 0;
    for (;;) {
      const idx = chunk.indexOf(10, start);
      const segment = idx < 0 ? chunk.subarray(start) : chunk.subarray(start, idx);
      pendingLength += segment.length;
      if (!discardingOversized && pendingLength <= maxLineBytes && segment.length) pending.push(segment);
      if (pendingLength > maxLineBytes) { discardingOversized = true; pending = []; }
      if (idx < 0) break;
      consumeLine();
      start = idx + 1;
    }
  }
  if (!header.value) issues.push({ code: "no_valid_header", line: 0, offset: 0 });
  return {
    header: header.value,
    entries,
    records,
    completeOffset,
    completeLines: lineNumber,
    pendingBytes: pendingLength,
    issues
  };
}
