# Advanced RAG — Coding Agent Brief

> Purpose: give a coding agent the minimum context needed to compare an existing app with the desired Advanced RAG behavior and produce an implementation plan. RAGFlow files are behavioral samples only: reuse the target app's architecture, abstractions, and dependencies; do not copy code.

## Mission

Inspect the target codebase, map its current indexing and retrieval paths, identify gaps against this brief, then write a phased implementation plan with exact target files and tests. Do not implement until that plan is approved.

Use the full specs only when this brief leaves a decision unresolved:

- [English full spec](advanced-rag-spec.en.md)

## Non-negotiable outcomes

1. Separate **index-time knowledge compilation** from **query-time retrieval/research**.
2. Reuse the app's document, chunk, search, LLM, embedding, job, authorization, streaming, and observability layers.
3. Keep one bounded policy engine for low/medium/high/ultra; do not build four independent pipelines.
4. Enable tools only when their required compiled artifacts are ready and authorized.
5. Every factual answer claim must resolve to authorized source evidence; compiled artifacts are navigation aids, not final authority.
6. Handle document create/update/delete with versioned artifact invalidation and rebuild.
7. Bound every loop by calls, cycles, parallelism, tokens, time, and cancellation.
8. Exclude the legacy tree-decomposition implementation; do not add compatibility wrappers for it.

## Target behavior

### Index plane

```text
source document
  -> parse/chunk/embed/index
  -> compile selected artifacts
  -> validate + persist artifact version/provenance
  -> mark ready in artifact catalog
```

Required artifact families:

| Artifact | Purpose | Minimum provenance |
|---|---|---|
| Structure/outline | Navigate document sections and hierarchy | source document + chunk IDs + source version |
| RAPTOR hierarchy | Multi-resolution semantic retrieval | child node/chunk IDs + model/config version |
| Mind map | Navigate concepts and relations | source chunk IDs + extractor version |
| Dataset navigation tree | Route a query to likely documents | dataset version + member document versions |
| Knowledge graph | Explore entities/relations and neighborhoods | source chunk IDs per entity/relation |
| Wiki/pages | Read synthesized topic views | claim-to-source-chunk mapping |

Artifact lifecycle: `missing -> queued -> building -> ready | failed -> stale`. A source version change makes dependent artifacts stale. Deletion removes or tombstones dependent nodes, embeddings, claims, and catalog entries. Query-time must never wait indefinitely for compilation; disable the unavailable tool and fall back to source search.

### Query plane

```text
request/auth scope
  -> formalize question
  -> route intent and source/tool eligibility
  -> preliminary retrieval
  -> create claims/subquestions
  -> execute selected mode
  -> normalize/deduplicate evidence
  -> sufficiency decision
  -> bounded follow-up or fallback
  -> grounded answer + citations + terminal stream event
```

Evidence has a stable ID, source chunk/document ID, locator, text, score, retrieval method, authorization scope, and optional artifact path. Deduplicate by source identity before semantic similarity. Preserve the strongest provenance when merging.

### Mode policy

| Mode | Execution | Required behavior |
|---|---|---|
| Low | Direct search | One source retrieval pass; no decomposition or agent loop |
| Medium | Decompose and search | Stable subquestions, parallel bounded retrieval, sufficiency check |
| High | Agentic research | Claim-oriented orchestration, selective navigation/search tools, reconciliation |
| Ultra | Deep research | High plus dynamic claim expansion, replanning, structured/web tools when allowed, larger but finite budget |

Mode is an external cost/latency policy. Routing, tool choice, and early stopping inside a mode are adaptive. Automatic mode selection is a separate optional policy layer, not required for Advanced RAG.

### Tool gating

Always-available tools, subject to authorization and configured providers: hybrid/vector/keyword search; optionally web and structured read-only query.

Artifact-dependent tools:

| Tool capability | Required readiness |
|---|---|
| Outline/ontology navigation | structure or outline ready |
| RAPTOR navigation | RAPTOR ready |
| Mind-map navigation | mind map ready |
| Dataset routing | dataset navigation tree ready |
| Graph exploration | knowledge graph ready |
| Wiki query | wiki/pages ready |

