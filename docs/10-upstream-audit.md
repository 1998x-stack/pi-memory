# Pi upstream compatibility audit — 2026-11-12

**Verdict: original design was directionally correct but NOT installation-ready.** This document is a source-level review, not evidence that Pi Memory's full memory system has run inside Pi. A small P0 discovery probe has been added, but real Pi install smoke is still pending.

**Pinned upstream for this review**: [earendil-works/pi@a40abecaaf39e5a11e6c4850ee5cd8ecda4958cc](https://github.com/earendil-works/pi/commit/a40abecaaf39e5a11e6c4850ee5cd8ecda4958cc), coding-agent package version **1.5.2**, Node engine **>=22.19.0**. Dates and interfaces can change; do not rely on `main` moving forward unchanged.

## 1. Findings ranked by severity

| ID | Severity | Finding in original plan | Upstream evidence | Required correction / gate |
|---|---|---|---|---|
| F01 | BLOCKER | Package example referenced `./dist/extension/index.js` although Git checkout has no build artifact | [package-manager.ts](https://github.com/earendil-works/pi/blob/a40abecaaf39e5a11e6c4850ee5cd8ecda4958cc/packages/coding-agent/src/core/package-manager.ts), [pi-manifest.ts](https://github.com/earendil-works/pi/blob/a40abecaaf39e5a11e6c4850ee5cd8ecda4958cc/packages/coding-agent/src/core/pi-manifest.ts) | P0 source `.ts` entry that actually exists, Git/local/npm pack smoke |
| F02 | HIGH | Host Pi modules treated like conventional dependencies in future package | [packages.md](https://github.com/earendil-works/pi/blob/a40abecaaf39e5a11e6c4850ee5cd8ecda4958cc/packages/coding-agent/docs/packages.md#declare-dependencies) | Host Pi and typebox only peerDependencies, do not bundle; runtime deps in dependencies |
| F03 | BLOCKER | Potential runtime DB under checked-out extension folder | [package-manager.ts Git updater](https://github.com/earendil-works/pi/blob/a40abecaaf39e5a11e6c4850ee5cd8ecda4958cc/packages/coding-agent/src/core/package-manager.ts) uses `git clean -fdx` | User data outside checkout; update/removal preservation test |
| F04 | HIGH | JSONL last entry implicitly treated as persistent active branch | [session-manager.ts](https://github.com/earendil-works/pi/blob/a40abecaaf39e5a11e6c4850ee5cd8ecda4958cc/packages/coding-agent/src/core/session-manager.ts) `branch()` changes in-memory leaf; reload `_buildIndex()` uses last entry | Capture `leafId` at relevant events; distinguish observed active branch from file-derived branch |
| F05 | HIGH | Proposed `source_file_hash + session_id + entry_id` as event primary key | Pi file appends and rewrites after migrations | Stable event identity: `(session_namespace, session_id, entry_id)` + separate content/version hash |
| F06 | HIGH | Ingestion only at `agent_settled` | [extensions.md](https://github.com/earendil-works/pi/blob/a40abecaaf39e5a11e6c4850ee5cd8ecda4958cc/packages/coding-agent/docs/extensions.md) lifecycle, session shutdown/reload/ephemeral sessions | Also catch up from persisted JSONL on session_start/CLI; aborted runs indexed with outcome flags |
| F07 | HIGH | Automatic memory injection into System Prompt could elevate untrusted evidence | Prompt sections are system messages | P1 inject only curated small navigation metadata; dynamic fact excerpts remain low-trust tool data, never instructions |
| F08 | HIGH | Global extension can inspect untrusted cwd before project trust | Project/user extension discovery vs project-trust gate | Auto-capture opt-in; check `ctx.isProjectTrusted()`; don't read local sensitive project resources without permission |
| F09 | HIGH | ModelRegistry available in Pi handlers assumed available to detached worker | [extensions.md model registry](https://github.com/earendil-works/pi/blob/a40abecaaf39e5a11e6c4850ee5cd8ecda4958cc/packages/coding-agent/docs/extensions.md), Pi extension context lifespan | In-process model call via `ctx.modelRegistry.complete`; detached worker must initialize its own authorized model adapter |
| F10 | MEDIUM | Tool guaranteed visible to model simply after registering | [settings.md](https://github.com/earendil-works/pi/blob/a40abecaaf39e5a11e6c4850ee5cd8ecda4958cc/packages/coding-agent/docs/settings.md), `--no-tools`, codemode and `defaultActive` | Test tool selection, `promptSnippet`, codemode, `--tools`, `--no-tools` |
| F11 | HIGH | Compaction summary might become mistaken for original evidence | [session-format.md](https://github.com/earendil-works/pi/blob/a40abecaaf39e5a11e6c4850ee5cd8ecda4958cc/packages/coding-agent/docs/session-format.md) | Index raw + projected separately; summary is derivative text; retained original raw source |
| F12 | HIGH | A single 'forget' operation seemed to promise full removal while native JSONL remains | Pi controls native sessions independently | Explicit hide / forget-derived / purge-source with separate permissions, anti-reingest tombstones and retention accounting |
| F13 | MEDIUM | Assume all tools appear as plain top-level calls in JSONL | [extensions.md](https://github.com/earendil-works/pi/blob/a40abecaaf39e5a11e6c4850ee5cd8ecda4958cc/packages/coding-agent/docs/extensions.md) nested tool semantics | Index nestedCalls metadata, preserve parentToolCallId, allow tool execution end without tool_result |
| F14 | HIGH | Treat Markdown + SQLite publish as one atomic transaction | Filesystem rename and SQLite commit are distinct operations | Explicit publication journal, restart reconciler, CAS and user-visible last-valid snapshot |
| F15 | MEDIUM | Repo initially lacked install/compatibility preflight | Pi has global/project/temporary packaging, trust, reload | Insert P0 before P1, cross-mode and OS install QA matrix |
| F16 | MEDIUM | Root package and user private state could both be installed in a consumer project | Pi package identity/dedupe + project settings | Test global-vs-project identity/overrides, isolate data keyed by trusted project ID |
| F17 | MEDIUM | Some previous docs implied `agent_settled` means task *success* | Final idle ≠ benchmark success | Record aborted/error/completed separately; task success from tests/evidence |
| F18 | MEDIUM | P2 Snapshot/versioned memory may retain removed data in backups | Immutable historical snapshots vs forget requirements | Define effective revocation at read time, purge policy for on-disk snapshots, disclose residual backups |
| F19 | MEDIUM | Dynamic L4 updates could invalidate prompt cache or append repeated patches | [extensions.md](https://github.com/earendil-works/pi/blob/a40abecaaf39e5a11e6c4850ee5cd8ecda4958cc/packages/coding-agent/docs/extensions.md) system sections patching | Prefer stable instruction-free index; measure cache effects; dynamic retrieval via Tool |
| F20 | MEDIUM | Sparse task outcome tracking would overstate learning | Distinct Compaction, model/provider, retries, user bash, parallel tool events | Event coverage matrix and final successful test evidence in P4 |

## 2. Upstream verified behaviors

### Package/install

- `pi install` supports git/npm/local sources, `--local` scopes to project, `pi list` enumerates packages, `pi config` filters resources.
- Git install clones into Pi-managed Git directory, optionally checks out ref, runs dependency install with dev dependencies omitted; Git updates may reset and clean checkout; do not treat Git checkout as persistent user state.
- Extension entry resolved from `package.json.pi.extensions` or conventional directories. TypeScript is loaded through jiti; default factory required.
- Host dependencies are mapped by Pi runtime; peer-declare hosts, not runtime-install duplicates; dev-only packages are not installed for Pi Git package consumers.
- User-installed packages may load across projects, project local packages require trust; user-level extension is still privileged.

### Runtime/session

- `session_start` fires on startup/reload/new/resume/fork (reason field), `session_shutdown` on replacement; factory may run without active session.
- `before_agent_start` modifies structured prompt sections or returns a custom message, not all tool/streaming events.
- `agent_end` can precede retries/queued continuation; `agent_settled` final-idle notification, not outcome verifier.
- `ctx.sessionManager` exposes `getSessionFile(), getSessionId(), getLeafId(), getBranch(), buildSessionProjection()`.
- Pi Session v3 JSONL entries are a tree. `branch()` moves leaf in memory with no immediately appended entry. `_buildIndex()` on load adopts last entry, so persisted file alone doesn't reconstruct every intermediate navigation.
- A new Session file may not exist before the first real user/assistant message; SDK/print modes can be ephemeral. Auto-index fallback must not assume every run emits a file.
- Compaction and `context_edit` alter projected context, not source log; fork/clone can create new files and reparent entries.
- Parallel/nested tool execution may reorder completion vs stored result ordering; `tool_execution_end` includes finalized failures even for blocked/unknown tool.
- Commands with duplicate names receive suffixes; `--no-extensions` disables discovered extensions, but explicit `-e` can still load extensions.

## 3. Evidence-based correction policy

- **Verified**: directly documented or inspected in Pi source at pinned SHA; static/semantic reasoning.
- **Planned**: our proposed Memory Engine/Schema/Worker/ACL, not shipped by Pi.
- **Tested**: only after actual executable Pi smoke with version, terminal log and environment.
- **Failed**: explicitly recorded with reproducer, never silently removed from QA.

This audit alone **does not establish** that the complete memory engine is implemented or that the P0 probe was loaded by live Pi. The current environment has Node 22.16.0 (below upstream Pi's declared >=22.19.0) and no Pi CLI; real install checks remain open.

## 4. Review priorities

1. G0 install compatibility is a prerequisite to any P1 integration work.
2. P1 must lock branch semantics, ephemeral sessions, stable source identity and trust.
3. P2 must resolve detached-worker model auth and snapshot consistency before automation.
4. P3 must avoid converting untrusted memory into high-priority instructions.
5. P4 validates OS/mode/package lifecycle, safety, task success and online+offline costs.

See [P0](phases/P0-install-contract.md), [packaging](11-installation-and-packaging.md), [runtime matrix](12-runtime-lifecycle-matrix.md), [corrections to roadmap](13-verified-roadmap.md).
