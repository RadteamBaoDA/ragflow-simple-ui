# Advanced RAG Logic Specification

Status: Draft for integration review

Audience: Product, architecture, backend, ML, data, QA, and operations teams

Purpose: Transfer the behavior and workflow of RAGFlow Advanced RAG into another application without copying its implementation.

## 1. Goal

Build an evidence-first Advanced RAG subsystem that can answer simple and multi-hop questions over internal documents, optionally use web and structured data, and produce traceable citations. The subsystem shall choose bounded research behavior, gather and cross-check evidence, retry targeted gaps, and either answer fully, answer partially with caveats, or abstain.

The design shall support four reasoning levels through one implementation:

- `low`: one direct retrieval pass.
- `medium`: claim decomposition, parallel retrieval, and sufficiency checking.
- `high`: bounded claim-level research agents with gated tools.
- `ultra`: deep research with dynamic claims and replanning.

## 2. Success outcomes

- Every factual answer is traceable to stored source chunks.
- Unsupported claims are not presented as facts.
- Complex questions are decomposed into independently verifiable claims.
- Missing evidence results in targeted follow-up retrieval, not repeated identical searches.
- Index-time artifacts improve retrieval but never become a hard availability dependency.
- `high` normally completes within 30-60 seconds; `ultra` may run for 2-3 minutes and streams progress.
- All loops have explicit cycle, time, concurrency, token, and cost limits.
- The subsystem integrates through contracts and adapters, without requiring the host app to copy RAGFlow classes or APIs.

## 3. Scope

### 3.1 Included

- Baseline document chunks, keyword index, embeddings, metadata, and provenance.
- Structure, outline, entity/relation, mind-map, RAPTOR, dataset-navigation, and wiki compilation.
- Incremental compile, rebuild, deletion, and artifact readiness.
- Query formalization, classification, preliminary retrieval, planning, orchestration, evidence checking, answer synthesis, citations, streaming, cancellation, and observability.
- Hybrid, vector, BM25, web, structured-query, navigation, graph, wiki, and inspection tools.
- `low`, `medium`, `high`, and `ultra` policies.
- Graceful fallback when a source, model, or compiled artifact is unavailable.

### 3.2 Excluded

- Reproducing RAGFlow source code or public API shapes.
- The disabled recursive `DeepResearcher` implementation.
- Compatibility shims for historical RAGFlow records, tuple shapes, parser fields, or compile keywords.
- A new authentication, tenant, billing, document-ingestion UI, or model-provider platform.
- Automatic model training or fine-tuning.
- Mandatory microservice decomposition.

## 4. Design principles

1. Evidence before fluency: answer quality cannot override grounding.
2. One engine, policy-driven modes: do not build four runtimes.
3. Coarse-to-fine retrieval: narrow corpus, navigate structure, then inspect details.
4. Cheapest sufficient path: stop when evidence is adequate.
5. Artifact-aware tools: expose a tool only when its required artifact exists.
6. Safe degradation: basic retrieval remains available without advanced artifacts.
7. Immutable provenance: generated artifacts retain links to original chunks.
8. Bounded autonomy: every agent and orchestrator loop has budgets.
9. Idempotent indexing: repeated compilation produces the same logical records.
10. Application-neutral contracts: host storage, LLM, queue, and search systems are adapters.

## 5. System model

The subsystem has two independently deployable planes joined by an artifact catalog.

```text
Index plane
  source document -> parse/chunk/embed -> compile artifacts -> artifact catalog

Query plane
  request -> formalize -> route -> pre-search -> plan -> research
          -> sufficiency -> follow-up/replan or synthesize -> cited response

Bridge
  artifact catalog -> tool eligibility and document-scope routing
```

The first implementation should remain a modular monolith. Module contracts must permit later separation when measured load requires it.

## 6. Core domain contracts

### 6.1 SourceDocument

- Stable document ID, dataset ID, tenant/security scope, title, metadata, content version, and lifecycle state.
- A new content version invalidates dependent artifacts.

### 6.2 SourceChunk

- Stable chunk ID, document ID, ordered position, text, token count, metadata, keyword fields, optional embedding, and content hash.
- Chunk IDs are the citation anchor.

### 6.3 CompiledArtifact

- Artifact ID, type, scope, source document/chunk IDs, compiler version, input hash, status, searchable content, optional vector, and timestamps.
- Artifact types: `outline`, `page_index`, `mind_map`, `raptor_tree`, `dataset_navigation`, `knowledge_graph`, and `wiki`.
- Status: `pending`, `building`, `ready`, `partial`, `failed`, `stale`, or `deleting`.

