# Product principles, scope & success criteria

## 1. 要解决的问题

Pi 已经能够持久化会话，但 *Session 可恢复* 不等于 *Agent 能跨会话利用可靠经验*。Pi Memory 将历史执行轨迹变为有出处、可验证、可修改、可按任务检索的知识，目标是减少重复排障并提高跨 Session 编码任务成功率。

**North Star**：在相同任务、模型和总体成本约束下，启用 Memory 后的 long-horizon task success 提高；即使收益未达预期，也能通过消融、证据链和成本报告解释原因。

### 用户故事

- 开发者切换新 Session 后，Pi 仍知道此项目已验证的架构约束和故障解决经验。
- Agent 能引用原始 Pi JSONL 的 session/entry/branch 来说明记忆来源。
- 发现旧经验与新测试冲突时，不直接覆盖原文，而生成候选纠正供验证和发布。
- 用户能够搜索、查看、纠正、删除某条记忆，并检查引用链和 Snapshot diff。
- 系统即使离线/LLM 故障也不妨碍原生 Pi 完成任务。

## 2. 不可违反的系统约束（Invariants）

1. **Source of truth**：Pi 原始 JSONL 为历史证据；索引、Notes、Wiki、L4 均可从合法来源重建。
2. **No silent authority escalation**：任何网页/Tool Result/生成 Note 均视为数据，不可自动升级为系统指令。
3. **Branch-aware**：同一 session 的不同叶子分支分别建 lineage；不把放弃分支结论当已确认事实。
4. **Evidence-first**：模型自称“通过测试”不算 verified；必须存在允许的可检查证据，或保持 candidate。
5. **Project isolation**：默认仅在当前用户+项目范围内检索，跨项目需显式授权。
6. **Budget-bounded**：L4 注入有硬上限；失败时采用空/旧的已批准 Snapshot 而不是阻塞 Agent。
7. **Atomic publish**：Dreaming 永远产生 Draft/Changeset，经验证才原子切换可见版本。
8. **Reversible**：可回滚 Snapshot；用户删除/撤回的记忆不得通过回滚重新出现。
9. **No secrets by default**：密钥、私人路径、可能的敏感日志不能无筛查进入长期记忆或 Git。
10. **Reproducibility**：评测固定数据、模型、Seed（若支持）、Pi 版本和 Token/美元成本口径。

## 3. 产品边界

### In scope

- Pi Extension 集成：`before_agent_start`、`agent_settled`、工具、命令、SessionManager API。
- L1 Session JSONL 解析/索引/引用；L2 用户手工与自动经验 Note；L3 Wiki；L4 小上下文索引。
- FTS5 先行，Embeddings 可插拔；离线 Dreaming；版本、审计、评测、隐私控制。
- 本地单用户优先，架构保留未来多 Agent / MCP Adapter 接口。

### Explicit non-goals（最初四阶段）

- 不修改 Pi Core Agent Loop、Compaction 核心算法或 Session 文件格式。
- 不进行模型微调；不保证模型“永久自我进化”。
- 不提供默认云同步、多人实时编辑、跨组织共享权限系统。
- 不把所有历史原文自动写进提示词；不自动提交隐私记忆到 Git。
- 不承诺 Wiki 或 Vector Search 一定优于 BM25；需评测决定。

## 4. 成功标准与拒绝标准

初始 *建议* Gate（待 P4 测量校准），不能把它们误写成实测性能：

| 维度 | 初始约束/目标 | 证据 |
|---|---|---|
| 数据正确性 | branch/compaction fixture 100% 不串线 | Parser golden tests |
| 数据重复 | 同一事件重复索引不会产生重复索引记录 | Idempotency tests |
| 来源透明度 | 自动验证 Note 100% 有可解析 Evidence | Provenance checks |
| 资源保护 | 注入不超过配置的 token budget | Token counting tests |
| 安全 | 跨项目未授权读取为 0；恶意指令不晋升 | Security cases |
| 可用性 | 记忆服务故障不阻断原生 Agent | Fault injection |
| 持续学习 | Memory 相比 baseline 的收益和方差可复现 | Ablation eval |
| 成本 | 记录在线 + 离线两类 tokens/latency/cost | Cost report |

## 5. 概念澄清

- **Pi Compaction**：为了当前 Session 继续推理而压缩上下文，不是长期 Memory。
- **L1 Transcripts**：原始事件及分支历史，可检索的证据源。
- **L2 Notes**：带适用条件与来源的经验，不只是“摘要”。
- **L3 Representations**：面向多跳问题的结构化 Wiki/索引。
- **L4 Injection**：在当前 run 预先加载少量知识，不提高原有指令权限。
- **Dreaming**：离线检查、纠错、合并、重新组织和发布的工作流，不是一个“总结历史”Prompt。

阅读顺序：[架构](01-architecture.md) → [路线图](05-roadmap.md) → [P1](phases/P1-transcripts-retrieval.md)。