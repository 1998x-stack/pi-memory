# Pi installation and integration QA — verified status

Review date: 2026-11-12. The results below are **real GitHub Actions executions** on Linux, Node 22.19.0 and `@earendil-works/pi-coding-agent@1.5.2`. Do not generalize these results to all operating systems or Pi releases.

## Continued P1 implementation evidence

- [Pi SDK L4 Hook run 43147497338](https://github.com/1998x-stack/pi-memory/actions/runs/43147497338): all jobs passed, including offline Pi 1.5.2 `before_agent_start` integration and project-scoped Note ID injection without title/body.
- [SIGKILL WAL recovery run 43147564344](https://github.com/1998x-stack/pi-memory/actions/runs/43147564344): all jobs passed, including crash rollback, FTS integrity and reconnect.
- [L4 token/cache usage parser run 43147636731](https://github.com/1998x-stack/pi-memory/actions/runs/43147636731): all jobs passed; analyzes numeric Pi usage records without exposing prompt contents.
- [L4 Note ID retrieval run 43147705782](https://github.com/1998x-stack/pi-memory/actions/runs/43147705782): model-free tests confirmed only approved Notes are retrievable by ID with Evidence, and revoked/foreign Notes are hidden.
- [Latest complete P1 suite 43147969626](https://github.com/1998x-stack/pi-memory/actions/runs/43147969626): **SUCCESS**, all 3 jobs passed: core/SQLite SIGKILL and L2/L4 unit tests, Pi RPC index→new Session→Note approval→ID lookup→revoke, Pi SDK L4 Hook, Git install/disable/update/remove.

## Final P1-G regression (2026-11-12)

[Run 43152874398](https://github.com/1998x-stack/pi-memory/actions/runs/43152874398) **SUCCESS, 3/3 CI jobs** after the orphan Markdown temporary-file cleanup regex fix, including the new crash-residual regression, multi-process CAS stress, Pi untrusted-project RPC gate and Git Package lifecycle.

## P1-G governance CI proof

[Run 43152614255](https://github.com/1998x-stack/pi-memory/actions/runs/43152614255) passed **3/3 jobs**: Note/Session derived Forget, outbox retry, five-process CAS, source attestation, Pi RPC --no-approve trust denial, Pi L2/L4 and Git install/update/remove (Linux/Node 22.19.0/Pi 1.5.2).

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
| Pi `buildSessionProjection` differential test, 11 cases | **PASS** | [run 43144372252](https://github.com/1998x-stack/pi-memory/actions/runs/43144372252) |
| Explicit --no-approve trust refusal | **PASS** | [run 43152614255](https://github.com/1998x-stack/pi-memory/actions/runs/43152614255) |
| Project-local trust prompt and local permanent install | NOT RUN | I03/I04 |
| Reload/TUI/print/JSON stdout safety, alternate OS/Bun | NOT RUN | I06–I11/I16 |
| SIGKILL WAL + five-process CAS stress | **PASS Linux** | [run 43152614255](https://github.com/1998x-stack/pi-memory/actions/runs/43152614255) |
| Disk-full/reader-concurrency/other OS fault matrix | NOT RUN | P1/P4 |
| Auto-extracted Notes, Dreaming, Wiki and long-horizon eval | NOT IMPLEMENTED | P2–P4; manual L2 + opt-in L4 implemented in P1 |

## Latest all-green CI

[Run 43144372252](https://github.com/1998x-stack/pi-memory/actions/runs/43144372252) passed all three jobs: model-free core/FTS5 suite, source-loaded Pi RPC + new-session recall + upstream differential projection, and pinned Git install/disable/update/remove data-retention checks. This is a Linux/Node/Pi-1.5.2 validation, not full G0/G1 certification.

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
- **G1 partially implemented/tested:** L1 ingestion/reconciliation/CAS/WAL, human-approved L2 Notes, verified-only L4 pointer injection and offline cache accounting are implemented/tested. Hard purge, broad Pi trust/platform matrix, cache experiment and automated capture remain.
- **G2–G4 not started in executable code.**

Use [install-test-matrix.md](install-test-matrix.md) for remaining tests; only mark a case pass after its actual logs exist.
