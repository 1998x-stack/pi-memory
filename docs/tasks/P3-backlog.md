# P3 Implementation backlog — knowledge wiki and context selection

> Primary plan: [P3 execution manual](../phases/P3-wiki-injection.md). 不把未经审核的 Wiki 直接写入 Pi System Prompt。

依赖主线：`P3-01 → P3-02/03 → P3-04/05/06 → P3-07/08 → P3-09`。

## Task matrix

| ID | 任务 | 优先级 | 依赖 | 代码/交付路径 | 验收检查 |
|---|---|---|---|---|---|
| P3-01 | Wiki taxonomy & criteria | P0 | G2 | src/wiki/taxonomy.ts, docs/wiki-taxonomy.md | topic thresholds, zero-page allowed |
| P3-02 | Wiki builder/materializer | P0 | P3-01 | src/wiki/builder.ts, materializer.ts | bounded compact pages, evidence footnotes |
| P3-03 | Link graph/backlinks | P0 | P3-02 | src/wiki/graph.ts, links.ts | supports/contradicts/supersedes provenance |
| P3-04 | Retrieval routing/rerank | P0 | P3-02 | src/retrieval/router.ts, rerank.ts | exact-code queries do not regress; hybrid fallback |
| P3-05 | Task-aware L4 selector | P0 | G2, P3-04 | src/injection/context-selector.ts, budget.ts | budget test; no disputed/revoked content |
| P3-06 | Promote/demote rule engine | P0 | P3-05 | src/injection/promotion.ts, rules.ts | draft→review→publish; AGENTS.md untouched |
| P3-07 | Wiki validation/propagation | P0 | P3-03, P3-06 | src/wiki/validator.ts, src/governance | no dangling cross-scope backlinks after delete |
| P3-08 | Review/inspect UX | P1 | P3-04, P3-07 | src/extension/commands.ts, src/cli/review.ts | CLI works without TUI; diff and citation visible |
| P3-09 | Multi-hop benchmark & G3 | P0 | P3-01..08 | evals/suites/multi-hop | wiki bloat + task success + token cost measured |

## Execution checklist

- [ ] **P3-01 Wiki taxonomy & criteria** — complete implementation + tests + PR evidence
- [ ] **P3-02 Wiki builder/materializer** — complete implementation + tests + PR evidence
- [ ] **P3-03 Link graph/backlinks** — complete implementation + tests + PR evidence
- [ ] **P3-04 Retrieval routing/rerank** — complete implementation + tests + PR evidence
- [ ] **P3-05 Task-aware L4 selector** — complete implementation + tests + PR evidence
- [ ] **P3-06 Promote/demote rule engine** — complete implementation + tests + PR evidence
- [ ] **P3-07 Wiki validation/propagation** — complete implementation + tests + PR evidence
- [ ] **P3-08 Review/inspect UX** — complete implementation + tests + PR evidence
- [ ] **P3-09 Multi-hop benchmark & G3** — complete implementation + tests + PR evidence

## 统一 DoD（所有任务）

- [ ] 实现与声明的 API / schema 一致；边界输入（空值、坏数据、取消、越权）有负例。
- [ ] 新增 unit/integration tests 和测试 fixture；`npm run typecheck` / `npm test` 应通过（脚本须在 P1-01 创建）。
- [ ] 不记录真实密钥/用户私有数据；错误不阻断 Pi 原生 Agent Loop。
- [ ] PR 描述标注：关联任务 ID、设计文档、测试命令、验收截图/日志、已知风险。
- [ ] 未通过验收条款不能将 checkbox 标为完成；此表当前全部未开始。

## Phase gate

G3: 由对应 Phase 主文档的 Exit Criteria 判定，不仅以 checkbox 数量判定。


## Upstream audit gate additions

本 Phase 的全部任务除原有 DoD 外，还须满足 [P0安装契约](../phases/P0-install-contract.md)、[Pi源码审计](../10-upstream-audit.md) 的相应 F01–F20 修复条款，并提交 [生命周期矩阵](../12-runtime-lifecycle-matrix.md) 和 [数据/安全测试矩阵](../qa/data-integrity-test-matrix.md) 的通过证据。