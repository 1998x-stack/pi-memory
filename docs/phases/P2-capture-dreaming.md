# Phase 2 — Automatic capture, evidence validation & Dreaming

**Goal**：基于 P1 的可追溯历史，提炼跨 Session Memory Candidate，纠正旧错误，建立 *Draft → Validation → Publish* 的可回滚离线处理链路。P2 不要求完整 Wiki，但必须具备未来 Wiki 变更的 Changeset 扩展点。

## 0. Entry / Exit

**Entry**：通过 G1，`SourceRef`、Notes v1 Schema、权限和项目隔离可用。

**Exit G2**：
- 新 Session 能触发 durable ingestion job；并发/崩溃重试不产生重复 Notes；
- 确定性 Evidence Validator 拒绝不存在/错分支/不支持结论的证据；
- 同一错误诊断被新执行结果推翻时，旧 Note 变 disputed/superseded，新结论被提议；
- `dream --dry-run` 不变更已发布状态；通过审核/验证后 publish 新 Snapshot；
- 故障、rollback、忘记/撤回不会复活已删除记忆；
- 至少一个完整 correction demo + unit/integration/fault tests。

## 1. Work items and implementation detail

### P2-01 — Durable event jobs and run outcome policy

**Implementation**：`src/jobs/queue.ts`、`worker.ts`。`agent_settled` 只 enqueue；job key 按 project/session/leaf/cursor/hash 去重；区分 completed/aborted/partial；记录来源与运行尝试，不把 aborted 判作成功。

**Acceptance**：多次 settled / 重复启动/worker 崩溃后仅有一次有效提炼；队列支持 lease/retry/dead-letter。

### P2-02 — Candidate extraction and salience scoring

**Implementation**：`src/notes/extractor.ts`、`prompts/extract.md`。读取增量 event bundles；输出 Schema-valid candidates，包含 `type, claim, conditions, evidence_refs, negative_examples, proposed_priority`；记录模型+Prompt 版本。重点提炼可复用失败经验、已证实程序规则和架构决策，避免“今天当前目录”等瞬时状态。

**Acceptance**：JSON Schema 校验；空成果合法；相同 fixture 再运行可比较且不直接发已验证结果；Token/成本上限可控。

### P2-03 — Evidence resolver and verification policy

**Implementation**：`src/evidence/resolver.ts`、`verifier.ts`。检查 `session_id/entry_id/branchLeafId` 是否存在、hash 是否匹配、toolCallId-result 是否关联、命令 exit code/测试结果是否支持断言；对源码文件改变标记 stale。无法确定时保留 candidate，绝不以 confidence 代替证据。

**Acceptance**：伪造 ID、错误 branch、仅 assistant 自述、工具 error、被删除 JSONL 均不能自动 verified。

### P2-04 — Note status transitions and correction history

**Implementation**：`src/notes/state-machine.ts`、`audit.ts`。Candidate / Verified / Disputed / Superseded / Revoked；每次状态变更带 reason、actor、timestamp、evidence refs 和 revision。旧 Note 不物理覆盖，保留可读历史与撤回标记。

**Acceptance**：非法状态跳转拒绝；新反证触发 disputed；用户撤回不能被普通 revalidation 恢复。

### P2-05 — Deduplication and conflict resolver

**Implementation**：`src/dreaming/deduplicator.ts`、`conflicts.ts`。Exact hash → lexical near duplicate → model-assisted semantic compare（可选）；“结论相同但条件不同”应保留两个适用条件或关联，不能盲合并；冲突需建立双向关联和优先验证队列。

**Acceptance**：重复导入不倍增 Notes；不同运行环境的相反结果不会被错误合并；保留源证据 union。

### P2-06 — Dreaming orchestrator with model adapter

**Implementation**：`src/dreaming/orchestrator.ts`、`model-adapter.ts`、`prompts/consolidate.md`。可配置模型，支持限额、分批、重试、取消、dry-run；输入是 snapshot + selected sessions + previous notes，不是全量无界 context；分离 model synthesis 与 deterministic validators。

**Acceptance**：无模型凭证时输出明确错误但 Search 仍可用；LLM 返回非法格式进入隔离区，不影响 current snapshot。

### P2-07 — Changeset proposal and reviewable diff

**Implementation**：`src/dreaming/changeset.ts`、`review.ts`；operations create/update/merge/supersede/revoke/promote；包含 `base_snapshot_id`、before/after hashes、reason、citations、impact set。CLI `dream --dry-run` / `diff` 列出更新摘要及证据。

**Acceptance**：可复现 diff；无证据的 promotion 自动被拦截；用户能拒绝单条变更而非只能全盘接受。

### P2-08 — Snapshot manager, CAS publish and rollback

**Implementation**：`src/snapshots/staging.ts`、`publisher.ts`、`rollback.ts`；immutable manifests，project lock，Compare-And-Swap 检查 current version；文件与 SQLite 双介质用 journal reconcile。rollback 必须应用 tombstones。

**Acceptance**：两个 worker 同时发布不会覆盖成功结果；写入中断后可恢复；忘记的数据不被旧版本恢复。

### P2-09 — Drift/forget propagation and reconciliation

**Implementation**：`src/governance/stale.ts`、`forget.ts`。监控证据文件消失、环境/配置变化、手动撤回；更新 Notes status、检索索引、注入候选。`forget` 提供 impacted set dry-run，再执行派生数据撤回；Pi raw JSONL 删除需单独明确授权。

**Acceptance**：源证据删除后该 Note 不继续被 L4 当 verified；旧 Snapshot 查询仍需生效 tombstone。

### P2-10 — Correction demo, acceptance eval & Gate

**Implementation**：`examples/corrected-diagnosis/`、`tests/integration/dreaming.test.ts`、`tests/faults/publish.test.ts`。设置 Session A 初步错误→ Session B 反证→ Dreaming Changeset → 用户审核→发布→ Session C 不再用旧规则。

**Acceptance**：保留失败/成功轨迹对照；包含 Token 成本和人工审核信息；G2 通过。

## 2. Core algorithm

```text
candidate = extract(current_sessions)
for c in candidate:
    refs = resolve_source_refs(c.evidence_refs)
    if refs missing / wrong branch: quarantine(c)
    else if evidence sufficient: propose_verification(c)
    else: keep_candidate(c)

draft = consolidate(snapshot, accepted_candidates)
draft = detect_conflicts_and_duplicates(draft)
report = deterministic_validate(draft)
if report passes:
    show_diff_and_review(draft)
    publish_if_current_version_matches(draft)
else:
    retain_published_snapshot()
```

**No direct write in live memory.** 即便模型生成 `status=verified`，也仅是 proposed status，代码验证器拥有最终权限。

## 3. Test matrix

| Test | Expected |
|---|---|
| tool failure narrated as success | candidate rejected/flagged |
| conflicting outcomes in different branches | scope-aware disputed, never merged silently |
| duplicate job replay | stable IDs, no duplicate notes |
| worker SIGKILL mid-publish | last valid snapshot available |
| malformed model JSON | quarantine, not published |
| outdated evidence path | note invalidated / review required |
| user forget then rollback | no resurrection |
| session with only transient activity | no spurious durable memory |

## 4. Scope cuts

P2 可先用一个模型、一个项目、人工点击 publish；不要先做 scheduler UI、agent swarm 或云端数据库。**不能删掉 evidence checking、diff/rollback 这三个关键能力。**

Task-by-task: [P2 Backlog](../tasks/P2-backlog.md). Next: [P3 Wiki](P3-wiki-injection.md).