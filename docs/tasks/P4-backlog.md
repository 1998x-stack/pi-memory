# P4 Implementation backlog — evaluation, security and beta

> Primary plan: [P4 execution manual](../phases/P4-evaluation-release.md). 完整 benchmark/故障/隐私报告是发布门槛，不是可选文案。

依赖主线：`P4-01/02 → P4-03/04 → P4-05/06/07/08/09 → P4-10`。评测设计可在早期阶段先行。

## Task matrix

| ID | 任务 | 优先级 | 依赖 | 代码/交付路径 | 验收检查 |
|---|---|---|---|---|---|
| P4-01 | Reproducible eval runner | P0 | G1-G3 | evals/runner.ts, manifest schema | pinned env/model/task; reproducible pipeline |
| P4-02 | Ground-truth task suites | P0 | G1-G3 | evals/suites/** | repeated-bug, correction, branch, multi-hop, privacy |
| P4-03 | A/B/C/D/E experiment arms | P0 | P4-01, P4-02 | evals/arms.ts, config/flags.ts | only intended features vary; no leakage |
| P4-04 | Metrics and confidence intervals | P0 | P4-03 | evals/scorer.ts, statistics.ts | success, CI, wrong-memory, cost, failures |
| P4-05 | Crash/concurrency resilience | P0 | G2 | tests/faults/** | kill during publish, DB lock, corrupt index, recover |
| P4-06 | Adversarial privacy tests | P0 | G3 | tests/security/** | prompt injection, secret, cross-scope, rollback tombstone |
| P4-07 | Trace and full cost ledger | P0 | P4-01 | src/telemetry, evals/cost-ledger.ts | online+offline attribution and sanitized logs |
| P4-08 | Package/migration compatibility | P0 | G3 | package.json, scripts/release, migrations | clean install/upgrade/uninstall/rollback |
| P4-09 | Public documentation & controls | P1 | P4-08 | docs/installation, troubleshooting, SECURITY.md | new-user walkthrough and explicit privacy choices |
| P4-10 | Benchmark report & beta tag | P0 | P4-01..09 | evals/reports, docs/benchmarks.md | all metrics/negative results disclosed; G4 signoff |

## Execution checklist

- [ ] **P4-01 Reproducible eval runner** — complete implementation + tests + PR evidence
- [ ] **P4-02 Ground-truth task suites** — complete implementation + tests + PR evidence
- [ ] **P4-03 A/B/C/D/E experiment arms** — complete implementation + tests + PR evidence
- [ ] **P4-04 Metrics and confidence intervals** — complete implementation + tests + PR evidence
- [ ] **P4-05 Crash/concurrency resilience** — complete implementation + tests + PR evidence
- [ ] **P4-06 Adversarial privacy tests** — complete implementation + tests + PR evidence
- [ ] **P4-07 Trace and full cost ledger** — complete implementation + tests + PR evidence
- [ ] **P4-08 Package/migration compatibility** — complete implementation + tests + PR evidence
- [ ] **P4-09 Public documentation & controls** — complete implementation + tests + PR evidence
- [ ] **P4-10 Benchmark report & beta tag** — complete implementation + tests + PR evidence

## 统一 DoD（所有任务）

- [ ] 实现与声明的 API / schema 一致；边界输入（空值、坏数据、取消、越权）有负例。
- [ ] 新增 unit/integration tests 和测试 fixture；`npm run typecheck` / `npm test` 应通过（脚本须在 P1-01 创建）。
- [ ] 不记录真实密钥/用户私有数据；错误不阻断 Pi 原生 Agent Loop。
- [ ] PR 描述标注：关联任务 ID、设计文档、测试命令、验收截图/日志、已知风险。
- [ ] 未通过验收条款不能将 checkbox 标为完成；此表当前全部未开始。

## Phase gate

G4: 由对应 Phase 主文档的 Exit Criteria 判定，不仅以 checkbox 数量判定。


## Upstream audit gate additions

本 Phase 的全部任务除原有 DoD 外，还须满足 [P0安装契约](../phases/P0-install-contract.md)、[Pi源码审计](../10-upstream-audit.md) 的相应 F01–F20 修复条款，并提交 [生命周期矩阵](../12-runtime-lifecycle-matrix.md) 和 [数据/安全测试矩阵](../qa/data-integrity-test-matrix.md) 的通过证据。