# Pi Memory

A local-first, evidence-grounded long-term memory extension for [Pi Coding Agent](https://github.com/earendil-works/pi), designed around four layers of memory and offline Dreaming.

> **Current implementation: early P1 preview, not production-ready.** Pi Extension installation, manual session indexing, scoped FTS5 transcript search and core Pi v3 branch/compaction projection are implemented. Automatic capture, verified L2 Notes, Wiki/L3, L4 injection and Dreaming are **not implemented**.

## What works now

- Pi Package loading from source and pinned Git commits using Pi 1.5.2 on Linux CI.
- `/pi-memory-doctor` checks Extension registration/session status.
- `/pi-memory index` explicitly indexes the **current persisted session**, after project trust is granted.
- `/pi-memory status` shows indexed event count for current project.
- `/pi-memory search QUERY` searches previously indexed transcripts.
- `memory_search` model Tool returns project-scoped **historical raw evidence** with session/entry provenance; not a verified recommendation.
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
# The model can use the memory_search tool when tools are enabled.
```

For development from this repo root, use `pi -e ./`; `pi -ne` disables discovered extensions, while explicit `-e` may still load one. The Extension never scans projects or calls a model automatically.

**Privacy warning:** This P1 preview indexes on explicit user request and performs best-effort secret-pattern redaction. This is **not complete DLP**. No end-user forget/purge UI has been implemented yet. Use synthetic or non-sensitive data until deletion and security hardening are complete.

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
- [Pi runtime integration/recall contract](docs/16-p1-live-recall.md)
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

Future: L2 verified Notes → Dreaming/Changesets/Snapshots → L3 Wiki → L4 context
```

**Status discipline:** passing Pi RPC and model-free FTS tests is not a G1 release. Work remains for automatic catch-up, full lineage journaling, Notes approval, L4 budgeting, fault/recovery testing and cross-platform compatibility.

Sources: [Pi Extensions](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/extensions.md), [Session Format](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/session-format.md), [Pi Packages](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/packages.md).
