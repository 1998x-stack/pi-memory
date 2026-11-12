# ADR-0002: Reuse Pi JSONL + Markdown Notes + SQLite FTS5

- Status: **Accepted for design** (implementation pending)
- Date: 2026-11-12

## Context

Coding Agent memory must search exact error strings and paths, preserve attribution, permit manual review, and work local-first without a hosted index. Pi owns raw Session JSONL, including branch trees; duplicating raw data risks divergence.

## Decision

- **L1**: Pi JSONL remains canonical; SQLite stores redacted searchable records and stable SourceRefs.
- **L2/L3**: Markdown with YAML Frontmatter as editable canonical notes/Wiki; SQLite stores projections, metadata, links, FTS indexes.
- **L4**: Small approved `MEMORY.md` within versioned Snapshot; served by Pi Hook.
- **Search**: start with SQLite FTS5 BM25 and exact-match boosts; add vector retrieval only after benchmark demonstrates gain.
- Store private data under `~/.pi/agent/memory/` (conceptual path), not the source repo.
- Use WAL/transactions, schema migrations, rebuild/doctor command and strict pre-filtering.

## Alternatives

| Alternative | Tradeoff |
|---|---|
| Vector DB first | added dependency, weaker exact match for code symbols, unnecessary complexity at P1 |
| Markdown only / grep | simple but hard to maintain audit, ranking and transaction state |
| SQLite only for all prose | transactional, but worse manual inspection/diff and topic wiki authoring |
| Clone all Pi JSONL | storage overhead and privacy/retention inconsistency |

## Risks and mitigations

- Two storage surfaces (files + DB): Snapshot manifest, fs staging, journal reconcile, rebuild indexes.
- YAML/code injection: safe parser, file boundary validation, never execute source text.
- FTS sensitive content: redact before index, do not store raw secret excerpts.
- Cross-platform stability: normalise paths/line endings, protect symlink escapes.

## Revisit when

Hundreds of projects/millions of events cause unacceptable FTS latency, benchmark favors hybrid semantics, or multi-user cloud syncing is explicitly required. Before migration preserve SourceRefs/Note Schema and task benchmark comparability.