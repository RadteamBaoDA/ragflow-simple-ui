# Coding Agent Contract — Portable Agentic TypeScript Module

## Mission

Implement Agentic as an independent, headless TypeScript module that another
TypeScript codebase can install and import. The module must reproduce the
observable behavior of workflows 01 through 12 under `research/v1/` without
importing AnythingLLM server, frontend, Prisma, storage, provider, vector DB, or
React code.

This replaces the previous dual-flow RAG/template scope. Do not implement
`rag_qa`, `template_generation`, HFS, CASAN, or Workflow 13 unless a later
requirement explicitly asks for them.

Do not implement production code before the target codebase, package location,
and implementation plan are approved.

## Roots and source-of-truth order

```text
TARGET_ROOT = codebase that will consume the module
REFERENCE_ROOT = D:\Project\AIProject\anything-llm
MODULE_ROOT = target-selected package directory
```

If `TARGET_ROOT == REFERENCE_ROOT`, stop and confirm that AnythingLLM itself is the
intended implementation target. Never edit the reference repo implicitly.

Use this precedence when requirements conflict:

1. This coding contract.
2. Workflow files 01–12 listed below.
3. Current reference implementation under `REFERENCE_ROOT`.
4. Other files under `research/v1/` as background only.

Workflow 13, comparison documents, and overview documents are not normative.
Read source call chains; do not copy whole JavaScript or React files.

## Required workflow references

```text
research/v1/agents-workflow-01-chat-invocation-websocket.md
research/v1/agents-workflow-02-automatic-native-tool-calling.md
research/v1/agents-workflow-03-skill-discovery-and-enablement.md
research/v1/agents-workflow-04-plugin-execution-lifecycle.md
research/v1/agents-workflow-05-tool-approval-and-whitelist.md
research/v1/agents-workflow-06-clarifying-questions.md
research/v1/agents-workflow-07-rag-memory-and-document-context.md
research/v1/agents-workflow-08-generated-files-charts-and-rich-outputs.md
research/v1/agents-workflow-09-agent-flows-builder-and-execution.md
research/v1/agents-workflow-10-imported-custom-skills.md
research/v1/agents-workflow-11-mcp-integration.md
research/v1/agents-workflow-12-context-retrieval-grounded-answer.md
```

## Current-code mapping audit

Mapping labels:

- `mapped`: the documented flow has a concrete end-to-end implementation.
- `host-coupled`: behavior exists but is bound to AnythingLLM infrastructure.
- `partial`: important documented or security behavior is missing or uneven.

