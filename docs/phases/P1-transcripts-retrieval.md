# Phase 1 — Session → Search → Manual Memory → Recall (MVP)

**Goal**：在新 Pi Session 中，能快速找到先前 Session 的历史工具结果，保存一条用户审核的 Note，在受限预算内注入关键项目记忆。**不做自动 Dreaming**，先建立可信 L1→Retrieval 的最小闭环。

## 0. Entry / Exit

**Entry**：**真实 Pi 的 G0 安装验收通过**，已确定 Pi 依赖版本、Node 运行环境、项目身份规则；已准备合法/异常 JSONL fixture。

**Exit G1**：
- 新 Session（与旧 Session 不同）`memory_search` 可靠地返回 old Session/entry references；
- FTS 精确匹配错误码、函数名、路径；跨项目不可见；
- `/tree`、`/compact`、`context_edit` fixture 下历史与可见性不串线；
- manually created Note 通过 schema 校验，可被搜索；仅人工批准 Note 可注入；
- 禁用/损坏 Memory 时 Pi 自身仍可执行请求；全套测试 CI 通过。

## 1. Work items and implementation detail

### P1-01 — Repository and toolchain baseline

**Implementation**：`package.json`、`tsconfig.json`、`vitest.config.ts`、`src/config/*`、GitHub Actions CI；固定 Pi 兼容版本（`@earendil-works/pi-coding-agent`）。定义 TS strict、lint、format、Node engines、issue/PR 模板。

**Acceptance**：`npm ci && npm run typecheck && npm test` 在空数据环境通过；`README` 标记尚未实现功能，避免假装已有 CLI。

### P1-02 — Corpus & golden fixtures

**Implementation**：`tests/fixtures/pi-v3/` 包含 SessionHeader、assistant toolCall、toolResult success/error、compaction、context_edit、custom_message、/tree 分叉、/fork parentSession、null parent、多 root、尾行损坏、绝对路径、Unicode。生成器使用虚构项目，不含真实私人日志。

**Acceptance**：每个 fixture 有 `manifest.json`（branch leaf、预期事件数量、当前投影、预期 toolCallId 关联），不依赖远端模型。

### P1-03 — JSONL reader and CanonicalEvent adapter

**Implementation**：`src/transcripts/pi-reader.ts`、`pi-parser.ts`、`normalize.ts`。基于 stream 逐行解析；`session` header 单独处理；Unknown event type 保留元数据且不崩溃；assistant content 兼容字符串/blocks；每条 source reference 带 `sessionId/entryId`；坏行 quarantine 而非跳过并误报完成。末尾没有换行的行暂缓。

**Acceptance**：golden normalized snapshots 与 expected 完全一致；不修改 Pi 文件；对大 Session 流式读取内存可控。

### P1-04 — Branch projection & lineage

**Implementation**：`src/transcripts/branch-resolver.ts`。构建 `entryId→parentId` map、detect missing parent/cycles/multiple roots；根据 `leafId` 回溯 active branch，解释 `compaction.firstKeptEntryId`、`context_edit` 的 model-visible effect；将 raw transcript search 与 current-model-context projection 分开；fork parentSession 不自动合并。

**Acceptance**：Branch A 的失败与 Branch B 的成功可分别检索；model-visible 投影符合 Pi reference fixtures；同一 entry 引用不歧义。

### P1-05 — Incremental indexer and ingestion state

**Implementation**：`src/transcripts/indexer.ts`、`src/store/migrations/001_init.sql`、`src/store/ingestion.ts`。缓存合法 JSONL 行的 offset/mtime/size；文件变化导致 reconciliation；SQLite WAL + busy timeout；`events` 使用 `(source_namespace,session_id,entry_id)` 稳定 upsert key（禁止 whole-file hash）幂等；DB transaction 包括 offset 更新；安全处理文件重命名、删除、半行。

**Acceptance**：相同 Session index 两次无重复；异常中断重试得到同样索引；并行 index 不丢数据；删除后孤儿事件有状态。

### P1-06 — FTS5 and lexical ranking

**Implementation**：`src/retrieval/fts.ts`、`rank.ts`。索引脱敏 text；FTS5 BM25，追加 exact path/error-code boost；限制 query complexity、snippet length 和 result count；索引更新/删除触发器与 rebuild 命令；向量检索保留接口但不实现。

**Acceptance**：`OperationalError`、`src/db/pool.ts`、`pytest -q` 示例在 fixture 中可检索；语法非法、空输入、超长 query 返回明确错误；重建索引结果可比对。

### P1-07 — Scope, provenance & local permissions

