# Documentation hub / 文档导航

> 状态：设计与任务规划，尚无运行时代码。文档目标是把四个 Phase 拆成可实现、可验证、可回滚的工程交付。

## 总体设计

| 文档 | 内容 |
|---|---|
| [设计原则与边界](00-principles-and-scope.md) | Why, scope, non-goals, assumptions |
| [系统架构](01-architecture.md) | L1–L4 + Dreaming，数据流、状态机、故障模型 |
| [Pi Extension 集成](02-pi-extension-integration.md) | Hook 时间线、分支、Compaction、工具及命令 |
| [数据模型与存储](03-memory-data-model.md) | Source refs、Note、Index、Wiki、Snapshot |
| [安全与隐私](04-security-privacy.md) | Prompt injection、密钥、权限、遗忘语义 |
| [Phase 路线图](05-roadmap.md) | 依赖图、里程碑、入口/退出条件 |
| [评测设计](06-evaluation-plan.md) | 长程任务、实验分组、统计与总成本 |
| [运维与故障恢复](07-operations-and-reliability.md) | 幂等、事务、可观测性、回滚 |
| [接口与 CLI 契约](08-api-and-cli-contracts.md) | Extension、Engine、Tools、CLI |
| [论文与 Pi 源码映射](09-source-mapping.md) | 设计依据、已核实接口、非官方推导 |

## 四阶段执行手册

| Phase | 核心成果 | 执行文档 | 任务看板 |
|---|---|---|---|
| P1 | 可检索的 Pi Session、手工 Memory、基础 L4 | [P1](phases/P1-transcripts-retrieval.md) | [P1 Backlog](tasks/P1-backlog.md) |
| P2 | 自动候选经验、Evidence、Dreaming、Snapshot | [P2](phases/P2-capture-dreaming.md) | [P2 Backlog](tasks/P2-backlog.md) |
| P3 | Wiki、知识关系、智能注入与更新传播 | [P3](phases/P3-wiki-injection.md) | [P3 Backlog](tasks/P3-backlog.md) |
| P4 | Benchmark、消融、发布、运维与安全加固 | [P4](phases/P4-evaluation-release.md) | [P4 Backlog](tasks/P4-backlog.md) |

## ADR

- [ADR-0001：Extension-first](adr/0001-extension-not-fork.md)
- [ADR-0002：Markdown + SQLite](adr/0002-files-sqlite.md)
- [ADR-0003：版本化快照](adr/0003-snapshots.md)

## Schemas

- [Memory Note](schemas/memory-note.schema.json)
- [Dream Changeset](schemas/dream-changeset.schema.json)
- [Memory Hit](schemas/memory-hit.schema.json)
- [Ingestion Job](schemas/ingestion-job.schema.json)

## 工程工作方式

1. 阅读 [Roadmap](05-roadmap.md) 确定当前 Phase；按任务 ID 领取 [Backlog](tasks/P1-backlog.md)。
2. 每个任务至少对应：实现路径、接口、单元/集成测试、负例、验收证据。
3. 每个 Phase 最后进行集成验收；没有通过 Exit Gate 不进入下一阶段。
4. 附有“建议阈值”的数值均是初始目标，必须在 P4 对照实验中重新校准。

参考： [Pi](https://github.com/earendil-works/pi) · [Anthropic: The components of agent memory](https://www.anthropic.com/research/components-of-agent-memory)。
