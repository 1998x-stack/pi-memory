# P1 continued implementation: release review and proof matrix

> Maintainer audit for the follow-on work after the verified manual L1 search slice. This is a **P1 prototype**; code/test coverage does not imply G0/G1 production sign-off. All three jobs in [GitHub Actions run 43147969626](https://github.com/1998x-stack/pi-memory/actions/runs/43147969626) passed on Pi 1.5.2, Node 22.19.0 / Linux.

## 1. What has been implemented

| Requirement | Implementation | Proof | Residual risk |
|---|---|---|---|
| Pi Session removed after indexing | `reconcileMissingSessions`, FTS5 delete triggers, fail-closed missing-source read | `tests/store/integrity.test.mjs` | no always-on watcher; derived data persists at rest until reconciliation |
| Symlink/source replacement | realpath identity and allowed root checks | integration unit tests | TOCTOU remains on concurrently mutating source |
| Writer concurrency | SQLite `BEGIN IMMEDIATE`, busy timeout and checkpoint CAS | two database handles / conflict assertion | not a distributed lease; heavy load stress pending |
| Crash-safe derived data | transactional FTS/checkpoint, WAL, explicit reindex/rebuild | `tests/store/wal-crash.test.mjs` (SIGKILL) | no encrypted backups or source-file journaling |
| Full rebuild preserves Evidence | upsert stable IDs, delete only stale IDs | `tests/notes/notes.test.mjs` | changing an evidence source hash requires human re-review |
| L2 manual Notes | Candidate / explicit human approve / dispute on evidence loss / revoke | `tests/notes/notes.test.mjs`, Pi RPC command flow | UI UX and hard purge not implemented |
| L2 Markdown | `/pi-memory note export` derived file in private data dir | Pi RPC export assertion | Markdown not write-back; backup/retention needs policy |
| L4 controlled index | opt-in, approved-only, metadata-only, 512 UTF-8-byte cap | `tests/injection/l4-index.test.mjs` and real Pi SDK Hook | no model-exact token bound or live provider cache metrics |
| L4 pointer retrieval | `memory_search({query:"mem_uuid"})` returns approved Note as **lower-trust** tool data | `tests/retrieval/memory-query.test.mjs`, Pi RPC | malicious Note content must remain untrusted |
| Prompt stability | stable SHA256 and runs/changes/bytes recorded, source loss removed | `/pi-memory l4 stats` + Pi SDK Hook | provider actual cacheRead/cacheWrite requires paid/authorized model run |
| Offline token/cache report | `scripts/l4-usage-report.mjs` parses native assistant usage/section patches | `tests/evals/l4-usage.test.mjs` | observational groups can have task/model confounders |

## 2. Real Pi host interfaces

Package install and runtime verification are **pinned** to Pi [1.5.2 at a40abeca](https://github.com/earendil-works/pi/commit/a40abecaaf39e5a11e6c4850ee5cd8ecda4958cc), Node22.19.0/Linux in CI.

- `pi install git:...` and direct `-e` load real `extensions/pi-memory.ts` using Pi's jiti loader.
- Pi RPC `get_commands` discovers `pi-memory` and `pi-memory-doctor` without model API keys.
- Pi RPC commands do manual index → `new_session` → historical search → Note candidate → approval → Note ID lookup → optional Markdown → L4 preview → revoke → pointer inaccessible.
- Official Pi SDK's `session.extensionRunner.emitBeforeAgentStart` is used in `tests/pi-l4-sdk-hook-smoke.mjs` to verify system section mutation. No fake event runner or external model call is needed.
- `memory_search` returns raw historical snippets or approved Note content as **Tool data**. Only Note ID/type/evidence count may appear in `before_agent_start.systemPromptOptions.sections["pi-memory"]`. Human-written title/content never go there.

## 3. Cost / cache measurement

To analyze actual **previously recorded** Pi model token/cache usage, run:

```bash
node scripts/l4-usage-report.mjs /path/to/pi-session-a.jsonl /path/to/pi-session-b.jsonl
```

Output is numeric aggregates grouped by:
- `off`: L4 section absent;
- `onChanged`: new/changed L4 section before that assistant response;
- `onStable`: same section as last assistant response.

Metrics: request count, assistant input/output tokens, cacheRead/cacheWrite tokens, total tokens and reported USD cost when present. The script reads **only explicit user-selected files**, not arbitrary Pi session folders, and emits no original prompts. It does not call a provider.

These are **observational** cohorts; do not infer causal cache performance improvements from them. The P4 controlled experiment must hold model, task, provider, conversation and ordering constant, and report input/output/cache tokens and maintenance costs, as laid out in [evaluation plan](06-evaluation-plan.md).

## 4. Minimal safe usage

```text
# In a trusted Pi project after a real Session has been persisted
/pi-memory index
/pi-memory search <known-bug-code>

# Replace with actual Pi SourceRef from indexed search
/pi-memory note add procedure <session-id>#<entry-id> | Pool incident | Inspect pool settings and test logs
/pi-memory note list
/pi-memory note approve mem_<uuid>
/pi-memory l4 on
/pi-memory l4 preview
/pi-memory l4 stats

# LLM can now call memory_search with query=mem_<uuid> for the full sourced Note.
# L4 never embeds the Note title/content in its privileged section.
/pi-memory note revoke mem_<uuid>
/pi-memory reconcile
/pi-memory recover
```

**Defaults:** no background capture; no remote Dreaming; L4 off; all commands scoped to Pi trusted project; original JSONL never modified.

## 5. Remaining quality/security release blockers

1. End-user hard delete/forget across original Pi sessions, derived SQLite, exported Markdown, WAL/backups and tombstones. Revocation is **not** total deletion.
2. Project trust-negative and project-local package smoke, reload and print/TUI, Windows/Bun/other Pi releases.
3. Multiple concurrent running Pi sessions under heavy source churn; long-lived WAL/SQLite lock contention, timeouts and retries.
4. Robust redaction beyond known credential regexes; prompt-injection and privacy adversarial fixtures.
5. Full JSONL history across legacy versions, fork/tree activity journal, nestedCalls and source-deletion propagation to all knowledge layers.
6. Real model-level before/after token/cache telemetry, controlled long-horizon coding tasks, regression confidence intervals.
7. L2 Note edit/merge/correction and evidence provenance in Markdown import; P2 Dreaming/Changeset/Snapshot not implemented.

## 6. Gate status

- **G0: partial** — actual Pi Linux source/Git Package loading, no-extension, update/remove passed; broader trust/platform matrix open.
- **G1: substantial prototype implemented** — L1 retrieval, integrity, L2 manual verified Notes, L4 bounded pointer, real Pi SDK Hook; all DoD not yet passed.
- **G2/G3/G4: planned**, not implemented in this stage.

Relevant: [original Pi audit](10-upstream-audit.md), [L2/L4 deep design](17-p1-integrity-notes-l4.md), [P1 backlog](tasks/P1-backlog.md), [QA](qa/install-results.md).
