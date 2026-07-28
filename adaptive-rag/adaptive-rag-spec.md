# Technical Specification: Adaptive RAG Parameter Selection

**Version:** 1.0 (Draft)
**Status:** For Review
**Scope:** Query-adaptive retrieval configuration for a RAGFlow-style RAG application

---

## 1. Overview

### 1.1 Problem

The application currently uses one static set of RAG parameters (`top_n`, `similarity_threshold`, `vector_similarity_weight`, rerank settings, etc.) for every query. This causes:

- **Factoid queries** (short, keyword-heavy) retrieving too many loosely related chunks → noise in the LLM context.
- **Broad/summary queries** retrieving too few chunks → incomplete answers.
- **Verbatim/content-paste queries** (user pastes a sentence or fragment copied from a document and asks about it) failing, because pure semantic search with a high threshold misses exact-text matches, while keyword matching would find them instantly.
- **Multi-dataset deployments** either searching all datasets with the same settings (slow, noisy) or searching a guessed subset (missed datasets, wrong answers).

### 1.2 Solution

An **Adaptive RAG layer** that sits between the user query and the retrieval engine:

1. **Classifies** the query using a **rules-first, LLM-second** detector (rules are fast and free; the LLM is a fallback for ambiguous cases only).
2. **Selects a parameter profile** (all RAGFlow-style retrieval parameters) based on the detected query type.
3. **Routes across datasets** with a strategy that guarantees no candidate dataset is skipped, while keeping latency acceptable for large / many datasets.
4. **Handles verbatim-content queries** specially: when the user's input looks like text copied out of a document, retrieval pivots to keyword/full-text-dominant search so the source chunk is found exactly.

### 1.3 Goals & Non-Goals

**Goals**

- G1: ≥ 90% of queries classified by rules alone (no LLM call) at < 5 ms overhead.
- G2: LLM classifier fallback adds ≤ 800 ms p95 and is used only when rules are inconclusive.
- G3: Zero missed datasets: every dataset is either searched or explicitly excluded by a logged, auditable routing decision.
- G4: Verbatim-paste queries locate the exact source chunk in the top 3 results ≥ 95% of the time.
- G5: All parameter profiles are config-driven (hot-reloadable), not hard-coded.

**Non-Goals**

- Changing the chunking / indexing pipeline (assumed already built, hybrid index available).
- Training a custom classifier model (v1 uses rules + a general-purpose LLM prompt; a trained lightweight classifier is a v2 option).
- Multi-turn conversational query rewriting (handled by the existing chat layer; this spec receives the already-rewritten standalone query).

---

## 2. High-Level Architecture

```
User query
    │
    ▼
┌─────────────────────────────┐
│ 1. Query Analyzer            │
│   1a. Normalizer             │  lowercase copy, token stats, language,
│   1b. Rule Engine (fast)     │  regex/heuristics → type + confidence
│   1c. LLM Classifier (slow)  │  only if rule confidence < threshold
└─────────────┬───────────────┘
              │ QueryProfile {type, confidence, signals}
              ▼
┌─────────────────────────────┐
│ 2. Parameter Selector        │  QueryType → RAGParamProfile
│    (config-driven mapping,   │  + per-signal adjustments
│     per-dataset overrides)   │
└─────────────┬───────────────┘
              │ RetrievalPlan {params, dataset strategy}
              ▼
┌─────────────────────────────┐
│ 3. Dataset Router            │  single vs multi dataset
│    (fan-out / prefilter /    │  guaranteed-coverage rules
│     merge & rerank)          │
└─────────────┬───────────────┘
              ▼
        Retrieval Engine (hybrid: BM25/full-text + vector [+ rerank])
              │
              ▼
        Merged, reranked chunks → LLM answer generation
              │
              ▼
┌─────────────────────────────┐
│ 4. Feedback / Telemetry      │  logs decision + outcome for tuning
└─────────────────────────────┘
```

All four components are stateless services/modules; configuration lives in a versioned YAML/JSON store.

---

