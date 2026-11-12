# API, tools and CLI contracts (proposed)

> 以下全部是 **待实现 API 设计**，并非上游 Pi 已存在命令。最终生成 TypeScript interface + JSON Schema + tests，并保持向后兼容。

## 1. Core engine boundary

```typescript
interface MemoryEngine {
  ingest(job: IngestionRequest): Promise<IngestionReport>;
  search(query: MemoryQuery): Promise<MemoryHit[]>;
  get(memoryId: string, scope: MemoryScope): Promise<MemoryNote | null>;
  remember(input: ManualMemoryInput): Promise<MemoryNote>;
  getInjectedContext(input: ContextRequest): Promise<InjectedContext>;
  dream(input: DreamRequest): Promise<DreamDraft>;
  validate(draftId: string): Promise<ValidationReport>;
  publish(draftId: string, expectedSnapshotId: string): Promise<Snapshot>;
  rollback(snapshotId: string): Promise<Snapshot>;
  forget(memoryId: string, scope: MemoryScope): Promise<ForgetReport>;
}
```

所有方法必须显式接受 project/user scope；不依赖调用者自行过滤。所有公开调用应可传 `AbortSignal`（概念代码省略）。

## 2. Query, Hit and source refs

```typescript
type MemoryScope = {
  ownerId: string;
  projectId?: string;
  sessionId?: string;
  branchLeafId?: string;
};
type MemoryQuery = {
  text: string;
  scope: MemoryScope;
  status?: "verified" | "candidate";
  limit?: number;
  includeRawTranscript?: boolean;
};
type MemoryHit = {
  id: string;
  layer: "transcript" | "note" | "wiki";
  title: string;
  snippet: string;
  score: number;
  status: string;
  snapshotId: string | null;
  evidence: SourceRef[];
  applicability?: string[];
};
```

默认只返回 verified Notes、已授权的 Transcript evidence。Candidate 作为开发者审查视图，不直接视为已验证结论。返回 `evidence` 时可提供简短 source snippet 和可在本地跳转的 `sessionId/entryId`。

## 3. Pi tools

| Tool | Args | Output | Permissions |
|---|---|---|---|
| `memory_search` | `query, limit?` | `MemoryHit[]` | current scope read |
| `memory_get` | `id` | note + provenance | current scope read |
| `memory_remember` | `text, scope?` | candidate ID | user consent / manual |
| `memory_suggest_correction` | `id, reason, refs` | proposed change ID | write-draft |
| `memory_forget` | `id` | dry-run affected links first | explicit confirmation |

建议第一阶段只开放 `memory_search` 和人工 `memory_remember`，减小模型自主写入风险。工具参数按 Pi 的 `typebox` JSON Schema 验证，仍要在 execute 内检查业务授权与路径。

## 4. CLI commands

```bash
# Proposed, not yet implemented
pi-memory init
pi-memory doctor
pi-memory index --project .
pi-memory search "connection pool" --project .
pi-memory note add --project . --file note.md
pi-memory status --json
pi-memory dream --project . --since 24h --dry-run
pi-memory diff snapshot-v1 draft-v2
pi-memory validate draft-v2
pi-memory publish draft-v2 --expect snapshot-v1
pi-memory rollback snapshot-v1
pi-memory forget mem-001 --dry-run
pi-memory eval run --suite repeat-bug-v1 --arm C
```

CLI 必须区分只读、草稿、发布、删除；批处理返回非零退出码和机器可读错误。默认禁止直接修改原始 Pi JSONL。

## 5. Error model

```json
{
  "code": "MEMORY_SCOPE_DENIED",
  "message": "Memory is not accessible from the current project",
  "retryable": false,
  "details": { "request_id": "req-123" }
}
```

建议错误码：`MEMORY_NOT_FOUND`、`MEMORY_SCOPE_DENIED`、`MEMORY_SOURCE_ORPHANED`、`MEMORY_SCHEMA_INVALID`、`MEMORY_SNAPSHOT_CONFLICT`、`MEMORY_TOKEN_BUDGET`、`MEMORY_WORKER_UNAVAILABLE`、`MEMORY_CANCELLED`。

## 6. Public commands inside Pi

Pi extension 注册 `/memory` 下的子命令：`status/search/review/dream/forget`；无 UI 模式不可调用 TUI 确认，必须安全拒绝或返回待人工审查标记。新命令和普通用户提示不可混淆。

## 7. Compatibility/versioning

- 采用 SemVer：重大 schema 变更需要 migration 和 fixture。
- Package 可声明支持的 Pi 版本区间，CI 至少包含 pinned stable + 可选最新 version。
- 工具返回结果保持稳定字段；新增可选字段，不轻易改变 `id/evidence/status` 含义。
- Snapshot/Note/Job 均含 `schema_version`；API 签名维护变更日志。

See [Pi integration](02-pi-extension-integration.md) and [Schemas](schemas/memory-note.schema.json).