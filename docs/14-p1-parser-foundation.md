# P1-01–P1-04: tested Pi Session parser foundation

These modules implement a deliberately **read-only** first slice of P1: streaming JSONL parsing, Pi v3 tree lineage, compaction/context-edit projection, and stable canonical source metadata. They are NOT yet an installed memory engine, FTS index, or memory_search tool.

## Contract

- `readPiSessionFile(path)` returns header, raw entries, record offsets/hashes, completed byte cursor, pending bytes and non-secret issue codes.
- `selectPiBranch(entries,{leafId,observed})` selects explicit leaf or last-file-entry inferred leaf; missing leaf/parent or cycle on selected path throws.
- `projectPiSession(entries,{leafId})` projects latest compaction, retained entries, and branch-relative context edits; old raw content is unchanged.
- `normalizePiRecords(reader, {sourceNamespace,projectId})` produces stable IDs with no raw user/tool text; `rawHash` detects per-entry content changes without changing identity.

## Non-goals / boundary

- No automatic v1/v2 migration. Pi itself migrates on load, but P1 adapter currently warns `non_v3_session` and normalization rejects until an explicit compatibility adapter is implemented. Never claim legacy support without tests.
- No database writes, project scanning, background workers or model calls.
- `observed` means the caller vouches for a Pi runtime event; it is **not** inferred from the JSONL.
- `getSessionFile()` may be missing in no-session mode; the parser accepts only an explicit file path.
- Malformed complete lines are skipped with positional issues; consumers must refuse promotion from a source with integrity issues. No secret-bearing source line is echoed in diagnostics.
- This layer does not implement privacy redaction for text indexing. Canonical events intentionally omit message content; FTS comes in P1-05/P1-06 after approved redaction.

## Tests

```sh
npm test
```

Fixture: `tests/fixtures/pi-v3/branched-compacted.jsonl`. Test cases include branch A failure vs branch B success, compaction checkpoint, context_edit, model state, partial tail, Unicode chunk boundaries, orphan/cycle/duplicate, and deterministic canonical identity.

**Upstream pin**: [Pi a40abeca](https://github.com/earendil-works/pi/commit/a40abecaaf39e5a11e6c4850ee5cd8ecda4958cc); authoritative projection: `packages/coding-agent/src/core/session-manager.ts`.

**Important remaining check**: differential-test the new projection against Pi's own `buildSessionProjection` inside a compatible host, especially multiple compactions and `context_edit` migration cases.
