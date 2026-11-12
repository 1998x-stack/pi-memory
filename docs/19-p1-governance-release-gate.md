# Phase P1-G — Memory Governance, crash recovery and Pi trust validation

Status: **Preview implementation, not G1 production sign-off**. This follows [P1 source-indexing](15-p1-indexer-fts.md), [real Pi recall](16-p1-live-recall.md), and [manual L2/L4](17-p1-integrity-notes-l4.md).

This stage addresses three previously open dependencies:
1. A user can explicitly **forget derived Memory**, not merely revoke a Note from lookup.
2. The system can recover failed cross-resource cleanup without confusing SQLite transactions with filesystem atomicity.
3. A busy/mutated Pi Session cannot silently make source history, Note evidence and FTS5 disagree.

## 1. Data ownership and explicit deletion contract

| Data | Owner | `forget note` | `forget session` |
|---|---|---|---|
| Pi v3 native JSONL | Pi/user | untouched | untouched |
| SQLite `memory_notes` | pi-memory | delete scoped row + evidence FK | delete ALL Notes depending on the selected Session |
| SQLite indexed `sessions/events/events_fts` | pi-memory | keep native evidence index | delete selected source and FTS-derived entries |
| Markdown `notes/<id>.md` | pi-memory | remove or queue retry | remove dependent exports or queue retry |
| Export temporary `<id>.md.<uuid>.tmp` | pi-memory | remove or queue retry | remove or queue retry |
| `memory_tombstones` | pi-memory | hashed note marker | hashed session + dependent note markers |
| L4 dynamic `pi-memory` section | Pi/model run | next run excludes Note | next run excludes erased source's Notes |
| Historical prompts, provider logs/cache | external | **cannot delete** | **cannot delete** |
| External backups / previous DB copies | user/backup | **cannot delete** | **cannot delete** |

**Strong boundary:** this is **derived-data erasure**, not complete privacy hard erasure or a guarantee that all bytes are unrecoverable. Do not delete Pi native JSONL implicitly; users must manage source Sessions separately. If a previous DB backup is restored, the in-DB tombstone can also be rolled back. Persisting tombstones outside the DB or providing an explicit backup recovery policy is a remaining blocker.

### Destructive commands: mandatory literal confirmation

```text
/pi-memory forget note mem_<uuid> confirm
/pi-memory forget session <sessionId> confirm
/pi-memory forget status
/pi-memory forget cleanup confirm
```

The command checks `ctx.isProjectTrusted()` before opening the DB. The `confirm` keyword is mandatory. The model Tool `memory_search` is **read-only**, and cannot call Forget or approve Note content.

`forget note`: delete owner/project-matched row and evidence links transactionally; insert hashed Note tombstone; place its exported view in cleanup outbox; attempt derived file cleanup; return explicit WAL checkpoint/cleanup status.

`forget session`: require previously indexed Session in the same owner/project/source namespace; find every Note (including multi-evidence Notes) that depends on that Session, delete those Notes and their export views, delete indexed Events and Session state, and persist hashed Session/Note tombstones. Reindex checks tombstone both **before source parsing** and inside `BEGIN IMMEDIATE` to prevent concurrent resurrection. Native Pi JSONL is not changed.

### Crash windows and retry

SQLite changes and outbox enqueue commit in one transaction. File unlink occurs afterward, so a process can crash between DB commit and unlink. The outbox persists `(owner,project,note_id)`, and `/pi-memory forget cleanup confirm` retries removal. An export process that races Forget verifies Note revision after rename; an orphaned atomic-export temp file can be collected by its generated UUID suffix. Directory symlinks are not followed. A failed unlink is reported, never labeled successful.

SQLite uses `secure_delete=ON` and attempts `wal_checkpoint(TRUNCATE)`, reporting whether WAL is busy. This cannot guarantee secure erase of backups, SSD wear-leveling, OS snapshots or provider logs.

