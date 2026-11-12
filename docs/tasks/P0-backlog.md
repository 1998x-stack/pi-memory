# P0 install and runtime contract backlog

> **G0 still open**, but real Linux Pi 1.5.2/Node22.19 CI has now verified source+Git Package install, RPC registration, no-extensions behavior, and Git update/remove state retention. Trust/TUI/reload/multi-platform remain.

| ID | Priority | Task | Depends | Output | Acceptance |
|---|---|---|---|---|---|
| P0-01 | P0 | Pin Pi upstream, Node runtime and API sources | none | docs/10-upstream-audit.md | all claims linked to exact Pi source |
| P0-02 | P0 | Source Pi manifest and harmless extension probe | P0-01 | package.json, extensions/pi-memory.ts, tests/installation-manifest.test.mjs | npm test + Git package path exists |
| P0-03 | P0 | Local/temporary/user Git installation tests | P0-02 | docs/qa/install-results.md | pi list/config, doctor command, no missing exports |
| P0-04 | P0 | Project trust/reload/TUI/RPC/print | P0-03 | QA matrix + logs | disabled in untrusted project; no stdout corruption |
| P0-05 | P0 | Git update/checkout clean/deletion-state isolation | P0-03 | QA logs | update/remove don't delete user memory store |
| P0-06 | P0 | G0 signoff and compatibility table | P0-03..05 | results with Pi commit/OS/version | explicit pass/fail and next compatibility watchpoints |

## Checklist

- [x] P0-01 upstream pin recorded in audit (Pi commit a40abeca; source review completed)
- [x] P0-02 source entrypoint package static checks ([CI passed](https://github.com/1998x-stack/pi-memory/actions/runs/43142215140); no live Pi claim)
- [ ] P0-03 real installation smoke on Pi — **partial**: Git and one-shot source PASS ([CI](https://github.com/1998x-stack/pi-memory/actions/runs/43143058406)); permanent local and trust-gated project install pending
- [ ] P0-04 trust/mode behavior verified — **partial**: RPC and --no-extensions PASS; trust-negative/TUI/JSON/print/reload pending
- [x] P0-05 update/removal state preservation verified **for pinned Linux Git install** ([CI](https://github.com/1998x-stack/pi-memory/actions/runs/43144184617)); other platforms remain Gate G0 follow-up
- [ ] P0-06 G0 report approved

Use [the P0 manual](../phases/P0-install-contract.md). Do not check any box until measured.
