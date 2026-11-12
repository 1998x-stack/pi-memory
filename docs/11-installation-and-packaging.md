# Pi Memory installation & package lifecycle contract

## 1. Runtime resolution path (verified from Pi source)

```text
pi startup
  ├─ read user settings (<agent-dir>/settings.json)
  ├─ project-trust decision (before project resources)
  ├─ read trusted project .pi/settings.json
  ├─ package-manager: resolve npm / git / local
  ├─ resource-loader: honor manifest and filters
  ├─ extension-loader: jiti.import(resolved entry) → default factory
  ├─ initializeExtension(factory, ExtensionAPI)
  ├─ session_start / resources_discover
  ├─ before_agent_start → Pi Agent loop → agent_settled
  └─ session_shutdown on reload/new/resume/fork/quit
```

The ordering is conceptual across startup and trust phases; the authoritative implementation is Pi's [resource-loader](https://github.com/earendil-works/pi/blob/a40abecaaf39e5a11e6c4850ee5cd8ecda4958cc/packages/coding-agent/src/core/resource-loader.ts) and [extensions docs](https://github.com/earendil-works/pi/blob/a40abecaaf39e5a11e6c4850ee5cd8ecda4958cc/packages/coding-agent/docs/extensions.md). Project trust is resolved before loading trust-gated project code, but user/global and explicit CLI extensions can load independently.

## 2. Source package (P0/P1), not a dist-only package

Current committed `package.json` explicitly points to `extensions/pi-memory.ts` and includes a `pi-package` keyword. The file exports a default function taking `ExtensionAPI`, registering only `/pi-memory-doctor`; it deliberately performs no ingestion or model calls.

**Why:** Pi uses jiti for TS and `installGit()` does not promise to run the project's `npm run build`. Git consumers only receive the versioned checkout + production dependencies. A manifest pointing at `dist/extension/index.js` when `dist` is not checked in causes a missing resource/extension instead of the promised integration.

After implementation, two supported packaging patterns:
- **Option A (preferred while Git+local):** TS source entry in manifest, include source in npm `files`; use Pi jiti, no consumer build.
- **Option B (later npm artifact):** prebuild JS in release pipeline; use `pi.extensions` to existing `dist` and verify `npm pack --dry-run`, but Git tag must contain prebuilt files or a proven production build hook.

Do not let npm and Git installs resolve to different entrypoint paths unless both have dedicated smoke tests.

## 3. Dependency and module identity

| Kind | Package location | Example | Rule |
|---|---|---|---|
| Host-provided | Pi runtime | `@earendil-works/pi-coding-agent`, `@earendil-works/pi-ai`, `typebox` | In peerDependencies if imported; do not bundle/duplicate |
| Runtime | pi-memory package | SQLite driver, schema parser | `dependencies`; includes native install/rebuild CI |
| Dev-only | maintainer environment | typescript, vitest, prettier | `devDependencies`; unavailable after Git production install |
| Data | external user data dir | SQLite, Notes, Snapshots | Never under package checkout nor consumer code by default |

Avoid native `better-sqlite3` as a hard dependency until Node ABI, bundled Pi distribution, Windows/macOS, and clean Git installs are proven. Initial decision: evaluate `node:sqlite` availability on the pinned Node/Pi runtime and fallback strategy; do not assume it works identically across all hosts.

## 4. Settings precedence & identity

- `<agent-dir>` defaults to `~/.pi/agent`; `PI_CODING_AGENT_DIR` can change it.
- Global user settings live under `<agent-dir>/settings.json`; project settings under `.pi/settings.json` after trust.
- `pi install <source>` registers a user package; `pi install --local <source>` project-scoped.
- Pi identifies npm packages by name, Git by URL ignoring ref, local by resolved path. Project entry normally replaces personal entry; `autoload:false` changes filtering behavior.
- `pi config` filters enabled resources; `--no-extensions` disables discovered extensions, while an explicit `-e` can load.
- `defaultTools`, `--no-tools` or `--tools` can hide `memory_search`, even if extension itself loaded. P0 doctor is a command and does not require an LLM or Tool activation.
- Avoid command/tool collisions: Pi can suffix duplicate commands `/name:1`, `/name:2`; use unique `pi-memory-doctor` and `memory_search` names.

## 5. Installation examples

Current source probe, from this repo root:

```sh
npm test
pi -e ./
# Inside Pi TUI: /pi-memory-doctor
```

Pinned Git user install (replace placeholder with committed, reviewed SHA):

```sh
pi install git:github.com/1998x-stack/pi-memory@<reviewed-commit>
pi list
pi config
# Start Pi and enter /pi-memory-doctor
```

Project install (project trust is required before it can load):

```sh
cd /path/to/consumer-project
pi install --local git:github.com/1998x-stack/pi-memory@<reviewed-commit>
pi config --local
```

Cleanup:

```sh
pi remove git:github.com/1998x-stack/pi-memory@<reviewed-commit>
```

Use `pi -ne` to disable discovered extensions for one run. Importantly, disabling/removing the package must not silently delete the user's long-term memory directory; a separate explicit purge command will be designed.

## 6. Update semantics and retention hazard

Pi's Git package manager resets checkout and can run `git clean -fdx` after update. Any `memory.sqlite` or `notes/` under managed checkout can be removed. Data root must be external, never relative to `import.meta.url`. Upgrades should use data migrations guarded by Snapshot backups, not blindly rebuild/overwrite.

Default data root proposal: `<agent-dir>/memory/` with strict filesystem permissions. Scope by validated project_id; use safe path join and reject symlink escapes. Package uninstall removes registration, **not** the data unless explicit user opt-in; docs must describe leftover files.

## 7. Release gates

- P0: Git/local smoke, version pin, trust/disable/reload matrix.
- P1: P0 repeated with `memory_search` and SQLite; verify clean node_modules & native compatibility.
- P2: repeated after adding Worker/model adapter; shutdown/worker/test isolation.
- P3: repeat with new prompts/skills/UI; no unexpected resource auto-discovery.
- P4: npm `pack`, full platform/mode matrix, migration/rollback and security audit.

The manifest probe is not evidence of a real Memory Engine. See [G0 checklist](phases/P0-install-contract.md).
