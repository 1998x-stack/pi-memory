# P0 actual Pi install results (not yet run)

**Current status: NOT RUN ON A LIVE PI RUNTIME**.

## Environment blocker

The review environment has Node **22.16.0** and no `pi` CLI available. Pi's reviewed package declares Node **>=22.19.0**. Network/installation access is unavailable in the review container. The submitted P0 test and CI workflow check the *static package contract*, not extension loading inside Pi.

## Completed static pipeline

- [GitHub Actions run 43142215140](https://github.com/1998x-stack/pi-memory/actions/runs/43142215140): **success**, Node 22.19.0, repository commit `2f51ad50fb31e46e0e7a9f3ef0cb4ab514fa1606`.
- Passed job steps: `npm test` (source manifest contract), `npm pack --dry-run --json --ignore-scripts`, assertion that packed files include `extensions/pi-memory.ts`.
- Static validation verified the Package manifest and TypeScript factory existence; **not** the Pi Extension loader execution, user/project trust, Git update or memory features.
- Documentation relative Markdown links and fenced-code parity checked across 32 Markdown files (no unresolved file links; `docs/phases/` directory link is valid).

## Required actual test record

| Case | Status | Pi version / OS | Evidence |
|---|---|---|---|
| I01: local -e | not_run | — | — |
| I02: Git user install | not_run | — | — |
| I03: project trust | not_run | — | — |
| I04: local permanent | not_run | — | — |
| I05–I11: disable/filter/reload/modes | not_run | — | — |
| I12–I17: update/remove/cross-platform | not_run | — | — |
| I18: npm published | not_applicable (P4) | — | — |

**Do not mark G0 passed** until a compatible Pi runtime has executed I01/I02/I03 plus the critical trust/disable/state isolation checks and logged the observations.

Instructions: [P0 execution plan](../phases/P0-install-contract.md), [full test matrix](install-test-matrix.md).
