# Source/API audit results — verified implementation boundaries

As of 2026-11-12, upstream source was reviewed at Pi [a40abeca](https://github.com/earendil-works/pi/commit/a40abecaaf39e5a11e6c4850ee5cd8ecda4958cc), coding-agent 1.5.2, and GitHub Actions executed real Pi on Node 22.19.0.

| Dimension | State |
|---|---|
| Pi Package manifest and host Typebox/peer semantics | source verified + CI passed |
| Source Extension loading and pinned Git install via Pi RPC | **PASS on Linux** |
| Pi Extension commands and manual cross-session Recall | **PASS on Linux RPC** |
| Pi projection matches upstream across fixtures | see latest differential CI |
| Source JSONL streaming and canonical identity | deterministic CI tests passed |
| Scoped FTS incremental append/rewrite/redaction baseline | deterministic CI tests passed |
| Git update/remove avoids deleting outside-checkout private data | **PASS on Linux** |
| Project trust refusal/TUI/print/Windows/Bun/native integrations | **NOT RUN** |
| True human-approved L2, L3 Wiki, L4 and Dreaming | **NOT IMPLEMENTED** |
| Real coding task success & independent security audit | **NOT RUN** |

CI references: [source+Git loader](https://github.com/1998x-stack/pi-memory/actions/runs/43143058406), [P1 parser/SQLite](https://github.com/1998x-stack/pi-memory/actions/runs/43143783323), [new-session recall](https://github.com/1998x-stack/pi-memory/actions/runs/43144014841), [disable/update/remove](https://github.com/1998x-stack/pi-memory/actions/runs/43144184617).

## Remaining correctness caveats

- Programmatic source tree parser currently handles **v3 only**; old v1/v2 files must be migrated by Pi or explicitly adapted.
- Branch leaf observed by an active Pi event is not the same as one inferred from last JSONL entry. Event-side branch activity journaling remains.
- SQLite FTS5 is based on `node:sqlite`, experimental in Node22; no cross-platform ABI assurance yet.
- The current read path does not automatically revoke records after deleted native sessions; source deletion reconciliation is future work.
- Known-pattern secret redaction is **not complete DLP**.
- Multiple processes can compete for the same DB/session; the lease and bounded recovery plan remains a release blocker.
- `memory_search` yields unverified historical source text, NOT permission to elevate instructions or verified facts.

## Review discipline

**Source reviewed** means exact Pi code/contract inspected; **runtime PASS** means a CI job executed the integration on the pinned Pi. Only labeled runtime checks can justify “verified integration”. Do not confuse CI unit success with real task completion or security certification.

Roadmap: [P0](../phases/P0-install-contract.md), [P1](../phases/P1-transcripts-retrieval.md), [full source audit](../10-upstream-audit.md).
