# Pi Memory

A local-first, evidence-grounded long-term memory extension for [Pi Coding Agent](https://github.com/earendil-works/pi), designed around four layers of memory and offline Dreaming.

> **Current implementation: P1 preview, not production-ready.** Pi Package installation, scoped FTS5, source reconciliation, evidence-backed human-approved L2 Notes and opt-in metadata-only L4 are implemented. Automatic capture, Wiki/L3 and Dreaming remain **not implemented**. See [integrity & L2/L4 design](docs/17-p1-integrity-notes-l4.md).

## What works now

- Pi Package loading from source and pinned Git commits using Pi 1.5.2 on Linux CI.
- `/pi-memory-doctor` checks Extension registration/session status.
- `/pi-memory index` explicitly indexes the **current persisted session**, after project trust is granted.
- `/pi-memory status` shows indexed event count for current project.
- `/pi-memory search QUERY` searches previously indexed transcripts.
- `memory_search` model Tool returns project-scoped **historical raw evidence** with session/entry provenance; not a verified recommendation.\n- `/pi-memory note add/approve/revoke/export` manages human-reviewed L2 Notes linked to Pi source evidence.\n- `/pi-memory l4 on/off/preview/stats` controls bounded, metadata-only L4 context; off by default.\n- `/pi-memory reconcile/recover` handles deleted native sessions and rebuilds derived FTS5 data.\n- `/pi-memory forget note|session ... confirm` erases explicitly selected **derived** memory, with tombstones and retryable Markdown cleanup. Native Pi source JSONL is not deleted.
- Parser supports Pi v3 JSONL streaming, branch lineage, compaction and context edits; SQLite FTS5 supports incremental append and full rewrite reconciliation.

## Try it in Pi

Use Node >=22.19.0 and a Pi installation compatible with `@earendil-works/pi-coding-agent@1.5.2`. For reproducibility, replace `<commit-sha>` with a reviewed pi-memory commit SHA:

```bash
pi install git:github.com/1998x-stack/pi-memory@<commit-sha>
pi list
pi
```

In the Pi TUI, in a project you trust:

```text
/pi-memory-doctor
# Perform a normal coding task so Pi writes a session JSONL file.
/pi-memory index
/new
/pi-memory search DATABASE_POOL_TIMEOUT
# The model can use memory_search for historical evidence or approved mem_<uuid> Note details when tools are enabled.
```

Manual Note workflow after indexing (replace the source IDs and Note ID with your actual values):

```text
/pi-memory note add fact <sessionId>#<entryId> | Pool timeout fix | Verify pool limits and test results
/pi-memory note list
/pi-memory note approve mem_<uuid>
/pi-memory l4 on
/pi-memory l4 preview
/pi-memory l4 stats
/pi-memory note revoke mem_<uuid>
/pi-memory reconcile
```

For development from this repo root, use `pi -e ./`; `pi -ne` disables discovered extensions, while explicit `-e` may still load one. The Extension never scans projects or calls a model automatically.

**Privacy warning:** This P1 preview indexes on explicit user request and performs best-effort secret-pattern redaction. This is **not complete DLP**. Revocation excludes Notes from L4, but end-user hard forget/purge (including native JSONL, SQLite backups and derived Markdown) has not been implemented yet. Use synthetic or non-sensitive data until deletion and security hardening are complete.

## Storage and boundaries

- Pi remains owner of original session JSONL files.
- Derived SQLite state defaults to `<agent-dir>/memory/pi-memory.sqlite`, respecting `PI_CODING_AGENT_DIR` when set, **outside the package checkout**.
- Every index/search operation checks explicit user/project scope; indexing also checks realpath session root, matching session cwd and user-initiated capture approval.
- Unknown/malformed events cannot be treated as verified Memory. The system currently has **no automatic promotion to L2/L4**.
- `node:sqlite` is experimental in the reviewed Node 22 release. Windows, Bun binaries, concurrent writer workloads and broader Pi versions are not yet certified.

## Documentation

- [Documentation hub](docs/README.md)
- [P0 upstream/install audit](docs/10-upstream-audit.md) · [Test results](docs/qa/install-results.md)
- [P1 parser and provenance](docs/14-p1-parser-foundation.md)
- [P1 scoped FTS indexer](docs/15-p1-indexer-fts.md)
- [Pi runtime integration/recall contract](docs/16-p1-live-recall.md)\n- [Integrity + human L2 Notes + controlled L4](docs/17-p1-integrity-notes-l4.md)\n- [P1 follow-on audit and proof matrix](docs/18-p1-continued-review.md)\n- [P1 Governance, Forget and Trust Gate](docs/19-p1-governance-release-gate.md)
- [Revised P0–P4 roadmap](docs/13-verified-roadmap.md) · [P1 backlog](docs/tasks/P1-backlog.md)

## Architecture

```text
Pi Extension (explicit user command / model search Tool)
    ↓
Trusted scope + SessionManager source path
    ↓
Pi v3 JSONL Reader → Branch/Compaction/ContextEdit projector
    ↓
Stable canonical source IDs + pre-index redaction
    ↓
SQLite FTS5 (rebuildable) → project-scoped transcript hits

L2 human-approved Notes → metadata-only L4 section (opt-in)\nFuture: Dreaming/Changesets/Snapshots → L3 Wiki → richer task-aware L4
```

**Status discipline:** passing Pi RPC and model-free FTS tests is not a G1 release. Work remains for automatic catch-up, full lineage journaling, Notes approval, L4 budgeting, fault/recovery testing and cross-platform compatibility.

Sources: [Pi Extensions](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/extensions.md), [Session Format](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/session-format.md), [Pi Packages](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/packages.md).