| Workflow | Mapping | Current implementation evidence | Gap the portable target must address |
|---|---|---|---|
| 01 Browser invocation/WebSocket | mapped, host-coupled | `server/utils/chats/stream.js` -> `grepAgents()` in `server/utils/chats/agents.js` -> `WorkspaceAgentInvocation.new()` -> `agentInitWebsocketConnection` -> `/agent-invocation/:uuid` -> `AgentHandler.init()` -> reference runtime factory -> `startAgentCluster()` | Invocation persistence, attachment cache, HTTP/SSE, WebSocket, and UI are host concerns. Current attachment handoff is process-memory only. The endpoint validates UUID/closed state but does not itself prove that the connecting user owns the invocation. |
| 02 Automatic native tool calling | mapped, host-coupled | `Workspace.supportsNativeToolCalling()` in `server/models/workspace.js`; `grepAgents()` selects the same agent path; providers expose `supportsNativeToolCalling()` and native/untooled helpers | Capability routing is tied to workspace fields and has subtly different fallback resolution from `AgentHandler`. The module needs one deterministic resolver shared by detection and execution. |
| 03 Skill discovery and enablement | mapped, host-coupled | `WORKSPACE_AGENT.getDefinition()`, `agentSkillsFromSystemSettings()`, and `resolveAgentSkill()` in `server/utils/agents/defaults.js`; `AgentHandler.#attachPluginByName()` resolves built-ins, child tools, flows, imported skills, and MCP tools | Settings and admin UI are host-owned. Google Calendar does not use the same backend disabled-subskill filter as the other configured multi-tools. Live tool toggling exists in current code but is newer than the workflow document and must use the same registry resolution. |
| 04 Plugin execution lifecycle | mapped | Reference runtime `reply()`, `handleAsyncExecution()`, and `handleExecution()`; provider helpers in `providers/helpers/tooled.js` and `untooled.js` | Runtime is untyped CommonJS and mutates shared flags/buffers. Tool-limit counting currently depends on recursion depth and executes the call present at the limit. The target must define the count precisely and test it. |
| 05 Approval and whitelist | partial, host-coupled | `requestToolApproval()` in `plugins/websocket.js` and `plugins/http-socket.js`; `AgentSkillWhitelist`; approval card and whitelist API | Browser/Telegram paths time out closed, but built-in handlers commonly skip approval when the function is absent, and imported skills explicitly resolve approved in that case. The portable target must not silently approve risky tools when no approval channel exists. |
| 06 Clarifying questions | mapped, host-coupled | enablement in `defaults.js`; validation/cap in `plugins/request-user-input.js`; request/response correlation in `plugins/websocket.js`; frontend clarification cards and chat-history persistence | Non-interactive runs omit the tool. Transport, timeout UI, and persistence are host concerns. The target must settle pending questions on abort as well as response/timeout. |
| 07 RAG memory and document context | mapped, host-coupled | `AgentHandler.#fetchParsedFileContext()`; reference runtime context injection; `plugins/memory.js`; `plugins/summarize.js`; vector DB and document manager adapters | Current `rag-memory` supports both `search` and `store`; retrieval authorization is implicit in the supplied workspace namespace. Citations are buffered source objects, not validated proof that final claims are supported. |
| 08 Files, charts, rich outputs | mapped, host-coupled | `plugins/rechart.js`; `plugins/create-files/*`; `_pendingOutputs` and `_replySpecialAttributes`; `plugins/chat-history.js`; `server/endpoints/agentFileServer.js`; frontend event renderers | Rendering, storage, authentication, ownership checks, and downloads are host concerns. The core must emit typed artifacts and never write directly to a package-global directory. |
| 09 Agent flows | mapped, host-coupled | `server/utils/agentFlows/index.js`, `executor.js`, `flowTypes.js`, and executors; active `@@flow_<uuid>` identifiers become callable tools | JSON-file CRUD and admin builder are host concerns. Only `start`, `apiCall`, `llmInstruction`, and `webScraping` blocks exist. Do not invent graph/parallel/code/file blocks. |
| 10 Imported custom skills | partial, host-coupled | `server/utils/agents/imported.js`, import endpoints, Community Hub import path, `imported-manifest.schema.json` | Path containment and Zip Slip checks exist, but the loader does not actually validate manifests against the schema and executes `handler.js` in the server process without a sandbox. The target must validate before activation and require an explicit execution policy. |
| 11 MCP integration | partial, host-coupled | `server/utils/MCP/hypervisor/index.js`; `server/utils/MCP/index.js`; MCP admin endpoints/UI; `@@mcp_<server>` expansion in `AgentHandler` | Lifecycle and suppression are implemented. Tool-schema `$ref` dereferencing is not applied uniformly across all provider-formatting paths. MCP tools are arbitrary external capabilities and need central policy/approval enforcement. |
| 12 Context retrieval and grounded answer | mapped behavior, partial enforcement | Workflow 01/04 runtime plus parsed/pinned context, `rag-memory`, document summarizer, web search/scrape, citation events, and chat-history persistence | Retrieval and source display exist, but grounding is prompt-guided. There is no deterministic final-answer check tying citations to authorized retrieval records or rejecting unsupported citations. |

The target is behaviorally compatible with the useful flow, not with the gaps
above. Security fixes are required compatibility hardening, not optional scope.

## Package boundary

Build one package with two import surfaces:

```text
@agentic/module  # platform-neutral runtime, durable harness contracts and flow engine
```

Use the target repository's existing package/build/test tooling. Do not add an
agent framework, database, web framework, UI framework, vector database, or
provider SDK to the core. Prefer zero core runtime dependencies; use the
target's existing JSON-schema validator if one already exists.

The core must not:

- create HTTP or WebSocket routes;
- access `process.env`, a database, filesystem, or network directly;
- import AnythingLLM modules;
- assume React, Prisma, a workspace schema, or a particular LLM provider;
- persist hidden chain-of-thought;
- expose a package-global singleton whose state leaks between runs.

