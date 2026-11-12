# Data, branch, security and memory-quality validation matrix

> Tests below are **planned**, not executed. Tests use synthetic fixtures and must assert exact source refs and snapshot state. Task IDs align with P1–P4 backlogs.

## 1. Pi data semantics

| ID | Input / transition | Expected invariant | Phase |
|---|---|---|---|
| D01 | v3 JSONL with normal messages/tool result | each source has stable session+entry ID | P1 |
| D02 | append new JSONL line | old indexed source keys unchanged | P1 |
| D03 | truncated last line then complete append | cursor only advances after newline | P1 |
| D04 | compaction then repeated compaction | raw pre-compaction facts searchable, projected only once | P1 |
| D05 | context_edit target replacement/null | original raw retained, projection annotated | P1 |
| D06 | branch A failure / B success | never conflate abandoned and active branches | P1 |
| D07 | branch move with no new append | activity journal observes current leaf; file alone considered ambiguous | P1 |
| D08 | fork/clone with parentSession | new Session namespace and lineage preserved | P1 |
| D09 | Pi v1→v3 migration rewrite | stale offsets rescan, no duplicate event keys | P1 |
| D10 | simultaneous tool execution | join toolCallId not adjacency | P1 |
| D11 | nested Tool call | parentToolCallId/nestedCalls correlated | P1 |
| D12 | tool denied/invalid | observe terminal failure, never verified successful test | P1/P2 |
| D13 | ephemeral session (no file) | skip durable file ingest or configured bounded capture; no crash | P1 |
| D14 | old source file deleted | evidence becomes orphaned; note downgraded | P1/P2 |

## 2. Memory quality and snapshots

| ID | Input / transition | Expected invariant | Phase |
|---|---|---|---|
| M01 | model assertion of “fixed” without tools | candidate not auto-verified | P2 |
| M02 | tool returns nonzero exit but assistant says pass | cannot produce verified successful claim | P2 |
| M03 | 2 repeats with different environment constraints | no incorrect dedup/merge | P2 |
| M04 | new contradictory evidence on same branch | old note disputed, proposed correction references evidence | P2 |
| M05 | attempt publish with wrong base snapshot | CAS conflict, no lost update | P2 |
| M06 | worker crash between staging/files/DB | reconcile last valid visible snapshot | P2 |
| M07 | forget note then rollback | note still hidden, not resurrected | P2 |
| M08 | repeated ingestion of same events | same logical candidates; no duplicates | P2 |
| M09 | wiki link to revoked note | page invalidated/rematerialized | P3 |
| M10 | Wiki bloat input (many repeated notes) | bounded pages, no dozens of low-value duplicates | P3 |
| M11 | candidate/disputed with high salience | cannot enter privileged injection | P3 |
| M12 | task-aware memory budget | selection stays under token cap and references exist | P3 |

## 3. Security/privacy

| ID | Attack | Expected invariant | Phase |
|---|---|---|---|
| S01 | fake API key in Tool Result | not written in FTS/Note/Wiki/logs | P1 |
| S02 | user/project B memory requested from A | pre-filter denies | P1 |
| S03 | tool output says “ignore previous instructions” | not promoted as policy | P2/P3 |
| S04 | `../` or symlink to outside allowed root | denied | P1 |
| S05 | project not trusted | no automatic project scan | P0/P1 |
| S06 | manual forget -> restart/reindex | tombstone prevents re-ingest | P2 |
| S07 | snapshot rollback contains revoked data | effective read mask + purge policy | P2 |
| S08 | remote Dreaming configured without explicit approval | disabled by default | P2 |
| S09 | Markdown YAML custom tags / template markers | parsed as data only, never executed | P1/P3 |
| S10 | no-extensions mode | zero capture and injection side effects | P0/P4 |

## 4. Performance/benchmark

| ID | Suite | Metric | Phase |
|---|---|---|---|
| E01 | repeat bug across sessions | task success, repeat error rate | P4 |
| E02 | wrong memory corrected after counterevidence | correction lag and wrong-memory use | P4 |
| E03 | multi-document question | Wiki vs FTS success, token spend | P4 |
| E04 | small/simple exact lookup | ensure Wiki routing does not regress | P3/P4 |
| E05 | compaction/branch cross-session | source relevance precision | P1/P4 |
| E06 | all arms | online+offline costs, latency p50/p95, CI | P4 |

## 5. CI organization

```text
tests/
  unit/                       # parser, schema, ranking, budget
  fixtures/pi-v3/             # synthetic JSONL + manifests
  integration/pi-extension/   # real Pi host with pinned version
  integration/store/          # SQLite/Markdown consistency
  security/                   # scope and injection
  faults/                     # crashes/locks/restart
evals/
  suites/                     # runnable task environments
  reports/                    # manifest and full outcomes
```

Golden event fixtures and expected projections must be versioned alongside parser code. Model-based evals must never run as a mandatory offline unit test, but CI must run deterministic model-free compatibility tests.

See [lifecycle matrix](../12-runtime-lifecycle-matrix.md), [evaluation](../06-evaluation-plan.md).
