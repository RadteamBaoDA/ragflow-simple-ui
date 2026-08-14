# Agentic Module Integration Specification

## Goal

Integrate `@agentic/module` into another TypeScript codebase using that
codebase's database, authentication, LLM, transport, retrieval, storage, and
MCP infrastructure. The module has zero runtime dependencies and imports no
host-application code.

## Package entrypoint

Build the package and import only its root:

```ts
import {
  DurableInteractionManager,
  ToolRegistry,
  createAgentHarness,
  runHarnessStoreConformance,
  type HarnessStore,
} from "@agentic/module";
```

Required environment: TypeScript 5.7+, ES2022+, `AbortController`, and an ESM
consumer or compatible bundler. Do not copy individual source files.

## Runtime composition

```text
authenticated HTTP/WebSocket/job
  -> host HarnessStore (existing database)
  -> createAgentHarness
       -> append-only events + reducer/checkpoints
       -> ProviderAdapter
       -> ToolRegistry -> schema validation -> central policy
       -> durable approval/question suspension
       -> citations + artifacts
  -> host transport and persistence
```

Create one harness configuration per provider/security boundary. Runs are
identified by `runId`; authorization also compares principal, tenant, and
workspace context. UUID possession is not authorization.

## Database adapter contract

Implement `HarnessStore` using the existing database. The following operations
must be database transactions or equivalent atomic conditional writes:

- `create`: insert a unique run with owner context and version `0`;
- `claim`: compare owner, reject terminal runs, and acquire an unexpired lease;
- `renewLease`: update only when `workerId` still owns the lease;
- `append`: require `expectedVersion`, append ordered events, increment version,
  and deduplicate `idempotencyKey` in one transaction;
- `load`: return one consistent record/events view ordered by `sequence`;
- `releaseLease`: release only the owning worker;
- `close`: make terminal state durable and release its lease.

Recommended constraints:

```text
UNIQUE(run_id)
UNIQUE(run_id, sequence)
UNIQUE(run_id, idempotency_key) WHERE idempotency_key IS NOT NULL
```

Run the exported conformance suite against the real adapter:

```ts
const failures = await runHarnessStoreConformance(() => new DatabaseHarnessStore(db));
if (failures.length) throw new Error(failures.join("\n"));
```

`InMemoryHarnessStore` is only a reference implementation for tests and local
demos. It does not provide process-restart durability.

## Approval flow

Register every capability with risk `read`, `write`, or `external`. Central
policy executes immediately before every tool. A `write`/`external` tool is:

1. allowed by `policy.isApproved`, or
2. suspended by the durable harness, or
3. denied when no approval capability exists.

With `DurableInteractionManager`, suspension persists an `approval_requested`
event and returns `status: "needs_input"` plus `result.pending`. Send that
request to the authorized client. Route its response by `runId + requestId`:

```ts
await harness.respondApproval(runId, context, {
  requestId,
  approved: true,
  alwaysAllow: false,
});
```

The harness resumes the saved tool call without asking the provider to produce
it again. Rejection and timeout fail closed. If `alwaysAllow` is true, the host
must persist a principal-scoped whitelist after independently authorizing that
operation; the module never writes a global whitelist.

## Question flow

Register `createDurableClarificationTool()`. A call persists a structured
request and returns `needs_input`. After input/choice/multi-choice, skip, or
timeout, route the correlated response:

```ts
await harness.respondClarification(runId, context, {
  requestId,
  skipped: false,
  timedOut: false,
  answers: [{ skipped: false, answer: "Ada" }],
});
```

The response becomes the saved tool result and provider execution continues
from the checkpoint. Duplicate, wrong-owner, wrong-request, timeout, abort, and
disconnect paths settle once. Call `expireInteraction()` from the host's job
scheduler; the core does not create background timers.

## Workflow 01-12 mapping

| Flow | Module behavior | Host implementation required |
|---|---|---|
| 01 invocation | ownership-aware atomic claim/lease, append/replay, abort/close | routes, authentication, DB `HarnessStore`, attachment transport |
| 02 activation | `shouldUseAgent` explicit/automatic routing | resolve the same provider/model used for execution |
| 03 tools | five identifier forms, registry, authorized live toggle | settings/admin APIs and availability loaders |
| 04 lifecycle | streaming/text parity, provider-tool-provider, exact budgets, direct output, retry, abort | provider adapter and JSON Schema validator |
| 05 approval | durable request/response, rejection/timeout fail closed | approval UI/transport and principal whitelist storage |
| 06 questions | durable input/choice/multi-choice, skip/timeout, resume | question UI/transport and scheduler |
| 07 RAG/docs | fresh context, scoped retrieval, document tools, write-risk memory store | vector/document adapters with scope enforcement |
| 08 artifacts | typed artifacts and safe-reference/ownership guard | byte storage, persistence, renderer and download endpoint |
| 09 flows | validation and sequential four-block executor | flow CRUD plus API/LLM/web executors |
| 10 imported skills | manifest validation, inactive-first, path/archive guards, execution-policy gate | extraction and worker/sandbox implementation |
| 11 MCP | lifecycle interface, health/timeout/suppression, schema dereference, safe serialization | MCP SDK transport, credentials and process/network isolation |
| 12 grounding | retrieval priority, untrusted context boundary, current-run citation validation, insufficient evidence | authorized evidence adapters and semantic answer evaluation |

## Host adapters still required

The consuming codebase must implement these before enabling the corresponding
feature:

- `HarnessStore` with its existing database;
- `AttachmentStore` and `ArtifactStore`;
- provider and tool-input JSON Schema validation;
- authenticated WebSocket/HTTP/job transport;
- approval/question UI and timeout scheduler;
- tenant/workspace-scoped context, vector, memory, and document adapters;
- imported-code worker/sandbox and archive extraction;
- MCP manager using the chosen MCP SDK;
- transactional final chat/result persistence and observability.

Absence of a required adapter must disable the feature or return
`CAPABILITY_UNAVAILABLE`; it must never silently grant access.

## Coding-agent completion checklist

When copying this module into a target codebase, the coding agent must:

1. Resolve the server-authoritative agent and map agent/user/tenant/workspace
   identity into `ExecutionContext`.
2. Implement `HarnessStore` and run `runHarnessStoreConformance` against the
   real database, including two concurrent claim attempts.
3. Map the target provider into `ProviderAdapter` and propagate `AbortSignal`.
4. Pass the target's existing JSON Schema validator as `validateToolInput`.
5. Implement server-authoritative `PolicyAdapter`; never rely on UI guards.
6. Wire approval/question events and responses using `runId + requestId`.
7. Schedule expired interactions and lease recovery using the host scheduler.
8. Implement `SkillRuntimeAdapter`: query only enabled bindings for `agentId`,
   select from metadata per request, and load exact selected versions/digests.
9. Scope every attachment, retrieval, document, artifact, imported-skill, and
   MCP operation to the authenticated context.
10. Persist final results transactionally; surface `PERSISTENCE_FAILED`.
11. Run the module suite, database conformance, target integration tests,
    typecheck/build, dependency scan, and `git diff --check`.

## Release gates

- All package tests, typecheck, build, package-root import, and tarball checks pass.
- Real database adapter passes conformance under concurrent execution.
- Restart tests resume pending approval and clarification without duplicate tool execution.
- Cross-principal and cross-tenant negative tests pass for runs, retrieval, and artifacts.
- Provider/tool/retrieval/MCP work stops on abort or disconnect.
- No enabled external capability bypasses schema validation and central policy.
- No source imports a host database, provider SDK, MCP SDK, UI, or web framework.