MCP SDK, archive extraction, database access, and filesystem operations remain
host integrations behind explicit adapters, not core dependencies.

## Minimal public API

Exact filenames may follow the target's conventions, but these exported names
and semantics are stable.

```ts
export type RunId = string;
export type ToolName = string;
export type JsonSchema = Record<string, unknown>;

export type AgentEvent =
  | { type: "run_started"; runId: RunId }
  | { type: "status"; runId: RunId; message: string }
  | { type: "tool_started"; runId: RunId; toolName: ToolName; callId: string }
  | { type: "tool_finished"; runId: RunId; toolName: ToolName; callId: string; result: unknown }
  | { type: "output_delta"; runId: RunId; text: string }
  | { type: "approval_requested"; runId: RunId; request: ApprovalRequest }
  | { type: "clarification_requested"; runId: RunId; request: ClarificationRequest }
  | { type: "artifact_created"; runId: RunId; artifact: Artifact }
  | { type: "citations"; runId: RunId; citations: Citation[] }
  | { type: "run_finished"; runId: RunId; result: AgentResult };

export interface AgentRequest {
  runId: RunId;
  input: string;
  history?: AgentMessage[];
  attachments?: Attachment[];
  context: ExecutionContext;
  signal?: AbortSignal;
}

export interface AgentMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  toolCallId?: string;
  attachments?: Attachment[];
}

export interface Attachment {
  id: string;
  mediaType: string;
  name?: string;
  data?: unknown;
  storageRef?: string;
}

export interface ExecutionContext {
  principalId?: string;
  tenantId?: string;
  workspaceId?: string;
  conversationId?: string;
  metadata?: Record<string, unknown>;
}

export interface AgentResult {
  runId: RunId;
  status: "completed" | "needs_input" | "aborted" | "failed";
  text?: string;
  citations: Citation[];
  artifacts: Artifact[];
  error?: AgentError;
}

export interface AgentError {
  code: string;
  message: string;
  retryable: boolean;
}

export interface Citation {
  id: string;
  title: string;
  sourceRef: string;
  excerpt?: string;
  score?: number;
}

export interface ApprovalRequest {
  requestId: string;
  toolName: ToolName;
  description?: string;
  displayPayload?: Record<string, unknown>;
  timeoutMs: number;
}

export interface ClarificationRequest {
  requestId: string;
  questions: ClarificationQuestion[];
  allowSkip: boolean;
  timeoutMs: number;
}

export interface ClarificationResponse {
  requestId: string;
  skipped: boolean;
  timedOut: boolean;
  answers: Array<{ skipped: boolean; answer: unknown }>;
}

export interface ApprovalResponse {
  requestId: string;
  approved: boolean;
  alwaysAllow?: boolean;
}

export type ClarificationQuestion =
  | { kind: "input"; question: string; inputType?: string }
  | { kind: "choice"; question: string; choices: string[]; multiple?: boolean };

export interface Artifact {
  id: string;
  kind: "file" | "chart" | "image" | "custom";
  mediaType: string;
  displayName?: string;
  payload: unknown;
  storageRef?: string;
}

export interface ProviderAdapter {
  supportsNativeToolCalling(model?: string): boolean | Promise<boolean>;
  complete(request: ProviderRequest): Promise<ProviderResponse>;
  stream?(request: ProviderRequest): AsyncIterable<ProviderChunk>;
}

export interface ProviderRequest {
  messages: AgentMessage[];
  tools: Array<Pick<ToolDefinition, "name" | "description" | "parameters">>;
  signal: AbortSignal;
}

export type ProviderResponse =
  | { type: "text"; text: string; usage?: Record<string, number> }
  | { type: "tool_call"; callId: string; name: ToolName; arguments: unknown };

export type ProviderChunk =
  | { type: "text_delta"; text: string }
  | { type: "tool_call"; callId: string; name: ToolName; arguments: unknown }
  | { type: "usage"; usage: Record<string, number> };

export interface ToolDefinition {
  name: ToolName;
  description: string;
  parameters: JsonSchema;
  risk: "read" | "write" | "external";
  execute(input: unknown, context: ToolContext): Promise<ToolResult>;
}

export interface ToolContext {
  runId: RunId;
  execution: ExecutionContext;
  signal: AbortSignal;
  addCitation(citation: Citation): void;
  addArtifact(artifact: Artifact): void;
}

export type ToolResult =
  | { type: "continue"; content: string }
  | { type: "direct_output"; content: string };

export interface UserFeedback {
  text?: string;
  attachments?: Attachment[];
  approval?: ApprovalResponse;
  clarification?: ClarificationResponse;
}

export type FlowStep =
  | { type: "start"; config: { variables: Array<{ name: string; value?: unknown; description?: string }> } }
  | { type: "apiCall"; config: Record<string, unknown> }
  | { type: "llmInstruction"; config: Record<string, unknown> }
  | { type: "webScraping"; config: Record<string, unknown> };

export interface FlowDefinition {
  id: string;
  name: string;
  description?: string;
  active: boolean;
  steps: FlowStep[];
}

export interface AgenticConfig {
  provider: ProviderAdapter;
  tools: ToolDefinition[];
  policy: PolicyAdapter;
  emit(event: AgentEvent): void | Promise<void>;
  maxToolCalls?: number;
  maxTurns?: number;
  adapters?: Partial<AgenticHostAdapters>;
}

export interface PolicyAdapter {
  canManageTools(context: ExecutionContext): boolean | Promise<boolean>;
  authorizeTool(tool: ToolDefinition, context: ExecutionContext): boolean | Promise<boolean>;
  isAutoApproved(tool: ToolDefinition, context: ExecutionContext): boolean | Promise<boolean>;
  isWhitelisted(tool: ToolDefinition, context: ExecutionContext): boolean | Promise<boolean>;
  rememberApproval?(tool: ToolDefinition, context: ExecutionContext): Promise<void>;
}

export interface AgenticHostAdapters {
  invocations: {
    claim(runId: RunId, context: ExecutionContext): Promise<boolean>;
    close(runId: RunId, status: AgentResult["status"]): Promise<void>;
  };
  attachments: {
    take(runId: RunId, context: ExecutionContext): Promise<Attachment[]>;
  };
  approval: {
    request(runId: RunId, request: ApprovalRequest, signal: AbortSignal): Promise<ApprovalResponse>;
  };
  clarification: {
    request(
      runId: RunId,
      request: ClarificationRequest,
      signal: AbortSignal
    ): Promise<ClarificationResponse>;
  };
  context: {
    load(context: ExecutionContext, signal: AbortSignal): Promise<Array<{
      content: string;
      citation: Citation;
    }>>;
  };
  retrieval: {
    search(query: string, context: ExecutionContext, signal: AbortSignal): Promise<Array<{
      content: string;
      citation: Citation;
    }>>;
    store?(content: string, context: ExecutionContext, signal: AbortSignal): Promise<void>;
  };
  documents: {
    list(context: ExecutionContext, signal: AbortSignal): Promise<Array<{ id: string; title: string }>>;
    read(id: string, context: ExecutionContext, signal: AbortSignal): Promise<{
      content: string;
      citation: Citation;
    }>;
  };
  runs: {
    save(result: AgentResult, context: ExecutionContext): Promise<void>;
  };
  artifacts: {
    save(artifact: Artifact, context: ExecutionContext, signal: AbortSignal): Promise<Artifact>;
  };
  flows: {
    listActive(context: ExecutionContext): Promise<string[]>;
    load(id: string, context: ExecutionContext): Promise<FlowDefinition>;
  };
  importedSkills: {
    listActive(context: ExecutionContext): Promise<string[]>;
    load(id: string, context: ExecutionContext): Promise<ToolDefinition>;
  };
  mcp: {
    listActiveServers(context: ExecutionContext): Promise<string[]>;
    listTools(server: string, context: ExecutionContext): Promise<ToolDefinition[]>;
    callTool(server: string, tool: string, input: unknown, signal: AbortSignal): Promise<unknown>;
  };
}

export interface AgenticRuntime {
  start(request: AgentRequest): Promise<AgentResult>;
  continue(runId: RunId, feedback: UserFeedback): Promise<AgentResult>;
  abort(runId: RunId): void;
  setToolEnabled(runId: RunId, toolName: ToolName, enabled: boolean): Promise<void>;
}

export function createAgenticModule(config: AgenticConfig): AgenticRuntime;
```

