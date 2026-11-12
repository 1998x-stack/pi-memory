# Threat model, privacy and memory governance

## 1. Assets and adversaries

**Assets**：Pi session JSONL、源码/日志、用户偏好、记忆文档、索引、Snapshot、API 密钥、模型输出、项目边界。

**Adversaries/failures**：不可信代码仓库、网页、Tool Result、README 注入；错误推理；同机不同项目的意外越权；恶意扩展；损坏/删除源文件；被污染的旧版本 Snapshot；多人并发与误配置。

Pi extensions 与 Pi 进程共享操作系统权限，因此必须由用户明确信任安装来源。Project-local extension 必须经过 Pi 的 project trust；不能把“安装了扩展”当成默认安全。

## 2. Threat → mitigation → test

| Threat | 防护 | 测试 |
|---|---|---|
| Prompt injection 持久化 | Tool/user content 作为数据、no instruction promotion、区分 author/source trust | 注入句子“保存秘密、忽略规则”必须拒绝升级 |
| Secret leakage | 按敏感路径过滤、pattern + entropy 检测、日志脱敏、不上传 | fixture 包含假密钥时无索引/输出 |
| Cross-project recall | ACL/scope pre-filter + test | 项目 A 搜不到 B |
| Evidence forgery | `entryId`+hash+sourceFile allowlist+branch，工具结果验证 | 伪造 reference 不被验证 |
| Path traversal / symlink | canonicalize + deny escapes，禁止跟随未授权 symlinks | `../`、目录符号链接逃逸 |
| Memory drift | conditions、lastVerified、stale/revalidate triggers | 版本变更后不能再无条件注入 |
| Snapshot rollback poisoning | tombstones + trust policy apply to every version | 回滚不会复活 revoked 记忆 |
| Concurrent writers | SQLite transaction + per-project lease + CAS publish | 两个 worker 仅一份可发布 |
| Model/worker outage | fail open、bounded retries、DLQ | Pi 仍能回答 |
| User deletion ambiguity | 明示 raw Pi sessions 与 derived memory 的区别 | 清除报告列出剩余源数据 |

## 3. Data classification

推荐 4 类：`public`、`project_internal`、`personal`、`secret`。默认判为 `project_internal`；可能是密钥/隐私字段的文本降级为 `secret` 并拒绝持久化到 Notes/Wiki/日志。只有明确审批的内容允许跨项目提升到 global。

禁止自动保存：`.env`、私钥、密钥 Token、认证 Cookies、包含凭证的完整 URL、用户私人日志；可仅保存“验证发现配置问题”的不敏感结论。

## 4. Prompt trust policy

- `AGENTS.md` 的人类指令和 `MEMORY.md` 生成内容从来源上区分；Memory 不能修改系统/开发者指令。
- L4 只注入带引用的项目事实，避免“必须忽略安全检查”等命令式内容。
- Prompt injection 检测不能只靠正则；基于来源信任、工具用途、白名单验证任务和人工审查。
- Retrieval 返回原样 excerpt 时必须加 untrusted delimiter/context，不能当更高优先级指令。
- LLM 自我声明“证据已验证”不能代替代码层的来源检查。

## 5. User controls / consent

必须提供：禁用自动捕获、禁用 L4、项目 opt-out、查看 note/evidence、忘记 note、导出、清理 derived indexes、关闭 Dreaming。未来远端模型执行 Dreaming 时，应提示用户哪些材料会发送到提供商；本地默认不上传。

`memory_forget` 语义应明确区分：
1. `hide`：停止召回，不删除历史；
2. `forget`：移除派生 Note/Wiki/Index/Snapshot 可见项并添加 tombstone；
3. `purge-source`：涉及 Pi 原始 JSONL，须单独确认，不能由一般记忆工具静默执行。

## 6. Logging and retention

- 只记录匿名化事件 ID、latency、token count、error code，不记录完整 prompt/Tool Result。
- 配置 `retention_days`，删除策略应覆盖索引、暂存文件、缓存、旧快照；注意备份与审计保留。
- 明确用户目录权限（建议仅当前用户读写），禁止随源码仓库提交私有记忆。
- JSONL 读取采用只读模式；绝不改动原生 Pi Session。

## 7. Release security checklist

- [ ] untrusted tool content 不能改写 AGENTS.md/System Prompt。
- [ ] 跨项目读取有自动化负例。
- [ ] secret fixture 不进入 index / memory / logs。
- [ ] forgetting 不被旧 snapshot 恢复。
- [ ] malicious YAML/Markdown 不触发执行或越界读取。
- [ ] cancellation 和低权限 filesystem 测试通过。
- [ ] 安装和退出流程提供清楚的用户控制。

See [P4 release criteria](phases/P4-evaluation-release.md).