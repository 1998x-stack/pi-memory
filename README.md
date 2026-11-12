# Pi Memory

A local-first, evidence-grounded long-term memory architecture for Pi coding agent.

> Status: **design / documentation only**. No runtime implementation is claimed in this repository yet.

This repository specifies a four-phase implementation plan aligned with Anthropic's *The components of agent memory*: Transcripts, Memory Notes, Memory Representations (Wiki), Injected Context, and offline Dreaming.

## Documentation

- [Documentation index](docs/README.md)
- [Roadmap and delivery gates](docs/05-roadmap.md)
- [Overall architecture](docs/01-architecture.md)
- [Phase 1–4 execution plans](docs/phases/)

## Guiding decisions

- **Extension-first**: integrate with Pi via the TypeScript extension API instead of forking Pi.
- **Reuse Pi's JSONL**: original sessions remain the audit evidence; indexes are rebuildable.
- **Markdown + SQLite FTS5**: local-first, inspectable notes and lexical search; vectors optional.
- **Verification before promotion**: generated claims are candidates until supported by evidence.
- **Versioned Dreaming**: build, validate, diff, and publish memory snapshots with rollback.
- **Task outcomes matter**: measure long-horizon success and total online/offline cost, not just recall.

References: [Pi repository](https://github.com/earendil-works/pi), [Pi extension docs](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/extensions.md), and [Anthropic memory research](https://www.anthropic.com/research/components-of-agent-memory).

See [docs/README.md](docs/README.md) for the full navigation and task IDs.
