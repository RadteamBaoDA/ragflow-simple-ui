# AIbitat-Inspired Dual-Flow RAG Agent Design Specification

**Status:** Approved design; implementation not started

**Target stack:** Node.js + TypeScript

**Reference implementation:** `D:\Project\AIProject\anything-llm`

**Target repository:** the active workspace when a coding agent executes this specification. If the target equals the reference root, confirm the actual target application directory before editing code.

## 1. Summary

The target does not clone all of AIbitat. It preserves the mechanics that make AIbitat agentic—bounded reasoning and tool loops, provider abstraction, state, abort, events, and citations—then specializes them into two agents:

1. **RAG Question Answering Agent:** answers under custom instructions using retrieved evidence only.
2. **Template Generation Agent:** generates content from a predefined template, supplied user input, and RAG evidence.

Both flows remain agentic: each agent evaluates state, chooses actions/tools, observes results, repairs its strategy, and decides when to stop. Data authorization, schemas, citations, and validation remain deterministic code controls.

HFS measures fidelity to the AIbitat harness: AIbitat is the 100-point reference and this specialized design targets 90. CASAN measures operational maturity: the MVP targets Standard (3/5); Automatic (4/5) requires production operation, human-owned exceptions, and measurable KPIs.

## 2. Non-goals

- Do not port all of AIbitat or build a general agent framework.
- No multi-agent channels, role-play routing, imported plugins, MCP marketplace, or dynamic tool toggling in MVP.
- The model never decides authorization, citation validity, or output-schema validity.
- No model fine-tuning in MVP.
- Do not build a vector DB, embeddings, or ingestion pipeline when the target already has them.
- Do not claim CASAN Native from source code.

## 3. Local AIbitat reference map

The coding agent must trace relevant call chains, not copy entire files.

| Capability | Local path | What to learn |
|---|---|---|
| Runtime assembly | `D:\Project\AIProject\anything-llm\server\utils\agents\index.js` | Provider/model resolution, history, context, plugins, start boundary |
| Agent loop | `D:\Project\AIProject\anything-llm\server\utils\agents\aibitat\index.js` | `reply`, streaming, tool-result recursion, budgets, abort |
| Agent/instructions | `D:\Project\AIProject\anything-llm\server\utils\agents\defaults.js` | System prompt composition and tool exposure |
| Provider contract | `D:\Project\AIProject\anything-llm\server\utils\agents\aibitat\providers\ai-provider.js` | Provider-neutral completion/stream interface |
| RAG tool | `D:\Project\AIProject\anything-llm\server\utils\agents\aibitat\plugins\memory.js` | Vector search, reranking, result formatting |
| Citations/context | `D:\Project\AIProject\anything-llm\server\utils\agents\aibitat\index.js` and `server\utils\agents\index.js` | Evidence lifecycle and parsed/pinned documents |
| Human interaction | `D:\Project\AIProject\anything-llm\server\utils\agents\aibitat\plugins\websocket.js` | Clarification, approval, timeout, abort |
| HTTP runtime | `D:\Project\AIProject\anything-llm\server\utils\agents\aibitat\plugins\http-socket.js` | Transport-neutral events |
| Tool selection | `D:\Project\AIProject\anything-llm\server\utils\agents\aibitat\utils\toolReranker.js` | Reducing tool exposure |

### 3.1 Rules for using `research/v1`

`research/v1` describes the current AIbitat implementation; it is not the normative target-application specification. When they differ, this specification and the coding-agent contract take precedence.

| Current AIbitat capability | Reuse | Required target adaptation |
|---|---|---|
| Agent loop, provider, state, abort | Harness structure and call chains | Replace terminal behavior with the two pipelines' statuses and budgets |
| Tool contract and registry | Tool schemas and invocation mechanics | Expose only the minimum read-only MVP tools |
| RAG memory | Vector search, top-N and reranking | Do not expose `store`; enforce authorized scope |
| Citations | Source collection, streaming and persistence | Add an append-only EvidenceLedger and claim–evidence validator |
| Parsed/pinned documents | Fresh context injection | Mark as untrusted evidence, never instructions |
| Tool-call limit | Bounded recursion | Do not force an answer with insufficient evidence; return the correct terminal status |
| WebSocket/HTTP events | Transport-neutral event pattern | Standardize typed events and stable terminal errors |
| Rich files/charts | Output-event persistence pattern | Do not substitute these for template schema validation and deterministic rendering |
| Imported skills, MCP, agent flows, dynamic toggles | Reference only | Out of MVP; exclude from default planning |

