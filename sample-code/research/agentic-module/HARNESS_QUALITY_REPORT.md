# Agentic Harness — scoring and quality report

Date: 2026-08-13
Scope: `research/agentic-module` at the current workspace state
Verdict: portable HFS **100/100**; engineering quality **91/100**; production-host readiness is not scored until the consuming application supplies its real database, retrieval, authenticated transport, UI, and operational evidence.

## 1. Score summary

| Score | Result | Meaning |
|---|---:|---|
| Harness Fidelity Score (portable scope) | **100/100** | All module-owned HFS contracts have implementation and executable evidence. |
| Engineering quality | **91/100** | Strong correctness and recovery design; remaining deductions are coverage depth, concentration of orchestration code, and missing independent production evidence. |
| Production integration | **Not scored** | Retrieval, SSE/WebSocket server, UI, and the real database are intentionally host-owned and currently specified rather than implemented here. |

HFS measures behavioral contract fidelity. It does not measure model answer quality, production SLO maturity, or organizational readiness.

## 2. HFS scorecard

| Domain | Weight | Implemented behavior | Evidence | Score |
|---|---:|---|---|---:|
| Session tree, lanes, persistence | 20 | Immutable transcript tree, fork ancestry, isolated lanes, optimistic versions, atomic batches, projection from append-only mutations, reopen and corruption handling. | `durable-session.ts`, `transactional-session-store.ts`, `node-append-log-store.ts`; durable-session, transactional-store, node-append-log, and conformance tests. | 20 |
| Run lifecycle, queues, configuration, close | 15 | Start/continue/recover, bounded turns, frozen provider/tool configuration, steer/follow-up/next-run queues, cancellation, lease ownership, atomic abort/close. | `harness.ts`, `harness-store.ts`, `reducer.ts`; lifecycle and queue tests in `harness.test.ts`. | 15 |
| Tool lifecycle and replay safety | 15 | Schema validation before policy, authorization, durable plan/start/settle, protected arguments, sequential/parallel execution, safe replay, never-replay uncertainty, approval gating. | Tool, recovery, approval, protocol, parallel-order, and telemetry tests. | 15 |
| Provider retry, recovery, deferred work | 15 | Bounded retry, durable provider step/attempt IDs, planned-step reuse, settled-response reclassification, uncertain started calls, deferred handle persistence and polling recovery. | Provider retry/recovery/deferred tests, including crash states before start, after start, and after settlement. | 15 |
| Compaction and navigation | 10 | Preflight and overflow-once compaction, durable plan/start/settle, checkpoint lineage, tool protocol preservation, manual compaction, common-ancestor navigation and fork. | Compaction/navigation tests in `harness.test.ts` and `durable-session.test.ts`. | 10 |
| Events, privacy, validation, security | 10 | Sequenced event journal, replay cursor, SSE/WS envelope parity, UI reducer, sanitized thinking/tool events, telemetry redaction, ownership checks, citation/artifact and final-output validation. | `event-stream.ts`, `ui-state.ts`, `security.ts`, `grounding.ts`; streaming-output and workflow tests. | 10 |
| Manual drive and determinism | 5 | Manual action queue gates provider streams, tools, hooks, durable writes, close, abort, and queues while retaining automatic-mode semantics. | Manual-drive and automatic/manual log-equivalence tests. | 5 |
| Documentation and package evidence | 10 | Public index, integration spec, host coding spec, UI/SSE/WS spec, runbook, comparison, strict JSDoc contract, consumer fixture, buildable declarations and package dry-run. | Documentation gate, TypeScript build, fixture compilation, and package inspection. | 10 |
| **Total** | **100** | | | **100** |

No critical HFS cap was observed in the portable implementation: no tested duplicate uncertain side effect, silent corrupt-log repair, secret-bearing telemetry, or cross-lane active operation.

## 3. Implemented harness inventory

### Core agent loop

- Supports provider text, streaming text, one or multiple tool calls, direct tool output, deferred provider handles, and provider → tool → provider repetition.
- Enforces tool-call budgets, turn budgets, output-size limits, provider retry caps, abort propagation, and exactly one terminal runtime result.
- Emits provisional output separately from validated final output. Empty, oversized, invalid-schema, forged-citation, or unsafe artifact output fails before successful persistence.

### Durable state and recovery