## 3. Query Analyzer

### 3.1 Query Type Taxonomy

| Type ID | Name | Description | Examples |
|---|---|---|---|
| `FACTOID` | Precise fact lookup | Short question expecting a specific value/entity | "What is the max upload size?", "Who approved PO-2231?" |
| `KEYWORD` | Keyword / entity search | 1–4 terms, no question structure — behaves like a search engine query | "invoice template 2025", "error E-4402" |
| `VERBATIM` | Pasted document content | Input is (or contains) a fragment copied from a document; user wants to locate/ask about that text | pastes a paragraph + "which contract is this from?" or just pastes the text alone |
| `SUMMARY` | Broad synthesis | Asks for overview, comparison, list, or summary across content | "Summarize our refund policy", "Compare plan A vs plan B" |
| `PROCEDURAL` | How-to / steps | Wants a procedure or instructions | "How do I reset the device?" |
| `ANALYTICAL` | Reasoning over evidence | Why/what-if/implications; needs multiple supporting chunks | "Why did Q3 churn increase?" |
| `CONVERSATIONAL` | Chit-chat / meta | No retrieval needed or trivial | "thanks", "what can you do?" |
| `AMBIGUOUS` | Cannot determine | Rules inconclusive → LLM fallback; if still unclear, use safe default profile | — |

### 3.2 Stage 1 — Normalizer

Computed once per query, feeds both rule engine and telemetry:

- `char_len`, `token_count`, `sentence_count`
- `has_question_mark`, `starts_with_wh_word` (what/who/when/where/which/how/why — and localized equivalents)
- `stopword_ratio`, `punctuation_density`, `uppercase_ratio`
- `language` (fast langid; parameter profiles may differ per language)
- `contains_quoted_span` (text inside "…" / «…»)
- `looks_like_paste`: heuristic — `sentence_count ≥ 2 AND stopword_ratio in natural-prose range AND no imperative/question lead-in`, OR `char_len > 200 without a question`, OR clipboard artifacts (line-break patterns, bullet chars, page numbers, "…" ellipses mid-text)
- `named_entities` (fast NER or dictionary of known dataset entities — product names, doc IDs, error codes)
- `doc_id_pattern_hits`: regexes for internal identifiers (e.g., `PO-\d+`, `INV\d{6}`, `E-\d{4}`)

### 3.3 Stage 2 — Rule Engine (logic first)

Ordered rule list; first match with confidence ≥ `rule_conf_min` (default **0.8**) wins. Each rule returns `(type, confidence, matched_signals)`.

```
R01  contains doc_id_pattern OR quoted_span ≥ 5 tokens        → VERBATIM   (0.95)
R02  looks_like_paste = true                                  → VERBATIM   (0.90)
R03  token_count ≤ 4 AND no wh-word AND no verb               → KEYWORD    (0.90)
R04  starts_with "summarize|overview|compare|list all|tổng hợp|so sánh"
                                                              → SUMMARY    (0.90)
R05  starts_with "how do|how to|steps to|hướng dẫn|cách"      → PROCEDURAL (0.90)
R06  starts_with "why|what if|explain why|tại sao"            → ANALYTICAL (0.85)
R07  wh-word + token_count ≤ 15 + names ≥1 entity             → FACTOID    (0.85)
R08  greeting/thanks/meta lexicon match                       → CONVERSATIONAL (0.95)
R09  wh-word + token_count ≤ 15 (no entity)                   → FACTOID    (0.70)  ← below threshold
R10  default                                                  → AMBIGUOUS  (0.0)
```

Notes:

- Rule keyword lists are **localized per supported language** (the examples above show English + Vietnamese).
- Rules are data (YAML), not code — order, patterns, and confidences are editable without deploy.
- If multiple rules fire, the highest-priority (lowest-numbered) match is taken; all fired rules are logged.
- **VERBATIM outranks everything**: even if a paste also contains a question ("<pasted paragraph>… where does this appear?"), VERBATIM handling applies, with the trailing question passed to answer generation.