### 6.4 EvidenceItem

- Request-local evidence ID, source chunk ID, document ID, text, retrieval scores, source tool, query/claim ID, and provenance.
- Evidence IDs are stable for the duration of a request and map final citations back to source chunks.

### 6.5 ResearchPlan and Claim

- Plan type, ordered claims, cycle budget, and optional replan feedback.
- Each claim contains an ID, description, priority, suggested tools, verification state, confidence, evidence IDs, gaps, grounded facts, numeric facts, and discovered claims.

### 6.6 SufficiencyVerdict

- Status: `SUFFICIENT`, `USEFUL_BUT_INCOMPLETE`, `INSUFFICIENT`, or `CONFLICTING`.
- Score, claim coverage, grounding score, required-entity gaps, numeric conflicts, missing information, recommended follow-ups, and decision action.

## 7. Indexing and knowledge-compilation workflow

### 7.1 Baseline indexing

The host app parses documents, creates ordered chunks, tokenizes searchable text, computes embeddings, and writes metadata and provenance. Advanced compilation starts only after baseline chunks are durable.

### 7.2 Compile trigger and lifecycle

Compilation runs on document create/update, template/configuration change, explicit rebuild, and deletion. A job records input hash, compiler version, selected artifact types, progress, warnings, and final status. Re-running unchanged input is a no-op.

Failed artifact types do not roll back successful types. They become `failed` or `partial`, and query-time gating hides them.

### 7.3 Structure compilation

Process token-bounded chunk batches with configurable extraction templates. Supported logical outputs include lists, sets, timelines, entities, relations, and hypergraphs. Normalize results, attach source chunk IDs, embed searchable rows, deduplicate locally, then merge at document or dataset scope. Rebuild a display/navigation graph after commit.

### 7.4 RAPTOR compilation

Embed ordered chunks, group semantically adjacent content, summarize each group, and repeat over summaries until a bounded root layer is formed. Every summary node carries all descendant source chunk IDs. Store both hierarchy and searchable summary nodes.

### 7.5 Mind-map and outline compilation

Extract a deduplicated concept hierarchy from token-bounded document sections. Preserve document scope and source references. Store it as navigation data, not as authoritative factual evidence unless its nodes resolve to source chunks.

### 7.6 Dataset navigation

Create a document-level summary and embedding, place it in the nearest dataset cluster, and create a cluster when similarity is insufficient. Split oversized clusters and remove empty clusters. Use a per-dataset lock for concurrent updates. The result routes a query to candidate documents before detailed retrieval.

### 7.7 Knowledge graph compilation

Extract canonical entities and relations, retain aliases and source chunks, embed searchable fields, and deduplicate at the selected scope. Relations without grounded endpoints are rejected or marked incomplete. The graph is an exploration aid; returned facts must still resolve to source evidence.

### 7.8 Wiki compilation

Use the following logical phases:

1. MAP: extract entities, relations, concepts, claims, topics, and source chunk IDs per batch.
2. REDUCE: canonicalize and merge equivalent items.
3. PLAN: optionally group knowledge into pages.
4. REFINE: generate, update, or re-synthesize pages from source chunks.
5. FINALIZE: validate links, attach topics, persist searchable pages, and rebuild the page graph.

Incremental updates compare content hashes, reprocess changed chunks, remove deleted provenance, route new knowledge to existing pages, and re-synthesize only when growth thresholds are crossed.

### 7.9 Deletion

Deleting a document removes or updates every artifact that references it. Shared entities, clusters, and wiki pages remain only if other source documents still support them. Deletion is idempotent and auditable.

## 8. Artifact catalog and tool gating

At query start, build an artifact-readiness map by dataset and document. Tool eligibility is the intersection of mode policy, configured data sources, security scope, artifact readiness, current research phase, and request context.

Minimum requirements:

| Tool family | Required capability/artifact |
|---|---|
| Hybrid/vector/BM25 | Baseline chunks and corresponding indexes |
| Web search | Configured web provider and request permission |
| Structured query | Structured schema and query adapter |
| Dataset navigation | Ready dataset-navigation rows |
| Outline/ontology navigation | Outline, page index, mind map, or RAPTOR tree |
| Graph exploration | Ready knowledge graph and a discovered entity/context |
| Wiki query | Ready searchable wiki pages |
| Inspectors | Source chunks accessible in the current security scope |

