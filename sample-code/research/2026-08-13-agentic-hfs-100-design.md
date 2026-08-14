# Agentic Module — HFS 100 target design

Status: implementation target, not a current score claim.

## Boundary

The package owns deterministic agent-loop semantics, durable state contracts, final-output validation, and a transport-neutral event protocol. The host owns its database adapter, retrieval adapter, authentication, HTTP/SSE route, WebSocket server, and React/Vue/Angular wiring.

No hidden chain-of-thought is emitted. `thinking_summary_delta` carries only provider-supplied status or a safe reasoning summary.

## HFS acceptance matrix

| Domain | Weight | Required evidence for full credit |
|---|---:|---|
| Session tree, lanes, atomic persistence | 20 | one active operation per lane; fork ancestry; optimistic version checks; reopen at every durable prefix |
| Run lifecycle, queue, config, close | 15 | steer/follow-up/next-run ordering; frozen run config; idempotent abort/close |
| Tool plan, execution, replay, abort | 15 | planned effect ID before execution; safe replay; never-replay and explicit `uncertain`; abort boundaries |
| Retry, recovery, deferred provider | 15 | bounded retry; persisted deferred handle; polling recovery; no duplicate terminal event |
| Compaction and navigation | 10 | loss-bounded compaction; checkpoint lineage; deterministic previous/next navigation |
| Events, telemetry, privacy, security | 10 | monotonic cursor/no gaps; SSE/WS envelope parity; redaction; ownership checks; no raw chain-of-thought |
| Manual drive and deterministic tests | 5 | fake clock/provider/tool; step execution; identical manual/automatic logs |
| Documentation and operator evidence | 10 | DB/transport/UI integration specs; crash-prefix matrix; package-consumer test |

Critical failures cap the score below 60: duplicate external side effect without `uncertain`, silent repair of a corrupt log, secret leakage, or more than one active operation in a lane.

## Terminal-output gate

Before `completed`, the runtime must settle all tool calls, verify citation IDs against the current ledger, verify artifact ownership/reference rules, and call the host output validator for application schema/policy. Failure emits a failed `run_finished`; it must never persist a successful result.

## Unified event protocol

Every published event receives `{runId, sequence, timestamp, type, ...payload}`. A reconnect supplies the last accepted sequence and receives only later events. SSE and WebSocket serialize the identical envelope; database-backed replay is supplied by the host.

Required UI events: thinking summary, output delta, tool-call ready, tool started, tool-output delta, tool finished, usage, approval/question request and response, final candidate, final validated, terminal result, and error.

## Integration seams

- Retrieval: `loadContext` and retrieval tools return content plus provenance records.
- Persistence: implement the store contracts with host transactions and ownership predicates.
- Streaming: feed emitted events into the host event store, then expose the same envelopes over SSE or WebSocket.
- UI: replay from `lastSequence`, reduce events into view state, and send approval/question responses through authenticated host endpoints.