### 3.4 Stage 3 — LLM Classifier (fallback only)

Invoked **only** when the rule engine result has `confidence < rule_conf_min` (target: ≤ 10% of traffic).

- **Model:** smallest available fast model (e.g., a Haiku-class model), `temperature = 0`, `max_tokens ≤ 60`.
- **Prompt (system):** the taxonomy in §3.1 with one example each; instruction to return strict JSON only.
- **Output contract:**

```json
{ "type": "FACTOID", "confidence": 0.86, "reason": "short wh-question about a specific field" }
```

- **Guardrails:**
  - Timeout **800 ms** → on timeout/parse failure fall back to the rule engine's best guess; if that was AMBIGUOUS, use `DEFAULT` profile.
  - The LLM may only return a type from the taxonomy; anything else → DEFAULT profile.
  - Result cached (normalized-query hash, TTL 24 h) so repeated queries never re-invoke the LLM.
- Also asked to extract `key_terms` (≤ 8) used later for keyword boosting and dataset routing.

---

## 4. Parameter Selector

### 4.1 Parameter Set (RAGFlow-aligned)

All parameters the selector controls, matching RAGFlow's retrieval knobs plus routing extensions:

| Parameter | Meaning | Range |
|---|---|---|
| `top_n` | Chunks handed to the LLM after rerank | 1–30 |
| `top_k` | Candidates entering the rerank stage | 64–4096 |
| `similarity_threshold` | Minimum hybrid similarity to keep a chunk | 0.0–1.0 |
| `vector_similarity_weight` | Weight of vector score in hybrid score (keyword/full-text weight = 1 − this) | 0.0–1.0 |
| `rerank_model` | Cross-encoder rerank on/off + model id | null / model id |
| `keyword_boost` | Extract keywords from query and boost term matches | bool |
| `use_knowledge_graph` | Include KG retrieval (if dataset has KG) | bool |
| `max_context_tokens` | Token budget for stuffed chunks | 2k–16k |
| `multiturn_rewrite` | Rewrite query with chat history first | bool |
| `dataset_strategy` | Routing mode (§5) | `single` / `fanout_all` / `route_then_fanout` |
| `per_dataset_top_k` | Candidate quota per dataset in multi-dataset mode | 16–512 |

### 4.2 Profile Table (defaults — all values config-driven)

| Profile → Type | `top_n` | `top_k` | `sim_thresh` | `vector_weight` | `rerank` | `keyword_boost` | Rationale |
|---|---|---|---|---|---|---|---|
| `FACTOID` | 6 | 256 | 0.25 | 0.55 | on | on | Precision-leaning hybrid; rerank sharpens the top |
| `KEYWORD` | 8 | 512 | 0.15 | **0.30** | on | on | Term matching dominates; low threshold because keyword scores scale differently |
| `VERBATIM` | 5 | 512 | **0.10** | **0.05–0.15** | on | on | Near-pure full-text/BM25; exact phrase should surface even if embeddings drift |
| `SUMMARY` | **15** | 1024 | 0.15 | 0.70 | on | off | Recall-leaning; semantic breadth matters more than exact terms |
| `PROCEDURAL` | 8 | 384 | 0.20 | 0.60 | on | on | Steps often span consecutive chunks; moderate breadth |
| `ANALYTICAL` | 12 | 768 | 0.18 | 0.65 | on | on | Needs diverse supporting evidence |
| `CONVERSATIONAL` | 0 | — | — | — | — | — | Skip retrieval entirely |
| `DEFAULT` (ambiguous) | 8 | 512 | 0.20 | 0.50 | on | on | Balanced middle ground |

### 4.3 Dynamic Adjustments (applied after profile selection)

Deterministic post-rules, each logged:

