/**
 * Conservative pre-index text filtering.
 * NOT a complete DLP guarantee: keep this filter before, never after, FTS.
 */
const patterns = [
  /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----[\s\S]*?-----END (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/g,
  /\b(?:sk-(?:proj-)?[A-Za-z0-9_-]{12,}|ghp_[A-Za-z0-9]{12,}|github_pat_[A-Za-z0-9_]{12,}|AKIA[0-9A-Z]{16})\b/g,
  /\b(Bearer\s+)[A-Za-z0-9._~+\/-]{10,}={0,2}/gi,
  /\b([A-Z][A-Z0-9_]*(?:TOKEN|KEY|SECRET|PASSWORD|CREDENTIAL)[A-Z0-9_]*)\s*[:=]\s*("[^"]*"|'[^']*'|[^\s,;]+)/gi
];

export function redactSecrets(text) {
  if (typeof text !== "string") return "";
  let cleaned = text;
  cleaned = cleaned.replace(patterns[0], "[REDACTED_PRIVATE_KEY]");
  cleaned = cleaned.replace(patterns[1], "[REDACTED_SECRET]");
  cleaned = cleaned.replace(patterns[2], "$1[REDACTED_SECRET]");
  cleaned = cleaned.replace(patterns[3], "$1=[REDACTED_SECRET]");
  return cleaned;
}

export function indexablePiText(entry, { maxChars = 6000 } = {}) {
  if (entry?.type !== "message") return "";
  const role = entry.message?.role;
  // Never index system instructions, arbitrary custom memory messages, or tool arguments.
  if (!["user","assistant","toolResult"].includes(role)) return "";
  const content = entry.message.content;
  let text = "";
  if (typeof content === "string") text = content;
  else if (Array.isArray(content)) {
    text = content.filter(b => b?.type === "text" && typeof b.text === "string")
      .map(b => b.text).join("\n");
  }
  // Redact BEFORE truncating: don't leave secret fragments at truncation edges.
  return redactSecrets(text).slice(0, maxChars);
}
