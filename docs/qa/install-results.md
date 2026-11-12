# Pi installation and integration QA — verified status

Review date: 2026-11-12. The results below are **real GitHub Actions executions** on Linux, Node 22.19.0 and `@earendil-works/pi-coding-agent@1.5.2`. Do not generalize these results to all operating systems or Pi releases.

## Executed evidence

| Verification | Status | Evidence |
|---|---|---|
| Static Pi manifest, npm pack, peer-dependency contract | PASS | [run 43142215140](https://github.com/1998x-stack/pi-memory/actions/runs/43142215140) |
| Source `pi -ne -e ./` Extension loaded by Pi RPC | PASS | [run 43143058406](https://github.com/1998x-stack/pi-memory/actions/runs/43143058406) |
| `pi install git:...` pinned source, fresh Pi RPC doctor | PASS | [run 43143058406](https://github.com/1998x-stack/pi-memory/actions/runs/43143058406) |
| P1 streaming reader, JSONL projection, SQLite FTS tests | PASS | [run 43143783323](https://github.com/1998x-stack/pi-memory/actions/runs/43143783323) |
| Real Pi RPC `/pi-memory index` then `new_session` then `/pi-memory search` | PASS | [run 43144014841](https://github.com/1998x-stack/pi-memory/actions/runs/43144014841) |
| `pi -ne` hides installed Extension; explicit `-e` can enable | PASS | [run 43144184617](https://github.com/1998x-stack/pi-memory/actions/runs/43144184617) |
| Pinned Git `pi update --extensions` and `pi remove` retain external memory sentinel | PASS | [run 43144184617](https://github.com/1998x-stack/pi-memory/actions/runs/43144184617) |
| Pi `buildSessionProjection` differential test | IN PROGRESS | [workflow](https://github.com/1998x-stack/pi-memory/actions) |
| P0 project trust negative case and local permanent install | NOT RUN | I03/I04 |
| Reload/TUI/print/JSON stdout safety, alternate OS/Bun | NOT RUN | I06–I11/I16 |
| Corruption and process crash recovery, concurrent writers | NOT RUN | P1/P4 fault matrix |
| Automatic Notes, L4, Dreaming, Wiki and long-horizon eval | NOT IMPLEMENTED | P1-08/P1-09, P2–P4 |

## What the real Pi integration proves

1. A clean Linux runner installed Pi 1.5.2 from npm.
2. Pi resolved this repository as an Extension using both direct source and managed Git Package installation.
3. RPC `get_commands` identified the Extension's commands without model credentials.
4. A synthetic persisted Session file was indexed by an explicit user command; after a Pi `new_session`, a search command returned the prior toolResult with source entry ID.
5. Private SQLite/FTS state was inspected independently, and owner/project-scoped results matched.
6. A separate Git install lifecycle workflow confirmed disabled loading and retained a sentinel file outside the checkout across update/remove.

**Not proven:** real coding task effectiveness, full project trust matrix, cross-runtime compatibility, safety against all secret formats, Snapshot/forget correctness.

## Gate interpretation

- **G0 partially verified:** install, Git lifecycle and disable succeeded on one pinned Linux/Node/Pi combination. Project trust, reload and broader platform cases remain.
- **G1 partially implemented/tested:** read-only sources and scoped retrieval work. Manual Notes, L4 and more robust fault/privacy controls remain.
- **G2–G4 not started in executable code.**

Use [install-test-matrix.md](install-test-matrix.md) for remaining tests; only mark a case pass after its actual logs exist.
