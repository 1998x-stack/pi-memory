# Phase 4 — Long-horizon evaluation, hardening & beta release

**Goal**：证明 Memory 在哪些情境下有净价值；把前 3 阶段的系统变成可安装、可恢复、可观测、可解释的 Pi Package。不得以“测试脚本能跑”取代对照实验。

## 0. Entry / Exit

**Entry**：G1–G3 的主功能可运行且版本/安全约束稳定；Model adapter 可记录在线与离线 usage。

**Exit G4**：
- 执行 A/B/C/D/E 主消融并提交 manifest、任务结果和全部成本；
- Source/权限/伪造/并发/删除/故障恢复测试有结论；
- 冷启动安装、升级/迁移、卸载和禁用都有可执行验证；
- README、CLI help、troubleshooting、security policy 完整，打 beta tag；
- 若结果无显著收益，也如实报告，列出失败边界。

## 1. Work items and implementation detail

### P4-01 — Benchmark runtime & reproducibility

**Implementation**：`evals/runner.ts`、`evals/manifest.schema.json`；固定 Pi commit、model ID/version、工具权限、任务仓库 commit、Node 版本、容器或 sandbox、Token/时间预算。处理重试、timeout、日志脱敏，输出每次 run 的 session JSONL 位置和证据。

**Acceptance**：同 fixture 在 clean environment 可复现至少运行流程与判分，manifest 中无缺失关键版本字段。

### P4-02 — Dataset suites with ground truth

**Implementation**：`evals/suites/repeated-bug/`、`contradiction/`、`branch-compaction/`、`multi-hop/`、`privacy/`。真实可执行测试与规范化的预期结果；训练/开发集与报告集分离，避免“看到答案才设计记忆”。

**Acceptance**：每套有任务描述、起始仓库、参考 evidence/评估脚本、预期结果、攻击数据脱敏版本。

### P4-03 — Ablation arms A/B/C/D/E

**Implementation**：`evals/arms.ts`、`config/flags.ts`，每组只打开明确的 Memory 组件；记录功能开关快照。A vanilla Pi；B + L1；C + L2；D + Dreaming；E + Wiki/L4；资源允许时做 no-Wiki/no-L4 对照。

**Acceptance**：组别差异可机器检查；禁用功能不会暗中注入 L4；同一基础模型和任务资源预算。

### P4-04 — Deterministic task scoring & stats

**Implementation**：`evals/scorer.ts`、`statistics.ts`。优先跑测试/静态判定，辅助人工 blind-review 或 LLM-as-judge（标记版本与 rubric）；计算 Task Success、Wrong-memory Utilization、Evidence Precision、Recall@k、成本与 p95。

**Acceptance**：报告显示 N、mean、variance、CI、失败详情；没有证据不报告“提升 X%”。

### P4-05 — Fault injection, crash & concurrency

**Implementation**：`tests/faults/`。worker mid-publish kill、SQLite lock、损坏 DB、JSONL half-write、两 worker 发布竞争、Snapshot pointer 损坏、证据删除、重建索引。设计恢复/报警/日志。

**Acceptance**：最后一个有效 Snapshot 可读取，无 silent data loss；fail open 可验证；恢复脚本文档化。

### P4-06 — Security regression & red-team fixtures

**Implementation**：`tests/security/`；不可信 README/Tool Result 存储指令、fake key、路径遍历、跨项目查询、rollback resurrection、custom message 注入、YAML 异常解析。人工审查最有风险的 L4 Promotion。

**Acceptance**：已定义所有负例通过；未知风险明确记录，不能“安全 100%”。

### P4-07 — Observability & cost ledger

**Implementation**：`src/telemetry/*`、`evals/cost-ledger.ts`；独立记账在线 agent、Retrieval、Extraction、Dreaming、Wiki builder；token、latency、cache hit、human approval time；默认只留无敏感内容的 trace metadata。

**Acceptance**：每个 benchmark run 成本可归属且不双计；可导出 JSON/CSV，缺失 usage 要有明显警告。

### P4-08 — Packaging, migrations & compatibility

**Implementation**：`package.json`、`scripts/release.ts`、`src/store/migrations/*`；可通过 Pi package 标准 npm/Git 安装；集成 pinned Pi stable，提供新版本 API 契约检查。升级前备份、失败还原 schema/snapshot。

**Acceptance**：clean install、upgrade、disable、uninstall、migration rollback smoke 通过；npm 包不携带私有资料或 fixture secrets。

### P4-09 — User/maintainer docs and security disclosure

**Implementation**：更新根 README、`docs/installation.md`、`docs/troubleshooting.md`、`SECURITY.md`、`CHANGELOG.md`、`CONTRIBUTING.md`；解释自动捕获/发送到远端模型/遗忘和原始 Pi JSONL 的边界。提供 CLI 和 Pi TUI 示例。

**Acceptance**：新用户按文档在干净机器完成“安装→新 Session recall→禁用→清除派生数据”，不需要开发者指导。

### P4-10 — Results report, release gate & beta tag

**Implementation**：`evals/reports/<run-id>/`、`docs/benchmarks.md`、Release notes；记录适用场景、失败案例、隐私风险、默认配置、未来兼容路线；只有 G4 全部通过才发布 beta。

**Acceptance**：每项结论追溯 task/trace/manifest；报告不选择性省略失败；发布版本和 commit hash 对应。

## 2. Evaluation sequence

```text
1. Freeze benchmark suites + pinned environments.
2. Run A (vanilla Pi), save trajectories & cost.
3. Run B, C, D, E with same task matrix and budgets.
4. Blind-score task outcomes and label memory use.
5. Calculate success/variance/CI, online+offline cost.
6. Investigate regressions / hallucinated memories.
7. Run privacy/crash/race/rollback suites.
8. Publish report including negative findings.
9. Release beta only if security and reproducibility gates pass.
```

## 3. Hard release blockers

- Secret/cross-scope leaks, invalid source citations or wrong branch promotion.
- User forget can be undone by rollback.
- Corrupt memory blocks Pi execution.
- No reproducible recovery of last valid Snapshot.
- Inability to distinguish proposed from implemented features.
- Missing cost ledger or benchmark task outcome audit trail.

## 4. Non-blocking issues (document honestly)

- Vector search absent (if FTS adequate).
- UI may be text-only CLI.
- Benchmarks may show no statistically significant benefit for some tasks.
- Model dependent quality variation.
- Wiki may have no benefit for single-hop retrieval.

## 5. After beta

Potential future phases: cross-agent adapters, MCP, opt-in team sharing, embedding/hybrid retrieval, smarter event-driven Dreaming, richer Memory Explorer UI. None should block P4.

Task-by-task: [P4 Backlog](../tasks/P4-backlog.md). Protocol: [Evaluation](../06-evaluation-plan.md).