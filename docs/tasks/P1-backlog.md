# P1 Implementation backlog — searchable, branch-aware Pi Memory

> Primary plan: [P1 execution manual](../phases/P1-transcripts-retrieval.md). **P1 Preview 已有真实代码和 CI，但所有任务的完整 DoD/G1 Gate 尚未达到**。下面列出部分交付，不能仅因子功能通过就将整个任务勾选。

依赖主线：`P1-01/02 → P1-03/04 → P1-05/06/07 → P1-08/09 → P1-10`。P1-02 可与 P1-01 并行。

## Task matrix

| ID | 任务 | 优先级 | 依赖 | 代码/交付路径 | 验收检查 |
|---|---|---|---|---|---|
| P1-01 | Bootstrap & CI | P0 | none | package.json, tsconfig, vitest, .github/workflows | npm ci/typecheck/test on clean node |
| P1-02 | Session v3 fixtures | P0 | P1-01 | tests/fixtures/pi-v3/**, manifest.json | normal + branch + compaction + fork + corrupt tail covered |
| P1-03 | Streaming parser + normalize | P0 | P1-02 | src/transcripts/pi-reader.ts, normalize.ts | golden snapshots, malformed tail safe |
| P1-04 | Branch lineage/projection | P0 | P1-03 | src/transcripts/branch-resolver.ts | A/B leaves separated; context_edit/compaction correct |
| P1-05 | SQLite migration/indexer | P0 | P1-03 | src/store/migrations, src/transcripts/indexer.ts | reindex idempotent; half-line and crash recovery |
| P1-06 | FTS5 & lexical ranking | P0 | P1-05 | src/retrieval/fts.ts, ranking.ts | error/path exact match; index rebuild consistent |
| P1-07 | Scope/evidence/redaction | P0 | P1-04, P1-05 | src/core/scope.ts, evidence.ts, src/security | cross-project denied; source refs resolvable; secrets masked |
| P1-08 | Manual Note repository | P1 | P1-07 | src/notes/repository.ts, note schema | candidate/approved states, Markdown roundtrip |
| P1-09 | Pi Extension + memory_search + L4 | P0 | P1-06, P1-07, P1-08 | src/extension/index.ts, hooks.ts, tools.ts | new session recall; budget bounded; fail open |
| P1-10 | E2E demo & G1 report | P0 | P1-01..09 | examples/repeated-bug, tests/integration | Pi real run; source citation; all G1 criteria |

## Execution checklist

- [ ] **P1-01 Bootstrap & CI** — complete implementation + tests + PR evidence
- [ ] **P1-02 Session v3 fixtures** — complete implementation + tests + PR evidence
- [ ] **P1-03 Streaming parser + normalize** — complete implementation + tests + PR evidence
- [ ] **P1-04 Branch lineage/projection** — complete implementation + tests + PR evidence
- [ ] **P1-05 SQLite migration/indexer** — complete implementation + tests + PR evidence
- [ ] **P1-06 FTS5 & lexical ranking** — complete implementation + tests + PR evidence
- [ ] **P1-07 Scope/evidence/redaction** — complete implementation + tests + PR evidence
- [ ] **P1-08 Manual Note repository** — complete implementation + tests + PR evidence
- [ ] **P1-09 Pi Extension + memory_search + L4** — complete implementation + tests + PR evidence
- [ ] **P1-10 E2E demo & G1 report** — complete implementation + tests + PR evidence

## 统一 DoD（所有任务）

- [ ] 实现与声明的 API / schema 一致；边界输入（空值、坏数据、取消、越权）有负例。
- [ ] 新增 unit/integration tests 和测试 fixture；`npm run typecheck` / `npm test` 应通过（脚本须在 P1-01 创建）。
- [ ] 不记录真实密钥/用户私有数据；错误不阻断 Pi 原生 Agent Loop。
- [ ] PR 描述标注：关联任务 ID、设计文档、测试命令、验收截图/日志、已知风险。
- [ ] 未通过验收条款不能将 checkbox 标为完成；此表当前全部未开始。

## Phase gate

G1: 由对应 Phase 主文档的 Exit Criteria 判定，不仅以 checkbox 数量判定。


## Upstream audit gate additions

本 Phase 的全部任务除原有 DoD 外，还须满足 [P0安装契约](../phases/P0-install-contract.md)、[Pi源码审计](../10-upstream-audit.md) 的相应 F01–F20 修复条款，并提交 [生命周期矩阵](../12-runtime-lifecycle-matrix.md) 和 [数据/安全测试矩阵](../qa/data-integrity-test-matrix.md) 的通过证据。
## Current implementation review — partial progress

| Task | State | Current evidence | Remaining acceptance |
|---|---|---|---|
| P1-01 | partial | Node22.19 + node:test + GitHub Actions | TypeScript strict, migration/typecheck baseline |
| P1-02 | partial | Pi v3 branched-compacted fixture | fork/older versions/multi-root/nestedCalls full fixture corpus |
| P1-03 | partial | Streaming reader, stable normalized source ID, corrupt-tail tests | native full fixture coverage, schema version strategy |
| P1-04 | partial | branch/compaction/context edit projection and differential CI | observed-leaf event journal, varied Pi forks/compactions |
| P1-05 | partial | SQLite FTS5 transactional checkpoint, incremental/rewrite tests | DB migrations, source-deletion and crash/concurrency recovery |
| P1-06 | partial | lexical FTS, project-scope prefilter | exact code/path ranking evaluation and FTS rebuild |
| P1-07 | partial | path/cwd scope, basic redaction and owner+project filter | hardened secret policy, documented forget/error behavior |
| P1-08 | not started | schema documents only | manual Notes repository/verification |
| P1-09 | partial | actual Pi memory_search Tool, manual index command | bounded L4 and automated lifecycle capture safeguards |
| P1-10 | partial | Pi RPC synthetic session → new_session → search | actual coding task with reproducible success criteria |

**Review status:** L1 retrieval and Pi Package integration work; G1 is not satisfied. Start next with source-deletion reconciliation + manual Notes approval before enabling automatic capture.
