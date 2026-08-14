# Agentic Module vs. AnythingLLM agent runtime

Snapshot reviewed: 2026-08-13. This comparison describes current repository behavior, not product marketing.

| Capability | Agentic Module | AnythingLLM agent runtime |
|---|---|---|
| Agent loop | Iterative provider → tool → provider loop with strict pre-execution budget | Streaming and synchronous recursive provider → tool → provider paths in `server/utils/agents/aibitat/index.js` |
| Durable state | Append-only store contract, ownership, optimistic version, lease, checkpoint, restartable approval/question | Invocation record plus live runtime/socket state; approval/question wait is held in an in-process Promise |
| Thinking stream | `thinking_summary_delta`; contract forbids raw hidden chain-of-thought | Status/reasoning is sent as stream/status messages and rendered as thought bubbles |
| Tool-call stream | `tool_call_ready` includes call ID, name, and arguments | Provider streams `toolCallInvocation`; frontend accumulates/replaces its payload |
| Tool output stream | `tool_output_delta` includes host-redacted output, then `tool_finished` | Internal `toolCallResult` exists, but the reviewed frontend socket handler does not render a general tool-result stream |
| Usage stream | Unified `usage` event for streaming and non-streaming responses | `usageMetrics` stream event |
| Final validation | Non-empty invariant, current-run citation validation, host schema/policy validator, candidate/validated events before success persistence | No deterministic final-output schema gate found in the reviewed agent loop |
| Approval/question | Durable request/response records and transport events | WebSocket request/response with timeout; pending Promise is not restart durable |
| Transport | Same sequenced envelope for host-provided SSE or WebSocket; cursor replay contract | WebSocket route `/agent-invocation/:uuid`; no agent SSE route found |
| UI | Framework-neutral reducer plus setup spec | React socket handler and approval/clarification cards already integrated |
| Automatic skill loading | `loadSkills` runs per execution and selected skills stay inside normal policy/approval/budget gates | ToolReranker reranks/selects configured functions from the current user prompt |
| Automatic context compaction | `contextWindow` checks every provider boundary and checkpoints compacted history | Provider context limits and content summarizers exist; no durable automatic conversation compaction gate was found in the reviewed agent loop |
| HFS 100 | Portable module scope passes 100/100; consuming-app production score still requires its database, transport, retrieval, UI, security, and operator evidence | Not an event-sourced durable harness and not HFS 100 under the selected rubric |

## Evidence paths

- WebSocket lifecycle: `server/endpoints/agentWebsocket.js`
- Agent loop, reranking, usage, citations, and internal tool results: `server/utils/agents/aibitat/index.js`
- Approval/question socket protocol: `server/utils/agents/aibitat/plugins/websocket.js`
- Frontend streaming reducer: `frontend/src/utils/chat/agent.js`
- Agentic implementation and tests: `research/agentic-module/src`, `research/agentic-module/test`

## Current verdict

The Agentic Module now has the stricter portable protocol, durable lanes/queues/effect replay, deferred recovery, compaction/navigation, terminal validation, transport-neutral stream contract, and reusable backend/recovery conformance. The reference application still has the more complete application-specific WebSocket/React integration. An evidence-backed HFS 100 release therefore depends on wiring the module contracts to the consuming application's real database, retrieval, transport and UI, then archiving its crash-injection, security and operator evidence.