- **A1 – Long query (> 30 tokens, not VERBATIM):** `vector_weight += 0.10` (long natural language embeds well), cap 0.85.
- **A2 – Contains doc-id / error-code pattern:** `vector_weight −= 0.15`, `keyword_boost = on` (identifiers are lexical).
- **A3 – Few results:** if kept chunks after threshold < `min(top_n, 3)` → one retry with `similarity_threshold −= 0.05` (floor 0.05) and `top_k ×= 2` (cap 4096). Max **1** retry.
- **A4 – Huge dataset (> N million chunks):** raise `top_k` by tier (see §5.4) so the rerank stage still sees enough candidates.
- **A5 – Rerank unavailable/slow:** if rerank p95 breaches SLO, circuit-breaker disables rerank and compensates with `similarity_threshold += 0.05`.
- **A6 – VERBATIM exact-phrase pass:** run an exact/phrase full-text query for the longest 8–15-token shingle of the paste **in parallel** with hybrid search; exact hits are pinned to the top of the merged list (see §6).

### 4.4 Configuration Schema (excerpt)

```yaml
adaptive_rag:
  rule_conf_min: 0.8
  llm_classifier:
    model: fast-small
    timeout_ms: 800
    cache_ttl_h: 24
  profiles:
    FACTOID:   { top_n: 6,  top_k: 256,  similarity_threshold: 0.25, vector_similarity_weight: 0.55, rerank: true,  keyword_boost: true }
    KEYWORD:   { top_n: 8,  top_k: 512,  similarity_threshold: 0.15, vector_similarity_weight: 0.30, rerank: true,  keyword_boost: true }
    VERBATIM:  { top_n: 5,  top_k: 512,  similarity_threshold: 0.10, vector_similarity_weight: 0.10, rerank: true,  keyword_boost: true, exact_phrase_pass: true }
    SUMMARY:   { top_n: 15, top_k: 1024, similarity_threshold: 0.15, vector_similarity_weight: 0.70, rerank: true,  keyword_boost: false }
    PROCEDURAL:{ top_n: 8,  top_k: 384,  similarity_threshold: 0.20, vector_similarity_weight: 0.60, rerank: true,  keyword_boost: true }
    ANALYTICAL:{ top_n: 12, top_k: 768,  similarity_threshold: 0.18, vector_similarity_weight: 0.65, rerank: true,  keyword_boost: true }
    DEFAULT:   { top_n: 8,  top_k: 512,  similarity_threshold: 0.20, vector_similarity_weight: 0.50, rerank: true,  keyword_boost: true }
  dataset_routing:
    mode_thresholds: { fanout_max_datasets: 8 }
    per_dataset_top_k: { small: 64, medium: 128, large: 256, huge: 512 }
  overrides:            # optional per-dataset profile overrides
    legal_contracts:
      FACTOID: { similarity_threshold: 0.30 }
```

Config is versioned; every retrieval log records the config version used.

---

## 5. Dataset Router — Single & Multi-Dataset (Guaranteed Coverage)

### 5.1 Principle: "No Silent Skips"

A dataset may only be excluded from a search by an **explicit, logged rule** (user scoping, permissions, or a routing score below a floor *with* a mandatory safety pass — see 5.3). The router must never drop a dataset merely because a heuristic guessed it was irrelevant.

### 5.2 Modes

| Mode | When | Behavior |
|---|---|---|
| `single` | Exactly one dataset in scope | Apply profile directly. |
| `fanout_all` | ≤ `fanout_max_datasets` (default 8) datasets in scope | Search **every** dataset in parallel with `per_dataset_top_k` candidates each; merge; global rerank; apply `top_n`. Guarantees coverage by construction. |
| `route_then_fanout` | Many / huge datasets | Two-phase (5.3): cheap relevance scoring routes to a primary set, but a low-cost **coverage pass** still touches all remaining datasets. |

### 5.3 `route_then_fanout` (large-scale mode)

