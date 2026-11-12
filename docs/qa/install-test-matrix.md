# Pi installation smoke-test matrix (P0/P4)

> Status: **NOT RUN ON LIVE PI**. These are test cases. Record actual pass/fail in `install-results.md` only after running them. P0 probe is ready for source inspection; no long-term memory behavior is shipped.

## 1. Preconditions

- Pi version / commit: `a40abecaaf39e5a11e6c4850ee5cd8ecda4958cc` baseline review; actual runtime version must be reported.
- Node >=22.19.0 when running the Node Pi package.
- Isolated `PI_CODING_AGENT_DIR` (temporary directory), separate test project cwd; no private credentials.
- Use controlled home/working directory for test, note OS / architecture / Pi installation type (npm, Bun binary, source).
- Use a reviewed Git SHA for `pi-memory`, not an unpinned branch.

## 2. Test cases

| Case | Mode | Command/Action | Expectation | Evidence |
|---|---|---|---|---|
| I01 | local one-shot | `pi -e ./`, then `/pi-memory-doctor` | recognizes source package and default factory; message “P0 install probe” | terminal transcript |
| I02 | personal Git | `pi install git:github.com/1998x-stack/pi-memory@SHA` + `pi list` | stored personal package, command visible | settings diff |
| I03 | project Git | `pi install --local git:github.com/1998x-stack/pi-memory@SHA` | only loaded after project trust | before/after trust logs |
| I04 | direct local package | `pi install /path/to/pi-memory` | works without Git copy; source file exists | package list + TUI |
| I05 | explicit/disabled | `pi -ne` vs `pi -ne -e ./` | discovered disabled; explicit -e can load | command visibility |
| I06 | config filter | `pi config` disable resource | no doctor on fresh Pi | config listing |
| I07 | reload | change extension, `/reload` | single registration, no stale module | logs |
| I08 | new/resume/fork | use commands and inspect doctor | session ID/state accurately refreshed | session logs |
| I09 | TUI | `/pi-memory-doctor` | notification works | TUI screenshot/log |
| I10 | RPC/print/JSON | launch with extension but no UI | no stray stdout; normal protocol intact | parsed output |
| I11 | no-tools/codemode | later P1: `--no-tools` etc | extension may load while `memory_search` disabled | tools list |
| I12 | Git update | `pi update --extensions` | update/clean does not touch external data root | sentinel hash |
| I13 | remove | `pi remove git:...` | package removed, external data persists | listing + sentinel |
| I14 | offline | `PI_OFFLINE=1` with package installed | uses cache/offline behavior, no network requirement | log |
| I15 | duplicate config | same package user+project | no unexpected duplicate extension; scoped settings resolved | resource list |
| I16 | cross-platform | Linux/macOS/Windows and Node/Bun host as supported | artifact loads; native SQLite strategy compatible | environment table |
| I17 | upgrade | pinned old/new version, schema migration | no data loss, backup/rollback | migration log |
| I18 | npm published only P4 | `npm pack --dry-run --json` and `pi install npm:...@version` | manifest entry and runtime assets in pack | tarball file listing |

## 3. Log template per test

```yaml
case: I01
result: not_run  # pass | fail | skip | not_run
timestamp:
pi_version:
pi_commit:
pi_install_method:
node_version:
os:
architecture:
pi_memory_commit:
command:
expected:
observed:
logs_redacted:
notes:
```

Never store tokens, full user paths, credentials or private session contents in results. Avoid setting `pass` from source review alone.

## 4. Release blockers

- Entry file missing after Git clone/npm pack.
- Host dependency duplicates cause module type mismatch.
- Project-local package loads without required trust.
- Git update/cleanup deletes user memory data.
- Unexpected stdout corrupts JSON/RPC output.
- `--no-extensions` still performs background capture.
- Null/unpersisted session causes extension crash.
- Memory tool falsely appears available when `--no-tools` has disabled it.

## 5. Actual results

**Pending**: write `docs/qa/install-results.md` once a compatible Pi runtime is available. See [P0](../phases/P0-install-contract.md), [packaging](../11-installation-and-packaging.md).