Unavailable tools are omitted from the agent schema rather than allowed to fail predictably.

## 9. Query-time workflow

### 9.1 Request initialization

Validate identity and dataset/document permissions. Resolve models, data-source adapters, reasoning mode, language, metadata filters, attachments, budgets, and cancellation handle. Create an empty request-local evidence pool and trace.

### 9.2 Question formalization

Convert the last user turn plus bounded conversation history into a standalone question and compact retrieval keywords. Preserve explicit entities, dates, numbers, constraints, and requested answer type. On failure, use the original user question.

### 9.3 Route

Classify the question as factual, comparative, procedural, analytical, or exploratory. Determine whether decomposition is useful and record the expected answer shape. The selected reasoning mode fixes the execution-strategy family; routing adapts planning inside that family but does not automatically switch modes.

### 9.4 Preliminary search

For decomposed modes, perform one bounded hybrid search before planning. Its purpose is to ground claim generation and seed citations. Skip it for direct mode to avoid duplicate retrieval.

### 9.5 Planning

Create independently verifiable claims. Limits: low 1, medium 3, high 5, ultra 8 initial claims. Comparative plans cover every compared subject and comparison dimension. Procedural plans cover prerequisites, ordered steps, constraints, and outcomes. Replanning must address prior missing-information feedback and avoid equivalent claims.

### 9.6 Execution policies

#### Low

Run one direct hybrid/BM25 retrieval path, merge evidence, and synthesize. No agent loop or sufficiency retry.

#### Medium

Search claims in a bounded parallel batch. Cross-check each claim, compute sufficiency, and run targeted follow-ups for missing information within the cycle budget. No autonomous tool loop.

#### High

Assign unverified claims to bounded research agents. Agents operate coarse-to-fine, use only gated tools, and return structured reports. Run at most two agents concurrently and two agent cycles per claim by default. Perform an LLM-assisted sufficiency check after each orchestrator cycle.

#### Ultra

Use the high workflow plus dynamic claim discovery, replanning, broader compiled-artifact tools, and up to three concurrent agents. New claims must be novel, relevant to the top-level answer, and within the global claim budget.

## 10. Research-agent loop

Each agent receives one claim, relevant context, available tool schemas, evidence already collected, and hard budgets. It may reason, call tools, inspect returned evidence, and finish by emitting a structured report.

The loop must support native function calling and a text-tool fallback. Tool arguments are validated. Independent calls in one model turn may execute concurrently. A navigation result is checked for sufficiency before broader search is allowed. Terminal report generation ends the loop.

Required report fields: claim ID, report, verified flag, confidence, evidence IDs, grounded facts, numeric facts, gaps, and discovered claims.

## 11. Retrieval and navigation semantics

- Hybrid search combines keyword and vector signals, returns source chunks, and deduplicates by stable chunk ID.
- Vector search is semantic-only; BM25 is lexical-only.
- Web results are isolated as external sources and carry URL provenance.
- Structured query translates a question through a controlled schema adapter and returns both a natural-language result and provenance rows.
- Dataset navigation returns document IDs and updates downstream document scope.
- Outline, mind-map, and RAPTOR navigation return source-backed passages from selected documents.
- Graph exploration starts from known entities and returns relations with source chunks.
- Wiki query searches compiled pages but citations resolve to original chunks.
- Inspectors expand a chunk, fetch adjacent chunks, grep a document, or compare sources without expanding global scope.

Repeated equivalent searches in one request are cached. Queries differing in explicit numbers or material constraints are not considered equivalent.

## 12. Evidence management and sufficiency

All tool results merge into one deduplicated evidence pool. Generated summaries, graph edges, and wiki pages cannot become final citations unless they resolve to original chunks.

For each claim, verify:

- cited evidence IDs exist;
- grounded facts appear in cited text;
- required entities are present;
- disclosed numbers are supported and non-conflicting;
- the report answers the claim rather than a bridge entity;
- evidence diversity is adequate when cross-source confirmation is required.

Fuse deterministic checks, agent confidence, claim coverage, and an LLM context sufficiency judge. Hard provenance, entity, or numeric conflicts override a positive LLM judgment.

Decision ladder:

- `ANSWER_FULL` when evidence is sufficient and no hard conflict exists.
- `CONTINUE` when a targeted query can close material gaps within budget.
- `ANSWER_PARTIAL` when useful evidence exists but progress stagnates or budget is exhausted.
- `ABSTAIN` when no trustworthy evidence supports the requested answer.

Stop early after repeated cycles without a material score increase.

## 13. Final answer synthesis and citations

Before generation, establish an answer-target contract describing what entity, value, or outcome the user actually requested and which entities are merely intermediate clues. Select only useful evidence, preserve number-bearing passages, and cap evidence independently of the model's maximum context.

The answer must:

- use the user's language unless requested otherwise;
- distinguish supported facts, uncertainty, and missing information;
- include inline citation markers mapped to source chunks;
- never cite internal plans, model reasoning, or unsupported compiled summaries;
- state insufficiency instead of filling gaps from model memory;
- include a partial-answer caveat when applicable.

## 14. Streaming contract

Expose semantic events independent of transport:

- `research_started`
- `question_formalized`
- `route_selected`
- `pre_search_completed`
- `plan_created`
- `claim_started` / `claim_completed`
- `tool_started` / `tool_completed`
- `sufficiency_checked`
- `replan_started`
- `answer_delta`
- `answer_completed`
- `research_failed` / `research_cancelled`

Progress text may be shown as a reasoning/status stream, but private chain-of-thought is never required or persisted.

## 15. Budgets, failure handling, and fallback

Budgets are configurable by mode: orchestration cycles, agent cycles, parallel agents, claims, tool calls, retrieved chunks, context tokens, elapsed time, and estimated cost.

Failures are isolated by claim and tool. Retry only transient provider/storage failures with bounded backoff. Invalid LLM JSON is repaired once, then replaced by deterministic fallback. A failed advanced artifact falls back to basic search. Cancellation propagates to model calls, tools, and compilation jobs. Partial results retain their provenance.

Default service targets:

- `high`: 3 orchestrator cycles, 2 agent cycles, 2 parallel agents, 30-60 second target.
- `ultra`: 4 orchestrator cycles, 2 agent cycles, 3 parallel agents, 2-3 minute ceiling.

## 16. Security and privacy

- Apply tenant, dataset, document, and row permissions before retrieval and again before citation emission.
- Never broaden document scope beyond the caller's authorized scope.
- Treat document text, tool output, web pages, and compiled artifacts as untrusted prompt content.
- Structured query uses allowlisted schemas, read-only execution, parameterization, row limits, and timeout.
- Log IDs, stages, counts, durations, scores, and errors; do not log document bodies, prompts containing sensitive content, credentials, or private model reasoning.

## 17. Observability

Create one correlation ID per request and one per compilation job. Capture mode, route, plan size, tool availability, tool trace, retrieval counts and scores, cache hits, evidence-pool size, sufficiency decisions, cycle count, model/token usage, latency, fallback reason, cancellation, and final outcome.

Recommended quality metrics:

- citation precision and coverage;
- grounded-claim rate;
- answer-target correctness;
- retrieval recall on labeled questions;
- unsupported-number rate;
- abstention correctness;
- average cycles and tool calls by mode;
- latency and cost by stage;
- artifact readiness and compilation failure rate.

## 18. Validation strategy

### Unit

Test routing fallbacks, plan normalization, tool gating, scope propagation, evidence deduplication, numeric/entity checks, sufficiency decisions, citation mapping, budget enforcement, and deletion semantics.

### Integration

Test each storage/model/search adapter; compile and retrieve every artifact type; verify incremental update and delete; verify web/SQL permission controls; verify cancellation and timeout propagation.

### End-to-end

Use factual, comparative, procedural, multi-hop, conflicting, missing-answer, multilingual, and explicit-document-summary scenarios. Run each against all modes and assert response status, claim coverage, citations, latency ceiling, and no unauthorized evidence.

### Evaluation gate

Do not enable a mode in production until its grounded-answer and citation metrics beat baseline RAG without unacceptable latency or cost regression.

## 19. Delivery workflow

1. Define host-app adapters and domain contracts.
2. Establish baseline retrieval, evidence pool, citation resolver, and evaluation set.
3. Add compilation lifecycle and artifact catalog.
4. Add structure, RAPTOR, mind-map, and dataset navigation.
5. Add wiki and knowledge graph.
6. Add formalize, route, preliminary search, planner, and `low/medium` orchestration.
7. Add gated research-agent loop and `high`.
8. Add dynamic claims, replanning, expanded tools, and `ultra`.
9. Add streaming, operational budgets, dashboards, and production gates.

