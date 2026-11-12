# Pi Extension integration — verified API surface and plan

> 依据 Pi 当前仓库 `packages/coding-agent/docs/extensions.md`、`session-format.md`、`compaction.md`、`examples/extensions/prompt-customizer.ts`、`summarize.ts`。上游接口可能变化；实现时必须 pin Pi 版本并运行契约测试。

## 1. Packaging strategy

独立 npm/Git Pi Package，入口 `src/extension/index.ts`，非 fork。Pi 会自动发现全局 `~/.pi/agent/extensions/`、项目 `.pi/extensions/` 或安装的 package；开发期可用 `pi -e ./src/extension/index.ts` 验证。项目扩展仅在项目获信任后加载；第三方扩展具有当前进程权限，必须审查来源。

示例 package manifest（最终以 Pi 包文档与发布环境测试为准）：

```json
{
  "name": "pi-memory",
  "private": true,
  "type": "module",
  "pi": { "extensions": ["./dist/extension/index.js"] }
}
```

## 2. Lifecycle hook contract

| 事件 | 目的 | 允许执行 | 禁止 |
|---|---|---|---|
| `session_start` | 初始化 scope，获取 session 文件路径 | 读取小 metadata / snapshot pointer | 大规模同步重建索引 |
| `before_agent_start` | L4 注入 | 修改 `event.systemPromptOptions.sections.pi_memory` | 每次替换整个 prompt / 长时间 Dreaming |
| `agent_settled` | 最终 run 结束 | enqueue durable ingestion job | 等待模型长时间抽取 |
| `session_compact` | 索引 compaction 元数据 | record anchor + summary relation | 把 summary 当历史事实 |
| `session_tree` | 观察新旧叶子，更新 scope/branch cursor | lightweight metadata | 错误混合分支 |
| `session_shutdown` | flush/close/cleanup | release leases, drain local handles | 删原始 JSONL |
| `tool_result` (可选) | 捕获事件供监控 | 仅轻量摘要/统计 | 盲目保存原始 secrets |
| `pi.registerTool` | 搜索/查看/保存（权限限制） | schema validated Tool | 容许外部文本调用系统指令 |

### 为什么使用 `agent_settled` 而非 `agent_end`

一次 low-level agent run 后仍可能重试、Compaction 恢复或消费 queued messages。`agent_settled` 为最终 settled 通知，`event.aborted` 应被记录为状态；即使 aborted 仍可索引证据，但不得默认标记“成功解决”。Worker 应基于 Source 事件客观判断结果。

## 3. Recommended extension code shape (pseudo-implementation)

```typescript
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { openEngine } from "../core/engine.js";

export default function (pi: ExtensionAPI) {
  const engine = openEngine(); // lazy init; no long-lived timers here

  pi.on("before_agent_start", async (event, ctx) => {
    const text = await engine.inject({
      cwd: ctx.cwd,
      prompt: event.messageType === "user" ? event.prompt : undefined
    });
    if (text) event.systemPromptOptions.sections.pi_memory = text;
  });

  pi.registerTool({
    name: "memory_search",
    label: "Search project memory",
    description: "Find verified memories with source references.",
    parameters: Type.Object({
      query: Type.String(),
      limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 10 }))
    }),
    async execute(_id, params, signal, _update, ctx) {
      const hits = await engine.search({
        query: params.query,
        limit: params.limit ?? 5,
        cwd: ctx.cwd,
        signal
      });
      return { content: [{ type: "text", text: JSON.stringify(hits) }] };
    }
  });

  pi.on("agent_settled", async (event, ctx) => {
    const file = ctx.sessionManager.getSessionFile();
    if (!file) return;
    await engine.enqueue({
      sessionFile: file,
      sessionId: ctx.sessionManager.getSessionId(),
      leafId: ctx.sessionManager.getLeafId(),
      aborted: event.aborted
    });
  });
}
```

上面示例是 **目标接口草图**，不是已实现功能；`engine`、容错、权限和工具取消信号均需实现。`before_agent_start` hook 中修改结构化 `sections`，避免无条件覆盖整个 System Prompt；若旧 Pi 不支持，应由适配层检测并 fail open。

## 4. Pi Session v3 facts

默认路径类似：`~/.pi/agent/sessions/--<path>--/<timestamp>_<session-id>.jsonl`。SessionHeader 有 `id/cwd/timestamp/version`；SessionEntry 有 `id/parentId/timestamp/type`。

需要处理的 entries：

- `message`：role user/assistant/toolResult/system，assistant content 可能包含 `toolCall` block；toolResult 用 `toolCallId` 关联。
- `compaction`：`summary/firstKeptEntryId`，表示模型上下文裁剪边界；raw entries 仍可用于审计。
- `branch_summary`：切换分支时可能包含摘要，不等于完整原始记录。
- `context_edit`：影响 model-visible projection，raw history 保留原条目，需在索引标注是否已从当前上下文移除。
- `custom/custom_message`：custom 不发送模型；custom_message 会进入上下文，需防止 extension 再次重复写入自身记忆。
- `session_info` / `usage` / `model_change` / `thinking_level_change`：用于元数据、评测和成本。

### Branch correctness contract

- 原始事件唯一键：`source_file_hash + session_id + entry_id`（实现可用规范化稳定路径/文件标识）。
- 分支是 `(session_id, leaf_id)`，Parent 链遍历要检测环、缺失父节点和多根。
- 索引所有合法 raw entries；生成“本次行动的事实”须明确使用活动 leaf 和对应因果范围。
- `/fork` 生成新 session 时保留 `parentSession` 链接，不默认为同一个 session。
- 不得把同一文件全部 messages 按顺序连接成一个平面 Conversation。

## 5. Tool surface and control

- `memory_search(query, limit?, scope?)`：默认只查 verified，candidate 需显式 opt-in；返回 Evidence refs。
- `memory_get(id)`：读取 Note/Wiki 和来源（遵守 scope 权限）。
- `memory_remember(text, scope?)`：MVP 建立人工候选；验证 / 自动推广由后续阶段实现。
- `/memory status|search|review|dream|forget`：TUI/RPC/CLI 支持逐步扩展；命令不可假装存在。

每个工具应处理 `AbortSignal`、最大结果/字节数、Path traversal、敏感字符串掩码；运行时缺少模型凭证时 `memory_search` 仍应可用。

## 6. Compaction interaction

- 不覆盖 Pi 的 `session_before_compact` 默认实现：P1 只订阅 `session_compact` 进行索引。
- L4 遵循注入预算，不把 Compaction Summary 再作为独立永久记忆重复注入。
- 若 L4 以 `sections.pi_memory` 修改，保证内容稳定，避免每轮无意义缓存失效。
- 内存进程重载/新 Session 自动重新读取已发布 Snapshot，而非读取 draft。

## 7. Contract tests to pin

1. 新旧 Session open/reload/new/resume/fork 均能取到正确 session ID/leaf ID。
2. `/tree` 切换后结果的 branch scope 不串线。
3. `/compact` 后仍可通过 L1 找到原始被压缩的证据。
4. Extension 加载异常不阻断正常 Pi 流程。
5. `before_agent_start` sections 注入与其他 extensions 共存，不覆盖它们的内容。
6. `agent_settled` 不导致无限 continuation；重复触发不会重复入队。
7. TUI、RPC、headless 无 UI 时不调用需交互的确认接口。

See [P1 tasks](tasks/P1-backlog.md) and [official extension docs](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/extensions.md).