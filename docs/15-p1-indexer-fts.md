# P1-05/P1-06 — Scoped incremental SQLite FTS5 baseline

**Implemented prototype**, not yet declared production-safe. Uses Node's built-in `node:sqlite` (experimental on Node 22) to avoid native package ABI duplication. Verify bundled Pi/Windows/Bun support before broad compatibility claims.

## Flow

```text
explicit trusted-session path and owner/project scope
 → realpath allowlist and opt-in capture permission
 → Pi v3 header validation
 → read existing session checkpoint
 → unchanged / append-only incremental / full reconciliation
 → streaming parser + stable canonical event ID
 → pre-index text redaction (system/tool args excluded)
 → SQLite transaction:
      append-only or replace source events
      FTS5 insert/update/delete triggers
      checkpoint and mtime/size/record-anchor metadata
 → scoped FTS query (returns raw historical evidence, not verified Memory)
```

## Invariants

- A session never crosses owner/project scope via update or search.
- `(namespace,session_id,entry_id)` determines stable event identity; content hashes detect changes.
- Database writes, external-content FTS triggers and ingestion cursor share one SQLite transaction.
- The partial final JSONL line is not indexed or marked consumed.
- Same-size rewrites trigger full reconciliation; increasing files verify last stored record anchor before incremental append.
- Realpath scope denies traversals and symlink escapes.
- System messages, arbitrary custom entries and tool arguments are never indexed as text.
- Basic secret-pattern redaction is defense in depth, **not complete DLP**. Never assume all sensitive content is detected.
- `memory_search` Extension **is now registered** and `/pi-memory index` is implemented in follow-up stage. Manual Notes, branch journal and Dreaming remain incomplete; see [live Pi recall](16-p1-live-recall.md).

## Next hardening needs

- Pi source files could be rewritten in the middle while preserving last anchor + file length increases; periodic full reconciliation or stronger file fingerprint required.
- Source deletion/orphaning requires a reconciler and evidence downgrade policy.
- Multiple processes concurrently ingesting the same path need a lock/lease protocol.
- SQLite per-Node ABI/binary compatibility matrix; alternatives if `node:sqlite` unavailable.
- Full source-provenance audit and no-stdout/secret leakage during RPC.
- FTS exact code symbols ranking and quality benchmark vs linear search.

Tests are in `tests/store/pi-indexer.test.mjs`; `npm test` runs model-free deterministic tests.