- `HarnessStore` defines scoped claim, lease renewal/release, optimistic append, atomic terminal settlement, and complete event replay.
- The reducer rejects sequence gaps and illegal provider, tool, compaction, queue, or usage transitions as `STORAGE_CORRUPTION`.
- Recovery behavior is explicit for every external effect state:
  - planned but not started: safe to start using the same logical step ID;
  - started but not settled provider: terminal `EFFECT_UNCERTAIN`;
  - settled provider response: classify the stored response without calling the provider again;
  - safe tool: replay from restored protected arguments;
  - never-replay tool: expose uncertainty without duplicate execution.
- Reference implementations cover in-memory runs, in-memory sessions, transactional document adapters, and an append-log session backend. Production must implement the same contracts using the host database.

### Interaction lifecycle

- Approval and clarification requests are durable and correlated by `runId + requestId`.
- Approval supports reject, timeout, duplicate-response rejection, optional server-authorized always-allow, restart recovery, and single execution after approval.
- Clarification supports input, choice, multi-choice, skip, timeout, ownership checks, and provider resume with structured answers.

### Queueing, concurrency, and termination

- `steer` is consumed after the current tool result and before the next provider call.
- `followUp` begins a later turn after the current one settles.
- `nextRun` survives abort and is consumed exactly once on a later run.
- One writer lease protects a run; session lanes permit independent operations while rejecting two simultaneous operations in the same lane.
- Abort and close signal active work, drain it, then atomically persist terminal state and release the lease.

### Streaming and UI protocol

- Implemented module events include thinking summary, output delta, tool-call payload, tool start, tool output, tool finish, usage, approval/question lifecycle, compaction, final candidate, final validation, suspension, and terminal result.
- `AgentEventJournal` provides the reference replay/live watcher, monotonic sequence, and reconnect cursor behavior.
- SSE and WebSocket serializers produce the same event envelope; `reduceAgentUiEvent` is a framework-neutral, duplicate-safe UI projection.
- The authenticated network routes, database-backed event journal, backpressure, heartbeat, UI components, and reconnect deployment are intentionally specified in `UI_STREAMING_SPEC.md` for the target codebase.

### Skills, MCP, flows, retrieval, and grounding

- Agent-scoped skills list authorized metadata by `agentId`, select a bounded
  request-relevant subset, hydrate only exact versions/digests, inject selected
  instructions, and persist the snapshot before provider work. Recovery reloads
  the snapshot without rerunning selection. Hydrated tools enter the same
  validation, policy, approval, budget, and event loop as static tools.
- Imported manifests are validated, imported inactive, centrally authorized, and protected against archive/path escape. Process/container isolation remains a host responsibility.
- MCP normalization covers health, suppression, timeout, abort, schema `$ref`, reload/stop, BigInt, and circular result serialization while preserving central policy.
- Portable flow validation/execution supports the defined sequential block types and stops on first failure or direct output.
- Retrieval/document/memory/artifact factories enforce host adapters and current execution scope. Retrieved content is treated as untrusted context and citation IDs must originate from the current provenance ledger.

### Compaction and navigation

- Automatic compaction runs before provider boundaries and retries context overflow at most once.
- Compaction persists plan/start/settle plus the resulting checkpoint and rejects orphaned or split tool-call protocol.
- Manual compaction preserves lineage and expands the retained tail when necessary to keep tool-call/result pairs complete.
- Session navigation uses common ancestry, atomic lane movement, optional branch summary and labels, and rejects invalid navigation without writes or summary effects.

### Telemetry and privacy

- Provider, tool, compaction, and deferred spans carry durable correlation, attempt, duration, outcome, and usage without prompt/output bodies.
- Recursive redaction removes credential-shaped fields; tool arguments can use host protection/restoration hooks, and tool output is sanitized before UI emission.
- Hidden chain-of-thought is not part of the protocol; only provider-supplied safe `thinking_summary_delta` is exposed.

## 4. Engineering quality score

