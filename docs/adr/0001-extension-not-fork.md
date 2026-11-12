# ADR-0001: Integrate with Pi via Extension, not a core fork

- Status: **Accepted for design** (implementation pending)
- Date: 2026-11-12
- Owner: Pi Memory project

## Context

Pi already provides lifecycle hooks, registered tools, commands, SessionManager and configurable prompt sections. A fork would offer freedom but create a permanent maintenance burden and hide memory-specific behavior inside the host runtime.

## Decision

Use `@earendil-works/pi-coding-agent` TypeScript Extension as a **thin adapter**. Headless `MemoryEngine`, storage, retrieval, Dreaming and evaluation live outside Pi Core.

Hook mapping:
- `session_start` initialize project scope and Snapshot.
- `before_agent_start` inject bounded L4 via `systemPromptOptions.sections.pi_memory`.
- `agent_settled` enqueue durable post-run indexing, never block on LLM.
- `session_tree`/`session_compact` capture branch/projection metadata.
- `registerTool` exposes search (later remember/get/correct).
- `registerCommand` exposes controlled user operations.

## Alternatives

| Option | Reason not chosen now |
|---|---|
| Modify Pi core | upstream upgrade conflicts; larger trust surface |
| Only `AGENTS.md`/Skills | no reliable event capture or verified cross-session state |
| Only external MCP server | no native access to Pi lifecycle/branch context without separate adapter |
| Full daemon-first architecture | operational complexity for local MVP |

## Consequences

Positive: easily installable with Pi Package, model-independent Engine, testable boundary. Negative: Extension runs with Pi user privileges; API compatibility must be pinned and tested; prompt/tool overhead. Keep memory optional and fail open.

## Revisit when

Pi Extension cannot provide a needed event or SessionManager semantics; performance measurements show boundary overhead dominates; or Pi upstream offers a native durable memory ABI. Before forking, propose an upstream API enhancement.

## Evidence

[Pi extension documentation](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/extensions.md), [Pi package documentation](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/packages.md).