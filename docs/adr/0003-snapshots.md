# ADR-0003: Dreaming produces reviewable Changesets and immutable Snapshots

- Status: **Accepted for design** (implementation pending)
- Date: 2026-11-12

## Context

Dreaming uses an LLM and may be wrong. Directly overwriting shared notes creates silent corruption, inconsistent Wiki, lost decisions and rollback hazards. Concurrent Workers can publish competing updates.

## Decision

Dreaming must produce **Draft Changeset**, separate from active Memory. Deterministic validators check Evidence/Schema/ACL/links/budgets. Approval policy gates publish. Publisher uses per-project lock + compare-and-swap of current Snapshot, records journal, switches pointer atomically and retains rollback versions.

```text
Published vN (read-only) → Clone → Dream Draft
  → validate → diff → approve/reject
  → CAS(current==vN) → publish vN+1
  → next Pi run reads vN+1
```

No mutation of Pi Session JSONL. Revoked content is protected by durable tombstones applied **above** snapshot selection, so rollback cannot resurrect removed private data.

## ChangeSet contract

`base_snapshot_id, operations[], before_hash, after_hash, evidence_refs, rationale, validation_report, reviewer, approved_at`. Operations: `create/update/merge/supersede/revoke/promote/wiki_update`. Model's declaration that evidence is verified is not sufficient; code validators own the status.

## Alternatives

| Alternative | Why rejected |
|---|---|
| Directly edit live notes | opaque failure and no safe rollback |
| Git commits only | useful for source docs, not private runtime WAL/concurrency/privacy |
| Per-note in-place versioning | hard to atomically update many Wiki/backlink/injection projections |
| Full automated publish from day one | high risk of repeated false memories |

## Consequences

More operational complexity and disk usage, but auditable decisions, human oversight, safe concurrency and explicit failure handling. Startup/recovery must reconcile pointer/files/SQLite journal after partial writes.

## Revisit when

Snapshot storage or review cost becomes measurable bottleneck; consider incremental snapshots after correctness/fault benchmarks, not before.