The planner receives only eligible tools. The executor must re-check authorization/readiness because catalog state can change after planning.

### Sufficiency ladder

Evaluate in this order and stop as soon as a safe decision is possible:

1. Deterministic checks: claim coverage, citation validity, scope, duplication, empty/contradictory evidence.
2. Score fusion: retrieval quality, coverage, source diversity, and cross-check support.
3. Bounded LLM judge only for ambiguous cases, using cited evidence plus a capped context.
4. Decision: `answer`, `follow_up`, `replan`, `fallback`, or `insufficient`.

Never treat “more chunks” as sufficient by itself. Prefer evidence that directly supports the claim and retain explicit uncertainty when evidence conflicts.

## Compare with the current codebase

Do a targeted discovery pass; do not scan or summarize the whole repository. Locate the owners of:

```text
query/API entrypoint        document + chunk models
ingestion/indexing jobs     search/vector adapters
LLM + embedding adapters    authorization/tenant filters
stream/cancellation model   tracing/metrics/evaluation
artifact/derived-data store existing agent/workflow runtime
```

Search by concepts and callers, then read only the owning path and its tests. Prefer existing abstractions. Do not introduce a new workflow engine, vector store, queue, ORM model family, or provider interface unless the current codebase demonstrably lacks the capability.

Produce this gap matrix before proposing files:

| Capability | Current owner/path | Reuse as-is | Missing behavior | Minimal change | Verification |
|---|---|---|---|---|---|
| Baseline chunk retrieval | | | | | |
| Artifact catalog/lifecycle | | | | | |
| Knowledge compilation | | | | | |
| Tool registry/gating | | | | | |
| Mode policy/orchestration | | | | | |
| Evidence normalization | | | | | |
| Sufficiency/early stop | | | | | |
| Citation synthesis | | | | | |
| Streaming/cancellation | | | | | |
| Authorization/observability | | | | | |

If a target capability already exists, plan an extension at its owner rather than a parallel “advanced_rag” subsystem. Record unknowns as explicit validation tasks, not assumed facts.

## Required implementation-plan output

The coding agent's plan must contain:

1. **Assumptions and exclusions** — confirmed facts separated from unknowns; legacy path explicitly excluded.
2. **Current architecture map** — entrypoints, owners, data flow, persistence, async boundaries, and relevant tests.
3. **Completed gap matrix** — including what will be reused or deleted.
4. **Phases in dependency order** — each step names exact target files, behavior, contracts/data changes, failure handling, and a runnable verification command.
5. **Migration/rollout** — artifact backfill, versioning, invalidation, feature gates, rollback, and observability; say “none” where unnecessary.
6. **Evaluation gates** — baseline dataset and measurable quality/latency/cost regressions.

Default phase order; merge phases when the target app already supplies the capability:

- **P0 — Baseline and contracts:** current retrieval evaluation, evidence/citation contracts, budgets, auth boundaries.
- **P1 — Index foundation:** artifact catalog, lifecycle, structure/RAPTOR/dataset navigation, update/delete invalidation.
- **P2 — Low/medium:** shared pipeline, direct retrieval, decomposition, evidence normalization, deterministic sufficiency.
- **P3 — High:** bounded claim orchestrator, artifact-aware tools, reconciliation, LLM judge fallback.
- **P4 — Ultra:** dynamic claims/replan, graph/wiki and optional structured/web tools; only after evaluation proves need.
- **P5 — Operations:** backfill, dashboards, tracing, cancellation, load/failure tests, staged rollout.

Each plan step must be small enough for one reviewable change and must state its dependency. Avoid placeholder scaffolding for later phases.

## Acceptance gates

- Low mode still works when no compiled artifact exists.
- Planner never sees an unavailable or unauthorized tool; executor rejects stale access.
- Update/delete cannot return stale evidence after the defined consistency window.
- Citations resolve to accessible source chunks and support the associated claims.
- All loops terminate on budget, timeout, cancellation, or sufficiency.
- Partial provider/artifact failures degrade to a defined lower-cost path and emit structured diagnostics.
- Stream emits ordered progress plus exactly one terminal success/error/cancel event.
- Evaluation compares quality, citation correctness, latency, token use, and cost against the existing baseline.
- No legacy tree-decomposition code or compatibility-only API is ported.

