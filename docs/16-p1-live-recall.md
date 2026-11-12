# P1 live Pi host integration and cross-session recall

**Stage:** implemented model-free vertical slice; full G1 remains open.

## Host commands and Tool

| Surface | In-Pi usage | Side effects |
|---|---|---|
| `/pi-memory-doctor` | Inspects Extension availability | none |
| `/pi-memory index` | Indexes only current persisted, trusted-project Session | writes user-local SQLite/FTS |
| `/pi-memory status` | Indexed event count | reads DB |
| `/pi-memory search <query>` | Historical lexical transcript search | reads DB |
| `memory_search({query,limit?})` | LLM Tool with source references | reads DB, never triggers indexing |

`--no-tools` / configured tool selection may disable `memory_search` even while command registration remains. Pi in-process Extension is not a standalone CLI; `pi-memory` shell executable is NOT implemented.

## Permission behavior

- Global Extension may load before project trust; no capture on startup.
- `/pi-memory index` is a user-initiated operation; requires `ctx.isProjectTrusted()`.
- Session file comes from Pi's read-only `ctx.sessionManager.getSessionFile()`. If no persisted file exists, indexing safely stops.
- Realpath session source must be under `ctx.sessionManager.getSessionDir()`. Header `cwd` must resolve to trusted current project `cwd`; mismatches are refused.
- SQLite state must not be created or accessed when project trust fails; it remains outside npm/Git checkout.
- Model Tool cannot run index; `memory_search` returns unverified historical evidence and does not grant new execution permission.

## Tested route (CI)

```text
npm install -g @earendil-works/pi-coding-agent@1.5.2
  → run Pi --mode rpc with Extension
  → RPC get_commands confirms doctor + /pi-memory
  → open synthetic persisted Pi v3 JSONL
  → RPC prompt "/pi-memory index" (handled, no LLM API)
  → RPC new_session
  → RPC prompt "/pi-memory search PI_MEMORY_REAL_RPC_RECALL_2048"
  → receives original toolResult source ref t2 and matching text
  → independently queries private SQLite FTS5 for same project
```

This establishes a **real Pi process + two Session objects + durable retrieval**, but does not establish task success gains or verified Note correctness.

CI evidence:
- [Real Pi source and Git install smoke passed](https://github.com/1998x-stack/pi-memory/actions/runs/43143058406)
- [P1 manual cross-session recall passed](https://github.com/1998x-stack/pi-memory/actions/runs/43144014841)
- [Pipeline definitions](../.github/workflows/p0-static-contract.yml) (relative link above resolves from docs to repository root).

## Known limitations / P1 next

1. Manual single-session capture only: no settled-event queue, catch-up scan or background jobs.
2. No branch-activity journal: historical last leaf is inferred; model-context projection does not reconstruct all transient navigation events.
3. `node:sqlite` on Node22 currently emits experimental warnings; ensure compatibility with Pi bundles and alternate runtimes.
4. Secret redaction is only baseline, not strong enough for unrestricted real private data.
5. FTS tokenization and ranking need exact code/path relevance benchmark.
6. Source deletion/revocation, concurrent write locking and reindex recovery need tests.
7. L2 manual Notes approval, L4 bounded injection and Dreaming remain future work.

See [P1 execution plan](phases/P1-transcripts-retrieval.md), [P1 backlog](tasks/P1-backlog.md).
