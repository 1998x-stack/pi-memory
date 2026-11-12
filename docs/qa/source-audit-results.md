# Source-level audit results — verified vs pending

Review date: 2026-11-12.

| Check | Evidence | Status |
|---|---|---|
| Pi source version pinned | [Pi a40abeca](https://github.com/earendil-works/pi/commit/a40abecaaf39e5a11e6c4850ee5cd8ecda4958cc), package 1.5.2 | verified by source |
| Install manifest entry exists | `package.json` → `extensions/pi-memory.ts` | PASS static CI |
| Host modules not bundled as runtime deps | `peerDependencies` + CI static test | PASS static CI |
| npm package contains extension source | `npm pack --dry-run --json` | PASS static CI |
| P0 CI job | [run 43142215140](https://github.com/1998x-stack/pi-memory/actions/runs/43142215140) on Node 22.19.0 | PASS |
| Documentation relative links and fences | 32 Markdown files; directory links counted as valid | PASS source review |
| Git `pi install` / runtime factory invoked | isolated host with Pi CLI | **NOT RUN** |
| Project trust, `/reload`, RPC/JSON modes | live Pi test matrix I03–I11 | **NOT RUN** |
| Pi Git update checkout-clean/data retention | live Pi test matrix I12–I13 | **NOT RUN** |
| Actual memory_search / notes / dreaming / wiki | P1–P3 not implemented | **NOT IMPLEMENTED** |
| End-to-end long-horizon benchmark | P4 required | **NOT RUN** |

## Confidence boundaries

**Source verified** means exact upstream method/event/package behavior was read in Pi code at the pinned commit. **Static test passed** means GitHub Actions executed a valid package-manifest/npm asset assertion. Neither proves runtime extension can load inside all Pi distributions. Do not mark G0 as complete until real install logs are attached to [install-results.md](install-results.md).

## Revalidation cadence

Every upstream Pi compatibility update must rerun static CI + a real Git/local package smoke, and compare changes in `package-manager.ts`, `pi-manifest.ts`, `resource-loader.ts`, `extensions/loader.ts`, `extensions/types.ts` and `session-manager.ts`.

See [Upstream audit](../10-upstream-audit.md), [G0 plan](../phases/P0-install-contract.md) and [Install matrix](install-test-matrix.md).
