# Phase 0 — Pi install, runtime and trust contract

> **P0 is a hard prerequisite to P1.** This phase is dedicated to verifying that a package installed from this repository can be discovered, loaded, disabled, upgraded and inspected inside real Pi. A minimal command-only probe is committed in `extensions/pi-memory.ts`; it is not a memory implementation.

## 0. Why P0 is necessary

Pi is **not** a generic Node application running our own main(). Pi's Package Manager discovers package resources; its Extension loader imports a **default factory** with jiti; its runtime supplies host modules and invokes event handlers. A design that looks valid in a TypeScript repo may be unloadable through `pi install git:` if `pi.extensions` points to missing `dist`.

Sources pinned for review (2026-11-12): Pi commit [a40abeca](https://github.com/earendil-works/pi/commit/a40abecaaf39e5a11e6c4850ee5cd8ecda4958cc); [package manager](https://github.com/earendil-works/pi/blob/a40abecaaf39e5a11e6c4850ee5cd8ecda4958cc/packages/coding-agent/src/core/package-manager.ts); [extension loader](https://github.com/earendil-works/pi/blob/a40abecaaf39e5a11e6c4850ee5cd8ecda4958cc/packages/coding-agent/src/core/extensions/loader.ts).

## 1. Install-ready package contract

Source-tree strategy for P0/P1:

```text
pi-memory/
  package.json
  extensions/pi-memory.ts   # default ExtensionAPI factory; P0 doctor only
  src/                      # later engine (P1 onwards)
  tests/
  docs/
```

`package.json` must declare `pi.extensions: ["./extensions/pi-memory.ts"]`. The file must exist **in the Git checkout and npm packed artifact**. Pi's jiti loader supports TypeScript sources. Git package installs run `npm/pnpm/bun install` with development dependencies omitted: relying on a separate `tsc` step and a generated untracked `dist/` is incorrect for Git install unless an explicitly verified production-safe build lifecycle is implemented.

**Host modules:** `@earendil-works/pi-coding-agent`, `@earendil-works/pi-agent-core`, `@earendil-works/pi-ai`, `@earendil-works/pi-tui` and `typebox` are provided by Pi. Declare used hosts under `peerDependencies`, not `dependencies`, and do not bundle own copies. Runtime dependencies (e.g. SQLite driver) belong in `dependencies` when added. Local package installs do **not** install/modify node_modules; dev must `npm install` independently where required.

**State isolation:** all runtime DB/Notes/Snapshots/Jobs go into a user-controlled data directory outside Git/npm checkout (default design: `<agent-dir>/memory`, with `PI_CODING_AGENT_DIR` respected where possible). Pi Git updater can run `git clean -fdx` in the checkout; never store user data there. Do not auto-commit memory into the consumer's code repository.

## 2. Three distribution channels

| Channel | Command (to run on a machine with Pi installed) | Expectations |
|---|---|---|
| Source one-shot | `pi -e ./` from pi-memory root | load manifest + TypeScript entry; no persistent registration |
| Local permanent | `pi install /absolute/path/to/pi-memory` | add package to personal settings; local source is not copied |
| Git user install | `pi install git:github.com/1998x-stack/pi-memory@<reviewed-commit>` | clone repo, install prod deps, discover probe; pin SHA for reproducibility |
| Git project install | `pi install --local git:github.com/1998x-stack/pi-memory@<reviewed-commit>` | project config, only loaded after project trust |
| npm versioned (P4 only) | `pi install npm:pi-memory@<published-version>` | only after remove `private`, publish and verify `npm pack` contents |

**Never execute the angle-bracket placeholders literally.** Replace `<reviewed-commit>` with an actual commit hash, and note the repository currently only implements the P0 doctor.

Installation is NOT the same as activating every feature. Check resource selection in `pi config`, `defaultTools`, `--no-tools`, `--no-extensions`, and `pi -e` explicit loading precedence.

## 3. Acceptance workflow (real Pi required)

1. Confirm `node --version` satisfies Pi's required Node engine (current Pi package declares `>=22.19.0`).
2. Run `npm test` in source repo (manifest-only static checks); note this does **not** test Pi compatibility.
3. Start from clean temp `PI_CODING_AGENT_DIR` and an isolated test project to avoid editing real settings/sessions.
4. `pi -e ./` → TUI command `/pi-memory-doctor` → must display *P0 install probe* and correctly describe whether a session file exists.
5. `pi install git:github.com/1998x-stack/pi-memory@<reviewed-commit>` → `pi list` and `pi config` show resource → `/pi-memory-doctor` works in fresh process.
6. `pi install --local ...` with project trusted and untrusted; command loads **only when trust permits**. Test `pi config --local` filters.
7. `pi -ne` without `-e` should disable discovered probe; explicit `-e` still loads even with `-ne`.
8. `pi remove <exact-source>` removes package registration; `pi update --extensions`/pinned Git behavior has no user-data loss.
9. Test macOS/Linux/Windows and TUI/RPC/print where feasible; no console stdout from extension in machine-readable modes.
10. Provide complete command transcript + Pi version + OS + git commit + pass/fail in `docs/qa/install-results.md` (only after actual run).

## 4. P0 tasks

- **P0-01**: Review upstream API and pin commit + Node version; document upstream changes.
- **P0-02**: Commit source-resolvable Pi manifest and zero-side-effect doctor extension. **Static files now present; Pi runtime verification pending.**
- **P0-03**: Verify local `pi -e`, user `pi install`, Git `pi install` with isolated config.
- **P0-04**: Verify project trust, filters, reload, CLI/print/RPC and collisions.
- **P0-05**: Verify Git update, remove, checkout clean, state-directory persistence.
- **P0-06**: Publish a versioned compatibility matrix with reproducible logs; only then mark P0-Gate passed.

**Exit Gate G0**: all install channels marked pass/skip-with-reason, Git + local entry confirmed on actual Pi, source package carries no memory data, tests and version pin recorded. P1 starts only after G0; a statically valid manifest is not enough.

See [Installation audit](../11-installation-and-packaging.md), [Install QA](../qa/install-test-matrix.md), [Upstream corrections](../10-upstream-audit.md).