**Implementation**：`src/core/scope.ts`、`src/core/evidence.ts`、`src/security/redaction.ts`。Project ID 规范化、用户/项目/task 三层范围；SQLite 查询前 filter；source path allowlist；session_id+entry_id+branch 证据链接；敏感字段不进入检索摘要。

**Acceptance**：项目 A 无法查询 B；`../`、symlink escape、fake token 不泄露；source missing 返回 `unavailable`，而不是伪引用。

### P1-08 — Manual Memory Notes (L2 starter)

**Implementation**：`src/notes/repository.ts`、`note-schema.ts`，用户手工 `remember` 建立 Candidate；可通过 CLI/命令显式审核提升；Markdown Frontmatter，stable IDs、version、evidence refs；同步维护 SQLite note metadata。

**Acceptance**：新增/读取/修改/撤回 Note 可追溯；无 evidence 的 Note 不会自动变 verified；parse/serialization round trip 一致。

### P1-09 — Pi Extension Tool & bounded L4

**Implementation**：`src/extension/index.ts`、`tools.ts`、`hooks.ts`。注册 `memory_search`；`before_agent_start` 注入小型固定 `MEMORY.md` **非指令性的已批准导航索引**，设置 `sections.pi_memory`；`session_start` 绑定项目；`agent_settled` enqueue 索引任务（保留 aborted，不能宣称任务成功），`session_start`/CLI 扫描漏记 historical JSONL；无证据不得动态推广；按配置注入 Token 上限（建议首版≤600–1200）。

**Acceptance**：同进程跨 `/new` 仍找到旧记忆；其他 extension 的 prompt sections 不被覆盖；异常时 fail open；Tool cancellation 有效；无 UI 模式不弹窗。

### P1-10 — End-to-end demo, docs and Gate

**Implementation**：`examples/repeated-bug/`、`tests/integration/pi-memory.test.ts`。第一次 Session 运行可复现的测试失败并修复；第二次新 Session 通过 Search 找到修复经验；检查源码/测试/指标；记录延迟和 token 注入。

**Acceptance**：提供测试录像/日志（脱敏）、`README quickstart`、G1 检查报告；`typecheck/test` 通过。

## 2. End-to-end sequence

```text
pi session writes JSONL
    → settled event queues {sessionId, leafId, path}
    → incremental reader + branch map
    → redaction + canonical events + SQLite FTS
    → new Pi session / user prompt
    → L4 stable approved index (bounded)
    → memory_search("connection pool")
    → hit {snippet, sessionId, entryId, branchLeafId, status}
    → user/agent inspects actual old evidence
```

## 3. Core test matrix

| Test | Input | Expected |
|---|---|---|
| normal sessions | 2 valid JSONLs | both indexed, no duplicates |
| branch | two leaves contradict | provenance identifies branch |
| compaction | pre-compact tool result | still in raw FTS, not incorrectly injected |
| context_edit | removed old answer | raw retained with visibility flag |
| interrupted line | malformed final JSONL tail | skipped until appended, cursor safe |
| scope | project A, project B | no leaked hits |
| credential | fake token in toolResult | no secret indexed, output masked |
| extension outage | DB unavailable | agent run continues |
| manual note | candidate without evidence | not auto verified or injected |

## 4. Suggested PR order

`P1-01+02` → `P1-03+04` → `P1-05+06+07` → `P1-08` → `P1-09+10`。Task IDs/checkboxes in [P1 Backlog](../tasks/P1-backlog.md).

## 5. Scope cuts

If timeline is tight: CLI search before TUI, only FTS (no embeddings), manual Notes before auto extraction, minimal L4 index before dynamic selector. **Do not cut branch correctness or scope filtering.**

Next: [P2](P2-capture-dreaming.md).

## G1 Pi-source audit additions

- 新增 transient `branch()` leaf 测试：`session_tree` 事件 journal 和后台 JSONL 文件推断需要分开标识 observed/inferred。
- 新增 host Package 安装回归：以 P0 Git/local probe 方式加载已实现的 `memory_search`，检查 `--no-tools`, codemode-only, `/reload`。
- 新增 stable event key 测试：JSONL 追加、Pi 迁移重写、fork 后不生成重复来源。
- 新增独立 private data root/项目 trust opt-in 测试：在 untrusted cwd/global install 不能扫描项目日志。
- 新增 `nestedCalls`、parallel tool 顺序、ephemeral/no session file、aborted run、catch-up after restart。

Blocking matrix: [Runtime Lifecycle](../12-runtime-lifecycle-matrix.md).