**Phase A — Dataset relevance scoring (cheap, all datasets):**
For every in-scope dataset compute a routing score from:
1. **Dataset profile match** — each dataset maintains an auto-built profile: centroid embedding(s) of its chunks, top-TF-IDF vocabulary, entity dictionary, and description. Score = cosine(query, centroids) + lexical overlap(query key_terms, vocabulary).
2. **Metadata filters** — user/tenant scoping, tags, date ranges (hard filters; exclusions logged with reason `scope`).
3. **Historical hit-rate** — smoothed rate at which this dataset produced chunks that survived reranking for this query type (cold start = neutral prior; never used as a hard exclusion signal on its own).

**Phase B — Tiered search:**
- **Primary tier** (score ≥ `route_hi` or top-M datasets): full search with the selected profile, `per_dataset_top_k` by size class.
- **Coverage tier** (everything else still in scope): **lightweight probe** — BM25/full-text only, `top_k = 32`, no rerank at this stage. Cost per dataset is tiny, but it means *every dataset is physically queried*.
- **Promotion rule:** if any coverage-tier dataset returns a chunk with raw score above `promote_threshold`, that dataset is promoted and re-searched with the full profile before merging.

**Phase C — Merge:**
- Normalize scores per dataset (z-score or min-max within each result list) *before* merging, so datasets with different score distributions compare fairly.
- Global rerank (cross-encoder) over the merged candidate pool (cap: `top_k` global), then cut to `top_n`.
- Deduplicate near-identical chunks across datasets (SimHash/MinHash > 0.92 → keep highest scorer, record duplicates as provenance).

**Coverage invariant (testable):** `searched_datasets ∪ scope_excluded_datasets == all_datasets`, and `scope_excluded_datasets` entries each carry a machine-readable reason. A CI test and a runtime assertion both enforce this.

### 5.4 Size Classes & Scaling

| Class | Chunk count | `per_dataset_top_k` | Notes |
|---|---|---|---|
| small | < 100 k | 64 | |
| medium | 100 k – 1 M | 128 | |
| large | 1 M – 10 M | 256 | ANN index params (ef_search / nprobe) bumped one tier |
| huge | > 10 M | 512 | Mandatory pre-filter by metadata partition if available; A4 adjustment applies |

### 5.5 VERBATIM × Multi-Dataset

Verbatim queries get a special guarantee: the **exact-phrase pass (A6) always runs `fanout_all`** across every in-scope dataset regardless of routing scores — a pasted fragment can come from any document, and phrase queries against full-text indexes are cheap. Hybrid search may still use `route_then_fanout`.

---

## 6. VERBATIM / Content-Paste Handling (Special Requirement)

Typical user behavior: copy a sentence/paragraph from a document, paste it, and ask (or ask nothing and expect the system to find the source).

**Pipeline for `VERBATIM`:**

