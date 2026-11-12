# P2 Implementation backlog — automatic memory and Dreaming

> Primary plan: [P2 execution manual](../phases/P2-capture-dreaming.md). 在 P1-G1 通过前不合并会改变可见记忆的自动任务。

依赖主线：`P2-01 → P2-02/03 → P2-04/05 → P2-06/07 → P2-08/09 → P2-10`。

## Task matrix

| ID | 任务 | 优先级 | 依赖 | 代码/交付路径 | 验收检查 |
|---|---|---|---|---|---|
| P2-01 | Durable job queue + settled ingestion | P0 | G1 | src/jobs/queue.ts, worker.ts | dedup, retry, lease expiry, abort-aware |
| P2-02 | Candidate extraction & salience | P0 | P2-01 | src/notes/extractor.ts, prompts/extract.md | schema-valid candidates; token limits; no invented verified |
| P2-03 | Evidence resolver/verifier | P0 | G1, P2-02 | src/evidence/resolver.ts, verifier.ts | wrong branch/fake refs and self-claimed success rejected |
| P2-04 | Status transitions & audit | P0 | P2-03 | src/notes/state-machine.ts, audit.ts | candidate/verified/disputed/revoked legal transitions |
| P2-05 | Dedup + contradiction engine | P0 | P2-04 | src/dreaming/deduplicator.ts, conflicts.ts | retain conditions, do not merge contradictory scopes |
| P2-06 | Dream runner/model adapter | P0 | P2-02..05 | src/dreaming/orchestrator.ts, model-adapter.ts | dry-run; model errors isolated; usage captured |
| P2-07 | Changeset and review diff | P0 | P2-06 | src/dreaming/changeset.ts, review.ts | before-after + evidence + impact set reviewable |
| P2-08 | Snapshot publish/rollback | P0 | P2-07 | src/snapshots/staging.ts, publisher.ts | CAS, journal recovery, pointer always valid |
| P2-09 | Stale/forget propagation | P0 | P2-04, P2-08 | src/governance/stale.ts, forget.ts | removed evidence and revoked notes never reappear |
| P2-10 | Correction demo & G2 report | P0 | P2-01..09 | examples/corrected-diagnosis, tests/faults | session A wrong → B evidence → C corrected |

## Execution checklist

- [ ] **P2-01 Durable job queue + settled ingestion** — complete implementation + tests + PR evidence
- [ ] **P2-02 Candidate extraction & salience** — complete implementation + tests + PR evidence
- [ ] **P2-03 Evidence resolver/verifier** — complete implementation + tests + PR evidence
- [ ] **P2-04 Status transitions & audit** — complete implementation + tests + PR evidence
- [ ] **P2-05 Dedup + contradiction engine** — complete implementation + tests + PR evidence
- [ ] **P2-06 Dream runner/model adapter** — complete implementation + tests + PR evidence
- [ ] **P2-07 Changeset and review diff** — complete implementation + tests + PR evidence
- [ ] **P2-08 Snapshot publish/rollback** — complete implementation + tests + PR evidence
- [ ] **P2-09 Stale/forget propagation** — complete implementation + tests + PR evidence
- [ ] **P2-10 Correction demo & G2 report** — complete implementation + tests + PR evidence

## 统一 DoD（所有任务）

- [ ] 实现与声明的 API / schema 一致；边界输入（空值、坏数据、取消、越权）有负例。
- [ ] 新增 unit/integration tests 和测试 fixture；`npm run typecheck` / `npm test` 应通过（脚本须在 P1-01 创建）。
- [ ] 不记录真实密钥/用户私有数据；错误不阻断 Pi 原生 Agent Loop。
- [ ] PR 描述标注：关联任务 ID、设计文档、测试命令、验收截图/日志、已知风险。
- [ ] 未通过验收条款不能将 checkbox 标为完成；此表当前全部未开始。

## Phase gate

G2: 由对应 Phase 主文档的 Exit Criteria 判定，不仅以 checkbox 数量判定。
