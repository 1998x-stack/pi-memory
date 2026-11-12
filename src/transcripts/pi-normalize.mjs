/**
 * Canonical event references for P1-03.
 * Avoids persisting plaintext tool output, hidden system prompts, or file paths.
 * Text redaction and SQLite indexing are separate future P1 work.
 */
import { createHash } from "node:crypto";

function sha(text) { return createHash("sha256").update(text).digest("hex"); }
function safeString(input) { return typeof input === "string" ? input : ""; }

/**
 * @param {{header:object,records:Array<{entry:object,offset:number,rawHash:string,line:number}>}} source
 * @param {{sourceNamespace:string, projectId:string}} context
 */
export function normalizePiRecords(source, context) {
  if (!source.header?.id) throw new TypeError("Missing Pi Session header");
  if (!context?.sourceNamespace || !context.projectId) throw new TypeError("Source namespace and project scope required");
  if (source.header.version !== 3) throw new Error("Only Pi Session v3 normalization is currently supported");
  const sessionId = source.header.id;
  return source.records.map(rec => {
    const e = rec.entry;
    const message = e.type === "message" ? e.message : null;
    const toolCalls = message?.role === "assistant" && Array.isArray(message.content)
      ? message.content.filter(x => x?.type === "toolCall").map(x => ({
          toolCallId: safeString(x.id), toolName: safeString(x.name)
        })) : [];
    const stableTuple = [context.sourceNamespace, sessionId, e.id];
    return {
      id: sha(JSON.stringify(stableTuple)),
      sourceNamespace: context.sourceNamespace,
      projectId: context.projectId,
      sessionId,
      entryId: e.id,
      parentId: e.parentId,
      entryType: e.type,
      role: safeString(message?.role) || null,
      toolCallId: safeString(message?.toolCallId) || null,
      toolCalls,
      toolName: safeString(message?.toolName) || null,
      toolError: message?.isError === true,
      rawHash: rec.rawHash,
      sourceOffset: rec.offset,
      sourceLine: rec.line
    };
  });
}