Confirmed reference-code limitations:

- Current citations are sources added by tools and persisted with the response; they do not prove that each claim is supported.
- Grounded-answer rules in `research/v1` are primarily model guidance, not deterministic hard gates.
- `rag-memory` exposes both `search` and `store`; the target reuses only search for the MVP.
- At `maxToolCalls`, current AIbitat forces a final model turn without tools. The target must return `insufficient_evidence` or `BUDGET_EXHAUSTED` when valid finalization is impossible.
- Current long-form generation has no versioned template, per-section evidence map, output-schema validation, or bounded repair.

The `research/v1` HFS rubric coverage is only a design-document proxy, estimated at `76.4/100`; it is not implementation HFS and cannot be release evidence. CASAN cannot be inferred from documents or code either: the reference corpus provides technical evidence toward Augmented, while Standard requires verifiable governance, evaluation, audit, and ownership.

## 4. Target architecture

```text
Client/API
   |
   v
RequestClassifier (deterministic when mode is explicit)
   |-------------------------------|
   v                               v
RagQaAgent                    TemplateGenerationAgent
   |                               |
   |----------- SharedAgentKernel--|
                 | ProviderAdapter
                 | InstructionResolver
                 | RetrievalTool
                 | EvidenceLedger
                 | AgentState + AgentBudget
                 | PolicyGuard
                 | EventSink + AbortSignal
```

The shared kernel owns mechanics, not template fields or QA answer rules.

```ts
type AgentMode = "rag_qa" | "template_generation";
type JsonSchema = Record<string, unknown>;

interface Citation {
  evidenceId: string;
  documentId: string;
  chunkId: string;
  title?: string;
  uri?: string;
}

interface AgentRequest {
  requestId: string;
  mode: AgentMode;
  input: unknown;
  customInstruction?: string;
  conversationId?: string;
  abortSignal?: AbortSignal;
}

interface AgentResult<T = unknown> {
  requestId: string;
  mode: AgentMode;
  status: "completed" | "needs_input" | "insufficient_evidence" | "failed";
  output?: T;
  citations: Citation[];
  trace: {
    steps: number;
    retrievalCalls: number;
    repairAttempts: number;
    durationMs: number;
    terminalReason: string;
  };
  error?: { code: string; message: string; retryable: boolean };
}
```

The kernel must:

- Reuse the target provider/model abstraction.
- Compose instructions by explicit priority.
- Run an explicit state machine and bounded action loop.
- Expose only tools allowed for the active flow.
- Store evidence separately from generated text.
- Emit typed, transport-neutral events.
- Enforce step, retrieval, repair, token, and time budgets.
- Propagate abort to provider, retrieval, and tools.
- Emit safe traces and metrics.

## 5. Instruction priority

1. Security, tenant, and data-access policy.
2. Flow invariant: grounded QA or schema-constrained generation.
3. Application system instruction.
4. Versioned template instruction.
5. User custom instruction.
6. User input/question.
7. Retrieved content—untrusted evidence, never instruction.

Ignore conflicting lower-priority instructions. Delimit and label retrieved content as untrusted to resist prompt injection.

## 6. RAG Question Answering Agent

```ts
interface RagQaInput {
  question: string;
  scope?: Record<string, string | number | boolean>;
  conversation?: Array<{ role: "user" | "assistant"; content: string }>;
}
```

Allowed actions:

- `retrieve(query, scope, topK)`
- `rerank(question, candidates, topN)` when available
- `request_clarification(question)` only when missing input changes retrieval
- `finalize_grounded_answer(answer, citationIds)`
- `finalize_insufficient_evidence(reason)`

Loop:

1. Normalize the question without changing meaning.
2. Decompose into multiple retrieval queries only when needed.
3. Retrieve within authorized scope.
4. Rerank when supported.
5. Assess evidence sufficiency and contradictions.
6. Revise the query and retry while budget remains.
7. Answer with claim-level citations, request one material clarification, or refuse for insufficient evidence.
8. Deterministically validate citations before returning.