Keep invocation, approval, clarification, retrieval, persistence, artifact,
flow, imported-skill, and MCP ownership separate so hosts can implement only
the capabilities they enable. MCP results remain `unknown` by design and must
be normalized before entering provider history.

`AgenticConfig` accepts adapters for provider resolution, invocation state,
tool policy, approval, clarification, context retrieval, persistence,
artifacts, flows, imported skills, MCP, logging, and ID/time generation. Only
the provider, tool registry, policy, and event sink are required for a basic
non-persistent run. A requested workflow must fail with a stable capability
error when its adapter is absent; it must not guess or silently downgrade.

## Shared runtime invariants

```text
host trigger -> invocation adapter -> createAgenticModule -> resolve provider/tools
             -> model -> optional tool -> model -> final result
             -> typed events + persistence adapter
```

- One run owns its history, counters, pending requests, citations, artifacts,
  abort controller, and tool snapshot.
- Provider streaming and non-streaming use the same loop and terminal rules.
- Tool results are appended to provider history before the next model call.
- Unknown tool calls become a structured tool error and consume one attempt.
- `maxToolCalls` means exactly the number of handlers that may execute. At the
  limit, call the provider once with no tools; do not execute call N+1.
- `maxTurns` separately bounds user/agent continuation rounds.
- Direct output terminates the current turn after emitting output, citations,
  artifacts, and usage; it must not leave a mutable global skip flag.
