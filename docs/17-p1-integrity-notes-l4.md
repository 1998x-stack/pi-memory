# P1 data integrity, manual L2 Notes and controlled L4 context

Status: **implemented P1 prototype; not G1-certified for production**. The integration remains opt-in. The authoritative implementation lives in:
- `src/store/sqlite-store.mjs`, `src/store/integrity.mjs`
- `src/transcripts/pi-indexer.mjs`
- `src/notes/notes.mjs`
- `src/injection/l4-index.mjs`
- `extensions/pi-memory.ts`

Source-level reference for Pi: [earendil-works/pi@a40abeca](https://github.com/earendil-works/pi/commit/a40abecaaf39e5a11e6c4850ee5cd8ecda4958cc), especially [Extension before_agent_start](https://github.com/earendil-works/pi/blob/a40abecaaf39e5a11e6c4850ee5cd8ecda4958cc/packages/coding-agent/docs/extensions.md#before_agent_start) and [system prompt sections](https://github.com/earendil-works/pi/blob/a40abecaaf39e5a11e6c4850ee5cd8ecda4958cc/packages/coding-agent/src/core/system-prompt.ts).

## 1. Data-integrity changes (L1)

### Reconcile native Pi Session deletion

`reconcileMissingSessions(store, scope)` enumerates **previously indexed** sessions within an explicitly provided owner/project/namespace and session root. For missing or suspiciously replaced paths:
1. Downgrade approved Notes referencing deleted evidence to `disputed`.
2. Remove derived event rows, updating external-content FTS5 through DB triggers.
3. Remove the source checkpoint. Original Pi files are never deleted.
4. Commit everything in a **single SQLite transaction**; rollback on any thrown error.

The Pi Extension calls reconciliation on `/pi-memory reconcile` and before `/pi-memory search` / model `memory_search`. There is no ongoing background watcher. If native files are deleted while Pi is not running, stale SQLite bytes might persist **until next reconciliation**; do not claim forensic secure deletion or encrypted disk erase.

### Safe full reindex and crash recovery

- File scanner records complete LF-delimited byte offsets; incomplete JSONL tail is not indexed.
- Reader issues on a complete line fail the index instead of silently deleting evidence.
- Incremental ingestion requires same device/inode plus a verified final-entry anchor. Explicit `forceFull:true` bypasses incremental path for repair.
- A full reindex **upserts matching stable event IDs** and deletes only entries no longer present. The old delete-all/reinsert strategy was rejected because it would cascade-delete Note evidence FKs.
- `BEGIN IMMEDIATE` provides SQLite writer serialization; checkpoint compare-and-swap inside the transaction rejects results parsed against a stale database version.
- SQLite WAL mode and FTS5 integrity-check/rebuild are available. `/pi-memory recover` re-reads previously indexed, authorized session files with `forceFull:true`, then rebuilds the FTS index.

**Limits:** this is not a distributed lease, not crash-proof filesystem atomicity with the Pi JSONL producer, and not guaranteed corruption repair of arbitrary SQLite pages. Checkpoint source integrity still requires periodic verification if Pi rewrites files while preserving a previous record anchor.

## 2. Manual L2 Memory Notes

The Note repository uses SQLite as the **authoritative transactional source**, with optional `/pi-memory note export` to generate a human-readable Markdown view. Markdown exports are derived; they are **not independently mutable write-back files**. Storing both Markdown and SQLite as separate authoritative stores without a journal would create a dual-write inconsistency.

### State transitions

```text
   user-authored candidate
      ├── explicit approve + intact evidence → verified (human_reviewed)
      ├── source deleted / changed → cannot approve or show as approved L4
      └── explicit revoke → revoked (terminal for this Note ID)

   verified
      ├── evidence lost → disputed (not injected; requires explicit re-review)
      └── explicit revoke → revoked

   disputed
      ├── new intact evidence and explicit reapproval → verified
      └── revoke → revoked
```

An approval verifies **that the user explicitly reviewed a Note associated with current Pi evidence**, not that its proposition is universally or scientifically true. The model cannot change Note status through `memory_search`.

Evidence is tied to an owner/project/namespace, session ID, entry ID and source-entry SHA256. Approval and L4 eligibility recheck that the current raw Pi source line still hashes identically. Cross-project refs and missing/replaced source entries are refused. Revoked Notes never enter the L4 index; revoked rows intentionally remain as audit records. **Hard-purge/forget (including exported Markdown, WAL and backups) is not yet implemented.**

### Commands

```text
/pi-memory index
/pi-memory status
/pi-memory search DATABASE_POOL_TIMEOUT
/pi-memory reconcile
/pi-memory recover

/pi-memory note add fact <sessionId>#<entryId> | Fix database pool timeout | Check connection pool limits and tests
/pi-memory note list
/pi-memory note show mem_<uuid>
/pi-memory note approve mem_<uuid>
/pi-memory note revoke mem_<uuid>
/pi-memory note export mem_<uuid>
```

The `add` command only creates `candidate`, even when source line came from a successful Tool Result. Only a subsequent explicit user `approve` makes it eligible for L4. Avoid storing private credentials in Notes: regex-based redaction is defense in depth, not DLP.

## 3. L4 controlled prompt injection

### Why metadata-only?

Pi's `before_agent_start.systemPromptOptions.sections` is a high-priority system prompt location. Copying Note title/body or arbitrary Tool Results directly into it would risk **promotion of untrusted data into instructions**. Therefore the initial safe L4 contract intentionally includes **only stable generated Note IDs, enumerated type names, and evidence counts**, with a fixed code-authored navigation sentence. Actual content remains low-trust `memory_search` Tool data. The Tool accepts an approved `mem_<uuid>` pointer in its `query` field to retrieve the full Note with Evidence. Revoked, disputed, stale or foreign-project IDs are not returned.

L4 is **off by default**, activated per trusted project explicitly with:

```text
/pi-memory l4 on
/pi-memory l4 preview
/pi-memory l4 stats
/pi-memory l4 off
```

Pi Hook behavior:
1. Check `ctx.isProjectTrusted()` and project scope.
2. Confirm `memory_search` is in the current selected tool loadout; skip injection when disabled by `--no-tools` or related configuration.
3. Read only `verified` Notes for which **all** linked evidence hashes still match existing raw Session source lines.
4. Build a deterministic `pi-memory` prompt section under **512 UTF-8 bytes** and at most 8 Note pointers. No Note content/title is allowed.
5. On revoke/evidence loss/disable, remove the section from the next prompt options. Pi's prompt patch mechanism can then remove it from the effective system prompt.
6. Errors are fail-open for the Pi agent (no memory injected); they are not permission grants to inspect another project.

This is a strict **byte** bound, not tokenizer-exact: `estimatedTokens = ceil(bytes/3)` is monitoring only. Do not promise a 512-token maximum without measuring the active model tokenizer.

### Prompt-cache / cost observability

`/pi-memory l4 stats` exposes:
- `renders`: counted L4-enabled start hooks;
- `changes`: times the stable L4 section hash changed since the previous render;
- `lastBytes`: last section byte size.

Because titles/body are omitted, a Note with unchanged approval/evidence has a stable index hash across new runs. **These metrics are not actual provider cache hit/miss or token usage metrics**. For numerical provider usage from previously recorded Pi Session JSONL, run `node scripts/l4-usage-report.mjs <session-a.jsonl> <session-b.jsonl>`; see [continued review](18-p1-continued-review.md). At P4, compare 3 arms on identical models and tasks: L4 off, L4 on (stable), L4 on with Note changes, collecting Pi assistant usage `cacheRead`, `cacheWrite`, `input`, overall prompt tokens and per-run latency. Report all model and maintenance costs.

## 4. Operational tests and exit gates

| Area | Automated test | Remaining G1 work |
|---|---|---|
| Session deletion | delete JSONL, verify immediate query suppression + reconciliation | privacy purge and source-folder audit |
| Writer races | two SQLite handles, checkpoint stale conflict | process-kill concurrency/load suite |
| Crash recovery | thrown exception and real SIGKILL before commit, followed by WAL/FTS verify | multi-writer process-kill matrix remains |
| Full reindex | preserved IDs and Note FK references | migrations, corrupt-file quarantine UX |
| L2 state transitions | candidate → approved → revoked; wrong scope, source loss | stronger schema validation & human-review UX |
| L4 safety | malicious Note title/body omitted, capped bytes, revoke removes | Pi model request with real token/cache accounting |
| Pi host | RPC command and Git Package loader | project trust-negative, TUI, Windows/Bun |

**Not yet included:** background capture, Dreaming worker, automatic correction and Wiki. G1 is intentionally not marked complete.

Related: [P1 Backlog](tasks/P1-backlog.md), [Runtime Lifecycle](12-runtime-lifecycle-matrix.md), [Privacy](04-security-privacy.md).
