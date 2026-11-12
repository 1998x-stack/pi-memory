# P0 install and runtime contract backlog

> P0 is **not completed**. Source-only manifest and install probe have been added, but no real Pi runtime install has been performed in this audit environment.

| ID | Priority | Task | Depends | Output | Acceptance |
|---|---|---|---|---|---|
| P0-01 | P0 | Pin Pi upstream, Node runtime and API sources | none | docs/10-upstream-audit.md | all claims linked to exact Pi source |
| P0-02 | P0 | Source Pi manifest and harmless extension probe | P0-01 | package.json, extensions/pi-memory.ts, tests/installation-manifest.test.mjs | npm test + Git package path exists |
| P0-03 | P0 | Local/temporary/user Git installation tests | P0-02 | docs/qa/install-results.md | pi list/config, doctor command, no missing exports |
| P0-04 | P0 | Project trust/reload/TUI/RPC/print | P0-03 | QA matrix + logs | disabled in untrusted project; no stdout corruption |
| P0-05 | P0 | Git update/checkout clean/deletion-state isolation | P0-03 | QA logs | update/remove don't delete user memory store |
| P0-06 | P0 | G0 signoff and compatibility table | P0-03..05 | results with Pi commit/OS/version | explicit pass/fail and next compatibility watchpoints |

## Checklist

- [ ] P0-01 upstream pin recorded in audit
- [ ] P0-02 source entrypoint package static checks
- [ ] P0-03 real installation smoke on Pi
- [ ] P0-04 trust/mode behavior verified
- [ ] P0-05 update/removal state preservation verified
- [ ] P0-06 G0 report approved

Use [the P0 manual](../phases/P0-install-contract.md). Do not check any box until measured.