- Abort propagates to provider, retrieval, tool, flow, approval,
  clarification, artifact, and MCP work and settles every pending promise.
- Every final path emits exactly one `run_finished` event.

## Workflow contracts

### 01 — Invocation and interactive transport

Provide host helpers that decide whether a request is agent-capable and create
an invocation before runtime start. Invocation records contain `runId`, input,
principal/context ownership, status, and attachment references. The host may
bootstrap a WebSocket through SSE as AnythingLLM does, but protocol routing is
outside the core.

Requirements:

- Authorize the connecting principal against the invocation context; UUID
  possession alone is insufficient.
- Claim an invocation atomically so it cannot start twice.
- Use an `AttachmentStore` adapter rather than an in-memory module `Map`.
- Route correlated feedback, approval, clarification, tool-toggle, abort, and
  close messages by `runId` and request/call ID.
- Close marks the invocation terminal and aborts active work.

### 02 — Explicit and automatic activation

Export one activation function used by both detection and execution:

```ts
shouldUseAgent({ input, mode, provider }): Promise<boolean>
```

Return true for an explicit `@agent` prefix. In `automatic` mode return true
only when the resolved provider/model supports native tool calling. Resolve
provider/model once through the same `ProviderResolver` used by the run. Keep
prompt-based untooled execution available only for explicit activation.

### 03 — Tool discovery, enablement, and live toggles

Use one `ToolRegistry`; do not duplicate browser and ephemeral loaders. Support
these reference identifier forms at the adapter boundary:

```text
plain-tool
parent#child
@@flow_<id>
@@<imported-skill-id>
@@mcp_<server-name>
```

Discovery combines default tools, optional enabled tools, enabled child tools,
clarification, imported skills, flows, and MCP tools. Availability, suppression,
and authorization are server-authoritative. A live toggle updates only the
run's tool snapshot and requires `PolicyAdapter.canManageTools(context)`.

### 04 — Provider/tool/provider lifecycle

Providers return final text or one structured tool call. Native and prompt-based
providers normalize into the same `ProviderResponse`. Validate tool arguments
against the declared schema before execution. Apply policy centrally, execute
the handler, append a normalized result, and continue until final text, direct
output, abort, error, or budget exhaustion.

Do not rely on each tool author remembering to enforce approval or policy.

### 05 — Approval and whitelist

Before every `write` or `external` tool, evaluate in order:

1. host auto-approval policy;
2. principal-scoped whitelist;
3. interactive approval adapter;
4. deny.

Requests include a unique `requestId`, tool name, redacted display payload,
description, and timeout. Match responses by `runId` and `requestId`. Rejection,
timeout, abort, missing channel, or transport close fail closed. “Always allow”
persists through the host whitelist adapter after authorization; the client
cannot write another principal's or global whitelist.

