# Agent Orchestrator + RAG — Solution Brief

**Scope of this document:** The agent orchestrator and RAG layer to add to an existing Node.js / Express backend. Routes, auth, persistence, and infra are assumed to exist. This brief defines *what the orchestrator does, how it thinks, and what it requires of the system around it*. Implementation detail will be planned later in Claude Code against the existing codebase.

**Stack assumptions:**
- Node.js / Express backend already in place (routes, controllers, middleware)
- RAGFlow core for the ingestion pipeline (parsing, chunking, embedding)
- OpenSearch as vector + lexical store (assume reachable)
- A small-context LLM (8K–32K) for generation
- Output: a downloadable `.md` document

---

## Table of Contents

1. [Problem & Solution Summary](#1-problem--solution-summary)
2. [Where the Orchestrator Sits](#2-where-the-orchestrator-sits)
3. [Orchestrator Design](#3-orchestrator-design)
4. [Pipeline Phases (Responsibilities Only)](#4-pipeline-phases-responsibilities-only)
5. [Context Window Strategy](#5-context-window-strategy)
6. [RAG Layer Design](#6-rag-layer-design)
7. [Core Design Decisions](#7-core-design-decisions)
8. [Functional Requirements](#8-functional-requirements)
9. [Non-Functional Requirements](#9-non-functional-requirements)
10. [Failure Modes & Fallbacks](#10-failure-modes--fallbacks)
11. [Interface Contract with the Express App](#11-interface-contract-with-the-express-app)
12. [Open Questions for Implementation Phase](#12-open-questions-for-implementation-phase)

---

## 1. Problem & Solution Summary

### Problem

Users submit a structured markdown request with five headers (User Profile, Task, Context, Keywords, Output Format). The system must produce a long, well-structured document — SRS, user stories, test cases, or design document — grounded in a reference corpus. Constraints:

- **Long output:** 4000–8000 tokens.
- **Small LLM context:** 8K–32K. Cannot hold full retrieval + full output in one call.
- **Grounding required:** every claim traceable to retrieved chunks.
- **Multi-faceted input:** each header plays a different role — some belong in retrieval, others in tone/format/filtering, not all in either.

### Solution

A **multi-phase agent orchestrator** that decomposes one user request into many small, focused retrieval and LLM operations, each fitting in a small context window. The final document is stitched from independently-generated sections, each grounded in its own targeted retrieval.

The core moves:

- **Decompose** the request into sub-queries — one per planned output section.
- **Retrieve per section** using hybrid search (BM25 + vector) with rank fusion and reranking.
- **Outline first, then fill.** One small LLM call produces the outline; one small LLM call produces each section.
- **Roll a summary forward**, not the full prior text — this is how long documents fit a small-context model.
- **Stream phases to the client**, persist final output, support single-section re-edit.

---

## 2. Where the Orchestrator Sits

The orchestrator is a service-layer module the existing Express routes call into. It owns nothing routing-related; it composes the agent behavior.

```
┌────────────────────────────────────────────────────────────┐
│  Existing Express App                                      │
│  ├── routes (already exist)                                │
│  ├── controllers (already exist)                           │
│  ├── auth / middleware (already exist)                     │
│  └── persistence / storage (already exist)                 │
└──────────────────┬─────────────────────────────────────────┘
                   │  call into:
                   ▼
       ┌────────────────────────┐
       │  Agent Orchestrator    │   ◄── this brief
       │  (the new layer)       │
       └───────────┬────────────┘
                   │  uses:
       ┌───────────┴────────────┐
       ▼                        ▼
  ┌─────────┐             ┌──────────┐
  │ RAG     │             │ LLM      │
  │ Layer   │             │ Adapter  │
  └────┬────┘             └──────────┘
       │
       ▼
 ┌──────────┐   ┌──────────┐
 │OpenSearch│   │ RAGFlow  │
 │          │   │(ingest)  │
 └──────────┘   └──────────┘
```

The orchestrator exposes a small, opinionated API to the rest of the app (covered in §11). Everything inside it — phase logic, retrieval choreography, prompt assembly, summary rolling — is the orchestrator's concern.

---

## 3. Orchestrator Design

### 3.1 What the Orchestrator Is

A stateful, phase-driven coordinator that:

- accepts a parsed request and a job id,
- runs the pipeline phases in order (with controlled parallelism where safe),
- emits progress events as each phase completes,
- streams LLM tokens to the client while a section is generating,
- persists intermediate artifacts (outline, per-section metadata) so re-edits don't restart the pipeline,
- returns a final markdown document and a download reference.

### 3.2 What the Orchestrator Is *Not*

- Not a route or controller. It is called *by* controllers.
- Not a job queue. If jobs need to outlive a process, a queue (BullMQ etc.) wraps the orchestrator — the orchestrator itself runs one job at a time per invocation.
- Not a chunking or embedding engine. RAGFlow owns that on the ingestion side.
- Not an LLM client. It calls an adapter; the adapter handles provider specifics.

### 3.3 Internal Composition

Conceptually, the orchestrator is a sequence of **agent modules**, each responsible for one phase. Each module:

- has a single, well-defined responsibility,
- accepts a typed input and returns a typed output,
- emits an event on start and on completion,
- can be retried or skipped independently.

This is what makes single-section re-edit possible: each module is a pure function over its inputs.

| Module | Phase | Single Responsibility |
|--------|-------|-----------------------|
| `parser` | 1 | Markdown → structured request + doc type |
| `planner` | 2 | Request → per-section sub-queries |
| `retriever` | 3 | Sub-queries → candidate chunks (hybrid + fusion) |
| `reranker` | 4 | Candidates → top-K chunks within token budget |
| `outliner` | 5 | Request + top snippets → JSON outline |
| `sectionWriter` | 6 | Outline + chunks + rolling summary → section body |
| `stitcher` | 7 | Sections → final markdown + validation pass |
| `streamer` | 8 | Phase + token events → SSE to client |

### 3.4 Execution Model

- All retrieval and LLM operations are async I/O — the Node event loop handles concurrency naturally.
- Phase 3 (retrieval) parallelizes per sub-query.
- Phase 6 (section writing) parallelizes for sections without dependency relationships, capped at ~3 concurrent to keep the rolling summary coherent.
- Reranker, if hosted in-process, runs in a worker thread; otherwise it's a network call.

---

## 4. Pipeline Phases (Responsibilities Only)

Each phase is described by what it does, what it consumes, what it produces, and whether it uses the LLM. No implementation detail here.

### Phase 1 — Parse & Classify
- **In:** Raw markdown.
- **Out:** Structured request (five fields) + detected `doc_type`.
- **LLM:** None for parsing. Optional tiny call only when doc type is ambiguous.

### Phase 2 — Sub-Query Planning
- **In:** Structured request + doc-type template skeleton.
- **Out:** List of sub-queries, one per planned section, each with: section id, semantic query, lexical keywords, must-include concepts.
- **LLM:** One small call, JSON output.
- **Cache:** Keyed by hash of (doc_type + task + context).

### Phase 3 — Hybrid Retrieval
- **In:** Sub-queries.
- **Out:** Per sub-query, ~40 candidate chunks fused from BM25 + vector via RRF.
- **LLM:** None.
- **Parallelism:** All sub-queries fan out concurrently.

### Phase 4 — Rerank & Budget
- **In:** Candidate chunks per section.
- **Out:** Per section, top 5–8 chunks respecting a token budget.
- **LLM:** None (cross-encoder).
- **Cross-section dedup:** Track chunks claimed by higher-scoring sections.

### Phase 5 — Outline Generation
- **In:** Request + doc-type template + small set of top reference snippets.
- **Out:** JSON outline — section ids, titles, purposes, target tokens, dependencies.
- **LLM:** One small call.

### Phase 6 — Section-by-Section Generation
- **In:** Outline + per-section chunks + rolling summary + global context (profile/task/constraints).
- **Out:** Markdown body per section.
- **LLM:** N small calls (one per section). Each call sees outline + summary + its own chunks — never the full text of prior sections.
- **Retry:** Section-level retry if output is too short or contains placeholders.

### Phase 7 — Stitch, Validate, Refine
- **In:** All sections + outline.
- **Out:** Final stitched markdown (title, TOC, sections, references).
- **Validators:**
  - Citation check (every `[N]` resolves to a chunk used in that section).
  - Consistency review (one small LLM call over outline + rolling summaries only — never the full document).
  - Format compliance against the doc-type template.
- **LLM:** One small consistency call + targeted re-generation calls for flagged sections only.

### Phase 8 — Stream, Persist, Deliver
- **Stream** phase events and section tokens to the client.
- **Persist** the final `.md` and per-job metadata.
- **Deliver** a download reference (the route layer turns this into a URL).
- **Re-edit:** Outline + section map are persisted so a single section can be regenerated later without re-running phases 1–5.

---

## 5. Context Window Strategy

This is the architectural answer to the small-context constraint. Each technique contributes independently; together they make a 6000-token output achievable on an 8K-context model.

| Technique | Phase | Saves Tokens By |
|-----------|-------|-----------------|
| Sub-query decomposition | 2 | Retrieval narrows per section instead of one diluted query. |
| Per-section retrieval | 3 | Each LLM call sees only its own chunks. |
| Cross-encoder reranking | 4 | Higher precision → fewer chunks needed per call. |
| Token budgeting | 4 | Hard upper bound on chunks per call. |
| Outline-then-fill | 5→6 | Sections share a ~250-token outline instead of duplicating global context. |
| Rolling summary | 6 | Carries meaning of prior sections in ~50 tokens each, not their full text. |
| Compact global context | 6 | Profile + task + constraints kept under ~200 tokens. |
| Section-level re-edit | 8 | Edit one section without resending the rest. |

**Illustrative per-call budget on an 8K-context model:**

```
System prompt + instructions       ~600
Global context (profile/task)      ~200
Compact outline                    ~250
Rolling summary (prior sections)   ~450
Reference chunks (5–8 reranked)   ~3000
─────────────────────────────────────
Input total                       ~4500
Reserved for output                ~700
Headroom                          ~3000   ✓
```

A 10-section document × ~600 tokens output ≈ 6000 tokens total — comfortably beyond what a single call could produce reliably.

---

## 6. RAG Layer Design

The RAG layer is what the orchestrator's `retriever`, `reranker`, and ingestion paths talk to. It hides RAGFlow and OpenSearch behind a clean interface.

### 6.1 Ingestion Path (out of scope for orchestrator, in scope for design)

Reference documents (existing SRS, design docs, standards, internal templates) flow through RAGFlow → embedding → OpenSearch index. The orchestrator never touches ingestion at request time; it consumes a pre-populated index.

Key design points:
- **Chunking strategy matters.** For long-form generative targets like SRS or design docs, prefer structure-aware chunking (RAGFlow's `book` or `manual` parsers) over naive splitters — section boundaries become retrievable.
- **Embedding model must match.** Whatever embeds on ingestion must match what embeds queries at retrieval time. Lock this at the config level.
- **Metadata is part of recall.** Every chunk carries `doc_type`, `domain`, `section_type`, `tags`, `token_count`. The orchestrator uses these as filters; without them, filtering degrades to substring matching.

### 6.2 Retrieval Path

Hybrid retrieval per sub-query:

- **BM25** for lexical anchors (the Keywords header, must-include terms).
- **Vector kNN** for semantic match against the sub-query text.
- **RRF fusion** to merge the two ranked lists into one candidate set.
- **Cross-encoder rerank** on the fused candidates for final precision.

Filters applied at the OpenSearch query layer (not post-hoc): `doc_type`, `domain`, optionally `tenant_id`.

### 6.3 What the RAG Layer Exposes

A narrow surface to the orchestrator:

- `retrieve(subQuery, filters) → CandidateChunk[]`
- `rerank(query, chunks, topK, tokenBudget) → SelectedChunk[]`
- `embed(text) → vector` (used in sub-query embedding; cached)

Everything provider-specific (OpenSearch DSL, RAGFlow APIs, reranker invocation) lives below this surface.

### 6.4 Caching

Four cache namespaces, all keyed by content hash:

1. **Embedding cache** — text → vector. Long TTL.
2. **Sub-query plan cache** — (doc_type + task + context) → plan JSON. 24h TTL.
3. **Retrieval cache** — (sub_query + filters) → chunk ids. 1h TTL (corpus may evolve).
4. **Rerank cache** — (query + chunk_id) → score. Long TTL (reranker is deterministic).

Caching is the single biggest cost lever for repeat-similar jobs.

---

## 7. Core Design Decisions

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | Multi-phase pipeline, not single-shot | Required for long output on small-context models; also improves grounding. |
| 2 | Per-section retrieval channels | One blob-query dilutes embedding signal across 10+ topic areas. |
| 3 | Hybrid (BM25 + kNN) with RRF | Vector misses exact terminology (e.g., "PCI-DSS"); BM25 misses paraphrases. |
| 4 | Cross-encoder rerank | Largest precision gain per dollar for long-form generation. |
| 5 | Outline-then-fill | Locks structure before content; lets each section call share a small map. |
| 6 | Rolling summary across sections | Carries meaning (~50 tok/section) instead of text (~600 tok/section). |
| 7 | Hard per-section token budget | Guarantees every LLM call fits, regardless of retrieval volume. |
| 8 | Job persistence + per-section re-edit | User can refine one section without redoing the pipeline. |
| 9 | SSE for streaming | One-way server→client; simpler in Express; proxy-friendly. |
| 10 | RAGFlow used for ingestion only | Keeps its strengths (parsing/chunking) without inheriting its agent opinions. |
| 11 | Provider-agnostic LLM adapter | Swap models or providers without touching orchestrator logic. |

---

## 8. Functional Requirements

### 8.1 Input
- **FR-1.1** Accept markdown with five expected headers: User Profile, Task, Context, Keywords, Output Format. Case-insensitive header matching.
- **FR-1.2** Reject requests missing Task or Output Format with a structured error. Other headers are recommended but not required.
- **FR-1.3** Detect doc type (srs / user_story / test_case / design_doc). If ambiguous, return a structured error with options.

### 8.2 Retrieval
- **FR-2.1** Produce per-section sub-queries before retrieval.
- **FR-2.2** Hybrid retrieval (BM25 + vector kNN) for every sub-query.
- **FR-2.3** Cross-encoder reranking on the fused candidate set.
- **FR-2.4** Token budget enforced per section before LLM call.
- **FR-2.5** Filter retrieval by doc_type and domain derived from the request.

### 8.3 Generation
- **FR-3.1** Produce an outline before any section content.
- **FR-3.2** Generate each section in its own LLM call.
- **FR-3.3** Each section call receives outline summary + rolling summary + its own chunks + global context — never the full prior text.
- **FR-3.4** Insert inline `[N]` citations referencing chunks actually used in that section.
- **FR-3.5** Run a consistency review pass over outline + rolling summaries; trigger targeted section regeneration when issues are flagged.

### 8.4 Output
- **FR-4.1** Final output is a single `.md` file containing title, TOC, all sections, and a References section.
- **FR-4.2** Stream progress (phase events + section token output) to the client throughout generation.
- **FR-4.3** Persist job: request, outline, per-section metadata, chunks used, final document reference.
- **FR-4.4** Support regenerating a single section of an existing job without re-running prior phases.

### 8.5 Doc Type Coverage
- **FR-5.1** SRS — IEEE-830-style sections.
- **FR-5.2** User Stories — story set with Given/When/Then acceptance criteria.
- **FR-5.3** Test Cases — test plan with scenarios, steps, expected results.
- **FR-5.4** Design Document — HLD or LLD style with components, data flow, interfaces.

Each doc type carries its own template: section list, target tokens, required headings, dependency graph.

---

## 9. Non-Functional Requirements

### 9.1 Performance
- **NFR-1.1** End-to-end latency for a 10-section document: ≤ 60 seconds.
- **NFR-1.2** First streamed token to client: ≤ 12 seconds.
- **NFR-1.3** All-sub-query retrieval combined: ≤ 3 seconds.
- **NFR-1.4** Reranking ~400 candidate pairs: ≤ 5 seconds.

### 9.2 Reliability
- **NFR-2.1** Client disconnect must not abort an in-flight job — completion is server-side, retrievable by job id.
- **NFR-2.2** Every LLM and search call has configurable timeout and at least one retry.
- **NFR-2.3** Single section failure must not fail the whole job — the failed section is regenerated or flagged.

### 9.3 Observability
- **NFR-3.1** Per-phase timing emitted for every job.
- **NFR-3.2** Per-job token usage (input/output) recorded.
- **NFR-3.3** Retrieval quality sampling — periodic logging of top chunks for offline review.

### 9.4 Cost
- **NFR-4.1** Total LLM tokens per job tracked and budgeted with alert thresholds.
- **NFR-4.2** Caching reduces repeat-similar-job cost by ≥ 50%.

### 9.5 Security
- **NFR-5.1** Reference corpus may be tenant-scoped — retrieval must enforce tenant filter at the OpenSearch query layer.
- **NFR-5.2** Generated documents inherit the requester's access scope.

---

## 10. Failure Modes & Fallbacks

| Failure | Required Behavior |
|---------|-------------------|
| Missing required header | Return structured error indicating which. |
| Doc type unclassifiable | Return structured error with options; UI lets user pick. |
| Sub-query LLM returns invalid JSON | Retry once with stricter prompt; on second fail, fall back to template-default sub-queries. |
| OpenSearch timeout | Retry once; on second fail, degrade to BM25-only and flag in job metadata. |
| Reranker unavailable | Skip reranking; use fused RRF rank order; flag in job metadata. |
| Section returns empty / placeholder | Retry once with directive prompt; if still failing, mark section `needs_review`. |
| Section cites a `[N]` not in its chunks | Strip invalid citation; do not fail the doc. |
| Consistency pass finds > N issues | Flag whole doc `needs_review`; do not auto-patch beyond threshold. |
| Client disconnects mid-stream | Continue job; deliver via download reference. |
| Job exceeds max wall-clock time | Abort gracefully; persist partial output; return partial doc id. |

---

## 11. Interface Contract with the Express App

The orchestrator should expose a narrow, stable surface to the existing routes and controllers. The exact method names will be decided in implementation, but the responsibilities are:

| Capability | What It Does |
|------------|--------------|
| **Start a generation job** | Accepts a job id (assigned by the app) + parsed request. Begins the pipeline. Returns an event stream + a promise of final result. |
| **Subscribe to job events** | Allows the route layer to forward phase events and section tokens to the client over SSE. |
| **Regenerate one section** | Accepts a job id + section id. Re-runs Phase 6 + 7 for that section only. Emits the same event types. |
| **Fetch job artifacts** | Returns the final markdown, the outline, per-section metadata, and the chunks used. Drives "show sources" UI. |
| **Cancel a job** | Best-effort cancellation; partial output is persisted with status. |

**What the orchestrator expects from the app:**
- A persistence facility for jobs and artifacts (the app's existing DB).
- A storage facility for final `.md` blobs (the app's existing object storage).
- An auth context (passed in with the request) for tenant scoping.
- Config: LLM endpoint, embedding endpoint, OpenSearch endpoint, reranker endpoint, template directory.

**What the orchestrator does not expect:**
- It does not pick a transport. SSE recommended, but the streamer module just emits typed events; the route layer adapts them.
- It does not pick a queue. Jobs run in-process unless the app wraps the orchestrator in a queue worker.

---

## 12. Open Questions for Implementation Phase

Deliberately deferred to the local Claude Code session against the existing codebase:

1. **LLM provider and exact model.** Affects token-budget math and JSON-mode reliability.
2. **Reranker deployment.** Hosted API vs in-process ONNX in a worker thread vs separate microservice.
3. **RAGFlow integration mode.** Separate HTTP service vs subprocess invocation.
4. **Job queue.** In-process Promise vs BullMQ — depends on whether jobs may outlive a process.
5. **Streaming transport.** SSE vs WebSocket — confirm against the deployment environment.
6. **Tenant model.** Single-tenant v1 vs tenant-scoped corpus from the start.
7. **Template authoring.** YAML in-repo (recommended) vs DB-stored editable templates.
8. **Cache backend.** Redis recommended; whatever the existing app already uses.
9. **Embedding model.** Must match what RAGFlow uses on ingestion — lock at config time.
10. **Section-level retry policy.** Max attempts, backoff, when to give up and mark `needs_review`.

---

## Appendix — Phase In/Out Summary

Quick reference for the implementation planning session.

| Phase | In | Out | LLM Calls |
|-------|-----|-----|-----------|
| 1 Parse | Raw markdown | Structured request + doc type | 0 |
| 2 Plan | Structured request | Sub-queries per section | 1 |
| 3 Retrieve | Sub-queries | Candidate chunks per section | 0 |
| 4 Rerank | Candidates | Top chunks per section (budgeted) | 0 |
| 5 Outline | Request + top snippets | JSON outline | 1 |
| 6 Sections | Outline + chunks + rolling summary | Section bodies | N |
| 7 Stitch | Sections + outline | Final markdown + validation | 1 + targeted re-gens |
| 8 Deliver | Final markdown | Download reference + stream events | 0 |

Total LLM calls ≈ 3 + N (where N = section count). For a 10-section SRS, ~13 small calls instead of one impossible giant call.

---

**End of brief.** This document defines the *what* and *why* of the orchestrator and RAG layer. The *how* — module wiring, file structure, exact libraries, route integration — is for the implementation planning session against the existing Express codebase.
