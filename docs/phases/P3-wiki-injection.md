# Phase 3 — Knowledge Wiki, retrieval routing & curated L4

**Goal**：把分散的已验证 Notes 组织成主题知识网络，降低跨 Session 多跳问题的查找成本；同时实现低 Token、可解释、可撤回的任务相关上下文注入。Wiki 是可重建视图，不是替代原始证据。

## 0. Entry / Exit

**Entry**：G2 通过；Changeset/Snapshot 可信、有可解析的 Note Evidence 链。

**Exit G3**：
- 多条 related Notes 生成 Wiki 页面，能追溯到底层 Pi entries；
- Wiki 连接无断链、无未经授权的跨项目引用；
- 对多跳任务能从 Wiki→Note→Transcript 导航，而不是只有未验证总结；
- 无关/过期内容不会占用 L4；ContextSelector 受硬 budget 和状态/权限限制；
- Wiki 更新、删除、人工修订都走 Changeset + Snapshot，而不是改活跃文件。

## 1. Work items and implementation detail

### P3-01 — Knowledge taxonomy & navigation rules

**Implementation**：`src/wiki/taxonomy.ts`、`docs/wiki-taxonomy.md`。主题初版为 architecture / conventions / debugging / workflows / decisions；每个 page 有 `page_id, scope, summary, related_pages, evidence_note_ids, version`。明确什么时候建新页、什么时候更新已有页，避免“一次 Session 一篇 Wiki”。

**Acceptance**：10 条分散候选经验可组织成少量主题页，且不丢证据与适用条件；无需要时允许零 Wiki 页。

### P3-02 — Wiki page builder and materialization

**Implementation**：`src/wiki/builder.ts`、`materializer.ts`；从 verified Notes 构建可读 Markdown，记录 provenance footnotes；模型可建议结构/摘要，但代码负责合法化与引用校验；draft 写 staging，publish 后变 live view。

**Acceptance**：相同输入构建输出稳定（尽可能 deterministic）；raw content 保留引用而非复制大段原文；重建不会丢人工维护区。

### P3-03 — Knowledge graph and backlinks

**Implementation**：`src/wiki/links.ts`、`graph.ts`；边类型 `supports, contradicts, related_to, supersedes, depends_on`；所有边有来源/可信度/变更版本。删除/撤回 Note 时，索引知道哪些 Wiki 页受影响。

**Acceptance**：无 dangling links；graph cycle 允许但有导航深度限制；路径遍历限制避免检索爆炸。

### P3-04 — Query routing: FTS vs Notes vs Wiki

**Implementation**：`src/retrieval/router.ts`、`rerank.ts`。通过关键词/查询结构先判断精确事实查询（走 L1/FTS），经验类（走 L2），复杂多跳（Wiki + FTS）；为路由保留可解释理由与 fallback。不要一上来只靠 LLM router。

**Acceptance**：错误码精确查找不会因为 Wiki 被稀释；多文档查询能抓到多个来源；路由失败可退回 FTS。

### P3-05 — Task-aware context selection & budgeting

**Implementation**：`src/injection/context-selector.ts`、`budget.ts`。L4 用“稳定 Index + 少量动态 verified facts”；输入当前 task、scope、memory importance、freshness、reuse count、token budget；做去重与截断，并返回 `selected_ids` 和拒绝原因。

**Acceptance**：模型在新 Session 至少知道 Memory 工具与关键规则；Token 不超过配置；候选/过时/撤回 Note 绝不注入。

### P3-06 — Promotion/demotion lifecycle

**Implementation**：`src/injection/promotion.ts`、`rules.ts`。高价值且稳定的 Note 可提升到 L4；短期状态/过时规则需要降级；promotion 作为 Changeset operation，经审查再 publish；与 `AGENTS.md` 完全隔离。

**Acceptance**：记忆被 disputed/revoked 后在下个 run 的 L4 不出现；变更记录可追溯。

### P3-07 — Wiki consistency, staleness and privacy

**Implementation**：`src/wiki/validator.ts`、`src/governance/propagate.ts`。检查 Wiki 引用状态、schema、permissions、更新连锁反应；如果自动摘要含秘密或命令式恶意文本，拒绝发布。

**Acceptance**：Source/Note 删除时 impact set 完整；跨项目链接阻断；无权来源不能进入系统 prompt section。

### P3-08 — Inspect/review UX

**Implementation**：`src/extension/commands.ts`、`src/cli/review.ts`。`/memory status` 显示 Snapshot、Wiki 页数、候选差异；`/memory review` 看证据链和 diff；`/memory search` 显示 L1/L2/L3 来源及可能过期信息。

**Acceptance**：有/无 TUI 均可用 CLI 完成审查，review 不假装执行成功；用户能明确批准/拒绝单条变更。

### P3-09 — Multi-hop benchmark & Gate

**Implementation**：`evals/suites/multi-hop`，生成多个 Session 组成的架构问题，比较 L1 FTS vs L2 vs Wiki+Search vs Wiki+L4，记录任务正确率、导航步数、总 Token 与检索时延。

**Acceptance**：输出包括全部优势/退化例子；Wiki 页面数、平均大小和总字节被记录，避免 bloat；G3 通过。

## 2. Wiki design rule: compact, not encyclopedic

```text
wiki/index.md
wiki/architecture/system-overview.md
wiki/debugging/database-pool.md
wiki/workflows/release-checklist.md
wiki/decisions/payment-retry.md
```

不要将每个 Session 输出为一个 Wiki page；一页至少应该解决一个跨经验组织问题。优先放链接与明确限制；仅在被实际问题需要时扩展。Anthropic 的案例指出 Wiki 可能膨胀超过原始资料，必须测量信息密度与使用价值。

## 3. L4 selection scoring (proposal)

```text
priority =
  applicability(task, note)
  × trust_weight(status, source)
  × reuse_probability
  × freshness
  ÷ estimated_token_cost
```

这是**设计启发式**而非官方算法。除分数外仍必须强制 ACL、verified status、tombstone 和 token-hard-cap。对候选/有争议的记忆，不通过高分绕过规则。

## 4. Test matrix

- Multiple Notes → one bounded Wiki topic with all citations.
- Updated Note → backlinks rebuilt before publish.
- Source deletion → Wiki and injection immediately drop invalidated claims.
- Exact search stays accurate when Wiki enabled.
- Long and redundant wiki generated → bloat validator rejects/truncates.
- `AGENTS.md` remains untouched.
- Tenant/project boundaries enforced before routing/re-ranking.
- Task prompt changing each run doesn't cause avoidable full system-prompt churn.

Task-by-task: [P3 Backlog](../tasks/P3-backlog.md). Next: [P4](P4-evaluation-release.md).