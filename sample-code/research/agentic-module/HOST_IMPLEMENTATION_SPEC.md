# Coding Agent Spec: Complete Host Integration

## Objective

Integrate `@agentic/module` into the target TypeScript codebase using its
existing database and infrastructure. Do not add another database. Do not copy
host-specific code into the module.

## Source of truth

1. This file for remaining host work.
2. `INTEGRATION_SPEC.md` for adapter semantics.
3. Exported types from `@agentic/module`.
4. Target-codebase authentication, database, transaction, transport, and test
   conventions.

If an exported contract conflicts with documentation, stop and update the
documentation or contract together; do not guess.

## Required implementation order

### 1. Database harness store

Implement every `HarnessStore` method with the target database. Atomic claim,
lease acquisition, optimistic version append, event sequencing, idempotency,
and `settle` must execute transactionally. `settle` atomically appends terminal
events, changes status, and releases the lease; never emulate it with separate
append/update calls.

Acceptance:

- `runHarnessStoreConformance(() => new TargetHarnessStore(db))` returns `[]`;
- `runHarnessRecoveryPrefixConformance({ writer, reopen })` returns `[]` against
  a genuinely reopened database adapter;
- two concurrent workers cannot both claim the same live run;
- a stale `expectedVersion` cannot append;
- process recreation can load events and recover the last checkpoint;
- wrong agent, principal, tenant, or workspace cannot claim or respond.

### 2. Provider and validation

Implement `ProviderAdapter` using the target provider abstraction. Pass
`AbortSignal` into every provider request and normalize final text, streaming
deltas, one structured tool call, usage, and citation IDs. Pass the target's
existing JSON Schema validator as `validateToolInput`.

Acceptance: streaming and non-streaming produce the same final result; invalid
arguments fail before policy/tool execution; retryable provider failures obey
`maxAttempts`; exactly one `run_finished` is emitted.

### 3. Authentication and transport

Create authenticated HTTP/WebSocket/job handlers around `createAgentHarness`.
Never authorize by `runId` alone. Route start, continue, approval response,
clarification response, abort, close, and tool toggle with the authenticated
`ExecutionContext`.

Acceptance: disconnect aborts active work; duplicate messages are idempotent;
unknown/wrong-owner requests fail closed.

### 4. Approval and clarification UI

Create one `DurableInteractionManager` with the same `HarnessStore`. Render
`AgentResult.pending` and correlate responses using `runId + requestId`.
Schedule `expireInteraction()` using the target scheduler. Persist
principal-scoped `alwaysAllow` only after server authorization.

Acceptance: approve, reject, timeout, abort, disconnect, duplicate response,
skip, input, choice, multi-choice, and restart recovery all settle once; an
approved tool executes once.

### 5. Attachments, RAG, documents, memory, and grounding

Implement `AttachmentStore`, fresh `loadContext`, scoped retrieval/document
adapters, and the write-risk memory tool. Every operation must require tenant
and workspace scope. Retrieved text remains inside the untrusted-context
boundary. Only enable external retrieval when requested or local evidence is
insufficient.

Acceptance: context refreshes every turn; cross-scope reads fail; no result
returns `insufficient_evidence`; forged citation IDs fail; local/external
conflicts are disclosed by the response policy/evaluator.

### 6. Artifacts

Implement `ArtifactStore` using existing object/file storage. Store opaque
references, not absolute paths. Download routes must call
`authorizeArtifactAccess()` and prove access to the owning run/chat.

Acceptance: invalid references, traversal, and wrong-owner downloads fail;
artifact metadata survives restart.

### 7. Flows

Validate definitions with `validateFlow()` before activation. Supply only
`apiCall`, `llmInstruction`, and `webScraping` executors; `start` is handled by
the core. Propagate abort and central policy through the wrapper tool.

Acceptance: defaults/overrides, nested variables, first failure, direct output,
and all unsupported block types are tested.

### 8. Agent-scoped database skills

Resolve `agentId` from the authenticated server route or session; never accept
an unverified client-selected agent identity. Implement `SkillRuntimeAdapter`
against the existing database:

- `listCatalog` must join enabled `agent_skill_bindings` to enabled skill
  versions and filter by agent, tenant, and workspace;
- return metadata only (`id`, `name`, `version`, `digest`, `description`,
  optional `triggers` and `allowImplicitInvocation`);
- `load` must fetch the exact selected `id + version + digest`, return its
  instructions and tools, and fail when a row changed or disappeared;
- use the module's deterministic explicit/keyword selector first; implement
  `select` only when the host needs database full-text or semantic ranking;
- semantic ranking may reorder only the already authorized catalog and must
  never grant access;
- keep `maxSelected` small. The runtime hydrates only selected definitions and
  the durable harness reuses the same snapshot during recovery.

Acceptance: explicit `$skill` wins; implicit-disabled skills require explicit
invocation; unrelated skills are not hydrated or exposed to the provider;
missing `context.agentId`, cross-agent claims, out-of-catalog selection,
duplicate names, version/digest mismatch, and oversized selection fail closed;
restart recovery calls `load` with the persisted snapshot without calling
`listCatalog` or `select` again.

### 9. Imported skills

Validate and normalize manifests, import inactive, authorize activation, check
every archive entry and resolved entrypoint path, and execute only through a
worker/sandbox unless an administrator explicitly enables in-process mode.

Acceptance: malformed manifest, inactive invocation, archive traversal, path
escape, execution-policy denial, and central approval bypass attempts fail.

### 10. MCP

Implement `McpManagerAdapter` with the target MCP SDK. Own server credentials,
start/stop/reload, health, timeout, process/network isolation, and suppressed
tools in the host. MCP tools remain `risk: "external"` and pass central policy.

Acceptance: unhealthy/timeout/abort, suppression, schema `$ref`, BigInt,
circular output, reload, stop, and policy denial are tested.

### 11. Persistence and operations

Persist final result/chat transactionally. Schedule lease renewal and expired
lease recovery. Add safe metrics for state transitions, retries, latency, tool
calls, pending interactions, and failures without secrets or hidden reasoning.

Acceptance: persistence failure produces `PERSISTENCE_FAILED`; crash/restart
does not duplicate a tool; deployment has a recovery job and operational
runbook.

## Prohibited shortcuts

- no in-memory store in production;
- no second database introduced by the module;
- no client-authoritative policy or whitelist;
- no auto-approval when transport is missing;
- no imported code in the server process by default;
- no direct filesystem path accepted as an artifact reference;
- no citation accepted unless produced by the current authorized run;
- no hidden chain-of-thought persistence.

## Final verification

Run package tests/typecheck/build, both real-database conformance suites, target integration
tests, restart and concurrent-worker tests, dependency scan, and
`git diff --check`. Report each gate separately; do not claim production-ready
status when a host adapter or negative test is still missing.
