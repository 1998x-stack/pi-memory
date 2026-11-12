# Revised implementation roadmap after upstream audit

## 1. Key change: add G0 before the original four phases

```text
G0: package install / Pi runtime contract
  ↓
G1: L1 Pi JSONL → stable evidence / branch-aware FTS → verified manual Recall
  ↓
G2: L2 candidate extraction → evidence verification → Dreaming/Changesets/Snapshot
  ↓
G3: L3 Wiki + scoped graph + budgeted L4 and prompt-cache safety
  ↓
G4: long-horizon metrics + platform/install/release hardening
```

Phase 0 is **not feature delivery**. It closes a fundamental risk: a theoretically correct Memory Engine that cannot load through Pi's actual package/extension installation flow.

## 2. New critical path (with IDs)

| Gate | Required critical tasks | Can run in parallel | Cannot be cut |
|---|---|---|---|
| G0 | P0-01..06 | source audit, fixture design | Git/local install smoke, trust, data-outside-checkout |
| G1 | P1-02/03/04 → P1-05/06/07 → P1-09/10 | schema, FTS, scope unit tests | branch/projection, source key, P0 install repeat |
| G2 | P2-01/02/03 → P2-04/05 → P2-06/07/08/09/10 | model prompt evaluation, UI mock | evidence gate, detached model auth, CAS and tombstone |
| G3 | P3-01/02/03 → P3-04/05/06/07/09 | Wiki taxonomy, UX | source provenance, bounded L4, cache tests |
| G4 | P4-01/02/03/04 → P4-05/06/07/08/09/10 | security+fault suites | Pi install matrix, total cost, reproducible benchmarks |

## 3. Hard acceptance additions

### G0

- `pi install git:` detects `./extensions/pi-memory.ts` in pristine source checkout, no build assumed.
- `pi list`, `pi config`, trust and `/pi-memory-doctor` match expected behavior.
- `pi update --extensions` and `pi remove` do not touch user private store.
- Environment/Pi version recorded; no “verified installed” claim without actual Pi logs.

### G1

- Normalize transient leaf activity vs stored lineage; pass branch/context_edit/compaction/fork fixtures.
- Stable event key despite JSONL append/migration; hash tracks content changes separately.
- Catch-up ingestion on restart (not only `agent_settled`); ephemeral mode policy.
- Hard project trust/owner scope controls; no secret indexing; tool opt-out honored.

### G2

- Model adapter separates in-process `ctx.modelRegistry.complete` from standalone Worker auth.
- Snapshot publication journal and recovery tests; deletion tombstones apply across all versions.
- Explicitly disallow auto promotion when evidence is assistant self-report or branch-unresolved.

### G3

- Verified Notes/curated **metadata only** in high-priority prompt; no raw untrusted memory instructions.
- Prompt section changes can cause provider cache misses; measure them.
- Wiki links/FTS/Recall maintain consistent scope and revocation.

### G4

- Real Pi installations on all claimed OS/runtime modes, including git source and npm artifact when published.
- Reproduce tasks in clean environment; include baseline Pi without memory.
- Include all online+offline LLM cost, prompt-cache effects and maintenance overhead.

## 4. Delivery order — thin vertical slices

**Slice S0** (P0): `pi -e ./` + `/pi-memory-doctor` with project trust/packaging checks.

**Slice S1** (P1): two saved Pi sessions → JSONL lineage parse → local FTS query → source link → Pi Tool. Do *not* start with embeddings.

**Slice S2** (P1): manual Note → explicit approval → stable L4 index → restart/reload → recall. Ensure secret/ACL checks.

**Slice S3** (P2): evidence-backed automatic Note candidate → deterministic verifier → duplicate/conflict handling.

**Slice S4** (P2): Dreaming dry-run → human reviewable Changeset → CAS publish → rollback, correction fixture.

**Slice S5** (P3): multi-source Wiki pages with backlinks → task-aware retrieval → injection budget.

**Slice S6** (P4): all ablations + fault injection + npm pack/publish beta (only if conditions pass).

## 5. What changes in repo now vs later

**Committed during this review**: source-only install probe; P0 plans and QA matrices; pinned Pi compatibility audit; corrected design rationale and revised gates.

**Not yet completed**: real installation on Pi, functional memory engine, SQLite integration, automatic extraction, Dreaming, Wiki and any benchmark performance results.

Because the review host does not have a compatible installed Pi CLI and Node version is below upstream Pi's declared minimum, live install execution remains an explicit G0 task rather than a fabricated success claim.

Read [P0](phases/P0-install-contract.md) and [the Phase 1 manual](phases/P1-transcripts-retrieval.md).
