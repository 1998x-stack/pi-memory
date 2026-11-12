# Evaluation and ablation protocol

## 1. Research questions

- RQ1：跨 Session Transcript Search 能否降低重复排查成本？
- RQ2：Notes 是否优于直接检索原始日志？
- RQ3：Dreaming 能否降低错误记忆的复用/传播？
- RQ4：Wiki 是否在多跳任务中优于 Notes+Search？
- RQ5：L4 的 Token 开销是否带来净收益？
- RQ6：加入离线 Token、人工审核时间和维护成本后，完整系统是否仍有效？

## 2. Experimental arms

| Arm | Features | Primary causal comparison |
|---|---|---|
| A | Pi vanilla | 基线 |
| B | A + L1 FTS | B vs A：是否仅检索即可收益 |
| C | B + manual/online verified L2 | C vs B：Notes 抽象收益 |
| D | C + Dreaming | D vs C：离线纠错收益 |
| E | D + Wiki + dynamic L4 | E vs D：结构化知识+注入净效应 |

为隔离效应，建议再做 `E-no-wiki`、`E-no-L4` 与 `E-no-dream` 子消融（资源允许时）。不要把性能提升笼统归因于 Dreaming。

## 3. Benchmark suites

### S1: Repeat-bug resolution

构造三个相关 Session：初次修复、重复故障、环境版本变化。观察重复错误是否减少。使用真实可执行仓库和 tests（而非仅询问模型）。

### S2: Contradictory memory

Session 1 留下错误诊断，Session 2 给出确定性的反证工具结果，Session 3 询问实际解决方案。比较 D/C 的纠错率和误用率。

### S3: Branch and compaction

一个 Pi JSONL 有成功/失败两个分支、一次 compaction 和一次 context_edit。验证 search/evidence 是否混淆分支；无 UI 重现。

### S4: Multi-document synthesis

把架构决策、测试失败与修复 PR 分散在多个 Session/Markdown 页面中，必须聚合多个来源才能得出结论；用于评估 Wiki。

### S5: Security and privacy

跨项目检索、含 fake API key 的 Tool Output、注入恶意文档、删除后 rollback、orphaned evidence、符号链接逃逸。

## 4. Required dataset manifest

```yaml
suite: repeat-bug-v1
pi_version: pinned-commit
model: provider/model-id
task_ids: [bug-001, bug-002, bug-003]
seed: 42
container_image: image@sha256:...
repo_revision: git-sha
tools_enabled: [read, edit, bash, write]
time_budget_seconds: 900
token_budget: 200000
ground_truth: tests/expected-outcome.json
```

记录真实的版本/环境，不要使用占位版本宣称已完成可复现实验。测试账号/环境不得含真实秘密。每个 task 的模型、工具、预算尽量一致；若模型 API 不保证确定性，至少多次重复并报告波动。

## 5. Metrics (operational definitions)

| Metric | Definition | Source |
|---|---|---|
| Task Success Rate | 通过隐藏/公开验收测试且满足任务约束的任务比例 | Test runner |
| Repeat-failure Rate | 遇到已见错误后再次失败/重复错误操作的比例 | Trajectory labels |
| Evidence Precision | verified Notes 中有真实支撑证据的比例（人工抽样+自动校验） | Annotation |
| Wrong-memory Utilization | 因过时/错误 Memory 导致错误决定的回合占比 | Annotated traces |
| Recall@k | query 的相关 Memory 是否出现在前 k | Retrieval dataset |
| MRR / nDCG | 检索排序质量 | Grounded ranking labels |
| Injection Token Cost | 每次运行额外注入 tokens | Model usage |
| Online/Offline Total Cost | agent+search+extract+dream+wiki token 与外部费用合计 | Usage ledger |
| Latency p50/p95 | prompt-to-first-token、Search tool、索引/发布时延 | Trace spans |
| Correction Lag | 新反证出现到旧记忆撤回的时间/Session 数 | Audit journal |
| Rollback/Recovery | crash 后是否仍可读取最后一个有效 snapshot | Fault tests |

## 6. Evaluation discipline

- 基于固定预定义 task suites，不因某组效果差临时换题；
- 尽量盲测：Judge 不读取实验组标签；主成功指标优先确定性测试；
- 记录每组所有尝试、失败、超时、异常、人工干预；
- 报告均值、方差、置信区间（推荐 bootstrap）和样本数；
- 若没有足够样本，明确“探索性结果”，不做显著性论断；
- LLM-as-judge 只作为辅助，保留 rubric/版本和抽样人工复核；
- 对比必须包含 Dreaming 预计算 Token 成本和缓存影响；
- P4 之前先做测试框架 smoke，不把本项目早期 demo 当论文级证据。

## 7. Suggested non-binding release targets

- Parser/source correctness: zero lineage violations across golden fixtures.
- Privacy/ACL: zero cross-scope leaks in adversarial suite.
- Corrupt note or failed Dreaming: no published snapshot corruption.
- Task performance: at least non-inferior to baseline within uncertainty, and report all regressions.
- Cost: online/offline breakdown complete for 100% evaluated runs.

任务提升幅度不预设绝对比例；没有显著提升时发布报告并说明使用边界，比声称“持续学习成功”更可信。

## 8. Report format

```text
evals/reports/<run-id>/
  manifest.json
  tasks.jsonl
  outcomes.jsonl
  metrics.json
  confidence-intervals.json
  cost-ledger.csv
  failures.md
  reproduction.md
```

See [P4](phases/P4-evaluation-release.md), [Security](04-security-privacy.md).