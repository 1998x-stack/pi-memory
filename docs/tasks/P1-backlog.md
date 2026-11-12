# P1 Implementation backlog — searchable, branch-aware Pi Memory

> Primary plan: [P1 execution manual](../phases/P1-transcripts-retrieval.md). 所有任务均为 **TODO**。工作量估算仅供优先级排序，不表示工期承诺。

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