### 06 — Clarifying questions

Expose the clarification tool only when enabled and an interactive adapter is
available. Support input and choice questions, single/multi select, skip, and a
configurable per-turn cap. Validate and truncate a batch to the remaining cap.
Reset the counter on the next user turn. Persist the completed survey through
the run store. Response, skip, timeout, abort, and close must all settle the
request deterministically.

### 07 — RAG memory and document context

Use a `ContextAdapter` for fresh attachments/pinned documents before every
model turn, a `RetrievalAdapter.search()` action for vector retrieval, an
optional approved `RetrievalAdapter.store()` action for long-term memory, and
an optional document list/read/summarize adapter.

Every returned chunk carries a host-authorized provenance record. Delimit
retrieved content as untrusted data, never higher-priority instruction. A
`store` action is `risk: "write"` and must pass Workflow 05.

### 08 — Artifacts and rich outputs

Tools return typed artifacts instead of writing to a fixed directory or
sending UI-specific socket messages:

```ts
interface Artifact {
  id: string;
  kind: "file" | "chart" | "image" | "custom";
  mediaType: string;
  displayName?: string;
  payload: unknown;
  storageRef?: string;
}
```

The host `ArtifactStore` writes bytes, persists references, renders cards, and
serves downloads. A download must validate filename/reference format and prove
that the requesting principal can access the run/chat containing the artifact.

### 09 — Deterministic agent flows

Implement only four block types: `start`, `apiCall`, `llmInstruction`, and
`webScraping`. Validate all blocks before save/activation. Start variables form
the tool schema. Execute steps sequentially, expand `${path.to.value}` including
array/bracket access, store configured result variables, stop on first failure,
and honor direct output without another model pass. Flow persistence and CRUD
belong to `FlowStore`; a visual builder is not part of this package.

### 10 — Imported custom skills

The host imported-skill loader supports `plugin.json` plus an entrypoint. Before a
skill becomes active it must:

- validate the manifest with the declared JSON schema;
- validate package and entrypoint paths remain inside the configured root;
- reject archive path traversal before extraction;
- import as inactive and require an authorized activation;
- convert manifest parameters to a tool schema;
- inject central policy/approval so the skill cannot override it;
- use an explicit host execution policy: sandbox/worker, or documented
  `in_process` opt-in. Never default silently to in-process arbitrary code.

### 11 — MCP integration

Use an `McpManager` adapter for stdio/SSE/streamable HTTP lifecycle, connection
timeout, health, list-tools, call-tool, stop, reload, and suppression. Expand
each active server into one tool per unsuppressed MCP tool. Normalize names,
recursively dereference local JSON-schema `$ref` values before every provider
formatter, validate arguments, safely serialize BigInt/circular results, and
route every MCP call through Workflow 05 policy. Core does not spawn processes.

### 12 — Retrieval and grounded answering

Use this priority for workspace questions:

```text
authorized attached/pinned context
-> authorized vector search
-> named document read/summarize
-> external search/read only when requested or local evidence is insufficient
```

Use short, specific retrieval queries and split multi-part questions. Each
citation must refer to a provenance record returned during the current run and
authorized for the same execution context. Reject unknown citation IDs. When
no adequate local evidence exists, state that explicitly; do not claim the
knowledge base answered. Separate local and external evidence and disclose
conflicts. Persist final text, citations, usage, artifacts, attachments, and
clarification results through the host store.

The module guarantees provenance and citation validity. Semantic claim support
remains a model/evaluation concern unless a later requirement adds a claim
validator; do not advertise deterministic factual correctness.

## Security and trust boundaries

- Host adapters receive `ExecutionContext` on every read/write and fail closed
  when tenant/workspace/principal scope is missing.
- Tool arguments, flow variables, manifests, provider tool calls, transport
  messages, MCP schemas, artifact references, and retrieved text are untrusted.
- Central policy runs after schema validation and immediately before handler
  execution, so imported/MCP/built-in tools cannot bypass it.
- Never log secrets, authorization headers, raw retrieved bodies, attachment
  bodies, approval payload secrets, or hidden chain-of-thought by default.
- Imported code and MCP servers are arbitrary-code/external-service boundaries;
  activation is an admin-authorized host operation.

## Stable errors and terminal behavior

