# UI, SSE, and WebSocket integration spec

The module emits transport-neutral `AgentEvent` values. The host persists and publishes them; the module does not open network ports or depend on a UI framework.

## Required host pipeline

1. Pass one `emit(event)` callback to `createAgentHarness`.
2. In one database transaction, assign the next per-run sequence and append the event. Do not use `AgentEventJournal` as production storage; it is the in-memory reference/test implementation.
3. Authenticate every subscribe/respond request and verify `principalId`, `tenantId`, and `workspaceId` against the run record.
4. Replay events with `sequence > cursor`, then attach the live watcher without a replay/live gap.
5. Serialize each stored envelope with `serializeSseEvent` or `serializeWebSocketEvent`.
6. The client stores `lastSequence` and applies each envelope through `reduceAgentUiEvent`. Duplicate or old envelopes are ignored.

## SSE route

Expose `GET /agent/runs/:runId/events`. Accept `Last-Event-ID` first, then `?cursor=` as fallback. Return:

```http
Content-Type: text/event-stream
Cache-Control: no-cache, no-transform
Connection: keep-alive
```

Write replayed events first, subscribe atomically, send a comment heartbeat such as `: keepalive\n\n`, and unsubscribe on request abort. SSE is server-to-client only; approval/question responses use authenticated POST routes.

## WebSocket route

Expose `/agent/runs/:runId/ws?cursor=N`. Authenticate before upgrade. Send replay then live JSON envelopes from `serializeWebSocketEvent`. Accept only validated control messages:

```ts
type ClientControl =
  | { type: "approval_response"; requestId: string; approved: boolean; alwaysAllow?: boolean }
  | { type: "clarification_response"; requestId: string; skipped: boolean; answers: unknown[] }
  | { type: "abort" };
```

Route controls to `respondApproval`, `respondClarification`, or `abort`; never let the socket payload provide owner context. Derive ownership from the authenticated server session.

## Event-to-UI mapping

| Event | UI behavior |
|---|---|
| `thinking_summary_delta` | Append to a collapsible “Working” panel; never render hidden chain-of-thought |
| `tool_call_ready` | Create a tool card with name and sanitized arguments |
| `tool_started` | Mark the card running |
| `tool_output_delta` | Append sanitized output; cap rendered length and provide download for larger artifacts |
| `tool_finished` | Mark the card complete |
| `usage` | Update token/cost metadata |
| `skills_selected` | Optionally show selected capability names/versions; never expose instructions or database bindings |
| `skills_loaded` | Show optional capability metadata; do not expose hidden skill configuration |
| `context_compacted` | Show a passive “context summarized” marker |
| `approval_requested` | Show confirm/reject card; disable duplicate submission |
| `clarification_requested` | Render one to three accessible input/choice fields, plus Skip only when allowed |
| `approval_responded` / `clarification_responded` | Close the matching pending card idempotently |
| `output_delta` | Append assistant text |
| `final_output_candidate` | Keep provisional; do not mark message complete |
| `final_output_validated` | Mark content valid but wait for terminal result |
| `run_finished` | Set completed/failed/aborted state and stop loading |

UI requirements: keyboard focus moves into a new approval/question card, labels are programmatically associated with inputs, errors use an ARIA live region, and reconnect does not duplicate text.

## Automatic skills and context compaction

For database-backed skills, `SkillRuntimeAdapter.listCatalog` returns only
enabled metadata bound to authenticated `context.agentId`. Explicit invocation
or metadata matching selects a bounded subset, and `load` hydrates only those
exact versions/digests. The harness persists `skills_selected` before provider
work and recovery reloads that snapshot without rerunning selection. The legacy
`loadSkills` callback remains available for compatibility. Every hydrated tool
still passes normal argument validation, policy, approval, budget, and event
handling.

`contextWindow` runs before every provider boundary. `estimateTokens` must use the target model tokenizer when available. `compact` must preserve system safety rules, unresolved tool-call/tool-result pairs, the latest user intent, citation identifiers, and a lineage pointer in the host database. If compacted messages still exceed `maxInputTokens`, the module fails closed with `BUDGET_EXHAUSTED`.

## Retrieval integration

Implement retrieval through `loadContext` and/or a retrieval tool. Every returned chunk must include an authorized current-run citation. Retrieved text stays inside the module's untrusted-context boundary; transport code must not turn retrieved instructions into system instructions.

## Acceptance checks

- reconnect after every emitted sequence produces no gap and no duplicate UI text;
- SSE and WebSocket decode to identical envelopes;
- approval/question survives process recreation and rejects wrong-owner/duplicate/expired responses;
- raw secrets and raw chain-of-thought never enter persisted events;
- final success is persisted only after `final_output_validated`;
- auto-loaded skills cannot bypass tool policy or approval;
- recovery reuses the persisted skill identity/version/digest snapshot;
- compaction is persisted in the harness checkpoint and survives recreation.
