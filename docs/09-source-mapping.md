# Source alignment: Anthropic research vs Pi implementation

## 1. Primary sources

- Anthropic: [The components of agent memory](https://www.anthropic.com/research/components-of-agent-memory) — 四层记忆、Dreaming、长期任务实验。本文档的架构是**工程推导**，不是 Anthropic 公开的可复刻私有实现。
- Pi: [repository](https://github.com/earendil-works/pi) and [Coding Agent](https://github.com/earendil-works/pi/tree/main/packages/coding-agent).
- Pi: [Extensions](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/extensions.md).
- Pi: [Session file format](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/session-format.md).
- Pi: [Compaction](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/compaction.md).
- Pi: [Package distribution](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/packages.md).
- Pi sample: [prompt-customizer.ts](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/examples/extensions/prompt-customizer.ts), [summarize.ts](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/examples/extensions/summarize.ts).

## 2. Map the concepts

| Anthropic concept | Pi native feature | Pi Memory proposed implementation |
|---|---|---|
| L1 Transcripts | Session JSONL + `id/parentId` | Parser, event index, source refs, active branch |
| L2 Memory Notes | no requirement to modify core | Markdown/YAML + schema, review and extraction |
| L3 Representations | filesystem, custom tools | linked Wiki + provenance graph |
| L4 Injected Context | `before_agent_start` prompt sections | bounded curated context |
| Dreaming | custom worker/model calls | CLI/worker, draft, validate, snapshot publish |

## 3. Verified Pi API behavior (as reviewed 2026-11-12)

- Extension 可以用 `pi.on(...)` 注册事件、`pi.registerTool(...)` 注册自定义工具，`pi.registerCommand(...)` 注册命令。
- `before_agent_start` 可以操作 `event.systemPromptOptions.sections`；修改结构化 section 比无条件替换整个 system prompt 更适合缓存。
- `agent_end` 不是最终 idle，`agent_settled` 是最终通知事件。
- `ctx.sessionManager.getSessionFile()/getSessionId()/getLeafId()/getBranch()` 用于会话导航。
- Pi Session v3 是 JSONL tree，`compaction`、`context_edit` 会影响 model-visible projection，但不意味着 raw records 消失。
- Pi Package 支持从 npm/Git/local 安装扩展，`pi -e` 可用于本地测试。

## 4. Deliberately NOT claimed

- Anthropic 没有公开统一四层数据库 Schema；我们设计的 `MemoryNote`/`Changeset` 为独立格式。
- 文中建议的 token budget、任务指标与调度频率不属于 Pi/Anthropic 官方常量。
- Pi 当前无 `pi-memory` 原生命令；这些是拟实现的 extension/CLI。
- 上游 Pi 可能继续演进，需在 CI 固定依赖、定期运行 API contract tests。
- Wiki 与 Dreaming 的收益在不同任务中不保证成立，必须按 [评测方案](06-evaluation-plan.md) 验证。

## 5. Cross-project bridge

Pi JSONL → 统一 canonical events；未来可添加 Claude Code / Codex / OpenHands / LangGraph / SWE-agent adapters。**先把 Pi 的 branch semantics 测对**，再抽象为通用 schema；避免为兼容多框架而牺牲 provenance。

## 6. Documentation maintenance

每次上游更新 Pi 版本：
1. 重新检查上述链接的接口和事件顺序；
2. 更新 `docs/02-pi-extension-integration.md`；
3. 运行 branch/compaction/tool contracts；
4. 在 release notes 记录兼容范围。

来自模型的任何推导必须注明 Proposed/Decision，不得写成上游已提供功能。