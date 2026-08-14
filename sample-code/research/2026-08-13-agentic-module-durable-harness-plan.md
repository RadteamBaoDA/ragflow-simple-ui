# Agentic Module Durable Harness Implementation Plan

> **For agentic workers:** Execute inline with TDD. Do not delegate or add a database dependency.

**Goal:** Complete Agentic workflows 01-12 and add a database-agnostic durable agent harness that another TypeScript codebase can import from the package root.

**Architecture:** The core is an event-sourced state machine. A host-provided `HarnessStore` owns atomic claim/lease, append-only events, snapshots, attachments, artifacts, and terminal persistence. The package owns reducers, recovery, provider/tool execution, approval and clarification suspension/resume, grounding, flow validation, imported-skill security contracts, MCP lifecycle contracts, and adapter conformance tests.

**Tech Stack:** TypeScript 5.9, ES2022, Node built-in test runner, zero runtime dependencies.

**Spec:** `research/2026-08-13-agentic-module-coding-spec.md`

## Global constraints

- Do not import AnythingLLM, a database, web framework, provider SDK, vector DB, or MCP SDK.
- Database durability is supplied by the consuming codebase through adapters.
- In-memory stores are test/demo implementations only.
- Approval and clarification fail closed and are recoverable by `runId + requestId`.
- Every terminal path emits exactly one `run_finished` event.
- Keep `research/v1/` and unrelated worktree changes untouched.

### Task 1: Durable state and store contracts

**Files:** create `src/harness-types.ts`, `src/harness-store.ts`, `src/reducer.ts`; test `test/harness.test.ts`.

**Produces:** `RunRecord`, `HarnessEvent`, `HarnessStore`, `InMemoryHarnessStore`, `reduceHarnessEvents`, and store conformance tests.

- [ ] Write failing tests for atomic ownership claim, append sequencing, idempotency, lease expiry, terminal close, and reducer recovery.
- [ ] Run focused tests and confirm missing exports fail.
- [ ] Implement the minimum contracts, reducer, and in-memory reference store.
- [ ] Run focused tests until green.

### Task 2: Durable runtime lifecycle

**Files:** create `src/harness.ts`; modify `src/runtime.ts`, `src/types.ts`, `src/index.ts`; test `test/harness.test.ts`.

**Produces:** `createAgentHarness()` with `start`, `resume`, `continue`, `abort`, `close`, and `recover`.

- [ ] Write failing tests for start/recovery, checkpoint resume, abort, close, retryable failure, exact tool budget, max turns, event replay, and concurrent-run isolation.
- [ ] Confirm failures are caused by missing lifecycle behavior.
- [ ] Implement state transitions and persistence through `HarnessStore`.
- [ ] Run focused and existing module tests.

### Task 3: Durable approval and clarification

**Files:** create `src/interaction.ts`; modify `src/harness.ts`, `src/types.ts`; test `test/interactions.test.ts`.

**Produces:** correlated approval/clarification requests and response APIs with timeout/abort/duplicate protection.

- [ ] Write failing tests for approve, reject, always-allow, missing channel, timeout, abort, clarification answer/skip, duplicate response, and restart recovery.
- [ ] Implement persisted pending interactions and `needs_input` suspension.
- [ ] Verify every pending interaction settles deterministically.

### Task 4: Workflow capability adapters

**Files:** create `src/capabilities.ts`, `src/artifacts.ts`; modify `src/host-tools.ts`, `src/flow.ts`, `src/grounding.ts`; test `test/workflows.test.ts`.

**Produces:** fresh context injection, scoped retrieval/store/document tools, artifact ownership validation, flow validation, evidence priority, conflict/no-result outcomes, and citation validation.

- [ ] Write one failing acceptance test for each workflow 01-09 and 12 requirement not covered by Tasks 1-3.
- [ ] Implement only adapter-driven behavior; do not add transport, storage, or vector implementations.
- [ ] Run workflow tests and existing tests.

### Task 5: Imported skills and MCP boundaries

**Files:** modify `src/imported-skills.ts`, `src/mcp.ts`, `src/security.ts`; test `test/extensions.test.ts`.

**Produces:** inactive-first activation, execution-policy enforcement, archive/path validation, MCP manager timeout/health/reload/stop contracts, suppression, abort, and central policy routing.

- [ ] Write failing Workflow 10 and 11 acceptance tests.
- [ ] Implement portable validators and adapter contracts without loading code or spawning processes in core.
- [ ] Run extension tests and the full suite.

### Task 6: Database adapter conformance and handoff spec

**Files:** create `src/conformance.ts`, `test/conformance.test.ts`; modify `README.md`, `INTEGRATION_SPEC.md`, and the coding spec.

**Produces:** `runHarnessStoreConformance()` plus a coding-agent gap checklist for host database, transport, provider, RAG, artifact, imported runtime, and MCP integrations.

- [ ] Write a failing conformance test against an intentionally invalid store and a passing test against `InMemoryHarnessStore`.
- [ ] Implement the reusable conformance runner.
- [ ] Document required database transaction semantics and integration sequence.
- [ ] Run test, typecheck, build, package dry-run, root-import smoke, dependency scan, and `git diff --check`.

## Stop condition

Stop when every workflow 01-12 has executable acceptance evidence, harness recovery/concurrency tests pass, package-root imports work, and all remaining host-specific work is named in the integration spec rather than hidden behind a stub.
