# Pi runtime lifecycle, sessions, tools and source-event matrix

## 1. Runtime event semantics

| Operation | Pi events / behavior | Pi Memory required behavior | Test |
|---|---|---|---|
| cold start | `session_start(reason=startup)` | bind scope, read current approved Snapshot; do not start long-lived timers in factory | L01 |
| `/reload` | `session_shutdown(reason=reload)` then new runtime / `session_start(reload)` | cancel listeners, release file handles, reopen once | L02 |
| `/new` | before switch, shutdown old, start new | enqueue old pending events before release, reload L4 for new session | L03 |
| `/resume` | shutdown old, load other session, start resumed | reconstruct active scope/session identity | L04 |
| `/fork` or `/clone` | session_before_fork; new session with parentSession | index parent link, no duplicate attribution | L05 |
| `/tree` | before tree then session_tree (no runtime replacement) | capture newLeafId/oldLeafId as observed activity | L06 |
| manual/auto compact | before_compact, compact/failed | index summary as derivative, raw messages remain evidence | L07 |
| user prompt | `before_agent_start` then low-level agent runs | bounded stable L4, no slow model processing | L08 |
| retries / continuation | potentially many `agent_end` until one `agent_settled` | durable one key per actual checkpoint, not success assumption | L09 |
| aborted run | `agent_settled(aborted=true)` | store evidence with aborted flag, not verified success | L10 |
| print/RPC | limited/none TUI | no direct TUI assumptions; avoid stdout corruption | L11 |
| `--no-tools` | extension loaded but LLM tools disabled | doctor command should still exist; memory_search not promised | L12 |
| `--no-extensions` | discovered extensions disabled, explicit -e special case | no side effects in disabled mode | L13 |
| project untrusted | project-local resources not loaded | global extension must not auto-index untrusted project | L14 |
| parallel/nested tools | `tool_execution_end` in completion order; result messages later | join on toolCallId, not adjacent JSONL position | L15 |
| session not persisted | `getSessionFile()` may be absent | no filename assumption; configurable ephemeral policy | L16 |

## 2. Why raw file and active projection differ

Pi JSONL records raw events as a tree (parentId). `getBranch(leafId)` traverses a selected path. `buildContextEntries()/buildSessionProjection()` apply Compaction and `context_edit`. These views are not interchangeable:

- **raw**: evidence that a historical model/tool/user event happened, even if later branch abandoned or hidden from context.
- **branch**: what causal path a particular leaf contains.
- **projection**: current model-visible context after compaction and edits.
- **curated memory**: separately verified Note/Knowledge, possibly derived from several branches.

The P1 engine must annotate `visibility` and branch lineage. A direct linear flatten of all entries fails for Pi.

### Special case: transient leaf moves

`SessionManager.branch(id)` changes `leafId` in memory without immediately persisting a line. When file is reopened, `_buildIndex()` resets leaf according to the last stored entry. Therefore, a worker scanning JSONL later cannot infer **all observed active leaf choices**, especially if the user navigated and exited without appending.

**Required design:** event hook records `(session_id, oldLeafId, newLeafId, observed_at)` in a separate branch-activity journal where available; ingestion job snapshots leaf at event time. For historical files without such journal, label leaf as `inferred`, not `observed`, and avoid automatically verifying branch-specific causal claims.

### Stable identity vs changing content

- Event key: `(source_namespace, session_id, entry_id)`, stable across file append; `source_namespace` describes installation/import origin, not the entire file hash.
- Content verification: `raw_entry_hash`, optional excerpt hash, Pi session format version and content generation.
- File path: locator only, not immutable identity; handle rename/rewrite/session migration.
- Fork: separate Session ID with `parentSession` pointer; same content may be reused with new entry IDs; dedup at evidence/content layer, not by incorrectly merging identities.

## 3. Tool event semantics

Pi may execute tools in parallel and nested tool execution may not appear as ordinary top-level tool-call/result pairs. `tool_execution_end` is the terminal observation for executed, blocked, invalid or unknown calls; the stored `toolResult` message may carry bounded `nestedCalls` metadata. Match by `toolCallId`, keep `parentToolCallId`, record `isError` and `durationMs` when available.

An assistant statement such as “tests passed” is **not** a successful test; validate command execution result (exit status, actual test output, suite scope, fresh code revision).

## 4. L4 and tool availability

- P0 doctor has zero prompt/tool side effects; it merely verifies an Extension factory loaded.
- P1 `memory_search` is `registerTool` with `promptSnippet` to explain to model that the tool exists. Do not assume it remains active under `--no-tools`, codemode-only, tool exposure changes or user customization.
- P1 L4 only exposes a small **curated index/navigation metadata**; avoid placing raw snippets in privileged System Prompt sections.
- P3 task-aware facts should preferably arrive as bounded, explicitly attributed lower-trust tool data; if using custom messages or `context` transforms, add prompt cache, persistence and compaction tests to avoid duplicates and context drift.
- Never return a full System Prompt replacement unless needed; use `systemPromptOptions.sections` for stable descriptions.

## 5. Source-event fixture checklist

| Fixture | What it protects |
|---|---|
| ordinary user/assistant/toolResult | standard messages and call linkage |
| message content block toolCall | exact args/toolCall ID |
| nestedCalls / parentToolCallId | hidden nested execution semantics |
| tool error/unknown/blocked/aborted | completed tool vs successful task distinction |
| parallel calls reordered | source order vs execution-end order |
| context_edit null/replacement | raw source vs visible context |
| compaction + repeated compaction | original evidence survives |
| branch() without subsequent append | transient active leaf known only to runtime |
| fork/clone with reparenting | source identity and parent link |
| old Session format migrated/rewrite | reindex/reconcile without duplicate records |
| corrupt final JSONL line | incremental parser recoverability |
| no persisted Session file | ephemeral handling |
| project trust denied | no implicit capture |
| deleted Session + orphaned evidence | downgrade/forget policy |

Detailed test instructions: [QA matrix](qa/data-integrity-test-matrix.md).