Each step must remain deployable and testable; later steps may not introduce a second retrieval engine.

## 20. Acceptance criteria

- All four modes execute through one policy-driven workflow.
- Every citation resolves to an authorized source chunk and document.
- Missing compiled artifacts remove dependent tools and preserve baseline search.
- High/ultra research returns structured claim reports and obeys budgets.
- Sufficiency can produce full, continue, partial, and abstain outcomes.
- Numeric conflicts and missing required entities prevent a full-answer verdict.
- Incremental document updates invalidate and rebuild only affected artifacts.
- Document deletion removes its provenance from shared artifacts.
- Streaming emits ordered lifecycle events and a terminal outcome.
- Cancellation stops active work and preserves an auditable terminal state.
- Evaluation covers every retrieval source, artifact type, mode, and failure path.

## 21. Adaptive RAG boundary

This specification implements Advanced Agentic RAG with artifact-aware retrieval. Mode selection is an explicit request or application policy. Within that ceiling, routing, tool selection, follow-up retrieval, early stopping, and replanning are adaptive.

Fully automatic Adaptive RAG is a later policy layer that selects the cheapest initial mode and escalates only when evidence remains insufficient. It is not required for behavioral parity and must not create a second orchestration implementation.

## 22. Integration contracts

The host application may expose any transport, but it must preserve these logical operations.

### 22.1 Compile request

Input: document ID, content version, dataset/security scope, desired artifact types, template/configuration version, and rebuild flag. Output: compilation job ID and accepted artifact types. Status lookup returns per-artifact state, progress, warnings, error category, input hash, compiler version, and timestamps.

### 22.2 Research request

Input: conversation messages, authorized dataset/document scope, metadata filters, reasoning mode, language, enabled external sources, attachment references, generation settings, and optional budget overrides. The server owns identity and authorization; clients cannot enlarge scope through request fields.

### 22.3 Research response

The terminal response contains answer text, outcome (`full`, `partial`, `abstained`, `failed`, or `cancelled`), citations, referenced documents, request ID, mode, usage, elapsed time, and optional public trace summary. Streaming uses the events in Section 14 and always emits exactly one terminal event.

### 22.4 Required adapters

- Document repository: load authorized documents, metadata, versions, and ordered chunks.
- Search store: keyword, dense-vector, filtered, graph/wiki-artifact, upsert, and delete operations.
- LLM provider: chat, streaming chat, structured output, token limits, cancellation, and usage.
- Embedding provider: batch encoding with dimension metadata.
- Structured-data adapter: schema discovery and read-only query execution.
- Web-search adapter: query and normalized result provenance.
- Job runtime: enqueue, progress, cancellation, retry, and terminal status.
- Artifact catalog: readiness lookup, dependency tracking, invalidation, and lifecycle transitions.

## 23. RAGFlow file reference map

These files are behavioral references only; implementations must be designed against the contracts in this specification.

- `rag/advanced_rag/agentic_rag.py`
- `rag/advanced_rag/agentic_rag_graph.py`
- `rag/advanced_rag/think_log.py`
- `rag/advanced_rag/harness/config.py`
- `rag/advanced_rag/harness/types.py`
- `rag/advanced_rag/harness/route.py`
- `rag/advanced_rag/harness/planner.py`
- `rag/advanced_rag/harness/pipeline.py`
- `rag/advanced_rag/harness/agent.py`
- `rag/advanced_rag/harness/sufficiency.py`
- `rag/advanced_rag/harness/sufficiency_ladder.py`
- `rag/advanced_rag/harness/orchestrator/`
- `rag/advanced_rag/harness/tools/`
- `rag/advanced_rag/harness/prompts/`
- `rag/advanced_rag/knowlege_compile/_common.py`
- `rag/advanced_rag/knowlege_compile/runner.py`
- `rag/advanced_rag/knowlege_compile/structure.py`
- `rag/advanced_rag/knowlege_compile/raptor.py`
- `rag/advanced_rag/knowlege_compile/mind_map_extractor.py`
- `rag/advanced_rag/knowlege_compile/dataset_nav.py`
- `rag/advanced_rag/knowlege_compile/wiki.py`
- `rag/advanced_rag/knowlege_compile/wiki_incremental.py`

Explicitly excluded legacy reference:

- `rag/advanced_rag/tree_structured_query_decomposition_retrieval.py`