```text
INVALID_REQUEST
INVOCATION_NOT_FOUND
INVOCATION_ALREADY_CLAIMED
CAPABILITY_UNAVAILABLE
PROVIDER_UNAVAILABLE
PROVIDER_FAILED
TOOL_NOT_FOUND
TOOL_ARGUMENTS_INVALID
TOOL_DENIED
TOOL_FAILED
APPROVAL_TIMEOUT
CLARIFICATION_TIMEOUT
RETRIEVAL_FAILED
INVALID_CITATION
ARTIFACT_FAILED
FLOW_INVALID
FLOW_FAILED
SKILL_MANIFEST_INVALID
SKILL_EXECUTION_DENIED
MCP_UNAVAILABLE
BUDGET_EXHAUSTED
ABORTED
PERSISTENCE_FAILED
```

Each error has `code`, safe `message`, `retryable`, and optional `cause` kept
out of user events by default. Abort is idempotent. Persistence failure must be
reported; it must not be presented as a successfully saved run.

## Required tests

Use the target's existing test runner. Keep tests adapter-driven and runnable
without network, browser, real LLM, vector DB, MCP process, or filesystem outside
a test temp directory.

| Workflow | Minimum acceptance test |
|---|---|
| 01 | authorized invocation claims once; wrong principal denied; close aborts; attachments survive adapter handoff |
| 02 | explicit activation works without native tools; automatic activation uses the same provider resolution as execution |
| 03 | all five identifier forms resolve; disabled/unavailable tools stay absent; unauthorized live toggle fails |
| 04 | text completion; tool round-trip; streaming parity; unknown tool; exact tool budget; direct output; abort propagation |
| 05 | auto-approved, whitelisted, approved, rejected, timed out, aborted, and missing-channel risky tool paths |
| 06 | validated batch, cap/truncation, response, skip, timeout, abort, next-turn reset, persistence |
| 07 | fresh context each turn; search citations; scoped denial; duplicate handling; approved store; summarize abort |
| 08 | typed artifact event/persistence; invalid reference; unauthorized download; path traversal rejection |
| 09 | supported-block validation; defaults/overrides; nested variable paths; failure stop; direct output |
| 10 | schema rejection; inactive import; Zip Slip rejection; path containment; approval cannot be overridden; execution policy denial |
| 11 | lifecycle timeout; suppression; `$ref` normalization for every provider formatter; BigInt/circular result; policy denial; abort |
| 12 | direct local answer, no-result disclosure, external fallback, conflicting evidence, forged citation rejection, cross-scope denial |

Also run package typecheck, build, lint if configured, focused tests, the target's
full relevant suite, and `git diff --check`.

## Planning procedure

Before implementation:

1. Inspect target instructions, dirty status, package/build/test conventions,
   module format, Node/TypeScript versions, and existing adapters/dependencies.
2. Trace the current reference symbols named in the mapping audit and verify
   they have not drifted.
3. Produce a gap matrix:

   ```text
   workflow | required behavior | target existing code | reference symbol |
   reuse/adapt/create | security boundary | test | gap
   ```

4. Select the smallest package layout that exposes `@agentic/module` without
   coupling core to host infrastructure.
5. Map exact files, exported types, adapter ownership, tests, and verification
   commands in `research/YYYY-MM-DD-agentic-module-plan.md`.
6. Stop for approval. Do not write production code during planning.

## Definition of done

- All workflows 01–12 have a passing acceptance test and a public or adapter
  contract; none is represented only by a stub or document.
- A fixture host can import the built package, register a fake provider/tool,
  execute a tool round-trip, continue an interactive run, abort it, and consume
  typed events without importing AnythingLLM.
- Core has no imports from AnythingLLM, UI, database, filesystem, network, or a
  concrete provider/MCP SDK.
- Concurrent runs do not share counters, buffers, approvals, citations,
  artifacts, histories, or abort state.
- Risky tools fail closed without policy/approval capability.
- Invocation ownership, retrieval scope, imported paths, MCP calls, and artifact
  access are covered by negative tests.
- Package exports and generated declarations work from a separate TypeScript
  fixture project.
- No Workflow 13, dual-flow agent, template-generation pipeline, visual builder,
  provider catalog, vector DB, or UI implementation is added speculatively.
