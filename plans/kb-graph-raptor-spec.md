# KB-Level Knowledge Graph, RAPTOR & TOC — Requirements Spec

**This is a requirements brief, not a design.** Claude Code should read this together with the **current codebase in plan mode** and produce the architecture + implementation plan from there. All architecture, schemas, library choices, and file-level changes are **decided during planning, from the actual code** — they are intentionally not prescribed here.

---

## 1. Feature Summary

The application already builds a knowledge graph, a RAPTOR tree, and a TOC **per dataset**. This feature extends those to the **Knowledge Base (KB)** level: a KB groups many datasets, and we want **one** knowledge graph, **one** RAPTOR tree, and **one** TOC that span **all datasets in the KB** as a single source of truth — kept up to date **incrementally**, and tuned for **query-time quality** and **low LLM cost**.

---

## 2. Scopes & Terminology

Two scope levels must stay distinct (map these to the codebase's real field names during planning):

- **Dataset** — one ingestion unit (a set of documents).
- **Knowledge Base (KB)** — a domain/project grouping of many datasets; the single source of truth.

Every chunk, entity, relation, RAPTOR node, and TOC node must carry **both** its dataset scope and its KB scope. Per-dataset operations are scoped by dataset; the new unified operations are scoped by KB.

> Note for planning: if the codebase already uses a term (e.g. `kb_id`) for what this spec calls a *dataset*, resolve the naming collision explicitly before writing code.

---

## 3. Functional Requirements

1. **Unified knowledge graph across a KB** — entities and relations from all datasets in the KB are merged into one graph, with entities de-duplicated/linked across datasets, plus KB-level communities and community summaries.
2. **Unified RAPTOR across a KB** — one hierarchical summary tree spanning all datasets in the KB, retrievable via the existing collapsed/flattened-tree search.
3. **Unified TOC across a KB** — a hierarchical KB → dataset → document → section index, usable both for navigation and (optionally) as a query-routing pre-filter.
4. **Incremental maintenance** — adding or updating a dataset or document updates the KB graph, RAPTOR tree, and TOC **without a full rebuild**.
5. **KB-scoped retrieval** — queries run against a KB (optionally narrowed to a subset of its datasets).

---

## 4. Non-Functional Requirements & Constraints

| Constraint | Requirement |
|---|---|
| Scale | ~50 datasets and **millions of chunks** per KB |
| Update model | **Incremental** — never full-rebuild on every change |
| Cost | **Minimize LLM token spend** (extraction + summarization) |
| Quality | **Maximize query-time retrieval quality** (multi-hop, cross-dataset) |
| Vector DB | **OpenSearch** (kNN) |
| Orchestrator | **Express.js** (Node) control plane |
| Worker | **Python** worker, triggered via a **Redis** queue |
| Reuse | Reuse existing parsing / chunking / embedding / LLM components already in the codebase |

---

## 5. Hard Problems the Plan Must Solve

State and solve these during planning (the spec does not dictate the solution):

1. **Cross-dataset entity merging** — resolve/de-duplicate entities across datasets, incrementally and cheaply, as new datasets arrive.
2. **Hierarchical RAPTOR at scale** — build and retrieve a KB-spanning tree **without global clustering over millions of chunks**, and support incremental updates when datasets/documents change.
3. **Incremental communities** — detect and refresh graph communities incrementally; avoid regenerating community summaries that didn't change.
4. **Triggering expensive KB builds** — under frequent incremental ingestion, avoid thrashing: coalesce/debounce KB-level rebuilds, and run them safely (serialization/locking, idempotency, crash-resume).
5. **Avoid re-spending tokens** — never re-process unchanged content (delta-only, caching, near-duplicate dedup).
6. **KB scoping in OpenSearch** — store and filter all record types so retrieval is correctly scoped to a KB.

---

## 6. Explicitly Deferred to Plan Mode

Decide all of the following by reading the current codebase — do not assume them here:

- Concrete architecture and module/file layout.
- Data model, index design, and OpenSearch mappings/queries.
- Redis queue message contract and worker/task structure.
- Algorithm implementations and library choices.
- Schema migrations and the file-by-file change list.

---

## 7. Prior Art to Consider (non-binding references)

For algorithm ideas only — validate fit against the codebase before adopting: Microsoft GraphRAG (incremental indexing), the original RAPTOR paper, LightRAG (cheap extraction + incremental insert), and nano-graphrag / fast-graphrag (minimal reference implementations).

---

## 8. Acceptance Criteria

- A query against a KB retrieves and synthesizes across **multiple datasets** (multi-hop) measurably better than the per-dataset baseline.
- Adding a new dataset or document updates the KB graph, RAPTOR tree, and TOC **incrementally**, within bounded cost/time, with **no full rebuild**.
- Re-running ingestion on **unchanged** content spends approximately **no new tokens**.
- All retrieval is correctly **scoped to a KB** (and to a dataset subset when requested).

---

## 9. Open Questions to Resolve During Planning

- Real field names for *dataset* vs *KB*, and the current schema.
- Which existing components are reusable (parser, embeddings, LLM client, queue, OpenSearch layer)?
- The current ingestion and retrieval flow end to end.
- How much content is duplicated across datasets (affects caching/dedup savings).
- Target quality and per-build cost/time budgets.

---

## 10. Instructions for Claude Code

1. Enter **plan mode**. Read this spec and the codebase paths I add to context.
2. First, confirm your understanding of the **current** ingestion and retrieval flow back to me.
3. Then produce an **architecture + phased implementation plan** and write it to `docs/implementation-plan.md`.
4. Map every requirement here to concrete parts of my code (what exists vs. what's missing).
5. **Ask me** wherever a decision is ambiguous (especially §2 naming and §9 open questions) **before** finalizing the plan.
6. **Do not write implementation code** until I approve the plan.