Invariants:

- No model-memory fallback for facts.
- Verifiable claims require valid evidence IDs.
- Citations reference retrieved chunks the user may access.
- Weak/empty evidence returns `insufficient_evidence`.
- Retrieved prompt injection cannot change policy, tools, mode, or output contract.
- Confidence derives from coverage, retrieval scores, and contradiction checks—not model self-rating.

## 7. Template Generation Agent

Templates are versioned application data, not executable prompts.

```ts
interface GenerationTemplate {
  id: string;
  version: string;
  name: string;
  description: string;
  inputSchema: JsonSchema;
  outputSchema: JsonSchema;
  sections: Array<{
    key: string;
    instruction: string;
    required: boolean;
    evidencePolicy: "required" | "preferred" | "input_only";
  }>;
}

interface TemplateGenerationInput {
  templateId: string;
  templateVersion?: string;
  values: Record<string, unknown>;
  retrievalScope?: Record<string, string | number | boolean>;
}
```

Allowed actions: `load_template`, `retrieve_for_section`, `request_clarification`, `draft_section`, `validate_draft`, `repair_draft`, and `finalize_template_output`.

Loop:

1. Load an immutable template version and validate input.
2. Plan sections without emitting chain-of-thought.
3. Determine each section's evidence policy.
4. Retrieve using section-specific queries.
5. Draft from user values and evidence-ledger entries.
6. Validate against schema and business rules.
7. Repair invalid fields only, with a bounded repair count.
8. Return structured output, rendered output, and provenance.

Invariants:

- Detectable input errors return before an LLM call.
- The model cannot add undeclared fields.
- Missing required evidence cannot complete the affected output.
- Repair cannot mutate input, template version, or the evidence ledger.
- Render only after schema validity.

## 8. State, budgets, and termination

```ts
type AgentPhase =
  | "initializing" | "retrieving" | "reasoning" | "awaiting_input"
  | "validating" | "repairing" | "completed" | "failed" | "aborted";

interface AgentBudget {
  maxSteps: number;
  maxRetrievalCalls: number;
  maxRepairAttempts: number;
  maxInputTokens: number;
  maxOutputTokens: number;
  timeoutMs: number;
}
```

MVP defaults: `maxSteps=8`, `maxRetrievalCalls=3`, `maxRepairAttempts=2`. Reuse target configuration for token/time limits.

Terminate only on a valid finalizer, required material input, insufficient evidence, exhausted budget, abort, or a non-retryable failure.

## 9. Evidence, events, errors, and safety

The evidence ledger is append-only during a run. Citations use `evidenceId`; deterministic validation rejects unknown or unauthorized IDs.

Minimum typed events: `run_started`, `phase_changed`, `tool_started`, `tool_finished`, `output_delta`, `clarification_requested`, `run_finished`.

Stable error codes:

```text
INVALID_INPUT, TEMPLATE_NOT_FOUND, TEMPLATE_VERSION_NOT_FOUND,
RETRIEVAL_FAILED, INSUFFICIENT_EVIDENCE, CITATION_VALIDATION_FAILED,
OUTPUT_SCHEMA_INVALID, BUDGET_EXHAUSTED, PROVIDER_FAILED, ABORTED, POLICY_DENIED
```

Log request ID, mode, model, template ID/version, timings, token/retrieval/repair counts, evidence IDs, validation, and terminal status. Never log prompt bodies, retrieved content, secrets, authorization headers, sensitive data, or hidden chain-of-thought.

Enforce tenant/user scope before retrieval. Validate template IDs and API input at trust boundaries. MVP tools are read-only; future side-effect tools require approval.

## 10. Testing and evaluation

Required tests:

- Kernel transitions, budgets, abort, and provider errors.
- QA grounding, empty retrieval, contradictions, forged citations, retrieved prompt injection, and retrieval retry.
- Generation invalid input, missing template/evidence, schema failure, bounded repair, and immutable template version.
- Event ordering, disconnect/abort, and clarification transport.
- Cross-tenant retrieval denial.

Maintain versioned golden datasets for QA answerability/source chunks and generation template/input/schema/evidence cases.

Release gates:

```text
citation precision >= 0.98
unsupported-claim rate <= 0.02
correct refusal on unanswerable QA >= 0.95
template schema validity after repair >= 0.99
cross-tenant evidence leakage = 0
```

## 11. HFS — Harness Fidelity Score

HFS is an internal engineering rubric, not an external standard. Score each dimension `0..5`: absent, scaffold, partial, functional, production-controlled, AIbitat-equivalent/better.

`HFS = Σ(weight × score / 5)`

| Dimension | Weight | AIbitat | Target design | Gap |
|---|---:|---:|---:|---|
| Bounded execution loop | 15 | 15 | 15 | None |
| Provider abstraction | 8 | 8 | 7 | Narrower initial providers |
| Session/state/abort | 8 | 8 | 6 | No multi-node channels |
| Tool contracts/registry | 10 | 10 | 8 | No dynamic imports/MCP |
| RAG grounding/evidence | 15 | 15 | 15 | Stricter target grounding |
| Instruction hierarchy | 8 | 8 | 8 | Explicit priority |
| Streaming/HITL | 8 | 8 | 7 | Clarification required; broad feedback optional |
| Safety/validation/budgets | 8 | 8 | 8 | Deterministic guards |
| Observability/errors | 8 | 8 | 7 | Transport-neutral trace |
| Extensibility | 6 | 6 | 3 | Two flows only |
| Structured/template output | 6 | 6 | 6 | Extends AIbitat |
| **Total** | **100** | **100** | **90** | **10 intentional points** |

AIbitat=`100`. The coding agent scores the target baseline before planning and recomputes after runnable tests. Documentation/stubs do not earn points. Release requires HFS `>=85`, with full weighted scores for RAG grounding and safety.

## 12. CASAN assessment

FPT CASAN levels are Curious, Augmented, Standard, Automatic, and Native. CASAN covers data, governance, standardized processes, operating model, and measurable outcomes—not tool count alone.

Sources:

- https://fptsoftware.com/newsroom/news-and-press-releases/news/fpt-introduces-casan-an-ai-transformation-framework-for-global-enterprises
- https://digital.fpt.com/news-event/ban-do-5-cap-do-casan-va-hanh-trinh-dua-ai-tu-cong-cu-thanh-nang-luc-van-hanh-doanh-nghiep

| Level | Score | Required evidence |
|---|---:|---|
| Curious | 1/5 | Ad-hoc prototype; no governed data/evaluation |
| Augmented | 2/5 | Individual productivity; usage policy; workflow not standardized |
| Standard | 3/5 | Versioned templates/instructions, governed retrieval, evaluation, audit, ownership, repeatable deployment |
| Automatic | 4/5 | Agents operate core workflows at scale; humans own exceptions; SLA/quality/cost/risk/KPI monitoring |
| Native | 5/5 | Organization redesigned around AI; outside this specification |

The AIbitat reference is technically `4/5 Automatic-ready`; source code does not prove organizational maturity. Target MVP is `3/5 Standard`. Award `4/5 Automatic` only with production evidence.

## 13. Implementation planning contract

Before editing code, the coding agent must:

1. Map the target API entry, provider, retrieval, schemas, persistence, event transport, auth/tenant boundary, tests, and observability.
2. Read section 3 references and trace callers/callees.
3. Produce `requirement → target code → AIbitat reference → reuse/adapt/create → test → gap`.
4. Score current HFS/CASAN baselines from existing evidence.
5. Prefer existing helpers/dependencies; add no framework without demonstrated need.
6. Write `docs/superpowers/plans/YYYY-MM-DD-aibitat-dual-flow-agent.md` with exact paths, interfaces, failing tests, minimal implementation, and verification commands.
7. Stop for plan approval before production-code edits.

## 14. Acceptance criteria

- One shared kernel drives both modes without duplicated provider/retrieval infrastructure.
- Each flow proves a multi-step `observe → decide → act → observe` run in tests.
- QA cannot complete with unsupported claims.
- Generation cannot complete with schema-invalid output.
- Custom instructions cannot override policy, grounding, or template contracts.
- Citations resolve to authorized evidence only.
- Abort reaches active provider/retrieval work.
- Stable errors and typed events use the application's existing transport.
- Implemented HFS is `>=85` with runnable evidence.
- MVP CASAN claim is limited to Standard; Automatic requires production evidence.