## RAGFlow sample map — open only for the active gap

| Need | Behavioral sample |
|---|---|
| End-to-end graph and mode dispatch | [`agentic_rag_graph.py`](../../rag/advanced_rag/agentic_rag_graph.py) |
| Host retrieval/LLM adapter boundary | [`agentic_rag.py`](../../rag/advanced_rag/agentic_rag.py) |
| Mode budgets and eligible tools | [`config.py`](../../rag/advanced_rag/harness/config.py), [`types.py`](../../rag/advanced_rag/harness/types.py) |
| Routing and claim planning | [`route.py`](../../rag/advanced_rag/harness/route.py), [`planner.py`](../../rag/advanced_rag/harness/planner.py) |
| Shared tool execution | [`pipeline.py`](../../rag/advanced_rag/harness/pipeline.py), [`registry.py`](../../rag/advanced_rag/harness/tools/registry.py) |
| Readiness/tool eligibility | [`gating.py`](../../rag/advanced_rag/harness/tools/gating.py), [`tools/__init__.py`](../../rag/advanced_rag/harness/tools/__init__.py) |
| Low/medium/high orchestration | [`direct.py`](../../rag/advanced_rag/harness/orchestrator/direct.py), [`decompose.py`](../../rag/advanced_rag/harness/orchestrator/decompose.py), [`agentic.py`](../../rag/advanced_rag/harness/orchestrator/agentic.py) |
| Agent loop | [`agent.py`](../../rag/advanced_rag/harness/agent.py) |
| Sufficiency and bounded LLM judge | [`sufficiency_ladder.py`](../../rag/advanced_rag/harness/sufficiency_ladder.py), [`sufficiency.py`](../../rag/advanced_rag/harness/sufficiency.py), [`sufficiency_llm.py`](../../rag/advanced_rag/harness/orchestrator/sufficiency_llm.py) |
| Search/navigation/inspection semantics | [`search.py`](../../rag/advanced_rag/harness/tools/search.py), [`navigation.py`](../../rag/advanced_rag/harness/tools/navigation.py), [`exploration.py`](../../rag/advanced_rag/harness/tools/exploration.py), [`inspector.py`](../../rag/advanced_rag/harness/tools/inspector.py) |
| Streaming thought/progress bridge | [`think_log.py`](../../rag/advanced_rag/think_log.py) |
| Compile dispatch and shared mechanics | [`runner.py`](../../rag/advanced_rag/knowlege_compile/runner.py), [`_common.py`](../../rag/advanced_rag/knowlege_compile/_common.py) |
| Structure, RAPTOR, mind map | [`structure.py`](../../rag/advanced_rag/knowlege_compile/structure.py), [`raptor.py`](../../rag/advanced_rag/knowlege_compile/raptor.py), [`mind_map_extractor.py`](../../rag/advanced_rag/knowlege_compile/mind_map_extractor.py) |
| Dataset router | [`dataset_nav.py`](../../rag/advanced_rag/knowlege_compile/dataset_nav.py) |
| Wiki full/incremental compilation | [`wiki.py`](../../rag/advanced_rag/knowlege_compile/wiki.py), [`wiki_incremental.py`](../../rag/advanced_rag/knowlege_compile/wiki_incremental.py) |

Do not use [`tree_structured_query_decomposition_retrieval.py`](../../rag/advanced_rag/tree_structured_query_decomposition_retrieval.py): it is a legacy path, not a compatibility target.

## Compact instruction to hand to the coding agent

```text
Read this brief. Compare its required behavior with the current repository using targeted searches and owner/caller tracing. Treat linked RAGFlow files as behavioral samples only; do not copy code or impose RAGFlow's structure. Reuse current abstractions, complete the gap matrix, and produce a dependency-ordered implementation plan with exact files, tests/commands, migrations, rollout, and evaluation gates. Do not implement yet. Open a linked sample or full spec only when needed to resolve a specific gap.
```
