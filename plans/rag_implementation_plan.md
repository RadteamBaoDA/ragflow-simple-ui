# RAG Chat Implementation Plan
## Long-Form Generative Tasks (SRS, User Stories, Test Cases, Design Documents)

**Stack:** RAGFlow core + OpenSearch (vector DB) + Small-context LLM
**Goal:** Produce long, high-quality documents from structured markdown input while keeping every LLM call within a small context window.

---

## Table of Contents

1. [Architectural Overview](#1-architectural-overview)
2. [Phase 0 — Foundation Setup](#phase-0--foundation-setup)
3. [Phase 1 — Input Parsing & Intent Classification](#phase-1--input-parsing--intent-classification)
4. [Phase 2 — Query Planning & Sub-Query Generation](#phase-2--query-planning--sub-query-generation)
5. [Phase 3 — Hybrid Retrieval from OpenSearch](#phase-3--hybrid-retrieval-from-opensearch)
6. [Phase 4 — Reranking & Context Budgeting](#phase-4--reranking--context-budgeting)
7. [Phase 5 — Outline Generation](#phase-5--outline-generation)
8. [Phase 6 — Section-by-Section Generation](#phase-6--section-by-section-generation)
9. [Phase 7 — Stitching, Refinement & Validation](#phase-7--stitching-refinement--validation)
10. [Phase 8 — Streaming, Persistence & Download](#phase-8--streaming-persistence--download)
11. [Context Window Management Strategy](#context-window-management-strategy)
12. [Error Handling & Fallbacks](#error-handling--fallbacks)
13. [Performance & Cost Optimization](#performance--cost-optimization)
14. [Implementation Timeline](#implementation-timeline)

---

## 1. Architectural Overview

### 1.1 End-to-End Flow

```
┌──────────────────────────────────────────────────────────────────┐
│  USER INPUT (structured markdown)                                 │
│  ## User Profile / ## Task / ## Context / ## Keywords / ## Output│
└────────────────────────────┬─────────────────────────────────────┘
                             │
                ┌────────────▼────────────┐
                │ Phase 1: Parser         │
                │ - Extract headers       │
                │ - Classify doc_type     │
                │ - Validate completeness │
                └────────────┬────────────┘
                             │
                ┌────────────▼────────────┐
                │ Phase 2: Query Planner  │
                │ - Generate sub-queries  │
                │ - Map → output sections │
                │ - Cache by (task,ctx)   │
                └────────────┬────────────┘
                             │
                ┌────────────▼────────────┐
                │ Phase 3: Retrieval      │
                │ - Hybrid (BM25 + kNN)   │
                │ - Per-section channels  │
                │ - RRF fusion            │
                └────────────┬────────────┘
                             │
                ┌────────────▼────────────┐
                │ Phase 4: Rerank         │
                │ - Cross-encoder         │
                │ - Token budget per sec  │
                └────────────┬────────────┘
                             │
                ┌────────────▼────────────┐
                │ Phase 5: Outline LLM    │
                │ - One small call        │
                │ - Returns JSON outline  │
                └────────────┬────────────┘
                             │
                ┌────────────▼────────────┐
                │ Phase 6: Section Loop   │
                │ - 1 LLM call / section  │
                │ - Only relevant chunks  │
                │ - Carry summary forward │
                └────────────┬────────────┘
                             │
                ┌────────────▼────────────┐
                │ Phase 7: Stitch + QA    │
                │ - Merge sections        │
                │ - Consistency pass      │
                │ - Citation check        │
                └────────────┬────────────┘
                             │
                ┌────────────▼────────────┐
                │ Phase 8: Output         │
                │ - Stream to UI          │
                │ - Save .md to storage   │
                │ - Return download URL   │
                └─────────────────────────┘
```

### 1.2 Why This Architecture

Single-shot generation breaks down for long documents because (a) the LLM context window cannot hold all retrieved chunks plus a long output, and (b) quality degrades as output length grows. **Multi-step generation with per-section retrieval** solves both problems: each LLM call sees only what it needs, and each section gets dedicated reasoning capacity.

---

## Phase 0 — Foundation Setup

### 0.1 Infrastructure Checklist

| Component | Purpose | Notes |
|-----------|---------|-------|
| OpenSearch 2.11+ | Vector + lexical search | Enable k-NN plugin |
| RAGFlow core | Document parsing, chunking, embedding | Fork or use as library |
| Embedding model | Convert text → vectors | `bge-large-en-v1.5` (1024-dim) recommended |
| Reranker | Cross-encoder for precision | `bge-reranker-v2-m3` |
| LLM (small ctx) | Generation | e.g. 8K–32K context model |
| Redis | Cache sub-queries, embeddings | Optional but recommended |
| Object storage | Store final .md files | S3 / MinIO |
| Backend framework | API layer | FastAPI / NestJS |

### 0.2 OpenSearch Index Design

Create **two indices**: one for reference corpus, one for generated-output templates.

**Reference corpus index (`rag_chunks`):**

```json
PUT /rag_chunks
{
  "settings": {
    "index": {
      "knn": true,
      "knn.algo_param.ef_search": 100,
      "number_of_shards": 3,
      "number_of_replicas": 1
    }
  },
  "mappings": {
    "properties": {
      "chunk_id":        { "type": "keyword" },
      "doc_id":          { "type": "keyword" },
      "doc_type":        { "type": "keyword" },
      "domain":          { "type": "keyword" },
      "section_type":    { "type": "keyword" },
      "tags":            { "type": "keyword" },
      "title":           { "type": "text" },
      "content":         { "type": "text", "analyzer": "standard" },
      "content_vector":  {
        "type": "knn_vector",
        "dimension": 1024,
        "method": {
          "name": "hnsw",
          "space_type": "cosinesimil",
          "engine": "nmslib",
          "parameters": { "ef_construction": 256, "m": 24 }
        }
      },
      "token_count":     { "type": "integer" },
      "created_at":      { "type": "date" },
      "source_uri":      { "type": "keyword" }
    }
  }
}
```

**Templates index (`rag_templates`):** stores skeleton outlines for SRS, user story, test case, design doc. Used by Phase 5 as a structural anchor.

### 0.3 Document Type Taxonomy

Define a closed enum used throughout the system:

```python
class DocType(str, Enum):
    SRS = "srs"
    USER_STORY = "user_story"
    TEST_CASE = "test_case"
    DESIGN_DOC = "design_doc"
    UNKNOWN = "unknown"
```

Each `doc_type` has an associated template, default section list, target token length, and validation rules.

---

## Phase 1 — Input Parsing & Intent Classification

### 1.1 Goal

Convert the user's markdown into a typed `RequestSpec` object that downstream phases can reason about.

### 1.2 Parser Implementation

Use a deterministic parser (not an LLM) to extract headers. Markdown is structured enough that regex/AST parsing is more reliable and free.

```python
import re
from dataclasses import dataclass
from typing import Optional

@dataclass
class RequestSpec:
    user_profile: str
    task: str
    context: str
    keywords: list[str]
    output_format: str
    doc_type: DocType
    raw: str

HEADER_PATTERN = re.compile(
    r"^##\s+(User Profile|Task|Context|Keywords?|Output Format)\s*$",
    re.IGNORECASE | re.MULTILINE
)

def parse_request(md: str) -> RequestSpec:
    sections = {}
    matches = list(HEADER_PATTERN.finditer(md))
    for i, m in enumerate(matches):
        header = m.group(1).lower().replace(" ", "_").rstrip("s")
        start = m.end()
        end = matches[i+1].start() if i+1 < len(matches) else len(md)
        sections[header] = md[start:end].strip()

    keywords_raw = sections.get("keyword", "")
    keywords = [k.strip() for k in re.split(r"[,\n]", keywords_raw) if k.strip()]

    return RequestSpec(
        user_profile=sections.get("user_profile", ""),
        task=sections.get("task", ""),
        context=sections.get("context", ""),
        keywords=keywords,
        output_format=sections.get("output_format", ""),
        doc_type=classify_doc_type(sections),
        raw=md
    )
```

### 1.3 Doc Type Classification

A small rule-based classifier handles most cases; fall back to a tiny LLM call only when ambiguous.

```python
DOC_TYPE_HINTS = {
    DocType.SRS:         ["srs", "software requirements", "ieee 830", "functional requirement"],
    DocType.USER_STORY:  ["user story", "as a user", "acceptance criteria", "given when then"],
    DocType.TEST_CASE:   ["test case", "test plan", "test scenario", "qa"],
    DocType.DESIGN_DOC:  ["design doc", "architecture", "hld", "lld", "system design"]
}

def classify_doc_type(sections: dict) -> DocType:
    combined = " ".join(sections.values()).lower()
    scores = {dt: sum(1 for h in hints if h in combined)
              for dt, hints in DOC_TYPE_HINTS.items()}
    best = max(scores, key=scores.get)
    return best if scores[best] > 0 else DocType.UNKNOWN
```

### 1.4 Validation

Reject early if mandatory headers are missing. Return a structured error so the chat UI can prompt the user to fix their input.

---

## Phase 2 — Query Planning & Sub-Query Generation

### 2.1 Goal

Convert one `RequestSpec` into N sub-queries, each tied to one section of the final output.

### 2.2 Why Sub-Queries

A single embedding of the entire Task header retrieves "generally relevant" chunks. But an SRS has ~8–12 sections (Scope, Functional Reqs, Non-Functional Reqs, Interfaces, Constraints, Assumptions, etc.), each needing different references. Sub-queries give each section its own retrieval channel.

### 2.3 Sub-Query Generation

Use one small LLM call. The prompt is tight — well under 2K tokens — and the output is JSON.

**Prompt template:**

```
You are a retrieval planner. Given a user's request to generate a {doc_type},
produce a JSON list of sub-queries. Each sub-query targets ONE section of the
final document and will be used to search a vector database.

DOC TYPE: {doc_type}
TASK: {task}
CONTEXT: {context}
KEYWORDS: {keywords}

Required output sections for this doc type:
{section_list_from_template}

For each section, produce:
- "section_id": short snake_case id
- "section_title": human title
- "query": 1–2 sentence search query optimized for semantic search
- "keywords": 3–6 lexical anchors for BM25
- "must_include": concepts that MUST appear in retrieved chunks

Return ONLY valid JSON, no preamble.
```

**Expected output:**

```json
[
  {
    "section_id": "scope",
    "section_title": "Project Scope",
    "query": "scope and boundaries of a payment reconciliation module in fintech microservices",
    "keywords": ["scope", "boundaries", "reconciliation", "payment"],
    "must_include": ["reconciliation", "scope"]
  },
  {
    "section_id": "functional_reqs",
    "section_title": "Functional Requirements",
    "query": "functional requirements for double-entry reconciliation with idempotent settlement processing",
    "keywords": ["functional requirement", "idempotency", "settlement", "double-entry"],
    "must_include": ["idempotency"]
  }
  // ... more sections
]
```

### 2.4 Caching

Cache by `hash(doc_type + task + context)` in Redis with a 24h TTL. Sub-query plans are deterministic enough that this saves real money.

---

## Phase 3 — Hybrid Retrieval from OpenSearch

### 3.1 Goal

For each sub-query, retrieve top-K candidate chunks using both semantic and lexical search, then fuse.

### 3.2 Per-Sub-Query Retrieval

For each sub-query, run two searches in parallel:

**Dense (kNN) search:**

```json
POST /rag_chunks/_search
{
  "size": 30,
  "query": {
    "bool": {
      "must": [
        {
          "knn": {
            "content_vector": {
              "vector": [/* embedding of sub_query.query */],
              "k": 30
            }
          }
        }
      ],
      "filter": [
        { "terms": { "doc_type": ["srs", "design_doc"] } },
        { "term":  { "domain": "fintech" } }
      ]
    }
  }
}
```

**Sparse (BM25) search:**

```json
POST /rag_chunks/_search
{
  "size": 30,
  "query": {
    "bool": {
      "must": [
        {
          "multi_match": {
            "query": "idempotency settlement double-entry reconciliation",
            "fields": ["title^2", "content", "tags^1.5"],
            "type": "best_fields"
          }
        }
      ],
      "filter": [
        { "terms": { "doc_type": ["srs", "design_doc"] } }
      ]
    }
  }
}
```

### 3.3 Reciprocal Rank Fusion

Merge the two result lists using RRF:

```python
def rrf_fuse(dense_results, sparse_results, k=60, top_n=40):
    scores = {}
    for rank, doc in enumerate(dense_results):
        scores[doc["chunk_id"]] = scores.get(doc["chunk_id"], 0) + 1 / (k + rank)
    for rank, doc in enumerate(sparse_results):
        scores[doc["chunk_id"]] = scores.get(doc["chunk_id"], 0) + 1 / (k + rank)
    ranked_ids = sorted(scores, key=scores.get, reverse=True)[:top_n]
    return ranked_ids
```

### 3.4 Cross-Section Deduplication

A single chunk may rank high for multiple sub-queries. Track a global "claimed-by" map so the same chunk is not used in multiple sections unless its score is very high for both.

### 3.5 Parallelization

Run all sub-query retrievals concurrently. With N sections and 2 searches per section, that is 2N OpenSearch requests — easily parallelized with `asyncio.gather`. End-to-end retrieval should complete in 1–3 seconds.

---

## Phase 4 — Reranking & Context Budgeting

### 4.1 Goal

Take the 40 candidate chunks per section, rerank for precision, and trim to fit each section's token budget.

### 4.2 Cross-Encoder Reranking

The cross-encoder takes `(query, chunk)` pairs and scores them jointly. This is slower than embedding similarity but dramatically more accurate.

```python
from sentence_transformers import CrossEncoder

reranker = CrossEncoder("BAAI/bge-reranker-v2-m3")

def rerank(query: str, chunks: list[dict], top_k: int = 8) -> list[dict]:
    pairs = [(query, c["content"]) for c in chunks]
    scores = reranker.predict(pairs)
    for c, s in zip(chunks, scores):
        c["rerank_score"] = float(s)
    return sorted(chunks, key=lambda x: x["rerank_score"], reverse=True)[:top_k]
```

### 4.3 Token Budgeting

This is critical for small-context LLMs. Compute a per-section budget given the model's context window:

```python
MODEL_CTX = 8192            # small-context model
RESERVED_OUTPUT = 2000      # leave room for generation
RESERVED_PROMPT = 800       # system prompt, instructions, headers
AVAILABLE_FOR_CHUNKS = MODEL_CTX - RESERVED_OUTPUT - RESERVED_PROMPT  # 5392

def select_chunks_within_budget(chunks: list[dict], budget: int) -> list[dict]:
    selected, total = [], 0
    for c in chunks:
        if total + c["token_count"] <= budget:
            selected.append(c)
            total += c["token_count"]
        if total >= budget * 0.9:
            break
    return selected
```

If chunks exceed the budget, **compress** the lowest-ranked ones via a cheap summarization call rather than dropping them entirely.

### 4.4 Chunk Ordering Inside the Prompt

Order chunks by rerank score descending — highest-relevance content closer to the instruction tends to be attended to better by the LLM.

---

## Phase 5 — Outline Generation

### 5.1 Goal

Produce a JSON outline of the full document in one small LLM call, before generating any section content.

### 5.2 Why Outline First

An outline (a) locks in document structure, (b) gives every subsequent section call a shared map of the whole, and (c) is small enough to pass into every section prompt as global context.

### 5.3 Outline Prompt

```
You are drafting the outline for a {doc_type}.

USER PROFILE: {user_profile}
TASK: {task}
CONTEXT: {context}
OUTPUT FORMAT: {output_format}

REFERENCE TEMPLATE FOR THIS DOC TYPE:
{template_skeleton}

TOP REFERENCE SNIPPETS (for grounding only, do not copy):
{top_5_chunks_compressed}

Produce a JSON outline:
{
  "title": "...",
  "sections": [
    {
      "id": "snake_case",
      "title": "...",
      "purpose": "1 sentence on what this section covers",
      "target_tokens": 400,
      "depends_on": ["id_of_earlier_section_if_any"]
    }
  ]
}

Constraints:
- Total target_tokens across sections must equal ~{target_total_tokens}.
- Section order must be logical for a {doc_type}.
- Return ONLY valid JSON.
```

### 5.4 Outline Validation

After receiving the outline, validate that section ids match those from Phase 2's sub-queries. If a section was planned in Phase 2 but missing in the outline (or vice versa), reconcile — usually by trusting the outline and re-running retrieval for any new sections.

---

## Phase 6 — Section-by-Section Generation

### 6.1 Goal

Generate each section of the final document with one focused LLM call that fits comfortably in the small context window.

### 6.2 The Per-Section Prompt

```
You are writing ONE section of a {doc_type}.

DOCUMENT TITLE: {outline.title}
SECTION TO WRITE: {section.title}
SECTION PURPOSE: {section.purpose}
TARGET LENGTH: ~{section.target_tokens} tokens

GLOBAL CONTEXT (for consistency):
- User profile: {user_profile}
- Task: {task}
- Constraints: {context}
- Document outline (for awareness of other sections):
  {compact_outline_list}

PREVIOUSLY WRITTEN SECTIONS (rolling summary, not full text):
{rolling_summary}

REFERENCE CHUNKS RELEVANT TO THIS SECTION:
[1] {chunk_1.content}  (source: {chunk_1.source_uri})
[2] {chunk_2.content}  (source: {chunk_2.source_uri})
...

INSTRUCTIONS:
1. Write only the content for "{section.title}". Do not write other sections.
2. Use markdown formatting.
3. Cite references inline using [1], [2], etc., when you draw on them.
4. Stay within {target_tokens * 1.2} tokens.
5. Do not repeat content already covered in earlier sections (see summary).

Begin section content now:
```

### 6.3 Rolling Summary Mechanism

After each section is generated, produce a 2–4 sentence summary of what it covered. Append to a running list. This list — not the full prior text — is what gets passed to the next section call. This is how you handle long documents in a small context window.

```python
async def summarize_section(section_md: str) -> str:
    # Tiny LLM call, max_tokens=120
    prompt = f"Summarize the following section in 2-3 sentences focused on what was established, not stylistic detail:\n\n{section_md}"
    return await llm.complete(prompt, max_tokens=120)
```

### 6.4 Dependency-Aware Ordering

If the outline declared `depends_on`, generate sections topologically. Most documents are sequential, but some sections (e.g., "Assumptions") should be generated after the sections that produce assumptions.

### 6.5 Parallel vs Sequential

Sections without dependencies on each other can be generated in parallel. In practice, allow up to 3 parallel section calls — beyond that, the rolling summary becomes inconsistent. For strictly sequential docs, generate one at a time.

### 6.6 Section-Level Retry

If a section's output is shorter than `0.5 * target_tokens` or fails a basic quality check (e.g., empty, contains placeholders like "TODO"), retry with a more directive prompt that emphasizes the gap.

---

## Phase 7 — Stitching, Refinement & Validation

### 7.1 Stitching

Concatenate sections in outline order. Add a generated title page and table of contents:

```python
def stitch(outline, sections, request):
    parts = [
        f"# {outline['title']}\n",
        f"_Generated for: {request.task}_\n\n",
        "## Table of Contents\n",
        *[f"{i+1}. [{s['title']}](#{s['id']})" for i, s in enumerate(outline['sections'])],
        "\n---\n"
    ]
    for s in outline["sections"]:
        parts.append(f"\n## {s['title']} <a id='{s['id']}'></a>\n")
        parts.append(sections[s["id"]])
    return "\n".join(parts)
```

### 7.2 Consistency Pass

One additional small LLM call reviews the **outline + rolling summaries** (not the full doc) and flags:
- Contradictions between sections
- Terminology drift (e.g., section 2 says "transaction", section 5 says "operation")
- Missing references between sections

The pass returns a JSON list of issues. Each flagged issue triggers a targeted patch — regenerating just that section with the contradiction noted.

### 7.3 Citation Validation

Walk through the final markdown, extract `[N]` references, and verify each maps to a real chunk used in that section. Append a "References" section at the bottom listing all unique sources.

### 7.4 Format Compliance

If `output_format` specified a template (e.g., "IEEE 830"), run a structural check: required headings present, ordering correct, required fields filled.

---

## Phase 8 — Streaming, Persistence & Download

### 8.1 Streaming to UI

Use Server-Sent Events (SSE) or WebSocket. Emit events at each phase boundary:

```json
{ "type": "phase", "phase": "parsing", "status": "done" }
{ "type": "phase", "phase": "planning", "status": "done", "sub_queries": 8 }
{ "type": "phase", "phase": "retrieval", "status": "done", "chunks_retrieved": 240 }
{ "type": "phase", "phase": "outline", "status": "done", "outline": { ... } }
{ "type": "section", "section_id": "scope", "status": "generating" }
{ "type": "section_chunk", "section_id": "scope", "text": "The scope of this..." }
{ "type": "section", "section_id": "scope", "status": "done" }
...
{ "type": "complete", "download_url": "/api/docs/abc123.md" }
```

Within each section, stream the LLM's token output directly to the client so the user sees progress.

### 8.2 Persistence

Save three artifacts per generation job:
1. The final stitched `.md` file → object storage
2. The job metadata (request, outline, retrieval stats, timing) → relational DB
3. The chunks used → relational DB (for later "show sources" UI)

### 8.3 Download Endpoint

```
GET /api/docs/{doc_id}.md
→ 200 OK
  Content-Type: text/markdown; charset=utf-8
  Content-Disposition: attachment; filename="srs_payment_recon_2026-05-24.md"
```

Generate the filename from doc_type + a slug of the task + date.

### 8.4 Re-Edit Loop

Persist the outline and section map. If the user asks "expand the Non-Functional Requirements section," you can re-run only Phase 6 for that section_id, re-stitch, and produce a new file — no need to redo retrieval.

---

## Context Window Management Strategy

This is the heart of making small-context LLMs work for long outputs. Summary of techniques used above:

| Technique | Where Applied | Effect |
|-----------|---------------|--------|
| **Per-section retrieval** | Phase 3 | Each section sees only its own chunks |
| **Sub-query decomposition** | Phase 2 | Targets retrieval, avoids "everything" embeddings |
| **Cross-encoder reranking** | Phase 4 | Higher precision per token spent |
| **Rolling summary** | Phase 6 | Carry forward meaning, not text |
| **Compact outline as global context** | Phase 5 → 6 | Shared map for ~200 tokens |
| **Chunk compression on overflow** | Phase 4 | Avoid dropping useful context |
| **Token budgeting per section** | Phase 4 | Hard guarantee of fit |
| **Per-section regeneration** | Phase 7 + 8 | Fix issues without redoing whole doc |

### Token Budget Example (8K context model)

For an SRS targeting ~6000 tokens total output across 10 sections:

```
Per section call:
  System prompt + instructions:    ~600 tokens
  Global context (profile/task):   ~200 tokens
  Compact outline:                 ~250 tokens
  Rolling summary (last 9 sect):   ~450 tokens
  Reference chunks (top 6):       ~3000 tokens
  ─────────────────────────────────────────────
  Total input:                    ~4500 tokens
  Reserved for output:             ~700 tokens
  Buffer:                         ~3000 tokens   ✓ Fits in 8K
```

Total document ≈ 10 sections × ~600 tokens output ≈ 6000 tokens, well beyond what one call could produce reliably.

---

## Error Handling & Fallbacks

| Failure | Detection | Fallback |
|---------|-----------|----------|
| Input missing required header | Phase 1 validation | Return structured error → UI prompts user |
| Doc type unclassifiable | Phase 1 score = 0 | Ask user to pick from dropdown |
| Sub-query LLM returns invalid JSON | JSON parse fails | Retry with stricter prompt; on 2nd fail, use template default sub-queries |
| OpenSearch timeout | Async timeout | Retry once; degrade to single search type (BM25 only) |
| Reranker OOM on large batch | Memory error | Chunk into batches of 32 |
| Section call empty/short | Length check | Retry with directive prompt |
| Section call hallucinates citations | Citation validator | Strip invalid `[N]`, optionally regenerate |
| Consistency pass finds >5 issues | Threshold | Flag doc for human review rather than auto-patching |

---

## Performance & Cost Optimization

### Caching Layers

1. **Embedding cache** — hash of text → vector. Embeddings of common queries hit this constantly.
2. **Sub-query plan cache** — hash of (doc_type, task, context) → plan JSON. 24h TTL.
3. **Retrieval cache** — hash of (sub_query, filters) → chunk ids. 1h TTL (corpus may update).
4. **Rerank cache** — hash of (query, chunk_id) → score. Long TTL since reranker is deterministic.

### Concurrency

- Phase 3 retrievals: `asyncio.gather` across all sub-queries
- Phase 4 reranking: batched GPU inference
- Phase 6 sections: bounded parallelism (3 max) for non-dependent sections

### Cost Discipline

The bulk of LLM cost lives in Phase 6 (one call per section). Track tokens per phase. Most documents should cost a few hundred input tokens × ~10 sections plus a small overhead — predictable and tunable via the per-section budget.

### Latency Target

End-to-end for a 10-section SRS:
- Phases 1–2:  ~2 sec
- Phase 3:     ~2 sec
- Phase 4:     ~3 sec
- Phase 5:     ~3 sec
- Phase 6:    ~30 sec (with parallelism)
- Phase 7:     ~4 sec
- Phase 8:    streaming throughout

**Realistic target:** ~45 seconds end-to-end with streaming, so the user sees output starting at ~10 sec.

---

## Implementation Timeline

A pragmatic 6-week build for a small team (2–3 engineers):

### Week 1 — Foundation
- Set up OpenSearch with k-NN plugin, create indices
- Integrate RAGFlow as a library or fork
- Build ingestion pipeline for reference corpus
- Wire up embedding model + reranker as services

### Week 2 — Phases 1–3
- Markdown parser + doc type classifier
- Sub-query generator with caching
- Hybrid retrieval + RRF fusion
- API endpoints for retrieval debugging

### Week 3 — Phases 4–5
- Reranker integration with batching
- Token budgeting logic
- Outline generator with validation
- Outline → sub-query reconciliation

### Week 4 — Phase 6
- Per-section generation loop
- Rolling summary mechanism
- Dependency-aware ordering
- Section-level retry and quality checks

### Week 5 — Phases 7–8
- Stitching, citation validation, consistency pass
- SSE/WebSocket streaming
- Object storage + download endpoint
- Re-edit loop for single-section regeneration

### Week 6 — Hardening
- End-to-end load testing
- Cache tuning
- Error handling polish
- Observability: per-phase metrics, traces

---

## Appendix A — Minimal Project Structure

```
ragapp/
├── api/
│   ├── routes/
│   │   ├── generate.py       # POST /generate, SSE stream
│   │   └── docs.py           # GET /docs/{id}.md
├── core/
│   ├── parser.py             # Phase 1
│   ├── planner.py            # Phase 2
│   ├── retriever.py          # Phase 3
│   ├── reranker.py           # Phase 4
│   ├── outline.py            # Phase 5
│   ├── sections.py           # Phase 6
│   ├── stitcher.py           # Phase 7
│   └── streamer.py           # Phase 8
├── templates/
│   ├── srs.yaml
│   ├── user_story.yaml
│   ├── test_case.yaml
│   └── design_doc.yaml
├── prompts/
│   ├── planner.txt
│   ├── outline.txt
│   ├── section.txt
│   └── consistency.txt
├── infra/
│   ├── opensearch/mappings/
│   └── docker-compose.yml
└── tests/
```

---

## Appendix B — Sample Template (SRS)

```yaml
# templates/srs.yaml
doc_type: srs
target_total_tokens: 6000
sections:
  - id: introduction
    title: Introduction
    target_tokens: 400
  - id: scope
    title: Scope
    target_tokens: 400
  - id: overall_description
    title: Overall Description
    target_tokens: 600
  - id: functional_reqs
    title: Functional Requirements
    target_tokens: 1200
  - id: non_functional_reqs
    title: Non-Functional Requirements
    target_tokens: 800
  - id: external_interfaces
    title: External Interface Requirements
    target_tokens: 600
  - id: constraints
    title: Design Constraints
    target_tokens: 400
  - id: assumptions
    title: Assumptions and Dependencies
    target_tokens: 300
    depends_on: [functional_reqs, non_functional_reqs]
  - id: appendices
    title: Appendices
    target_tokens: 300
```

---

**End of plan.**