## 2. Source provenance and recomputation safety

The lexical search path now **re-reads raw source bytes** at each returned Event offset and SHA256-verifies the entry. A same-size rewrite preserving an indexed filename cannot expose outdated FTS snippets. L2 approval and L4 eligibility use the same source-hash attestation.

Commit and scan protection:
- Pi Session ID + entry ID + namespace is stable source identity; content SHA256 is separate.
- CAS checks last committed checkpoint inside `BEGIN IMMEDIATE`; concurrent writers cannot commit against a stale cursor.
- Incremental reader ignores incomplete trailing JSONL lines.
- Full reindex upserts stable events and deletes only disappeared entries; dependent Verified Notes become Disputed when source hash changes.
- Reconciliation handles deleted/symlinked source path and retracts derived index.
- User-initiated `/pi-memory recover` does forced full reconciliation of already indexed Sessions; no automatic wide directory scan is implemented.
- `ingestPiSessionWithRetry` retries CAS conflicts (bounded; no bypass of scope/approval).

## 3. Real Pi trust-negative behavior

Pi's `resolveProjectTrusted` short-circuits to **trusted** when the project has no trust-requiring local resources, unless an explicit override or previous trust record says otherwise. Therefore setting `defaultProjectTrust=never` alone in a resource-free test project is **not** a valid negative trust test.

Real Pi RPC negative test uses `pi --no-approve` with the Extension loaded explicitly, and verifies:
- Extension still registers commands;
- `/pi-memory-doctor` reports `Project trusted: no`;
- `/pi-memory index`, `/pi-memory l4 on` and `/pi-memory forget status` return the trust refusal;
- no `pi-memory.sqlite` is created.

Upstream: [Pi project-trust source](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/src/core/project-trust.ts), [Pi CLI args](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/src/cli/args.ts).

## 4. Implementation map and tests

| Module | Primary purpose | Tests |
|---|---|---|
| `src/governance/forget.mjs` | Scoped Tombstones, derived purge, outbox, WAL status | `tests/governance/forget.test.mjs` |
| `src/security/source-proof.mjs` | Shared source-line SHA256 attestation | `tests/store/pi-indexer.test.mjs`, `tests/notes/notes.test.mjs` |
| `src/transcripts/pi-indexer.mjs` | Two-stage tombstone check and CAS retry | `tests/store/multi-process-ingestion.test.mjs` |
| `scripts/index-concurrency-worker.mjs` | Independent workers for real SQLite lock stress | `tests/store/multi-process-ingestion.test.mjs` |
| `tests/pi-rpc-untrusted-smoke.mjs` | Real Pi trust denial without model calls | GitHub Actions `pi-rpc-local` |
| `tests/pi-rpc-recall-smoke.mjs` | Real Pi commands for Note/Session Forget | GitHub Actions `pi-rpc-local` |
| `tests/store/wal-crash.test.mjs` | SIGKILL transaction rollback | `npm test` |

Acceptance standards: all tests must pass against **Node 22.19.0 / Pi 1.5.2** on Linux. Passing an artificial JS mock does not replace Pi RPC or Pi SDK integration.

## 5. G1 gate: what remains

- A true user-facing forget workflow including Pi's own native Session deletion and user-controlled backups; do not imply external resources were erased.
- Multi-user/file-permission threat model and crash recovery with concurrent readers, long-running open SQLite connections, disk-full/ENOSPC and malformed filesystem metadata.
- Windows, macOS and bundled Pi/Bun compatibility; SQLite `node:sqlite` support matrix.
- Project-local trust prompt flows, TUI, JSON and print-mode extension behavior.
- External security review of secret redaction and prompt injection; current regex filter is only defense in depth.
- Long-horizon model-based memory quality and cache-hit cost measurements.
- Automatic capture, candidate mining and Dreaming remain **separate future phases**.

**Do not declare G1 complete** until these remaining items are explicitly tested or scoped out of the release contract.