| Quality dimension | Weight | Score | Assessment |
|---|---:|---:|---|
| Correctness and fail-closed behavior | 20 | 20 | Strong invariant validation, typed failures at core boundaries, final-output gate, and negative-path tests. |
| Durability and recovery design | 20 | 20 | Explicit effect states, atomic terminal settlement, deterministic replay, crash-prefix suites, and no implicit continuation closure. |
| Security and privacy | 15 | 13 | Ownership, policy, approval, path protection, provenance, and redaction are implemented; independent security review and real secret-at-rest/transport evidence are absent. |
| Test quality | 15 | 13 | 113 behavioral tests; 94.40% line, 79.06% branch, and 87.46% function coverage. No mutation, property/fuzz, or production-database fault-injection suite yet. |
| Architecture and maintainability | 15 | 12 | Zero runtime dependencies, explicit adapters, strict TypeScript, and documented functions. `harness.ts` is 930 lines and carries a high concentration of orchestration/recovery branches. |
| Portability and documentation | 10 | 9 | Package root import, declarations, consumer fixture, specs, and runbook are present. `README.md` still phrases HFS as a target while `HFS_STATUS.md` distinguishes portable 100 from host release evidence. |
| Observability and operations | 5 | 4 | Correlated privacy-safe spans and an operator runbook exist; production dashboards, SLO alerts, load evidence, and recovery-job evidence belong to the host and are not present. |
| **Total quality** | **100** | **91** | **Production-grade portable core; host integration remains a release gate.** |

## 5. Verification evidence

Current module size:

- 30 TypeScript source files, 3,920 source lines;
- 10 test files, 113 test cases, 2,304 test lines;
- 234 shipped callables covered by the AST JSDoc gate;
- no runtime dependency in `package.json`;
- TypeScript `strict: true` with emitted declarations.

Verified gates:

| Command/check | Result |
|---|---|
| `npm test` | PASS — 113/113 |
| `npm run typecheck` | PASS |
| `npm run check:docs` | PASS — every checked callable has a punctuated summary, parameter documentation, return documentation where applicable, direct-throw documentation, and an inline rationale comment |
| `npm run build` | PASS |
| `npm run test:package` | PASS — external consumer fixture compiles through package root |
| `npm pack --dry-run` | PASS — 67 packaged files, 63.7 kB tarball estimate |
| `git diff --check` | PASS |
| Node experimental test coverage | PASS tests; 94.40% lines, 79.06% branches, 87.46% functions |

The composite shell command used to collect coverage returned exit code 1 only because later metadata commands repeated `research/agentic-module` while already running inside that directory. The coverage test process itself completed 113/113 successfully; metadata and `git diff --check` were rerun separately and passed.

## 6. Remaining risks and release gates

### High priority — consuming application

1. Run `runHarnessStoreConformance`, `runHarnessRecoveryPrefixConformance`, `runSessionStoreConformance`, and `runSessionRecoveryPrefixConformance` against a genuinely reopened production database adapter.
2. Crash-inject real write/external tools at plan, start, effect completion, settlement, checkpoint, abort, and close boundaries.
3. Implement authenticated, scoped SSE/WebSocket replay with an atomic replay/live handoff, bounded backpressure, heartbeat, disconnect cleanup, and duplicate control-message handling.
4. Integrate retrieval and artifact stores with tenant/workspace authorization and verify cross-scope negative cases.
5. Run secret fixtures, dependency/security review, concurrent-worker load tests, restart tests, and operator recovery drills.

### Medium priority — module quality

1. Raise branch coverage around host capability factories, session-operation rejection paths, node append-log failures, and recovery error branches.
2. Split `harness.ts` only when changes or defect history show the 930-line orchestration unit is slowing review; avoid speculative abstraction before that evidence exists.
3. Add property-based or fuzz tests for malformed durable logs and event order, plus mutation testing for reducer and recovery invariants.
4. Standardize public-boundary errors that still use plain `Error` if consuming applications require machine-readable codes everywhere.
5. Align the final HFS wording in `README.md` with the portable-versus-host distinction in `HFS_STATUS.md`.

## 7. Final assessment

The module satisfies the portable HFS contract and has unusually strong durability evidence for a standalone TypeScript harness. Its most valuable properties are explicit effect uncertainty, atomic terminal settlement, durable approval/question state, protocol-safe compaction, final-output validation, and reusable backend conformance.

The current **91/100 quality score** is not reduced by the intentional absence of a bundled database, retrieval system, HTTP server, or UI framework. It is reduced only where the module or its evidence can improve directly. A production deployment must not reuse the portable HFS 100 claim until its host-owned acceptance work is complete.