1. **Split input** into `pasted_content` and optional `user_question` (rule: trailing/leading interrogative sentence not matching the paste's style, or explicit separators). If no question found, the implied intent is *"find this content and explain its context/source."*
2. **Shingle extraction:** from `pasted_content`, extract 2–4 shingles of 8–15 consecutive tokens, preferring spans with rare terms (max IDF sum). Normalize whitespace/quotes/dashes (clipboard artifacts).
3. **Exact/phrase pass:** full-text phrase queries for each shingle across **all** datasets (§5.5). Any hit = near-certain source match → pinned rank 1..k.
4. **Fuzzy pass:** hybrid search with the VERBATIM profile (`vector_weight ≈ 0.10`, `similarity_threshold 0.10`) using the whole paste — catches OCR noise, minor edits, translations of the pasted text.
5. **Merge:** exact hits first (dedup against fuzzy hits), then fuzzy by score; cut to `top_n`.
6. **Answering:** if a `user_question` exists, answer it grounded on the located chunks; otherwise return the source document(s), location (page/section metadata), and a short summary of surrounding context.
7. **Miss handling:** if neither pass finds a chunk above floor scores, tell the user the content was not found in the connected datasets (never hallucinate a source) and show closest fuzzy matches labeled as "similar, not exact."

---

## 7. Interfaces

### 7.1 Internal API

```
POST /v1/adaptive-retrieve
{
  "query": "…",
  "chat_history": [...],            // optional, for rewrite only
  "dataset_ids": ["*"] | ["a","b"], // "*" = all in tenant scope
  "override_profile": null | {...}, // power users / debugging
  "trace": true
}

200 →
{
  "chunks": [ {id, dataset_id, text, score, source, page, pinned_exact: bool}, ... ],
  "decision": {
    "query_type": "VERBATIM",
    "classifier": "rule:R02" | "llm",
    "confidence": 0.90,
    "profile_applied": {...},         // final params incl. adjustments A1–A6
    "adjustments": ["A2","A6"],
    "dataset_plan": {
      "mode": "route_then_fanout",
      "primary": ["contracts","policies"],
      "coverage": ["hr","it","finance"],
      "promoted": ["finance"],
      "excluded": [{"id":"archive_2019","reason":"scope:date_filter"}]
    },
    "config_version": "2026-07-15.3",
    "timings_ms": { "classify": 2, "retrieve": 240, "rerank": 180 }
  }
}
```

The `decision` block is the audit trail satisfying G3 and powers the tuning loop.

### 7.2 Retrieval Engine Contract

The engine must support per-request: hybrid weight, threshold, top_k, phrase queries, per-dataset quotas, and rerank toggle — i.e., the standard RAGFlow retrieval API surface. No engine changes required beyond exposing phrase search if not already available.

---

## 8. Observability & Tuning Loop

- **Log per query:** decision block (§7.1), user feedback (thumbs), whether the answer cited retrieved chunks, retry occurrences (A3), coverage-tier promotions.
- **Dashboards:** classification distribution & rule-hit heatmap; LLM-fallback rate (alert > 15%); per-profile answer quality; coverage-invariant violations (alert on any); VERBATIM top-3 hit rate (G4).
- **Offline tuning:** weekly job replays logged queries against a labeled set; proposes profile deltas (e.g., "SUMMARY top_n 15 → 12") as config PRs — humans approve, config is hot-reloaded.
- **A/B:** profile table versions can be split-tested by tenant percentage.

## 9. Failure Modes & Fallbacks

| Failure | Behavior |
|---|---|
| LLM classifier timeout/error | Rule best-guess, else DEFAULT profile |
| Rerank service down | Circuit breaker → rerank off + A5 compensation |
| A dataset shard unreachable | Return partial results **flagged** `coverage_incomplete: true` with the failed dataset listed; UI shows a notice |
| Retry (A3) still empty | Honest "not found" answer; no threshold below 0.05 |
| Config invalid on reload | Keep last good version; alert |

## 10. Acceptance Criteria

1. Rule engine classifies the labeled test set (≥ 500 queries, incl. Vietnamese + English) with ≥ 85% accuracy; combined rules+LLM ≥ 92%.
2. p95 added latency: rules-only path < 5 ms; LLM path < 800 ms.
3. Coverage invariant holds on 100% of multi-dataset test runs (CI gate).
4. VERBATIM suite (200 pasted fragments across all test datasets, incl. fragments with minor edits/OCR noise) — exact source in top 3 ≥ 95%.
5. Changing any profile value in config takes effect without redeploy within 60 s.
6. Every response carries a complete `decision` audit block.

## 11. Rollout Plan

- **M1 (wk 1–2):** Normalizer + rule engine + profile selector behind a feature flag; shadow mode (log decisions, don't apply).
- **M2 (wk 3):** Apply profiles for single-dataset tenants; VERBATIM pipeline.
- **M3 (wk 4–5):** Multi-dataset router with coverage invariant; LLM fallback classifier.
- **M4 (wk 6):** Telemetry dashboards, tuning job, A/B harness; GA.

## 12. Open Questions

- Should VERBATIM answers surface the full source paragraph or only chunk text? (UX decision)
- Per-language profile splits: do CJK/Vietnamese tokenization differences justify separate KEYWORD thresholds at launch or post-launch?
- Is a trained lightweight classifier (distilled from LLM fallback logs) worth building once ≥ 50 k labeled decisions accumulate? (v2 candidate)
