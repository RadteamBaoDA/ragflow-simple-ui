# Technical Specification: Adaptive RAG v2

**Version:** 2.0 (Draft)
**Status:** For Review
**Language:** Multilingual with BCP 47 language detection and configurable language packs
**Scope:** Portable, retrieval-only Adaptive RAG for Node.js, TypeScript, and OpenSearch
**Deployment model:** One modular service supporting multi-tenant, multi-project, and multi-dataset search
**Baseline:** Static BM25 plus dense-vector retrieval over already indexed chunks

---

## 1. Executive Summary

> **Adaptive mechanism covered:** End-to-end per-request adaptation from language and intent detection through routing, retrieval, evidence sufficiency, bounded iteration, and safe degradation.

Adaptive RAG v2 selects retrieval behavior from the query instead of applying one static configuration to every request. It is designed for deployments with:

- One to thousands of datasets per authorized scope.
- Many independent projects and tenants.
- A few datasets containing millions of chunks, thousands of smaller datasets, or both.
- Hybrid lexical and dense retrieval.
- Optional cross-encoder reranking.
- Exact or near-exact lookup for text pasted from source documents.
- Enterprise questions ranging from direct identifier lookup to bounded multi-hop research.

The retrieval mechanism has six stages:

1. Detect language and analyze the standalone query.
2. Select a base retrieval profile and independent modifiers.
3. Resolve the caller's authorized project and dataset scope.
4. Route hierarchically to a bounded set of datasets.
5. Retrieve, optionally decompose into bounded hops, rerank, and assemble evidence.
6. Return citations and an auditable retrieval decision without generating an answer.

The design intentionally does **not** query every eligible dataset. At large scale, physical fan-out across every dataset is incompatible with bounded latency and cost. Instead, every request produces a versioned, auditable routing decision, and routing quality is enforced through an offline `Routing Recall@M` acceptance target.

This is a retrieval-only specification. Parsing, chunking, document embeddings, ingestion jobs, index creation, reindexing, and answer generation are outside scope. Section 9 defines only the fields that those upstream systems must make searchable.

### 1.1 Adaptive Mechanism Coverage Matrix

This specification is complete for its declared retrieval-only boundary. "Complete" means every adaptive decision has a trigger, bounded action, fallback, telemetry, and acceptance gate. It does not mean every possible RAG feature is in scope.

| Adaptive decision | Trigger or input | Runtime adaptation | Primary section | Coverage |
|---|---|---|---|---|
| Language selection | Query text, hint, tenant default | Select BCP 47 language packs and lexical fields | 6 | Full |
| Mixed/unknown language | Detector confidence and candidates | Merge packs or use `und` plus dense fallback | 6, 7 | Full |
| Cross-lingual retrieval | Query/source language mismatch | Multilingual vector search and bounded translated lexical variants | 6, 7, 8 | Full |
| Retrieval/no retrieval | High-confidence meta intent | Select `NONE` or a retrieval profile | 6 | Full |
| Precision/recall strategy | Intent, length, complexity, evidence need | Select `PRECISION`, `BALANCED`, or `RECALL` | 6, 7 | Full |
| Lexical emphasis | Identifiers, acronyms, keyword query | Raise BM25 quota and RRF weight | 6, 7 | Full |
| Exact lookup | Quoted or pasted source text | Run exact locator beside fuzzy retrieval | 6, 8, 9 | Full when indexed fields exist |
| Temporal retrieval | Current, latest, effective, or as-of intent | Apply temporal filter or recency preference | 6, 7 | Full when indexed fields exist |
| Table retrieval | Numeric, table, row, or dimension intent | Prefer table fields and preserve header context | 6, 7, 10 | Full when indexed fields exist |
| Procedure context | How-to or troubleshooting intent | Expand neighboring and parent chunks | 6, 7, 10 | Full when adjacency exists |
| Scope selection | Identity, ACL, explicit IDs, metadata | Resolve authorized projects and datasets before search | 8, 13 | Full |
| Project/dataset routing | Eligible-scope size and catalog scores | Select bounded catalogs and mandatory datasets | 8 | Full |
| Physical search planning | Index, model, vector, and lexical compatibility | Group datasets into bounded `_msearch` work | 8 | Full |
| Candidate budgets | Profile, modifier, scale, and deadline | Change BM25, ANN, fusion, rerank, and context counts | 7, 8 | Full |
| Retrieval-source selection | Intent and capability health | Use BM25, vector, exact, or optional graph sources | 7, 9, 11 | Full; graph optional |
| Fusion strategy | Compatible/incompatible score distributions | Use weighted RRF or calibrated score fusion | 7, 10 | Full |
| Reranker decision | Profile, request mode, health, and deadline | Enable, skip, or circuit-break to non-reranked policy | 7, 15 | Full |
| Evidence sufficiency | Score, count, diversity, failures, comparison sides | Stop, relax once, escalate routing, or return insufficient evidence | 7, 8, 15 | Full |
| Parallel decomposition | Compound or comparison query | Run at most three independent subqueries | 6, 7 | Full |
| Sequential multi-hop | Evidence-dependent relationship query | Run at most three grounded retrieval hops | 6, 7 | Full |
| Context selection | Profile, token budget, diversity, adjacency | Deduplicate, diversify, expand, and trim evidence | 10 | Full |
| Failure adaptation | Dependency errors, timeouts, stale catalogs, shard failures | Use typed fallbacks, partial coverage, or fail closed | 15 | Full |
| Runtime configuration | Versioned profiles, models, rules, floors | Validate and atomically activate or roll back | 12 | Full |
| Feedback control loop | Telemetry and labeled evaluations | Calibrate rules, budgets, routing, scores, and feature flags offline | 14, 16, 17 | Full; no online self-training |
| Auditable API behavior | Request scope and runtime decisions | Return versions, timings, hops, coverage, and failure state | 13, 14 | Full |

Explicitly outside this coverage boundary:

- Document parsing, chunking, ingestion, and index lifecycle.
- Training embedding, reranking, routing, translation, or language-detection models.
- Final answer generation, answer translation, and hallucination controls after retrieval.
- Unlimited autonomous research, web browsing, and more than three synchronous retrieval hops.
- Automatic online learning that changes production behavior without evaluation and configuration approval.

---

## 2. Goals and Non-Goals

> **Adaptive mechanism covered:** Defines measurable boundaries for what may adapt at runtime and what remains intentionally static or outside retrieval.

### 2.1 Goals

- **G1 - Fast deterministic analysis:** At least 90% of queries use local language detection and rules only, with less than 10 ms p95 combined analyzer latency.
- **G2 - Query-adaptive retrieval:** Select precision, balanced, recall, or no-retrieval behavior from query signals.
- **G3 - Explicit score semantics:** Support reranked and non-reranked retrieval without treating reranker scores as vector cosine scores.
- **G4 - Large-scale routing:** Keep the number of fully searched datasets bounded even when the eligible scope contains thousands of datasets.
- **G5 - Auditable routing:** Record enough information to reconstruct why datasets were selected or not selected.
- **G6 - High routing recall:** Achieve at least 99.5% `Routing Recall@M` on the labeled routing evaluation set.
- **G7 - Exact source lookup:** Return the source in the top three results for at least 95% of supported pasted-fragment queries.
- **G8 - Safe degradation:** Fall back from reranked to calibrated non-reranked retrieval without applying incompatible score thresholds.
- **G9 - Versioned configuration:** Apply validated configuration changes without redeployment and retain the last known-good version.
- **G10 - Tenant and project isolation:** Apply authorization before routing and never expose unauthorized dataset existence through results or telemetry.
- **G11 - Enterprise query coverage:** Handle conversational, exact, factual, procedural, policy, temporal, comparative, tabular, cross-project, and bounded multi-hop queries.
- **G12 - Portable implementation:** Keep adaptive decisions and Reciprocal Rank Fusion in TypeScript and use the official OpenSearch client without requiring Neural Search pipelines.
- **G13 - Dual-axis scale:** Bound work independently for eligible dataset count, physical index count, shard count, and chunk candidate count.
- **G14 - Multilingual and cross-lingual retrieval:** Detect query language, apply language-specific rules and lexical fields, and retain dense retrieval when lexical support is unavailable.

### 2.2 Non-Goals

- Querying every eligible dataset for every request.
- Training a custom classifier in v2.
- Answer generation or prompt design after context assembly.
- Multi-turn query rewriting. The system receives a standalone query.
- Document parsing, chunk creation, document embedding, ingestion, reindexing, and index lifecycle automation.
- Creating or modifying any indexed content during retrieval.
- Using historical popularity as a hard routing signal.
- Enabling knowledge-graph retrieval for every analytical query.
- Unlimited agentic research, open-ended web search, or more than three synchronous retrieval hops.
- Automatic answer translation or localization of source evidence.

---

## 3. Design Principles and Invariants

> **Adaptive mechanism covered:** Constrains every adaptive choice with authorization, bounded work, score compatibility, read-only behavior, and honest no-evidence outcomes.

1. **Authorization precedes routing.** Unauthorized projects and datasets never enter router candidate sets.
2. **Query intent and retrieval properties are separate.** A query may be analytical and lexical, or summary-oriented and verbatim, at the same time.
3. **Routing is bounded.** Full retrieval is limited by configured project, dataset, candidate, and time budgets.
4. **No silent routing decisions.** Selected and non-selected datasets are explainable from the request scope, catalog version, router version, and score policy.
5. **Exact scores are not hybrid scores.** Exact phrase hits use a separate priority band and are not numerically blended with semantic scores.
6. **Reranked and non-reranked scores are not interchangeable.** Each path has separate weights, score floors, calibration versions, and fallbacks.
7. **Retrieval failure is not evidence absence.** Partial coverage, failed shards, and timeouts are surfaced explicitly.
8. **Profile values are seed configurations.** Production activation requires evaluation and score calibration for the selected embedding and rerank models.
9. **Retrieval is read-only.** Query handling never creates indexes, writes chunks, refreshes catalogs, or changes aliases.
10. **Client filters only narrow scope.** Tenant and ACL filters are created from trusted server identity and cannot be supplied or removed by the caller.
11. **Every loop is bounded.** Query variants, projects, datasets, physical indexes, candidates, retries, and multi-hop steps all have hard limits.
12. **No answer is a valid result.** The service returns `INSUFFICIENT_EVIDENCE` rather than filling evidence gaps.
13. **Language detection is advisory, not authorization.** A detected language changes analysis and retrieval fields but never tenant, project, dataset, or ACL scope.
14. **Low-confidence language never blocks retrieval.** Identifier search and multilingual dense retrieval remain available when language detection is uncertain.

---

## 4. Terminology

> **Adaptive mechanism covered:** Establishes the contracts used to express profiles, modifiers, routing waves, search groups, hops, language packs, calibration, and evidence.

| Term | Definition |
|---|---|
| Eligible project | A project the caller is authorized to search after hard scope filters. |
| Eligible dataset | A dataset the caller is authorized to search after project, tenant, ACL, and request filters. |
| Dataset catalog | A small routing index containing dataset-level representations rather than document chunks. |
| Exact locator index | A central positional phrase and character n-gram index mapping normalized text to dataset, document, and chunk locations. |
| Base profile | One of `PRECISION`, `BALANCED`, `RECALL`, or `NONE`. |
| Modifier | An independent retrieval behavior added to a base profile. |
| Retrieval pool | One physical OpenSearch index or alias containing chunks with one compatible vector dimension and embedding-model version. |
| Search group | Selected datasets that can be searched together because they share a retrieval pool, routing policy, and query-vector model. |
| Retrieval hop | One evidence-seeking subquery in a bounded multi-hop plan. |
| Language pack | Versioned rules, lexical fields, stopwords, and query expansions for one BCP 47 language. |
| Routing wave | One bounded selection and retrieval attempt over a set of projects or datasets. |
| Candidate | A chunk returned before final context selection. |
| Context chunk | A final evidence chunk returned to the downstream consumer. |
| Calibration version | The versioned mapping or threshold set used to interpret retrieval or rerank scores. |

---

## 5. High-Level Architecture

> **Adaptive mechanism covered:** Shows the control flow that converts query signals into a retrieval plan, executes it, checks evidence, and records the decision.

```text
Standalone query
      |
      v
+-------------------------+
| 1. Query Analyzer       |
| - language detection    |
| - language normalization|
| - language-pack rules   |
| - optional LLM fallback |
+-------------------------+
      |
      | RetrievalIntent
      v
+-------------------------+
| 2. Scope Resolver       |
| - tenant                |
| - project               |
| - ACL                   |
| - explicit dataset IDs  |
+-------------------------+
      |
      | Eligible scope
      v
+----------------------------------------------------+
| 3. Hierarchical Router                            |
| - exact locator shortcut                          |
| - project catalog search                          |
| - dataset catalog search                          |
| - mandatory inclusions                            |
| - bounded escalation                              |
+----------------------------------------------------+
      |
      | RetrievalPlan
      v
+----------------------------------------------------+
| 4. Retrieval Executor                             |
| - lexical and dense candidate generation          |
| - application-side Reciprocal Rank Fusion         |
| - optional cross-encoder rerank                    |
| - deduplication, diversity, neighbor expansion    |
+----------------------------------------------------+
      |
      | Evidence sufficient?
      +------------ no and MULTI_HOP ---------------+
      |                                             |
      | yes                                 bounded next hop
      v
+-------------------------+
| 5. Decision Telemetry   |
| - analyzer decision     |
| - routing decision      |
| - score path            |
| - quality and timings   |
+-------------------------+
```

The services may be horizontally stateless, but they depend on external state:

- Versioned configuration store.
- Dataset and project catalogs.
- Chunk and optional exact-locator indexes populated by an upstream indexing system.
- Classifier cache.
- Score calibration registry.
- Circuit-breaker state.
- Telemetry and evaluation stores.

---

## 6. Query Analyzer

> **Adaptive mechanism covered:** Detects language and query family, then selects the base profile, composable modifiers, decomposition, multi-hop, or `NONE`.

### 6.1 Language Detection

Language detection runs before language-specific intent rules.

Detection order:

1. Normalize Unicode with NFKC while preserving the original query.
2. Separate identifiers, URLs, code, and quoted/pasted spans from natural-language text.
3. Run the configured local or private language detector on the remaining text.
4. Normalize detector tags to BCP 47 base languages, for example `en-US -> en`, `vi-VN -> vi`, and `ja-JP -> ja`.
5. Compare the result with an optional authenticated user locale and tenant default.
6. Detect mixed-language input when two qualified languages each exceed the configured share threshold.
7. Select one primary rule language and up to two analysis languages.

The detector returns:

```json
{
  "primary": "vi",
  "confidence": 0.96,
  "source": "detector",
  "mixed": true,
  "analysis_languages": ["vi", "en"],
  "candidates": [
    { "language": "vi", "score": 0.96 },
    { "language": "en", "score": 0.61 }
  ]
}
```

Rules:

- Use BCP 47 base-language tags internally.
- A caller's `language_hint` is a tie-breaker, not an override, unless trusted tenant policy marks it authoritative.
- Queries with fewer than four natural-language tokens, identifier-only queries, and code-heavy queries are `und` unless the detector meets the short-query confidence gate.
- `und` uses language-neutral identifier, exact, length, and punctuation rules plus multilingual dense retrieval.
- Mixed-language queries apply rule packs in priority order and merge modifiers deterministically.
- A detected language without a configured lexical field uses the `und` lexical field or dense-only fallback; it does not fail the request.
- The detector must run locally or through an approved private service because raw enterprise queries may contain sensitive content.
- Detection output is cached by tenant-scoped query hash, detector version, and language-pack version.

The minimum supported set is deployment configuration. The seed configuration and TypeScript sample include English (`en`), Vietnamese (`vi`), and Japanese (`ja`) to demonstrate the mechanism.

### 6.2 Output Contract

```json
{
  "base_profile": "PRECISION",
  "modifiers": ["LEXICAL"],
  "language": {
    "primary": "en",
    "confidence": 0.98,
    "source": "detector",
    "mixed": false,
    "analysis_languages": ["en"]
  },
  "confidence": 0.91,
  "classifier": "rule:R03",
  "signals": {
    "token_count": 7,
    "sentence_count": 1,
    "has_question": true,
    "identifier_hits": ["E-4402"],
    "looks_like_paste": false
  },
  "key_terms": ["E-4402"]
}
```

### 6.3 Base Profiles

| Profile | Use |
|---|---|
| `PRECISION` | A narrow lookup expected to have one or a few directly relevant chunks. |
| `BALANCED` | A normal question needing moderate recall and precision. |
| `RECALL` | A summary, comparison, broad list, or analysis needing diverse evidence. |
| `NONE` | High-confidence conversational or meta input that requires no retrieval. |

### 6.4 Modifiers

| Modifier | Effect |
|---|---|
| `LEXICAL` | Increases lexical candidate quota and lexical influence for identifiers or keyword-style queries. |
| `EXACT` | Runs the exact locator path for quoted or pasted source content. |
| `LEXICAL_EXPANSION` | Adds approved acronym, alias, product-name, and glossary variants without changing authorization scope. |
| `MULTI_EVIDENCE` | Requires source diversity, raises evidence minimums, and may trigger routing escalation. |
| `NEIGHBOR_EXPANSION` | Fetches adjacent or parent chunks after ranking to preserve procedures and local context. |
| `TEMPORAL` | Applies explicit effective-date filters or a calibrated recency preference while preserving older conflicting evidence. |
| `TABLE_AWARE` | Raises candidates from table, row, header, and structured-value chunks. |
| `DECOMPOSE` | Creates independent retrieval subqueries for comparisons, lists, or compound questions and merges their evidence. |
| `MULTI_HOP` | Runs sequential evidence-dependent subqueries with a maximum of three hops. |
| `ENTITY_CARRYOVER` | Allows the next hop to use entities extracted only from evidence returned by an earlier hop. |
| `CROSS_LINGUAL` | Uses multilingual dense retrieval and approved translated lexical variants when query and source languages differ. |

Modifiers compose with profiles. For example:

- `PRECISION + LEXICAL`: "Who approved PO-2231?"
- `RECALL + EXACT + MULTI_EVIDENCE`: "Summarize this pasted policy section."
- `BALANCED + NEIGHBOR_EXPANSION`: "How do I reset the device?"
- `RECALL + DECOMPOSE + MULTI_EVIDENCE`: "Compare parental leave in Japan and Vietnam."
- `RECALL + MULTI_HOP + ENTITY_CARRYOVER`: "Which customer services depend on systems owned by Team A?"

### 6.5 Enterprise Query Coverage

The analyzer assigns a query family before applying ordered rules. A family is diagnostic metadata; executable behavior remains the base profile plus modifiers.

| Query family | Example | Required plan |
|---|---|---|
| Conversation or meta | "Thanks" | `NONE` |
| Exact identifier | "Status of INC-10452" | `PRECISION + LEXICAL` |
| Pasted or quoted source | "Where does this paragraph come from?" | `PRECISION + EXACT` |
| Simple fact | "Who owns Project Atlas?" | `PRECISION` |
| Acronym or internal jargon | "What is EDRM?" | `PRECISION + LEXICAL_EXPANSION` |
| Procedure | "How do I request production access?" | `BALANCED + NEIGHBOR_EXPANSION` |
| Policy or eligibility | "Can contractors access customer data?" | `BALANCED + MULTI_EVIDENCE` |
| Current or effective policy | "What is the current travel policy?" | `BALANCED + TEMPORAL` |
| Summary or exhaustive list | "Summarize all onboarding requirements" | `RECALL + MULTI_EVIDENCE` |
| Comparison | "Compare parental leave in Japan and Vietnam" | `RECALL + DECOMPOSE + MULTI_EVIDENCE` |
| Root cause or impact | "Why did incident X affect service Y?" | `RECALL + MULTI_HOP + MULTI_EVIDENCE` |
| Relationship traversal | "Which customers depend on systems owned by Team A?" | `RECALL + MULTI_HOP + ENTITY_CARRYOVER` |
| Table or numeric evidence | "What was Q3 revenue for each region?" | `BALANCED + TABLE_AWARE` |
| Ambiguous shorthand | "Access issue" | `BALANCED + LEXICAL_EXPANSION`, then at most three query variants |
| Cross-lingual evidence | Vietnamese query over English policy sources | Same profile plus `CROSS_LINGUAL` |
| Mixed-language query | "So sánh leave policy 日本" | Merge `vi` and `ja` language-pack modifiers, then `DECOMPOSE` when required |
| Cross-project discovery | "Which projects use library X?" | `RECALL + MULTI_EVIDENCE` with project diversity |
| Unsupported or absent evidence | No qualifying evidence | `INSUFFICIENT_EVIDENCE` |

Queries may belong to more than one family. For example, a current-policy comparison uses `RECALL + TEMPORAL + DECOMPOSE + MULTI_EVIDENCE`.

### 6.6 Normalized Signals

The rule path computes:

- Character, token, and sentence counts.
- Question mark and interrogative lead.
- Language-pack imperative and intent phrases.
- Quoted span length.
- Identifier patterns configured by project.
- Uppercase, punctuation, and newline density.
- Paste artifacts such as bullets, page headers, repeated line breaks, and hyphenation.
- Stopword ratio for sufficiently long queries.
- Explicit dataset or project references.
- Temporal language such as current, latest, effective, before, after, and as-of dates.
- Comparison conjunctions and independently retrievable clauses.
- Relationship language such as owned by, depends on, caused by, affected, and associated with.
- Table and numeric signals such as quarter names, currencies, percentages, "by region", and "for each".
- Primary, alternate, mixed, and undetermined language signals.
- Ratio of natural-language tokens to identifiers, URLs, code, and punctuation.

Each configured language pack supplies its tokenizer, stopwords, rule phrases, date expressions, and approved lexical fields. Named-entity recognition is not required on the fast path.

### 6.7 Ordered Rules

Rules produce independent base-profile and modifier decisions:

```text
R01 high-confidence greeting, thanks, or meta request
    -> NONE

R02 pasted prose or quoted span >= 8 tokens
    -> EXACT

R03 configured document, invoice, order, ticket, or error identifier
    -> LEXICAL

R04 approved acronym, product alias, or internal glossary term
    -> LEXICAL_EXPANSION

R05 current, latest, effective, expired, historical, or explicit as-of date
    -> TEMPORAL

R06 how to, steps, procedure, instructions, or troubleshoot
    -> BALANCED + NEIGHBOR_EXPANSION

R07 table, quarter, percentage, total, amount, "by <dimension>", or "for each"
    -> TABLE_AWARE

R08 compare, versus, differences, between, or independently answerable clauses
    -> RECALL + DECOMPOSE + MULTI_EVIDENCE

R09 summary, overview, list all, across, requirements, or exhaustive scope
    -> RECALL + MULTI_EVIDENCE

R10 why, caused by, impact, depends on, owned by, implication, or relationship chain
    -> RECALL + MULTI_HOP + MULTI_EVIDENCE

R11 relationship chain where a later lookup requires an entity not present in the query
    -> ENTITY_CARRYOVER

R12 short interrogative expecting one entity or value
    -> PRECISION

R13 one to four non-sentence search terms
    -> PRECISION + LEXICAL

R14 normal question
    -> BALANCED

R15 conflicting base-profile rules
    -> choose the broader profile in order RECALL > BALANCED > PRECISION

R16 insufficient confidence or ambiguous decomposition
    -> LLM fallback

R17 query language differs from selected source languages
    -> CROSS_LINGUAL
```

An identifier adds `LEXICAL`; it does not imply `EXACT`. `EXACT` requires evidence that query text was copied or deliberately quoted.

Modifier merge rules:

1. `NONE` is valid only when no retrieval modifier is present and its calibrated precision gate passes.
2. `MULTI_HOP` implies `MULTI_EVIDENCE`.
3. `ENTITY_CARRYOVER` is ignored unless `MULTI_HOP` is present.
4. `DECOMPOSE` creates parallel independent subqueries; `MULTI_HOP` creates sequential dependent subqueries.
5. `TEMPORAL` applies a hard date filter only when the user supplied a date or "current" has an indexed `is_current` contract. Otherwise it applies a soft preference and returns conflicting dates.
6. `TABLE_AWARE` never performs arithmetic. It retrieves table evidence and preserves row and header context.
7. `EXACT` runs beside fuzzy retrieval unless an authorized unique exact hit satisfies the request.
8. No modifier may increase the authorized project or dataset set.
9. Language-pack rules may broaden the profile but cannot remove a modifier produced by a higher-confidence language-neutral rule.
10. `CROSS_LINGUAL` prefers a compatible multilingual embedding model; translated lexical variants are optional, bounded, and recorded.

### 6.8 Rule and Language Confidence

Rule confidence values must be calibrated from labeled traffic:

- A configured threshold controls whether the LLM fallback runs.
- Each rule reports precision, recall, and sample size.
- Uncalibrated rule scores are called `rule_score`, not probability.
- Production `confidence` is emitted only after calibration.
- Language detection precision, recall, and calibration are reported per language, mixed-language slice, and query-length bucket.
- Intent confidence and language confidence are separate values.

### 6.9 LLM Fallback

The LLM fallback:

- Runs only when deterministic rules cannot choose a base profile.
- Uses temperature `0` and structured output.
- May return one base profile and zero or more valid modifiers.
- May return at most three parallel subqueries or three sequential hop templates.
- Cannot alter scope or authorization.
- Times out after 800 ms.
- Falls back to `BALANCED` on timeout or invalid output.
- Caches results by normalized query hash, analyzer version, model version, prompt version, and tenant.
- Never shares cache entries across tenants.
- Returns JSON validated against a closed enum; unknown fields and modifiers reject the output.
- Does not contribute facts, entities, filters, or evidence to the retrieval result.
- Receives detected language and must return the same BCP 47 language fields unless explicitly classifying a mixed-language query.
- Uses the query language for classification when a compatible prompt exists; otherwise uses a configured private translation only for classification.

### 6.10 Bounded Decomposition and Multi-Hop

`DECOMPOSE` is used when subquestions can be searched independently. All subqueries execute against the same authorized scope and share one global deadline.

`MULTI_HOP` is used only when a later retrieval depends on evidence from an earlier retrieval:

```text
original query
  -> hop 1 subquery
  -> retrieve and select qualifying evidence
  -> extract allow-listed entity types from that evidence
  -> instantiate hop 2 from the approved template
  -> stop, or run one final hop 3
```

Hard limits:

- Maximum three hops.
- Maximum three subqueries per hop.
- Maximum eight extracted carryover entities per hop.
- Maximum 128 characters per generated subquery.
- No repeated normalized subquery.
- No entity carryover from model memory or unqualified candidates.
- No authorization-scope expansion.
- Generated subqueries retain the original primary language unless a recorded `CROSS_LINGUAL` plan creates an approved translated variant.
- Stop when evidence is sufficient, the next hop has no grounded entities, or the request deadline has less than 250 ms remaining.

The response groups evidence by hop and records the dependency:

```json
{
  "hop": 2,
  "query": "services owned by Team A",
  "depends_on": [
    {
      "hop": 1,
      "chunk_id": "chunk-17",
      "entity": "Team A"
    }
  ]
}
```

If the loop stops early, completed evidence is returned with `coverage_incomplete: true` and an `unresolved_hops` list. Partial multi-hop evidence is never labeled complete.

---

## 7. Retrieval Parameter Model

> **Adaptive mechanism covered:** Converts profiles and modifiers into bounded candidate counts, RRF weights, score floors, reranking policy, retries, and specialized retrieval behavior.

### 7.1 Separation of Concerns

Adaptive RAG v2 separates five candidate counts:

| Parameter | Meaning |
|---|---|
| `dense_candidate_k` | Dense ANN candidates requested from each physical search group. |
| `lexical_candidate_k` | Lexical/BM25 candidates requested from each physical search group. |
| `fusion_candidate_k` | Candidates retained after lexical-dense fusion per search group. |
| `rerank_candidate_k` | Globally pooled candidates sent to the cross-encoder. |
| `context_top_n` | Final evidence chunks returned before neighbor expansion. |

This avoids overloading RAGFlow-style `top_k` with candidate generation, reranking, and context responsibilities.

### 7.2 RAGFlow Parameter Mapping

| RAGFlow-style parameter | Adaptive RAG v2 interpretation |
|---|---|
| `top_n` | `context_top_n` |
| `top_k` | Closest to `dense_candidate_k`; it is not the final rerank or context count. |
| `similarity_threshold` | A native dense or reranker floor only after calibration; it is not copied onto RRF scores. |
| `vector_similarity_weight` without reranker | `dense_rrf_weight` in rank fusion. |
| `vector_similarity_weight` with reranker | Candidate-generation preference only; final rank is the reranker rank. |
| `rerank_model` | `rerank.enabled` plus a versioned model ID. |
| `keyword` or `keyword_boost` | Lexical query expansion and lexical candidate generation policy. |
| `use_knowledge_graph` | A separately gated retrieval source, not a default profile switch. |

### 7.3 Default Non-Reranked Fusion

BM25 and k-NN scores have different distributions. The portable default is weighted Reciprocal Rank Fusion in TypeScript:

```text
rrf_score(c) =
    lexical_rrf_weight / (rrf_k + lexical_rank(c))
  + dense_rrf_weight   / (rrf_k + dense_rank(c))
  + exact_rrf_weight   / (rrf_k + exact_rank(c))
```

Missing ranks contribute zero. `rrf_k` defaults to `60`. Exact and identifier lists participate only when the analyzer enables them.

Requirements:

- Fuse globally after joining results from every physical search group.
- Deduplicate by stable chunk ID before assigning final ranks.
- Keep source-native scores for diagnostics but never add raw BM25 and vector scores.
- Weighted score fusion is allowed only after a calibration report proves cross-index and cross-model compatibility.
- Apply an RRF floor only if calibrated for the exact list count, weights, and `rrf_k`.
- A unique high-confidence exact hit may occupy a separate priority band; it remains labeled `exact`, not `rrf`.
- OpenSearch's score-ranker processor may replace application RRF when the deployment is pinned to a compatible version, but it is not required by this design.

### 7.4 Reranked Scoring

The reranked path has two steps.

**Candidate generation:**

```text
candidate_score(c) = weighted_rrf(lexical_rank, dense_rank, exact_rank)
```

**Final scoring:**

```text
final_rank(c) = rank_by(calibrated_rerank_score(c))
```

The reranker receives the original query, chunk text, and minimal section/title context. Dense and lexical scores determine candidate recall but do not masquerade as cross-encoder scores. Exact priority hits retain their exact label and may be reranked only within their priority band. Reranker score floors are calibrated independently from RRF floors.

### 7.5 Seed Base Profiles

These values are shadow-mode starting points, not universal production constants.

| Profile | Dense K | Lexical K | Fusion K | Rerank K | Context N | Lexical RRF weight | Dense RRF weight | Max per document |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| `PRECISION` | 256 | 128 | 96 | 60 | 5 | 1.25 | 1.00 | 2 |
| `BALANCED` | 512 | 256 | 160 | 100 | 8 | 1.00 | 1.00 | 3 |
| `RECALL` | 1024 | 512 | 256 | 150 | 12 | 0.90 | 1.10 | 3 |
| `NONE` | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |

### 7.6 Modifier Adjustments

#### LEXICAL

- Double `lexical_candidate_k`, capped at 1024.
- Increase `lexical_rrf_weight` by `0.50`, capped at `2.0`.
- Enable configured identifier normalization and an independent exact-identifier list.
- Do not lower the final floor solely because an identifier exists.

#### EXACT

- Run exact locator search in parallel with hierarchical routing.
- Use exact hits as mandatory dataset inclusions.
- Use the remaining profile for fuzzy fallback.
- Do not convert exact-locator confidence into a hybrid score.

#### MULTI_EVIDENCE

- Require at least three evidence chunks when available.
- Enforce document and dataset diversity.
- Enable one bounded routing escalation when evidence is insufficient.
- Apply a per-document cap before context assembly.

#### NEIGHBOR_EXPANSION

- Retrieve ranked anchor chunks normally.
- Fetch previous, next, parent, or section-heading chunks after ranking.
- Charge expanded chunks against `max_context_tokens`, not `context_top_n`.
- Preserve document order in the assembled context.

#### LEXICAL_EXPANSION

- Use only tenant-approved aliases, glossary entries, acronyms, and product names.
- Add at most eight variants and 128 total expanded tokens.
- Record every expansion in the decision trace.
- Never let a generated expansion become a server authorization filter.

#### TEMPORAL

- Use `effective_from`, `effective_to`, `is_current`, and `source_updated_at` when present.
- Apply a hard range only for explicit user dates or a validated `is_current` contract.
- Otherwise apply a soft recency preference and retain older contradictory evidence.

#### TABLE_AWARE

- Add `chunk_kind: table|table_row` as a preference, not an unconditional filter.
- Search `table_headers`, `table_text`, and normalized value fields.
- Fetch the associated table header and row context for selected anchors.

#### DECOMPOSE

- Execute at most three independent subqueries.
- Reserve a minimum candidate quota per subquery before global fusion.
- Require coverage for each comparison side before declaring evidence sufficient.

#### MULTI_HOP and ENTITY_CARRYOVER

- Use the limits in Section 6.10.
- Carry only entities supported by selected evidence.
- Preserve hop-specific candidate and citation groups in the response.

#### CROSS_LINGUAL

- Prefer a retrieval pool whose query embedding model is multilingual and compatible with the indexed vectors.
- Add at most two approved translated lexical variants when the selected source languages differ from the query language.
- Fuse each translated lexical list through RRF; never add translation-model scores to retrieval scores.
- Preserve the original query and source text and record language, translation model, target language, and variant hash.
- On translation failure, use the calibrated multilingual dense and `und` lexical paths when available.
- Never translate identifiers, code spans, URLs, or authorization filters.

### 7.7 Score Floors

Seed floors may be used only in shadow mode:

| Path | Precision | Balanced | Recall |
|---|---:|---:|---:|
| Weighted RRF, two lists with `rrf_k=60` | 0.018 | 0.014 | 0.010 |
| Reranker | 0.25 | 0.20 | 0.15 |

Production floors require a calibration report. Changing the number of fused lists, an RRF weight, `rrf_k`, embedding model, lexical engine, language analyzer, lexical-field map, translation variant policy, reranker, fusion formula, or score normalization invalidates the relevant calibration version.

### 7.8 Empty-Result Retry

At most one retrieval retry is allowed:

1. If no candidates were generated, expand dense and lexical candidate counts by 2x.
2. If candidates existed but were filtered by the RRF or reranker floor, use the profile's calibrated low-recall floor.
3. Do not lower an exact-match confidence threshold.
4. Do not retry `NONE`.
5. Record the retry reason and parameter delta.

### 7.9 Reranker Activation

`rerank_mode` is resolved before candidate execution:

1. `off` always uses the calibrated RRF path.
2. `on` requires the configured reranker and returns `DEPENDENCY_ERROR` when it cannot run.
3. `auto` enables reranking only when the selected profile enables it, the circuit breaker is closed, at least `rerank_min_candidates` survive fusion, and the remaining deadline exceeds `rerank_timeout_ms + 100`.
4. `auto` skips reranking when an authorized unique exact hit already satisfies a precision lookup.
5. Any skip records its reason: `request_off`, `profile_off`, `exact_sufficient`, `too_few_candidates`, `deadline`, or `circuit_open`.

Reranker activation changes the score path, score floor, calibration ID, candidate cap, and expected latency as one atomic plan decision.

### 7.10 Reranker Circuit Breaker

The reranker circuit breaker opens on configured timeout or error-rate thresholds.

When open:

- Use the profile's complete non-reranked scoring configuration.
- Apply the non-reranked calibration version and score floor.
- Do not reuse the reranked threshold.
- Record `degraded_mode: "no_rerank"`.

---

## 8. Hierarchical Routing

> **Adaptive mechanism covered:** Adapts authorized project, dataset, physical-index, embedding-model, lexical-schema, and search-group selection to deployment scale and evidence sufficiency.

### 8.1 Routing Hierarchy

Routing has four levels:

```text
L0: authorization and explicit scope
L1: project catalog routing
L2: dataset catalog routing
L3: full chunk retrieval in selected datasets
```

Document and chunk counts do not affect L1 and L2 search complexity. The router searches compact project and dataset catalog entries.

The router addresses two independent scale axes:

| Deployment shape | Required behavior |
|---|---|
| Few datasets with millions of chunks each | Bypass broad dataset ranking when scope is explicit and run filtered ANN plus BM25 in the target retrieval pool. |
| Thousands of small or medium datasets | Route through compact catalogs, then search selected dataset IDs together with a `terms` filter. |
| Thousands of datasets and very large chunk volume | Route hierarchically, group selected datasets by retrieval pool and embedding model, and issue one bounded `_msearch`. |
| Explicit authorized dataset IDs | Make them mandatory and bypass ranking for those IDs. |

The executor never sends one OpenSearch request per dataset unless each selected dataset is intentionally stored in a separate physical index. It sends one lexical and one dense search per compatible search group.

### 8.2 L0 - Scope Resolution

The scope resolver applies:

1. Tenant boundary.
2. User and service-account ACLs.
3. Explicit project IDs.
4. Explicit dataset IDs.
5. Request metadata filters.
6. Dataset health and lifecycle state.

Explicit authorized dataset IDs bypass project and dataset ranking and become mandatory inclusions.

The scope resolver returns:

```json
{
  "tenant_id": "tenant-a",
  "eligible_project_ids": ["p1", "p2"],
  "eligible_dataset_count": 1842,
  "mandatory_dataset_ids": ["d-explicit"],
  "scope_policy_version": "scope-17"
}
```

### 8.3 Project Catalog

Each project catalog entry contains:

- Project ID and tenant ID.
- Name, description, tags, and configured aliases.
- One or more router-space centroid embeddings.
- Top lexical terms.
- Dataset count.
- Last indexed time.
- ACL partition key.

The project router uses a dedicated, globally consistent routing embedding model. It does not depend on each dataset's content embedding model.

### 8.4 Dataset Catalog

Each dataset catalog entry contains:

- Dataset ID, project ID, and tenant ID.
- Name, description, tags, aliases, and business-domain labels.
- One to eight router-space centroid embeddings.
- Top lexical terms and configured identifier prefixes.
- Document and chunk counts.
- Content time range when available.
- Underlying retrieval engine and embedding model IDs.
- Physical chunk index or alias.
- Optional OpenSearch routing key.
- Vector field name, vector dimension, and distance space.
- Content-language set and lexical-schema ID.
- Catalog freshness timestamp.
- Health state.

Large or heterogeneous datasets may publish multiple centroids. Centroids are routing summaries, not replacements for chunk retrieval.

### 8.5 Catalog Read Contract

Catalog production and refresh are upstream responsibilities. Retrieval requires:

- An immutable catalog snapshot version for the duration of a request.
- `active` and `healthy` flags.
- A freshness timestamp.
- Physical-index, routing-key, and embedding-model compatibility fields.
- Tenant, project, dataset, and ACL partition fields that can be filtered before scoring.

When catalog age exceeds `max_age_hours`, retrieval uses the last healthy snapshot only if policy permits and emits `catalog_stale`. It does not refresh or repair the catalog.

### 8.6 Router Scoring

Project and dataset router scores use:

```text
route_score =
    0.55 * calibrated_router_dense_score
  + 0.30 * calibrated_router_lexical_score
  + 0.15 * metadata_match_score
```

The weights are seed values and require routing evaluation before production activation.

Historical hit rate is telemetry only in v2. It does not affect routing rank, avoiding popularity feedback loops and cold-start suppression.

### 8.7 Dynamic Selection Budgets

Default budgets:

| Level | Initial selection | Minimum | Maximum after escalation |
|---|---:|---:|---:|
| Projects | 3 | 1 | 8 |
| Datasets per selected project | 8 | 4 | 32 |
| Total fully searched datasets | 16 | 4 | 64 |
| Physical search groups | 4 | 1 | 8 |

Selection may stop below the initial limit when:

- The next route score is below the calibrated routing floor.
- The score margin after the last selected item is sufficiently large.
- All mandatory inclusions have been added.

Mandatory inclusions do not consume the minimum selection count but do consume the hard maximum unless the caller explicitly requests otherwise.

If mandatory datasets exceed a physical-group cap, explicit authorized scope wins, but the request must still obey the total deadline and report partial coverage. The service never silently drops a caller's explicit authorized dataset.

### 8.8 Physical Search Planning

After dataset selection, group datasets by:

```text
cluster_id
+ physical_index_or_alias
+ embedding_model_id
+ vector_field
+ vector_dimension
+ distance_space
+ lexical_schema_id
+ routing_policy
```

For each group:

1. Generate or reuse the query vector matching that group's embedding model.
2. Resolve lexical fields for the detected analysis languages and the group's lexical schema.
3. Build one trusted filter containing tenant, selected project IDs, selected dataset IDs, ACL principals, lifecycle state, and allowed client metadata filters.
4. Put the filter inside the k-NN clause for efficient filtered ANN when the index uses a supported Lucene or Faiss engine.
5. Reuse the same trusted filter in the lexical Boolean query.
6. Add one dense and one lexical request to `_msearch`.
7. Set per-search `cancel_after_time_interval`, result size, `_source` allow-list, and optional routing key.
8. Parse every `_msearch` response independently and mark shard failures or timeouts as partial coverage.

The executor caps physical groups, concurrent OpenSearch requests, concurrent shard requests, candidates per group, and total elapsed time. It never targets an unspecified wildcard or all indexes.

Detected language selects rule packs and lexical fields but is not a hard chunk filter by default. Hard filtering on `language` is allowed only when the caller explicitly requests source language and authorization policy permits it; otherwise cross-lingual evidence remains eligible.

### 8.9 Exact Locator Shortcut

For `EXACT` queries:

1. Search the exact locator index across the authorized scope.
2. Add datasets containing high-confidence phrase or n-gram hits as mandatory inclusions.
3. Skip catalog ranking when locator confidence is high and all hits fit within the dataset budget.
4. Run catalog routing in parallel for fuzzy fallback or ambiguous repeated text.

This provides broad exact-text coverage without sending a full retrieval request to every dataset.

### 8.10 Routing Wave 1

Wave 1:

1. Select projects.
2. Select datasets within those projects.
3. Add mandatory datasets from explicit scope, identifiers, and exact locator hits.
4. Compare detected query languages with selected dataset content languages and add `CROSS_LINGUAL` when required.
5. Group datasets by physical index, lexical schema, routing policy, and embedding-model compatibility.
6. Execute grouped `_msearch` retrieval with bounded concurrency and a shared deadline.
7. Fuse candidates globally.
8. Evaluate evidence sufficiency.

### 8.11 Evidence Sufficiency

Wave 1 is insufficient when any configured condition is true:

- No result survives the applicable score floor.
- Fewer than `min(context_top_n, 3)` chunks survive.
- `MULTI_EVIDENCE` has fewer than three evidence chunks.
- `MULTI_EVIDENCE` results come from only one dataset when multiple selected datasets produced candidates.
- `DECOMPOSE` has no qualifying evidence for one or more required comparison sides.
- `MULTI_HOP` has an unresolved dependency and enough deadline remains for the next bounded hop.
- The top score is below the calibrated sufficiency floor.
- More than 25% of selected search groups or shards failed or timed out.

### 8.12 Routing Escalation

At most one synchronous escalation is allowed:

- Expand to the next project and dataset candidates up to the configured maxima.
- Do not rerun datasets completed in Wave 1.
- Preserve mandatory inclusions.
- Use the remaining request deadline.
- Stop when the total fully searched dataset cap is reached.

If results remain insufficient, return an honest no-result or partial-coverage outcome. The system does not fan out to every eligible dataset.

### 8.13 Auditable Routing

Per-query telemetry stores:

- Scope policy and authorized-scope count.
- Project and dataset catalog versions.
- Router model and calibration versions.
- Selected projects and datasets with scores and reasons.
- Mandatory inclusions and their reasons.
- Selection floors, margins, and budgets.
- Escalation decision.
- Failed and timed-out datasets.
- Physical search groups, targeted indexes, query-vector model IDs, and shard-failure counts.
- Decomposition queries, hop dependencies, and grounded carryover entities.
- A normalized query hash rather than raw pasted text.

The full list of thousands of non-selected datasets is not copied into every request log. The decision is reconstructable from:

```text
query hash + normalized routing features + scope policy version
+ catalog snapshot version + router version + selection policy
```

### 8.14 Routing Quality Metric

For each labeled query, let `RelevantDatasets(q)` be datasets containing judged relevant evidence and `SelectedDatasets(q)` be datasets fully searched by the router.

```text
Routing Recall@M =
  |RelevantDatasets(q) intersect SelectedDatasets(q)|
  / |RelevantDatasets(q)|
```

Production acceptance requires:

- Overall `Routing Recall@M >= 99.5%`.
- No critical project or tenant slice below 98%.
- Separate reporting for new datasets less than seven days old.

### 8.15 OpenSearch Read Contract

Retrieval assumes the following logical fields. Physical names may differ behind a validated adapter, but their semantics may not.

#### Chunk document

| Field | OpenSearch type | Required | Retrieval use |
|---|---|---:|---|
| `chunk_id` | `keyword` | Yes | Stable global deduplication key. |
| `tenant_id` | `keyword` | Yes | Mandatory trusted filter. |
| `project_id` | `keyword` | Yes | Scope and diversity. |
| `dataset_id` | `keyword` | Yes | Scope, routing, and diversity. |
| `document_id` | `keyword` | Yes | Deduplication, caps, and citation. |
| `visibility` | `keyword` | Yes | `public` or `restricted`. |
| `acl_principals` | `keyword` | Yes | User, team, role, or service-principal filter. |
| `lifecycle_state` | `keyword` | Yes | Exclude deleted, quarantined, and inactive chunks. |
| `language` | `keyword` | Recommended | BCP 47 source language used for lexical-field selection and cross-lingual telemetry. |
| `text.<language>` | `text` | Yes for supported lexical languages | Language-analyzed BM25 field. |
| `text.universal` | `text` | Recommended | Language-neutral lexical fallback for `und` and unsupported languages. |
| `text` | stored or `text` | Yes | Returned source evidence; it may also be the universal lexical field. |
| `title` | `text` plus `keyword` subfield | Recommended | Boosted lexical search and citation. |
| `section` | `text` plus `keyword` subfield | Recommended | Boosted lexical search and citation. |
| `identifiers` | `keyword` | Recommended | Exact ticket, order, invoice, error, and document IDs. |
| `embedding` | `knn_vector` | Yes | Dense ANN retrieval. |
| `embedding_model_id` | `keyword` | Yes | Query-vector compatibility check. |
| `sequence` | `integer` | Recommended | Neighbor ordering. |
| `previous_chunk_id` | `keyword` | Optional | Neighbor expansion. |
| `next_chunk_id` | `keyword` | Optional | Neighbor expansion. |
| `parent_chunk_id` | `keyword` | Optional | Parent or section expansion. |
| `chunk_kind` | `keyword` | Recommended | `text`, `heading`, `table`, or `table_row`. |
| `table_headers` | `text` | Optional | Table-aware lexical retrieval. |
| `table_text` | `text` | Optional | Table-aware lexical retrieval. |
| `effective_from` | `date` | Optional | Temporal filtering. |
| `effective_to` | `date` | Optional | Temporal filtering. |
| `is_current` | `boolean` | Optional | Validated current-policy filter. |
| `source_updated_at` | `date` | Recommended | Recency preference and citation. |
| `content_hash` | `keyword` | Recommended | Exact duplicate removal. |
| `source` | `object` | Yes | URI, file name, page, section, and display metadata. |

An example compatible vector mapping is shown only to make the read contract precise; the retrieval service does not create it:

```json
{
  "settings": {
    "index.knn": true
  },
  "mappings": {
    "dynamic": "strict",
    "properties": {
      "tenant_id": { "type": "keyword" },
      "project_id": { "type": "keyword" },
      "dataset_id": { "type": "keyword" },
      "acl_principals": { "type": "keyword" },
      "lifecycle_state": { "type": "keyword" },
      "language": { "type": "keyword" },
      "text": {
        "type": "text",
        "fields": {
          "en": { "type": "text", "analyzer": "english" },
          "vi": { "type": "text", "analyzer": "standard" },
          "ja": { "type": "text", "analyzer": "kuromoji" },
          "universal": { "type": "text", "analyzer": "standard" }
        }
      },
      "identifiers": { "type": "keyword" },
      "embedding_model_id": { "type": "keyword" },
      "embedding": {
        "type": "knn_vector",
        "dimension": 1536,
        "space_type": "cosinesimil",
        "method": {
          "name": "hnsw",
          "engine": "lucene",
          "parameters": {
            "m": 16,
            "ef_construction": 128
          }
        }
      }
    }
  }
}
```

The dimension and model ID are deployment values, not universal defaults. A retrieval pool cannot mix incompatible dimensions or embedding models in the same vector field.

The language subfields are illustrative. Upstream mappings must use analyzers installed on the target cluster, and retrieval must query the same mapped fields so query-time and index-time analysis remain compatible. Japanese `kuromoji` and ICU-based analyzers require the corresponding OpenSearch analysis plugins.

#### Dataset catalog document

The dataset catalog must expose:

- Tenant, project, dataset, visibility, ACL, health, and lifecycle fields.
- Name, description, aliases, glossary terms, identifier prefixes, and domain tags.
- BCP 47 content languages and supported lexical-field names.
- One or more router-space centroid vectors.
- `cluster_id`, `physical_index`, optional `routing_key`, `embedding_model_id`, `vector_field`, `vector_dimension`, and `distance_space`.
- Document and chunk counts, source time range, and catalog freshness.

#### Project catalog document

The project catalog must expose tenant, project, ACL, language-tagged name/description/aliases, domain tags, router-space centroids, dataset count, supported content languages, and freshness.

Catalog vectors use one globally consistent multilingual routing model. Chunk retrieval pools may use different application-generated embedding models, but the executor must generate a compatible query vector for each selected search group. Cross-lingual retrieval requires a compatible multilingual embedding model or an approved bounded query-translation path.

#### Trusted filter shape

Every lexical and dense chunk search includes a filter equivalent to:

```json
{
  "bool": {
    "filter": [
      { "term": { "tenant_id": "tenant-a" } },
      { "terms": { "project_id": ["project-a"] } },
      { "terms": { "dataset_id": ["dataset-7", "dataset-11"] } },
      { "term": { "lifecycle_state": "active" } },
      {
        "bool": {
          "should": [
            { "term": { "visibility": "public" } },
            { "terms": { "acl_principals": ["user:u-1", "team:t-2"] } }
          ],
          "minimum_should_match": 1
        }
      }
    ]
  }
}
```

The server builds this object from trusted identity and resolved scope. User input never supplies raw Query DSL.

---

## 9. Exact and Verbatim Retrieval

> **Adaptive mechanism covered:** Switches quoted or pasted text to exact-location search while retaining fuzzy and cross-lingual fallback paths.

### 9.1 Required Indexed Fields

The upstream indexing system must make the following fields searchable when exact retrieval is enabled:

- Unicode-normalized source text.
- Language-tagged normalized token streams for configured lexical analyzers.
- Positional term index for phrase search.
- Character 4-gram index for OCR and punctuation variation.
- Chunk adjacency and parent-section links.
- Cross-chunk windows spanning the end of one chunk and start of the next.
- Dataset, document, page, section, and chunk provenance.

These fields may live in a separate exact locator index or in the chunk retrieval pool. Their production is outside this specification. Retrieval treats a missing optional field as an unavailable capability and records the degradation.

### 9.2 Query Normalization

Normalize pasted text with:

- Unicode NFKC.
- Case folding.
- Whitespace collapsing.
- Smart quote normalization.
- Dash and hyphen normalization.
- Line-break dehyphenation.
- Optional removal of repeated page-header or footer text only when the request parser can identify it without document access.

Original query text is preserved for display and audit-safe hashing.

### 9.3 Paste and Question Separation

The analyzer separates:

- `pasted_content`
- Optional `user_question`

Rules prefer explicit quotes, separators, paragraph boundaries, and a short leading or trailing interrogative sentence. If separation is uncertain, the entire input remains available to fuzzy retrieval and only high-confidence spans enter phrase search.

### 9.4 Exact Locator Search

1. Select two to four 8-15-token shingles with the highest catalog IDF.
2. Run positional phrase queries.
3. Run cross-chunk phrase queries.
4. If phrase search misses, run character 4-gram retrieval with an edit-distance ceiling.
5. Return dataset, document, chunk, page, section, match span, and match confidence.

### 9.5 Exact Hit Policy

- Unique, high-confidence phrase hits enter the exact priority band.
- Repeated boilerplate returns every qualifying provenance within the result cap.
- Repeated matches are never described as a unique source.
- Exact hits are deduplicated by normalized span and document provenance.
- Fuzzy semantic results follow exact hits but remain labeled separately.

### 9.6 Fuzzy Fallback

Fuzzy fallback uses the selected base profile:

- `PRECISION + EXACT` for source lookup.
- `RECALL + EXACT + MULTI_EVIDENCE` for summary or analysis of pasted content.

Unlike v1, fuzzy fallback is not forced to near-pure lexical scoring. Dense retrieval remains available to handle OCR changes, paraphrases, partial edits, and cross-lingual matches when the retrieval pool uses a compatible multilingual embedding model.

### 9.7 Miss Handling

If no exact or qualified fuzzy result is found:

- Return `found: false`.
- Do not invent a source.
- Include partial-coverage and failed-dataset information.
- Optionally return nearest fuzzy results labeled `similar_not_exact`.

---

## 10. Candidate Fusion and Context Assembly

> **Adaptive mechanism covered:** Adapts cross-group fusion, deduplication, diversity, neighbor expansion, multi-hop evidence preservation, and context trimming.

### 10.1 Per-Group and Per-Dataset Candidate Quotas

Each physical search group returns at most `fusion_candidate_k` candidates after RRF. The global pool applies:

- A hard `rerank_candidate_k` cap when reranking is enabled.
- A hard `global_candidate_k` cap when reranking is disabled.
- A minimum quota for mandatory datasets.
- A maximum quota per dataset to prevent one large dataset from monopolizing the pool.
- A minimum qualifying quota for each `DECOMPOSE` side or completed multi-hop step.

### 10.2 Cross-Dataset Merge

The system does not min-max or z-score each result list independently. Those methods can make the best result from an irrelevant dataset appear globally strong.

Use one of:

1. Application-side weighted Reciprocal Rank Fusion as the portable default.
2. OpenSearch score-ranker RRF when the deployment is pinned to a compatible search pipeline.
3. Calibrated global scores only when an evaluation proves compatibility.
4. Global cross-encoder reranking over quota-balanced fused candidates.

### 10.3 Deduplication

Deduplication runs in this order:

1. Exact normalized content hash.
2. Normalized token hash.
3. MinHash-estimated Jaccard similarity for near duplicates.

Near-duplicate removal preserves every provenance record. Multiple documents containing the same text remain visible as alternate sources.

### 10.4 Diversity

`MULTI_EVIDENCE` applies:

- Dataset cap.
- Document cap.
- Optional MMR after reranking.
- Coverage preference for distinct sections or source documents.

Relevance remains the primary signal; diversity cannot promote candidates below the applicable score floor.

### 10.5 Neighbor Expansion

Neighbor expansion occurs after ranking:

- Anchors retain their retrieval score and citation identity.
- Adjacent chunks are marked `expanded_context: true`.
- Expanded chunks do not count as independent evidence.
- Context is ordered by document and source position.

### 10.6 Context Budget

Default budgets:

| Profile | Maximum context tokens |
|---|---:|
| `PRECISION` | 4,000 |
| `BALANCED` | 8,000 |
| `RECALL` | 12,000 |
| `NONE` | 0 |

The assembler trims lowest-value non-exact chunks first. It never truncates provenance metadata or silently remove all evidence for a selected source.

For `DECOMPOSE`, the assembler preserves at least one qualifying evidence group per required side before adding lower-value duplicates. For `MULTI_HOP`, it preserves the evidence chain linking each grounded carryover entity to the next hop.

---

## 11. Knowledge-Graph Retrieval

> **Adaptive mechanism covered:** Optionally activates graph retrieval only for explicit or calibrated relationship queries and safely falls back to text retrieval.

Knowledge-graph retrieval is optional and separately gated because it may require LLM-based entity extraction and adds latency.

It runs only when:

- The request explicitly enables it, or
- A calibrated analytical rule enables it for a project with a healthy graph index.

KG candidates:

- Have a separate candidate quota.
- Carry graph provenance.
- Are globally reranked with text candidates when compatible.
- Never bypass tenant, project, or dataset authorization.

KG retrieval failure does not fail normal text retrieval.

---

## 12. Configuration

> **Adaptive mechanism covered:** Makes rules, language packs, models, budgets, floors, routing limits, and fallbacks versioned, validated, atomic, and reversible.

### 12.1 Example

```yaml
adaptive_rag:
  version: "2.0.0"

  languages:
    supported: ["en", "vi", "ja"]
    default: "en"
    detector_id: "private-language-detector-v1"
    confidence_min: 0.80
    short_query_confidence_min: 0.95
    mixed_language_score_min: 0.55
    max_analysis_languages: 2
    unknown_language: "und"
    lexical_fields:
      en: ["title.en^3", "section.en^2", "table_headers.en^2", "table_text.en^1.5", "text.en"]
      vi: ["title.vi^3", "section.vi^2", "table_headers.vi^2", "table_text.vi^1.5", "text.vi"]
      ja: ["title.ja^3", "section.ja^2", "table_headers.ja^2", "table_text.ja^1.5", "text.ja"]
      und: ["title.universal^3", "section.universal^2", "table_headers.universal^2", "table_text.universal^1.5", "text.universal"]
    cross_lingual:
      enabled: true
      max_translated_variants: 2
      translation_timeout_ms: 400
      dense_only_on_translation_failure: true

  analyzer:
    rule_confidence_min: 0.82
    llm_fallback:
      enabled: true
      timeout_ms: 800
      cache_ttl_hours: 24

  request:
    max_query_characters: 8000
    max_explicit_project_ids: 64
    max_explicit_dataset_ids: 256

  profiles:
    PRECISION:
      dense_candidate_k: 256
      lexical_candidate_k: 128
      fusion_candidate_k: 96
      global_candidate_k: 120
      rerank_candidate_k: 60
      context_top_n: 5
      max_context_tokens: 4000
      max_per_document: 2
      no_rerank:
        rrf_k: 60
        lexical_rrf_weight: 1.25
        dense_rrf_weight: 1.00
        exact_rrf_weight: 1.50
        score_floor: 0.018
        calibration_id: "rrf-precision-v1"
      rerank:
        enabled: true
        min_candidates: 10
        timeout_ms: 800
        score_floor: 0.25
        calibration_id: "rerank-precision-v1"

    BALANCED:
      dense_candidate_k: 512
      lexical_candidate_k: 256
      fusion_candidate_k: 160
      global_candidate_k: 240
      rerank_candidate_k: 100
      context_top_n: 8
      max_context_tokens: 8000
      max_per_document: 3
      no_rerank:
        rrf_k: 60
        lexical_rrf_weight: 1.00
        dense_rrf_weight: 1.00
        exact_rrf_weight: 1.50
        score_floor: 0.014
        calibration_id: "rrf-balanced-v1"
      rerank:
        enabled: true
        min_candidates: 20
        timeout_ms: 800
        score_floor: 0.20
        calibration_id: "rerank-balanced-v1"

    RECALL:
      dense_candidate_k: 1024
      lexical_candidate_k: 512
      fusion_candidate_k: 256
      global_candidate_k: 400
      rerank_candidate_k: 150
      context_top_n: 12
      max_context_tokens: 12000
      max_per_document: 3
      no_rerank:
        rrf_k: 60
        lexical_rrf_weight: 0.90
        dense_rrf_weight: 1.10
        exact_rrf_weight: 1.50
        score_floor: 0.010
        calibration_id: "rrf-recall-v1"
      rerank:
        enabled: true
        min_candidates: 30
        timeout_ms: 1000
        score_floor: 0.15
        calibration_id: "rerank-recall-v1"

  routing:
    project:
      initial_top_m: 3
      max_top_m: 8
    dataset:
      initial_per_project_top_m: 8
      max_per_project_top_m: 32
      initial_total_limit: 16
      hard_total_limit: 64
    search_groups:
      initial_limit: 4
      hard_limit: 8
    escalation:
      enabled: true
      max_waves: 2
    catalog:
      max_age_hours: 24
      dense_weight: 0.55
      lexical_weight: 0.30
      metadata_weight: 0.15

  exact_locator:
    enabled: true
    shingle_count: 4
    shingle_token_min: 8
    shingle_token_max: 15
    character_ngram_size: 4
    cross_chunk_windows: true

  execution:
    max_opensearch_requests: 2
    max_concurrent_searches: 8
    max_concurrent_shard_requests: 5
    search_timeout_ms: 900
    min_remaining_for_next_hop_ms: 250
    total_timeout_ms:
      no_rerank: 1500
      rerank: 3000
      multi_hop: 5000

  multi_hop:
    max_hops: 3
    max_subqueries_per_hop: 3
    max_entities_per_hop: 8
    max_query_characters: 128

  opensearch:
    project_catalog_alias: "rag-projects-read"
    dataset_catalog_alias: "rag-datasets-read"
    exact_locator_alias: "rag-exact-read"
    source_fields:
      - "chunk_id"
      - "tenant_id"
      - "project_id"
      - "dataset_id"
      - "document_id"
      - "language"
      - "text"
      - "title"
      - "section"
      - "sequence"
      - "source"

  telemetry:
    raw_query_logging: false
    decision_retention_days: 30
```

### 12.2 Validation

Configuration reload is atomic:

1. Parse and schema-validate the new version.
2. Verify the language detector, BCP 47 tags, language packs, and lexical-field maps.
3. Verify every referenced calibration, embedding, translation, and rerank model ID.
4. Verify all weights and candidate limits.
5. Run deterministic configuration smoke tests in every supported language.
6. Activate the entire version or retain the last known-good version.

No request may combine fields from two configuration versions.

---

## 13. Internal API

> **Adaptive mechanism covered:** Exposes adaptive inputs that may narrow behavior and returns the complete plan, language, route, hop, score, coverage, and timing decision.

### 13.1 Request

```http
POST /v2/adaptive-retrieve
```

```json
{
  "query": "Why did incident E-4402 occur?",
  "language_hint": null,
  "project_ids": ["project-a"],
  "dataset_ids": null,
  "metadata_filters": null,
  "as_of": null,
  "rerank_mode": "auto",
  "max_hops": 3,
  "use_knowledge_graph": false,
  "trace": true
}
```

`tenant_id`, user ID, team IDs, service-account principals, and ACL grants come from trusted authentication middleware. They are not accepted from this JSON body.

`rerank_mode` values:

- `auto`: Use profile configuration and circuit-breaker state.
- `on`: Require reranking; fail explicitly if unavailable.
- `off`: Use the calibrated non-reranked path.

`max_hops` may narrow the configured maximum but cannot raise it. Client metadata filters are matched against an allow-list and can only narrow the server-resolved scope.

`language_hint` is an optional BCP 47 hint used only as described in Section 6.1. Retrieval still detects language unless trusted tenant policy makes the hint authoritative.

### 13.2 Response

```json
{
  "status": "FOUND",
  "found": true,
  "coverage_incomplete": false,
  "chunks": [
    {
      "id": "chunk-1",
      "dataset_id": "dataset-7",
      "project_id": "project-a",
      "document_id": "document-3",
      "text": "...",
      "score": 0.84,
      "score_type": "rerank",
      "exact_match": false,
      "expanded_context": false,
      "source": {
        "document_name": "Incident Report E-4402",
        "page": 4,
        "section": "Root Cause"
      }
    }
  ],
  "decision": {
    "base_profile": "RECALL",
    "modifiers": ["LEXICAL", "MULTI_EVIDENCE", "MULTI_HOP"],
    "language": {
      "primary": "en",
      "confidence": 0.98,
      "source": "detector",
      "mixed": false,
      "analysis_languages": ["en"]
    },
    "classifier": "rule:R03+R10",
    "scoring_path": "reranked",
    "config_version": "2.0.0",
    "calibration_id": "rerank-recall-v1",
    "routing": {
      "scope_policy_version": "scope-17",
      "project_catalog_version": "pc-204",
      "dataset_catalog_version": "dc-981",
      "eligible_project_count": 12,
      "eligible_dataset_count": 1842,
      "selected_projects": ["project-a"],
      "selected_datasets": ["dataset-7", "dataset-11"],
      "mandatory_datasets": [],
      "search_groups": [
        {
          "index": "rag-chunks-ada-1536",
          "embedding_model_id": "text-embedding-v3",
          "dataset_count": 2
        }
      ],
      "waves": 1,
      "failed_datasets": [],
      "failed_search_groups": [],
      "failed_shards": 0
    },
    "hops": [
      {
        "hop": 1,
        "query_hash": "hmac:...",
        "depends_on": [],
        "evidence_chunk_ids": ["chunk-1"],
        "complete": true
      }
    ],
    "timings_ms": {
      "analyze": 3,
      "scope": 8,
      "route": 41,
      "retrieve": 620,
      "rerank": 310,
      "assemble": 12,
      "total": 994
    }
  }
}
```

`status` values:

- `FOUND`: sufficient qualifying evidence.
- `PARTIAL`: useful evidence exists but routing, shards, or multi-hop dependencies are incomplete.
- `INSUFFICIENT_EVIDENCE`: bounded retrieval completed without enough qualifying evidence.
- `NO_RETRIEVAL`: the high-precision `NONE` rule selected no retrieval.
- `DEPENDENCY_ERROR`: a required embedding or OpenSearch dependency failed and no safe fallback exists.
- `FORBIDDEN`: trusted scope resolution denied the requested explicit scope; no search was executed.

---

## 14. Observability and Privacy

> **Adaptive mechanism covered:** Supplies the feedback signals used to calibrate adaptive rules and budgets while protecting enterprise queries and unauthorized scope.

### 14.1 Metrics

Record:

- Primary, mixed, and undetermined language distributions.
- Detector confidence, per-language confusion, hint disagreements, and language-pack version.
- Language-specific rule accuracy and cross-lingual fallback rates.
- Rules-only and LLM-fallback rates.
- Base profile and modifier distributions.
- Classification quality by rule.
- Project and dataset `Routing Recall@M`.
- Selected dataset, physical search-group, targeted-index, and shard counts.
- Escalation rate and benefit.
- Candidate counts at each stage.
- Retrieval Recall@K, MRR, and nDCG.
- Exact top-3 source rate.
- Reranker usage, latency, timeout, and circuit-breaker state.
- Context diversity and duplicate removal.
- Partial-coverage and shard-failure rates.
- Query-family accuracy and per-family evidence coverage.
- Decomposition side coverage, hops attempted, grounded entities carried, repeated-hop stops, unresolved hops, and multi-hop completion.
- Latency and infrastructure cost per profile and scoring path.

### 14.2 Query Privacy

- Raw queries and pasted content are not logged by default.
- Query hashes use a tenant-specific keyed hash.
- Debug logging of raw content requires an explicit short-lived permission.
- Classifier cache entries are tenant-scoped.
- Telemetry never includes unauthorized dataset names or IDs.

### 14.3 Offline Evaluation

The evaluation set includes:

- Parallel query sets in every supported language.
- Mixed-language queries, short queries, identifier-only queries, and code-heavy queries.
- Cross-lingual questions where query and source languages differ.
- Queries in unsupported languages that must use `und` lexical or dense-only fallback.
- Precision lookups.
- Identifiers and search-style keyword queries.
- Procedures spanning adjacent chunks.
- Broad summaries and comparisons.
- Analytical multi-evidence questions.
- Current-policy and as-of-date questions with conflicting versions.
- Tables, rows, headers, units, and numeric-value lookups.
- Cross-project questions with many irrelevant datasets.
- Independent comparisons and compound questions.
- Two-hop and three-hop dependency questions with evidence-backed carryover entities.
- Adversarial multi-hop plans that attempt to expand scope or reuse ungrounded entities.
- Exact fragments within one chunk.
- Exact fragments spanning chunk boundaries.
- OCR and punctuation variations.
- Repeated boilerplate across documents.
- Queries where the relevant dataset is newly created or rarely used.

### 14.4 Adaptive Control Loop

Runtime requests do not train or mutate the mechanism. Adaptation across releases uses this controlled loop:

1. Collect sanitized decision, latency, coverage, and outcome telemetry.
2. Add sampled failures and regressions to versioned labeled evaluation sets.
3. Propose one versioned change to a rule pack, profile, budget, routing threshold, lexical map, RRF policy, or model reference.
4. Run all affected language, tenant, scale, and query-family slices offline.
5. Reject any change that misses a security, recall, latency, or critical-slice gate.
6. Run the surviving configuration in shadow mode.
7. Canary it for explicitly selected tenants.
8. Activate atomically or restore the last known-good version.

The loop never writes production configuration directly from user clicks, model output, or raw relevance feedback.

---

## 15. Failure Modes

> **Adaptive mechanism covered:** Defines how the mechanism adapts to uncertainty, unavailable models, stale catalogs, timeouts, partial shards, and insufficient evidence.

| Failure | Required behavior |
|---|---|
| Rule analyzer uncertain | Use LLM fallback, then `BALANCED` on failure. |
| Language detector unavailable | Use a trusted hint when present; otherwise use `und`, language-neutral rules, and multilingual dense retrieval. |
| Language detector confidence below threshold | Use `und` or a qualified hint; do not guess a language-specific analyzer. |
| Language pack unavailable | Keep language-neutral rules and use `und` lexical fields or dense-only retrieval. |
| Query/source languages differ | Add `CROSS_LINGUAL`; use a compatible multilingual vector model and optional approved translated lexical variants. |
| Cross-lingual translation fails | Continue dense-only when calibrated; otherwise return partial or dependency status without changing source text. |
| LLM classifier timeout | Use `BALANCED`; do not delay retrieval beyond 800 ms. |
| Project catalog unavailable | Use explicit project and dataset scope; otherwise use the last healthy snapshot and flag degradation. |
| Dataset catalog unavailable | Search mandatory datasets and configured project defaults only; never fan out to every dataset. |
| Catalog stale | Use the last snapshot, include recently changed mandatory entries, and flag `catalog_stale`. |
| Exact locator unavailable | Continue with fuzzy hierarchical retrieval and flag `exact_locator_unavailable`. |
| Query embedding fails | Use lexical-only retrieval only for a profile with a calibrated lexical fallback; otherwise return `DEPENDENCY_ERROR`. |
| Query-vector dimension differs from index contract | Skip the incompatible search group, flag partial coverage, and alert on catalog corruption. |
| Unauthorized explicit project or dataset | Return `FORBIDDEN`; execute no catalog or chunk search. |
| Reranker unavailable in `auto` | Use the calibrated non-reranked profile. |
| Reranker unavailable in `on` | Return an explicit dependency failure. |
| `_msearch` child or shard failure | Keep successful child results and return `PARTIAL` with authorized failure metadata. |
| More than 25% selected search groups or shards fail | Set `coverage_incomplete: true` and status `PARTIAL`. |
| Multi-hop planner fails | Run the original query once with `RECALL + MULTI_EVIDENCE`; do not invent hops. |
| Multi-hop entity extraction finds no grounded entity | Stop and return completed evidence plus unresolved hops. |
| Multi-hop deadline expires | Return completed-hop evidence with `PARTIAL`; do not start another hop. |
| Empty after one bounded relaxation | Return `INSUFFICIENT_EVIDENCE`; do not fabricate evidence. |
| Invalid config reload | Keep the last known-good version and alert. |

---

## 16. Acceptance Criteria

> **Adaptive mechanism covered:** Provides activation gates for every adaptive path so behavior changes are evidence-based rather than assumed improvements.

### 16.1 Analyzer

- Local language detection is less than 5 ms p95 and detection plus rules is less than 10 ms p95.
- At least 90% of production queries avoid classifier LLM calls.
- Base-profile macro F1 is at least 0.90.
- Each production modifier has precision and recall of at least 0.90.
- `NONE` precision is at least 0.98 to avoid incorrectly skipping retrieval.
- Supported-language detection macro F1 is at least 0.95 on queries with four or more natural-language tokens.
- Mixed-language detection F1 is at least 0.90.
- Detection, profile, and modifier metrics are reported per language; no critical language slice is more than five percentage points below the overall metric.

### 16.2 Routing

- Overall `Routing Recall@M` is at least 99.5%.
- No critical project or tenant slice is below 98%.
- Routing p95 is at most 100 ms with 10,000 eligible dataset catalog entries.
- A request fully searches no more than 64 datasets unless explicit authorized dataset IDs exceed the cap.
- New-dataset routing quality is reported separately and meets at least 98% recall.
- A query targets at most eight physical search groups unless explicit authorized scope exceeds the cap.
- The 10,000-dataset test and a separate 50-million-chunk retrieval-pool test both meet their latency and recall gates.

### 16.3 Retrieval Quality

- Each base profile matches or exceeds the static RAGFlow-style baseline on Recall@K and nDCG.
- `PRECISION` improves MRR without reducing Recall@5 by more than one percentage point.
- `RECALL + MULTI_EVIDENCE` improves relevant-source coverage over the static baseline.
- Every comparison side has qualifying evidence or the response is `PARTIAL`/`INSUFFICIENT_EVIDENCE`.
- Temporal retrieval returns the effective source in the top five and does not silently hide conflicting versions.
- Table-aware retrieval returns the qualifying row plus its header context.
- Each supported-language slice matches or exceeds its static same-language baseline.
- Cross-lingual retrieval Recall@10 is measured separately and may activate only after meeting its configured baseline gate.
- Two-hop and three-hop completion are reported separately; every carried entity has a supporting selected chunk.
- Reranked and non-reranked paths are evaluated separately.
- Reranker failure fallback does not reduce Recall@K by more than five percentage points.

### 16.4 Exact Retrieval

- Exact or near-exact source is in the top three for at least 95% of the supported verbatim suite.
- The suite includes cross-chunk spans, OCR noise, punctuation changes, and repeated boilerplate.
- Unique-source claims have at least 99% precision.
- Repeated exact text returns multiple provenance records rather than a false unique source.

### 16.5 Latency

Excluding answer generation:

- No-rerank adaptive retrieval is at most 1.5 seconds p95.
- Reranked adaptive retrieval is at most 3 seconds p95.
- Exact locator search is at most 250 ms p95.
- One escalation remains within the same total request deadline.
- Bounded multi-hop retrieval is at most 5 seconds p95 and never exceeds three hops.

### 16.6 Operations

- A validated config change takes effect within 60 seconds without redeployment.
- Every response identifies its config, router, catalog, and calibration versions.
- No request crosses tenant or project authorization boundaries.
- Retrieval performs no OpenSearch write API calls.
- Every targeted index comes from an authorized catalog entry; wildcard and implicit all-index searches are rejected.
- Invalid configuration never replaces the last known-good version.

---

## 17. Rollout Plan

> **Adaptive mechanism covered:** Activates analyzer, routing, specialized retrieval, reranking, decomposition, multi-hop, and cross-lingual behavior incrementally with rollback.

### Phase 0 - Baseline

- Build the labeled analyzer, routing, retrieval, and exact-fragment evaluation sets.
- Measure the static RAGFlow-style baseline.
- Establish score calibrations for reranked and non-reranked paths.

### Phase 1 - Analyzer and Profiles

- Run language detection, language-pack rules, and profile selection in shadow mode.
- Compare selected plans with the static baseline.
- Calibrate language, rule, and modifier confidence per language and query-length bucket.

### Phase 2 - Hierarchical Router

- Validate the upstream project and dataset catalog read contracts.
- Implement physical search grouping and trusted catalog filters.
- Run routing in shadow mode while full baseline retrieval remains authoritative.
- Measure `Routing Recall@M` and tune selection budgets.

### Phase 3 - Specialized Retrieval

- Enable exact, temporal, table-aware, and neighbor retrieval only where the required indexed fields are available.
- Enable language-specific lexical fields, then cross-lingual dense retrieval, as separate feature flags.
- Return explicit capability degradation for missing optional fields.
- Evaluate exact source location, current-policy selection, table context, and procedures.

### Phase 4 - Controlled Activation

- Activate adaptive profiles for low-risk tenants.
- Enable hierarchical routing after the 99.5% routing recall gate passes.
- Enable reranker circuit-breaker fallback.
- Enable decomposition, then bounded multi-hop, as separate feature flags after their evaluation gates pass.

### Phase 5 - Scale and General Availability

- Load test with at least 10,000 eligible dataset catalog entries.
- Load test at least one retrieval pool containing 50 million chunks.
- Validate isolation across multiple tenants and projects.
- Enable canary config rollout and automated rollback.

---

## 18. Deferred Options

> **Adaptive mechanism covered:** Prevents speculative adaptive features from entering runtime until telemetry demonstrates a measured need.

The following are intentionally deferred until telemetry demonstrates a need:

- Multilingual analysis and language-specific profiles.
- A trained query classifier.
- A learned dataset router.
- Historical-hit routing features.
- More than one synchronous routing escalation.
- Unbounded physical coverage probes.
- Automatic knowledge-graph retrieval for every analytical query.
- Per-dataset profile overrides without measured score-distribution differences.

---

## 19. Portable TypeScript Reference

> **Adaptive mechanism covered:** Demonstrates the executable contracts for analysis, language detection, scope, routing, grouping, OpenSearch retrieval, RRF, and bounded hops.

This reference is intentionally small. It shows the mechanism and trust boundaries without prescribing an embedding, LLM, or reranker vendor.

Install the official OpenSearch client:

```bash
npm install @opensearch-project/opensearch
```

### 19.1 Core contracts

```ts
// adaptive-rag.types.ts
export type BaseProfile = 'NONE' | 'PRECISION' | 'BALANCED' | 'RECALL'

export type Modifier =
  | 'LEXICAL'
  | 'EXACT'
  | 'LEXICAL_EXPANSION'
  | 'MULTI_EVIDENCE'
  | 'NEIGHBOR_EXPANSION'
  | 'TEMPORAL'
  | 'TABLE_AWARE'
  | 'DECOMPOSE'
  | 'MULTI_HOP'
  | 'ENTITY_CARRYOVER'
  | 'CROSS_LINGUAL'

export interface LanguageDetection {
  primary: string
  confidence: number
  source: 'detector' | 'hint' | 'tenant_default' | 'undetermined'
  mixed: boolean
  analysisLanguages: string[]
}

export interface TrustedIdentity {
  tenantId: string
  userId: string
  principals: string[]
  authorizedProjectIds: string[]
  authorizedDatasetIds: string[]
}

export interface RetrievalRequest {
  query: string
  languageHint?: string
  projectIds?: string[]
  datasetIds?: string[]
  metadataFilters?: Record<string, string | string[]>
  asOf?: string
  maxHops?: number
  rerankMode?: 'auto' | 'on' | 'off'
  trace?: boolean
}

export interface QuerySignals {
  tokenCount: number
  looksLikePaste: boolean
  identifierHits: string[]
  hasTemporalIntent: boolean
  hasTableIntent: boolean
  hasComparison: boolean
  hasRelationshipChain: boolean
}

export interface QueryIntent {
  profile: BaseProfile
  modifiers: Modifier[]
  language: LanguageDetection
  family: string
  classifier: string
  ruleScore: number
  signals: QuerySignals
  expansions: string[]
}

export interface RetrievalProfile {
  denseCandidateK: number
  lexicalCandidateK: number
  fusionCandidateK: number
  rerankCandidateK: number
  contextTopN: number
  maxContextTokens: number
  maxPerDocument: number
  rrfK: number
  lexicalRrfWeight: number
  denseRrfWeight: number
  exactRrfWeight: number
  scoreFloor: number
}

export interface SearchGroup {
  clusterId: string
  index: string
  routingKeys: string[]
  projectIds: string[]
  datasetIds: string[]
  embeddingModelId: string
  vectorField: string
  vectorDimension: number
  lexicalFields: Record<string, string[]>
  contentLanguages: string[]
}

export interface ChunkSource {
  chunk_id: string
  tenant_id: string
  project_id: string
  dataset_id: string
  document_id: string
  language?: string
  text: string
  title?: string
  section?: string
  sequence?: number
  previous_chunk_id?: string
  next_chunk_id?: string
  parent_chunk_id?: string
  chunk_kind?: 'text' | 'heading' | 'table' | 'table_row'
  source: {
    uri?: string
    file_name?: string
    page?: number
  }
}

export interface RankedChunk {
  id: string
  source: ChunkSource
  score: number
  scoreType: 'bm25' | 'vector' | 'rrf' | 'rerank' | 'exact'
  rank?: number
  groupIndex: string
}

export interface HopEvidence {
  hop: number
  query: string
  dependsOn: Array<{
    hop: number
    chunkId: string
    entity: string
  }>
  chunks: RankedChunk[]
  complete: boolean
}
```

### 19.2 Deterministic analyzer

```ts
// query-analyzer.ts
import type {
  BaseProfile,
  LanguageDetection,
  Modifier,
  QueryIntent,
  QuerySignals
} from './adaptive-rag.types.js'

const IDENTIFIER = /\b(?:INC|REQ|PO|INV|ERR|DOC)-?\d{3,}\b/gi
const QUOTED_EXACT = /(?:"[^"]{40,}"|\u201c[^\u201d]{40,}\u201d)/i

interface DetectorCandidate {
  language: string
  score: number
}

interface DetectorResult {
  language: string
  confidence: number
  mixed?: boolean
  candidates?: DetectorCandidate[]
}

type DetectLanguage = (query: string) => DetectorResult

interface LanguagePack {
  meta: RegExp
  summary: RegExp
  procedure: RegExp
  temporal: RegExp
  table: RegExp
  compare: RegExp
  relationship: RegExp
}

const LANGUAGE_PACKS: Record<string, LanguagePack> = {
  en: {
    meta: /^(?:hi|hello|thanks|thank you|good morning|good afternoon)[.! ]*$/i,
    summary: /\b(?:summari[sz]e|overview|list all|all requirements|across)\b/i,
    procedure: /\b(?:how (?:do|can|to)|steps?|procedure|instructions?|troubleshoot)\b/i,
    temporal: /\b(?:current|latest|effective|expired|historical|as of|before|after)\b/i,
    table: /\b(?:q[1-4]|quarter|percent|percentage|total|amount|revenue|by region|for each)\b/i,
    compare: /\b(?:compare|versus|vs\.?|differences?|between)\b/i,
    relationship: /\b(?:why|caused by|impact|depends on|owned by|affected|relationship)\b/i
  },
  vi: {
    meta: /^(?:xin chào|chào|cảm ơn|cám ơn)[.! ]*$/i,
    summary: /\b(?:tóm tắt|tổng quan|liệt kê tất cả|toàn bộ yêu cầu)\b/i,
    procedure: /\b(?:làm thế nào|cách|các bước|quy trình|hướng dẫn|khắc phục)\b/i,
    temporal: /\b(?:hiện tại|mới nhất|có hiệu lực|hết hạn|tính đến|trước|sau)\b/i,
    table: /\b(?:quý|phần trăm|tổng|số tiền|doanh thu|theo khu vực|mỗi)\b/i,
    compare: /\b(?:so sánh|khác biệt|giữa)\b/i,
    relationship: /\b(?:tại sao|nguyên nhân|tác động|phụ thuộc|sở hữu|ảnh hưởng)\b/i
  },
  ja: {
    meta: /^(?:こんにちは|ありがとう|おはようございます?)[。.! ]*$/,
    summary: /(?:要約|概要|すべて.*一覧|まとめ)/,
    procedure: /(?:方法|手順|やり方|トラブルシュート)/,
    temporal: /(?:現在|最新|有効|期限切れ|時点|以前|以降)/,
    table: /(?:四半期|パーセント|合計|金額|売上|地域別|それぞれ)/,
    compare: /(?:比較|違い|対比)/,
    relationship: /(?:なぜ|原因|影響|依存|所有|関係)/
  }
}

/**
 * @description Normalizes whitespace without changing identifier punctuation.
 * @param query Raw standalone query.
 * @returns Normalized query.
 */
function normalizeQuery(query: string): string {
  return query.normalize('NFKC').replace(/\s+/g, ' ').trim()
}

/**
 * @description Normalizes a detector tag to a BCP 47 base language.
 * @param tag Detector or hint language tag.
 * @returns Base language or und.
 */
function normalizeLanguageTag(tag: string | undefined): string {
  if (!tag) return 'und'

  try {
    return new Intl.Locale(tag).language.toLowerCase()
  } catch {
    return 'und'
  }
}

/**
 * @description Detects primary and mixed query languages with bounded fallbacks.
 * @param query Normalized standalone query.
 * @param detector Private language detector.
 * @param languageHint Optional caller locale hint.
 * @returns Normalized language decision.
 */
function resolveLanguage(
  query: string,
  detector: DetectLanguage,
  languageHint?: string
): LanguageDetection {
  const result = detector(query)
  const detected = normalizeLanguageTag(result.language)
  const hinted = normalizeLanguageTag(languageHint)
  const naturalText = query.replace(IDENTIFIER, '').trim()
  const naturalTokenCount = naturalText
    ? segmentWords(naturalText, detected).length
    : 0
  const confidenceMinimum = naturalTokenCount < 4 ? 0.95 : 0.8
  const detectorAccepted = (
    result.confidence >= confidenceMinimum &&
    detected !== 'und' &&
    naturalTokenCount > 0
  )
  const primary = detectorAccepted
    ? detected
    : hinted !== 'und'
      ? hinted
      : 'und'
  const candidates = result.candidates ?? []
  const analysisLanguages = [
    primary,
    ...(result.mixed
      ? candidates
          .filter(candidate => candidate.score >= 0.55)
          .map(candidate => normalizeLanguageTag(candidate.language))
      : [])
  ].filter((language, index, all) => (
    language !== 'und' &&
    all.indexOf(language) === index
  )).slice(0, 2)

  return {
    primary,
    confidence: detectorAccepted ? result.confidence : 0,
    source: detectorAccepted
      ? 'detector'
      : hinted !== 'und'
        ? 'hint'
        : 'undetermined',
    mixed: Boolean(result.mixed && analysisLanguages.length > 1),
    analysisLanguages: analysisLanguages.length > 0
      ? analysisLanguages
      : ['und']
  }
}

/**
 * @description Segments words with the Node.js Intl implementation.
 * @param query Normalized query.
 * @param language Detected BCP 47 base language.
 * @returns Word-like query segments.
 */
function segmentWords(query: string, language: string): string[] {
  const locale = language === 'und' ? 'en' : language
  const segmenter = new Intl.Segmenter(locale, { granularity: 'word' })

  return [...segmenter.segment(query)]
    .filter(segment => segment.isWordLike)
    .map(segment => segment.segment)
}

/**
 * @description Tests one rule across every selected language pack.
 * @param packs Selected language packs.
 * @param rule Rule field to test.
 * @param query Normalized query.
 * @returns True when any pack matches.
 */
function matchesLanguageRule(
  packs: LanguagePack[],
  rule: keyof LanguagePack,
  query: string
): boolean {
  return packs.some(pack => pack[rule].test(query))
}

/**
 * @description Adds a modifier once while preserving deterministic order.
 * @param modifiers Current modifiers.
 * @param modifier Modifier to add.
 * @returns Nothing.
 */
function addModifier(modifiers: Modifier[], modifier: Modifier): void {
  if (!modifiers.includes(modifier)) modifiers.push(modifier)
}

/**
 * @description Chooses the broader of two retrieval profiles.
 * @param current Current profile.
 * @param next Candidate profile.
 * @returns Broader profile.
 */
function broaden(current: BaseProfile, next: BaseProfile): BaseProfile {
  const order: BaseProfile[] = ['NONE', 'PRECISION', 'BALANCED', 'RECALL']
  return order.indexOf(next) > order.indexOf(current) ? next : current
}

/**
 * @description Applies the fast ordered enterprise-query rules.
 * @param rawQuery Raw standalone query.
 * @param detector Private language detector.
 * @param approvedExpansions Tenant-approved expansions keyed by language and lowercase term.
 * @param languageHint Optional BCP 47 locale hint.
 * @returns Query intent used to build the retrieval plan.
 */
export function analyzeQuery(
  rawQuery: string,
  detector: DetectLanguage,
  approvedExpansions: ReadonlyMap<string, string[]> = new Map(),
  languageHint?: string
): QueryIntent {
  // Normalize once so every rule sees the same query.
  const query = normalizeQuery(rawQuery)
  const language = resolveLanguage(query, detector, languageHint)
  const tokens = segmentWords(query, language.primary)
  const identifierHits = [...query.matchAll(IDENTIFIER)].map(match => match[0].toUpperCase())
  const modifiers: Modifier[] = []
  const packs = language.analysisLanguages
    .map(tag => LANGUAGE_PACKS[tag])
    .filter((pack): pack is LanguagePack => Boolean(pack))
  const expansionKey = `${language.primary}:${query.toLowerCase()}`
  const expansions = approvedExpansions.get(expansionKey)?.slice(0, 8) ?? []

  // Compute reusable signals before selecting a profile.
  const signals: QuerySignals = {
    tokenCount: tokens.length,
    looksLikePaste: QUOTED_EXACT.test(query) || (
      rawQuery.includes('\n') &&
      tokens.length >= 20
    ),
    identifierHits,
    hasTemporalIntent: matchesLanguageRule(packs, 'temporal', query),
    hasTableIntent: matchesLanguageRule(packs, 'table', query),
    hasComparison: matchesLanguageRule(packs, 'compare', query),
    hasRelationshipChain: matchesLanguageRule(packs, 'relationship', query)
  }

  // Skip retrieval only for a narrow, high-precision meta rule.
  if (matchesLanguageRule(packs, 'meta', query)) {
    return {
      profile: 'NONE',
      modifiers,
      language,
      family: 'conversation',
      classifier: 'rule:R01',
      ruleScore: 0.99,
      signals,
      expansions
    }
  }

  // Begin with the safe default and broaden only when a rule requires it.
  let profile: BaseProfile = tokens.length <= 8 ? 'PRECISION' : 'BALANCED'
  let family = profile === 'PRECISION' ? 'simple_fact' : 'standard_question'
  const rules: string[] = []

  if (signals.looksLikePaste) {
    addModifier(modifiers, 'EXACT')
    rules.push('R02')
    family = 'pasted_source'
  }

  if (identifierHits.length > 0) {
    addModifier(modifiers, 'LEXICAL')
    rules.push('R03')
    family = 'identifier'
  }

  if (expansions.length > 0) {
    addModifier(modifiers, 'LEXICAL_EXPANSION')
    rules.push('R04')
    family = 'enterprise_jargon'
  }

  if (signals.hasTemporalIntent) {
    addModifier(modifiers, 'TEMPORAL')
    rules.push('R05')
  }

  if (matchesLanguageRule(packs, 'procedure', query)) {
    profile = broaden(profile, 'BALANCED')
    addModifier(modifiers, 'NEIGHBOR_EXPANSION')
    rules.push('R06')
    family = 'procedure'
  }

  if (signals.hasTableIntent) {
    profile = broaden(profile, 'BALANCED')
    addModifier(modifiers, 'TABLE_AWARE')
    rules.push('R07')
    family = 'table_numeric'
  }

  if (signals.hasComparison) {
    profile = 'RECALL'
    addModifier(modifiers, 'DECOMPOSE')
    addModifier(modifiers, 'MULTI_EVIDENCE')
    rules.push('R08')
    family = 'comparison'
  } else if (matchesLanguageRule(packs, 'summary', query)) {
    profile = 'RECALL'
    addModifier(modifiers, 'MULTI_EVIDENCE')
    rules.push('R09')
    family = 'summary'
  }

  if (signals.hasRelationshipChain) {
    profile = 'RECALL'
    addModifier(modifiers, 'MULTI_HOP')
    addModifier(modifiers, 'MULTI_EVIDENCE')
    addModifier(modifiers, 'ENTITY_CARRYOVER')
    rules.push('R10')
    family = 'multi_hop'
  }

  return {
    profile,
    modifiers,
    language,
    family,
    classifier: rules.length > 0 ? `rule:${rules.join('+')}` : 'rule:R14',
    ruleScore: rules.length > 0 ? 0.9 : 0.75,
    signals,
    expansions
  }
}
```

The analyzer is deliberately conservative. Production replaces seed `ruleScore` values with calibrated confidence and calls a structured LLM planner only below the configured confidence gate or when decomposition is necessary.

### 19.3 Reciprocal Rank Fusion

```ts
// rrf.ts
import type { RankedChunk } from './adaptive-rag.types.js'

export interface RankedList {
  weight: number
  chunks: RankedChunk[]
}

/**
 * @description Fuses ranked lists without adding incompatible native scores.
 * @param lists BM25, vector, and optional exact ranked lists.
 * @param rankConstant Positive RRF rank constant.
 * @returns Deduplicated chunks sorted by descending RRF score.
 */
export function reciprocalRankFusion(
  lists: RankedList[],
  rankConstant = 60
): RankedChunk[] {
  const fused = new Map<string, RankedChunk>()

  for (const list of lists) {
    list.chunks.forEach((chunk, index) => {
      // RRF ranks are one-based.
      const contribution = list.weight / (rankConstant + index + 1)
      const current = fused.get(chunk.id)

      // Preserve one source payload and accumulate rank contributions.
      fused.set(chunk.id, {
        ...(current ?? chunk),
        score: (current?.score ?? 0) + contribution,
        scoreType: 'rrf'
      })
    })
  }

  return [...fused.values()]
    .sort((left, right) => right.score - left.score)
    .map((chunk, index) => ({ ...chunk, rank: index + 1 }))
}
```

### 19.4 Scope resolution and physical grouping

```ts
// retrieval-scope.ts
import type {
  RetrievalRequest,
  SearchGroup,
  TrustedIdentity
} from './adaptive-rag.types.js'

export interface ResolvedScope {
  tenantId: string
  principals: string[]
  projectIds: string[]
  datasetIds: string[]
  explicitProjectScope: boolean
  explicitDatasetScope: boolean
}

export interface DatasetRoute {
  clusterId: string
  index: string
  routingKey?: string
  projectId: string
  datasetId: string
  embeddingModelId: string
  vectorField: string
  vectorDimension: number
  lexicalFields: Record<string, string[]>
  contentLanguages: string[]
}

/**
 * @description Verifies that every requested ID is authorized.
 * @param authorized Authorized IDs from trusted identity.
 * @param requested Optional IDs supplied by the caller.
 * @param label Field name used in the error.
 * @param limit Maximum explicit IDs accepted from one request.
 * @returns Authorized IDs narrowed by the request.
 */
function narrowAuthorizedIds(
  authorized: string[],
  requested: string[] | undefined,
  label: string,
  limit: number
): string[] {
  if (!requested) return authorized
  if (requested.length > limit) throw new Error(`${label.toUpperCase()}_LIMIT_EXCEEDED`)

  const allowed = new Set(authorized)
  if (requested.some(id => !allowed.has(id))) {
    throw new Error(`FORBIDDEN_${label.toUpperCase()}`)
  }

  return [...new Set(requested)]
}

/**
 * @description Resolves caller scope before any catalog or chunk search.
 * @param identity Trusted server identity.
 * @param request Untrusted retrieval request.
 * @returns Scope that client filters can only narrow.
 */
export function resolveScope(
  identity: TrustedIdentity,
  request: RetrievalRequest
): ResolvedScope {
  return {
    tenantId: identity.tenantId,
    principals: [...new Set(identity.principals)],
    projectIds: narrowAuthorizedIds(
      identity.authorizedProjectIds,
      request.projectIds,
      'project_ids',
      64
    ),
    datasetIds: narrowAuthorizedIds(
      identity.authorizedDatasetIds,
      request.datasetIds,
      'dataset_ids',
      256
    ),
    explicitProjectScope: Boolean(request.projectIds),
    explicitDatasetScope: Boolean(request.datasetIds)
  }
}

/**
 * @description Groups selected datasets into compatible OpenSearch searches.
 * @param routes Selected dataset catalog entries.
 * @returns Physical search groups.
 */
export function buildSearchGroups(routes: DatasetRoute[]): SearchGroup[] {
  const groups = new Map<string, SearchGroup>()

  for (const route of routes) {
    // Group only fields that must be compatible in one k-NN search.
    const key = [
      route.clusterId,
      route.index,
      route.embeddingModelId,
      route.vectorField,
      route.vectorDimension,
      JSON.stringify(route.lexicalFields)
    ].join('|')
    const current = groups.get(key)

    if (current) {
      current.projectIds.push(route.projectId)
      current.datasetIds.push(route.datasetId)
      current.contentLanguages.push(...route.contentLanguages)
      if (route.routingKey) current.routingKeys.push(route.routingKey)
      continue
    }

    groups.set(key, {
      clusterId: route.clusterId,
      index: route.index,
      routingKeys: route.routingKey ? [route.routingKey] : [],
      projectIds: [route.projectId],
      datasetIds: [route.datasetId],
      embeddingModelId: route.embeddingModelId,
      vectorField: route.vectorField,
      vectorDimension: route.vectorDimension,
      lexicalFields: route.lexicalFields,
      contentLanguages: route.contentLanguages
    })
  }

  return [...groups.values()].map(group => ({
    ...group,
    routingKeys: [...new Set(group.routingKeys)],
    projectIds: [...new Set(group.projectIds)],
    datasetIds: [...new Set(group.datasetIds)],
    contentLanguages: [...new Set(group.contentLanguages)]
  }))
}

/**
 * @description Detects whether selected sources require cross-lingual retrieval.
 * @param groups Selected physical search groups.
 * @param analysisLanguages Primary and mixed query languages.
 * @returns True when no detected query language matches a selected source language.
 */
export function requiresCrossLingual(
  groups: SearchGroup[],
  analysisLanguages: string[]
): boolean {
  const queryLanguages = new Set(
    analysisLanguages.filter(language => language !== 'und')
  )

  return queryLanguages.size > 0 && groups.some(group => (
    group.contentLanguages.length > 0 &&
    !group.contentLanguages.some(language => queryLanguages.has(language))
  ))
}
```

For extremely large authorization scopes, `TrustedIdentity` may contain policy handles rather than expanded ID arrays. In that deployment, `resolveScope` is replaced by an authorization service call, but its output and fail-closed behavior remain the same.

### 19.5 Grouped OpenSearch hybrid retrieval

```ts
// opensearch-retriever.ts
import { Client } from '@opensearch-project/opensearch'
import type {
  ChunkSource,
  Modifier,
  RankedChunk,
  RetrievalProfile,
  SearchGroup
} from './adaptive-rag.types.js'
import type { ResolvedScope } from './retrieval-scope.js'
import { reciprocalRankFusion } from './rrf.js'

type QueryDsl = Record<string, unknown>
type EmbedQuery = (
  query: string,
  modelId: string,
  dimension: number
) => Promise<number[]>

interface SearchHit {
  _id: string
  _index: string
  _score: number
  _source: ChunkSource
}

interface SearchPart {
  error?: unknown
  timed_out?: boolean
  _shards?: {
    failed: number
  }
  hits?: {
    hits: SearchHit[]
  }
}

interface MultiSearchBody {
  responses: SearchPart[]
}

export interface HybridSearchResult {
  chunks: RankedChunk[]
  coverageIncomplete: boolean
  failedSearches: number
}

const SOURCE_FIELDS = [
  'chunk_id',
  'tenant_id',
  'project_id',
  'dataset_id',
  'document_id',
  'language',
  'text',
  'title',
  'section',
  'sequence',
  'previous_chunk_id',
  'next_chunk_id',
  'parent_chunk_id',
  'chunk_kind',
  'source'
]

/**
 * @description Builds the mandatory server-owned OpenSearch filter.
 * @param scope Trusted resolved scope.
 * @param group Compatible physical search group.
 * @returns Query DSL used inside both lexical and k-NN searches.
 */
function buildTrustedFilter(
  scope: ResolvedScope,
  group: SearchGroup
): QueryDsl {
  return {
    bool: {
      filter: [
        { term: { tenant_id: scope.tenantId } },
        { terms: { project_id: group.projectIds } },
        { terms: { dataset_id: group.datasetIds } },
        { term: { lifecycle_state: 'active' } },
        {
          bool: {
            should: [
              { term: { visibility: 'public' } },
              { terms: { acl_principals: scope.principals } }
            ],
            minimum_should_match: 1
          }
        }
      ]
    }
  }
}

/**
 * @description Resolves configured lexical fields for detected languages.
 * @param group Physical group with a validated lexical schema.
 * @param analysisLanguages Primary and mixed query languages.
 * @returns Deduplicated lexical fields with a universal fallback.
 */
function resolveLexicalFields(
  group: SearchGroup,
  analysisLanguages: string[]
): string[] {
  const fields = analysisLanguages.flatMap(
    language => group.lexicalFields[language] ?? []
  )
  const fallback = group.lexicalFields.und ?? ['text']

  return [...new Set(fields.length > 0 ? fields : fallback)]
}

/**
 * @description Builds the BM25 query for one search group.
 * @param query Normalized query.
 * @param filter Trusted scope filter.
 * @param lexicalFields Language-compatible lexical fields.
 * @param modifiers Selected query modifiers.
 * @param profile Retrieval profile.
 * @param expansions Approved lexical expansions.
 * @returns OpenSearch search body.
 */
function buildLexicalBody(
  query: string,
  filter: QueryDsl,
  lexicalFields: string[],
  modifiers: Modifier[],
  profile: RetrievalProfile,
  expansions: string[]
): QueryDsl {
  // Approved expansions are appended as optional lexical alternatives.
  const lexicalQuery = expansions.length > 0
    ? `${query} ${expansions.join(' ')}`
    : query
  const should: QueryDsl[] = []

  if (modifiers.includes('LEXICAL')) {
    should.push({ terms: { identifiers: [query.toUpperCase()] } })
  }

  if (modifiers.includes('TABLE_AWARE')) {
    should.push({ terms: { chunk_kind: ['table', 'table_row'] } })
  }

  if (modifiers.includes('TEMPORAL')) {
    should.push({
      term: { is_current: true }
    })
  }

  return {
    size: profile.lexicalCandidateK,
    track_total_hits: false,
    _source: SOURCE_FIELDS,
    query: {
      bool: {
        filter: [filter],
        must: [
          {
            multi_match: {
              query: lexicalQuery,
              type: 'best_fields',
              fields: [...lexicalFields, 'identifiers^4'],
              operator: modifiers.includes('LEXICAL') ? 'and' : 'or',
              minimum_should_match: modifiers.includes('LEXICAL') ? undefined : '60%'
            }
          }
        ],
        should
      }
    }
  }
}

/**
 * @description Builds an efficiently filtered approximate k-NN query.
 * @param vector Query vector compatible with the search group.
 * @param group Physical search group.
 * @param filter Trusted scope filter.
 * @param profile Retrieval profile.
 * @returns OpenSearch search body.
 */
function buildDenseBody(
  vector: number[],
  group: SearchGroup,
  filter: QueryDsl,
  profile: RetrievalProfile
): QueryDsl {
  return {
    size: profile.denseCandidateK,
    track_total_hits: false,
    _source: SOURCE_FIELDS,
    query: {
      knn: {
        [group.vectorField]: {
          vector,
          k: profile.denseCandidateK,
          filter,
          method_parameters: {
            ef_search: Math.max(profile.denseCandidateK, 256)
          }
        }
      }
    }
  }
}

/**
 * @description Converts one OpenSearch response into ranked chunks.
 * @param part One lexical or dense multi-search response.
 * @param scoreType Native score type.
 * @returns Ranked chunks, or an empty list for a failed search.
 */
function parseSearchPart(
  part: SearchPart,
  scoreType: 'bm25' | 'vector'
): RankedChunk[] {
  if (part.error || !part.hits) return []

  return part.hits.hits.map((hit, index) => ({
    id: hit._source.chunk_id || hit._id,
    source: hit._source,
    score: hit._score,
    scoreType,
    rank: index + 1,
    groupIndex: hit._index
  }))
}

/**
 * @description Executes BM25 and k-NN searches for all bounded physical groups.
 * @param client Reused OpenSearch client.
 * @param groups Selected compatible search groups.
 * @param scope Trusted resolved scope.
 * @param query Normalized standalone query.
 * @param analysisLanguages Primary and mixed detected languages.
 * @param modifiers Selected modifiers.
 * @param expansions Approved lexical expansions.
 * @param profile Selected retrieval profile.
 * @param embedQuery Application embedding function.
 * @returns Globally fused chunks plus partial-coverage state.
 */
export async function retrieveGroups(
  client: Client,
  groups: SearchGroup[],
  scope: ResolvedScope,
  query: string,
  analysisLanguages: string[],
  modifiers: Modifier[],
  expansions: string[],
  profile: RetrievalProfile,
  embedQuery: EmbedQuery
): Promise<HybridSearchResult> {
  if (groups.length === 0) return {
    chunks: [],
    coverageIncomplete: false,
    failedSearches: 0
  }

  if (groups.length > 8) throw new Error('SEARCH_GROUP_LIMIT_EXCEEDED')

  // Reuse one query vector for groups with the same model and dimension.
  const vectorCache = new Map<string, Promise<number[]>>()
  const vectors = await Promise.all(groups.map(async group => {
    const key = `${group.embeddingModelId}:${group.vectorDimension}`
    const pending = vectorCache.get(key) ?? embedQuery(
      query,
      group.embeddingModelId,
      group.vectorDimension
    )
    vectorCache.set(key, pending)
    const vector = await pending

    if (vector.length !== group.vectorDimension) {
      throw new Error(`EMBEDDING_DIMENSION_MISMATCH:${group.embeddingModelId}`)
    }

    return vector
  }))

  const body: QueryDsl[] = []

  groups.forEach((group, index) => {
    const filter = buildTrustedFilter(scope, group)
    const lexicalFields = resolveLexicalFields(group, analysisLanguages)
    const metadata = {
      index: group.index,
      routing: group.routingKeys.length > 0
        ? group.routingKeys.join(',')
        : undefined,
      cancel_after_time_interval: '900ms'
    }

    // Add one lexical and one dense search per physical group.
    body.push(metadata)
    body.push(buildLexicalBody(
      query,
      filter,
      lexicalFields,
      modifiers,
      profile,
      expansions
    ))
    body.push(metadata)
    body.push(buildDenseBody(vectors[index], group, filter, profile))
  })

  const response = await client.msearch({
    body,
    max_concurrent_searches: 8,
    max_concurrent_shard_requests: 5
  })
  const parts = (response.body as MultiSearchBody).responses
  const rankedLists: Array<{ weight: number, chunks: RankedChunk[] }> = []
  let failedSearches = 0

  for (let index = 0; index < parts.length; index += 2) {
    const lexicalPart = parts[index]
    const densePart = parts[index + 1]

    failedSearches += Number(Boolean(
      lexicalPart.error ||
      lexicalPart.timed_out ||
      lexicalPart._shards?.failed
    ))
    failedSearches += Number(Boolean(
      densePart.error ||
      densePart.timed_out ||
      densePart._shards?.failed
    ))

    rankedLists.push({
      weight: profile.lexicalRrfWeight,
      chunks: parseSearchPart(lexicalPart, 'bm25')
    })
    rankedLists.push({
      weight: profile.denseRrfWeight,
      chunks: parseSearchPart(densePart, 'vector')
    })
  }

  const chunks = reciprocalRankFusion(rankedLists, profile.rrfK)
    .filter(chunk => chunk.score >= profile.scoreFloor)
    .slice(0, profile.fusionCandidateK)

  return {
    chunks,
    coverageIncomplete: failedSearches > 0,
    failedSearches
  }
}
```

Production code should reuse one long-lived `Client`, use TLS and workload identity, apply request-level cancellation, and maintain one client per OpenSearch cluster ID.

### 19.6 Hierarchical catalog routing

```ts
// catalog-router.ts
import { Client } from '@opensearch-project/opensearch'
import type { DatasetRoute, ResolvedScope } from './retrieval-scope.js'

type QueryDsl = Record<string, unknown>
type EmbedRouterQuery = (query: string) => Promise<number[]>

interface CatalogSource {
  tenant_id: string
  project_id: string
  dataset_id?: string
  name: string
  description?: string
  aliases?: string[]
  cluster_id?: string
  physical_index?: string
  routing_key?: string
  embedding_model_id?: string
  vector_field?: string
  vector_dimension?: number
  lexical_fields?: Record<string, string[]>
  content_languages?: string[]
}

interface CatalogPart {
  error?: unknown
  hits?: {
    hits: Array<{
      _id: string
      _source: CatalogSource
    }>
  }
}

/**
 * @description Builds a trusted catalog filter for one routing level.
 * @param scope Trusted resolved scope.
 * @param projectIds Authorized project IDs.
 * @param datasetIds Optional authorized dataset IDs.
 * @returns Catalog filter.
 */
function buildCatalogFilter(
  scope: ResolvedScope,
  projectIds: string[],
  datasetIds?: string[]
): QueryDsl {
  const filter: QueryDsl[] = [
    { term: { tenant_id: scope.tenantId } },
    { terms: { project_id: projectIds } },
    { term: { lifecycle_state: 'active' } },
    {
      bool: {
        should: [
          { term: { visibility: 'public' } },
          { terms: { acl_principals: scope.principals } }
        ],
        minimum_should_match: 1
      }
    }
  ]

  if (datasetIds) filter.push({ terms: { dataset_id: datasetIds } })
  return { bool: { filter } }
}

/**
 * @description Fuses lexical and dense catalog lists by stable catalog ID.
 * @param lexical Lexical catalog response.
 * @param dense Dense catalog response.
 * @param limit Maximum returned catalog entries.
 * @returns Ranked catalog sources.
 */
function fuseCatalog(
  lexical: CatalogPart,
  dense: CatalogPart,
  limit: number
): CatalogSource[] {
  const scores = new Map<string, number>()
  const sources = new Map<string, CatalogSource>()

  const parts = [lexical, dense]

  parts.forEach(part => {
    part.hits?.hits.forEach((hit, index) => {
      sources.set(hit._id, hit._source)
      scores.set(hit._id, (scores.get(hit._id) ?? 0) + 1 / (60 + index + 1))
    })
  })

  return [...scores.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, limit)
    .map(([id]) => sources.get(id))
    .filter((source): source is CatalogSource => Boolean(source))
}

/**
 * @description Searches one compact catalog with BM25 and filtered k-NN.
 * @param client OpenSearch client.
 * @param index Explicit catalog alias.
 * @param query Normalized user query.
 * @param vector Router-model query vector.
 * @param filter Trusted catalog filter.
 * @param lexicalFields Language-compatible catalog fields.
 * @param limit Maximum fused results.
 * @returns Ranked catalog sources.
 */
async function searchCatalog(
  client: Client,
  index: string,
  query: string,
  vector: number[],
  filter: QueryDsl,
  lexicalFields: string[],
  limit: number
): Promise<CatalogSource[]> {
  const response = await client.msearch({
    body: [
      { index },
      {
        size: limit * 2,
        _source: true,
        query: {
          bool: {
            filter: [filter],
            must: [{
              multi_match: {
                query,
                fields: lexicalFields
              }
            }]
          }
        }
      },
      { index },
      {
        size: limit * 2,
        _source: true,
        query: {
          knn: {
            centroid: {
              vector,
              k: limit * 2,
              filter
            }
          }
        }
      }
    ]
  })
  const parts = (response.body as { responses: CatalogPart[] }).responses

  if (parts.length !== 2 || parts.every(part => part.error)) {
    throw new Error(`CATALOG_UNAVAILABLE:${index}`)
  }

  return fuseCatalog(parts[0], parts[1], limit)
}

/**
 * @description Builds catalog field names for primary and mixed languages.
 * @param analysisLanguages Detected analysis languages.
 * @returns Deduplicated catalog lexical fields.
 */
function catalogLexicalFields(analysisLanguages: string[]): string[] {
  const supported = analysisLanguages.filter(language => language !== 'und')
  const languages = supported.length > 0 ? supported : ['universal']

  return [...new Set(languages.flatMap(language => [
    `name.${language}^3`,
    `aliases.${language}^2`,
    `description.${language}`,
    `top_terms.${language}`
  ]))]
}

/**
 * @description Loads explicit datasets without relevance ranking.
 * @param client OpenSearch client.
 * @param scope Trusted explicit scope.
 * @returns Every authorized explicit dataset catalog entry.
 */
async function loadExplicitDatasets(
  client: Client,
  scope: ResolvedScope
): Promise<CatalogSource[]> {
  const response = await client.search({
    index: 'rag-datasets-read',
    body: {
      size: scope.datasetIds.length,
      _source: true,
      query: buildCatalogFilter(scope, scope.projectIds, scope.datasetIds)
    }
  })
  const hits = (response.body as {
    hits: {
      hits: Array<{ _source: CatalogSource }>
    }
  }).hits.hits.map(hit => hit._source)

  if (hits.length !== scope.datasetIds.length) {
    throw new Error('EXPLICIT_DATASET_CATALOG_MISMATCH')
  }

  return hits
}

/**
 * @description Validates and converts one dataset catalog entry.
 * @param dataset Dataset catalog entry.
 * @returns Physical dataset route.
 */
function toDatasetRoute(dataset: CatalogSource): DatasetRoute {
  if (
    !dataset.dataset_id ||
    !dataset.cluster_id ||
    !dataset.physical_index ||
    !dataset.embedding_model_id ||
    !dataset.vector_field ||
    !dataset.vector_dimension ||
    !dataset.lexical_fields
  ) {
    throw new Error(`INVALID_DATASET_CATALOG_ENTRY:${dataset.dataset_id ?? 'unknown'}`)
  }

  return {
    clusterId: dataset.cluster_id,
    index: dataset.physical_index,
    routingKey: dataset.routing_key,
    projectId: dataset.project_id,
    datasetId: dataset.dataset_id,
    embeddingModelId: dataset.embedding_model_id,
    vectorField: dataset.vector_field,
    vectorDimension: dataset.vector_dimension,
    lexicalFields: dataset.lexical_fields,
    contentLanguages: dataset.content_languages ?? ['und']
  }
}

/**
 * @description Routes a query through project and dataset catalogs.
 * @param client OpenSearch client.
 * @param query Normalized user query.
 * @param scope Trusted authorized scope.
 * @param analysisLanguages Primary and mixed detected languages.
 * @param embedRouterQuery Router-space embedding function.
 * @returns Dataset routes ready for physical grouping.
 */
export async function routeDatasets(
  client: Client,
  query: string,
  scope: ResolvedScope,
  analysisLanguages: string[],
  embedRouterQuery: EmbedRouterQuery
): Promise<DatasetRoute[]> {
  // Explicit authorized dataset scope bypasses relevance ranking.
  if (scope.explicitDatasetScope) {
    return (await loadExplicitDatasets(client, scope)).map(toDatasetRoute)
  }

  const vector = await embedRouterQuery(query)
  const lexicalFields = catalogLexicalFields(analysisLanguages)
  const selectedProjectIds = scope.explicitProjectScope
    ? scope.projectIds
    : (await searchCatalog(
        client,
        'rag-projects-read',
        query,
        vector,
        buildCatalogFilter(scope, scope.projectIds),
        lexicalFields,
        3
      )).map(project => project.project_id)
  const datasetFilter = buildCatalogFilter(
    scope,
    selectedProjectIds,
    scope.datasetIds
  )
  const datasets = await searchCatalog(
    client,
    'rag-datasets-read',
    query,
    vector,
    datasetFilter,
    lexicalFields,
    16
  )

  return datasets.map(toDatasetRoute)
}
```

Explicit authorized dataset IDs are loaded as mandatory catalog entries before ranked catalog results and are never dropped by the top-16 seed budget. The production router also applies score floors, margins, one escalation wave, catalog-version checks, and the hard 64-dataset/eight-group limits from Section 8.

### 19.7 Bounded multi-hop executor

```ts
// multi-hop.ts
import type { HopEvidence, RankedChunk } from './adaptive-rag.types.js'

export interface HopTemplate {
  queryTemplate: string
  requiresEntity: boolean
}

export interface GroundedEntity {
  value: string
  chunkId: string
}

type RetrieveHop = (
  query: string,
  hop: number
) => Promise<{
  chunks: RankedChunk[]
  sufficient: boolean
}>

type ExtractGroundedEntities = (
  chunks: RankedChunk[],
  limit: number
) => Promise<GroundedEntity[]>

/**
 * @description Replaces the only supported hop placeholder.
 * @param template Approved hop template.
 * @param entity Evidence-grounded entity.
 * @returns Concrete bounded subquery.
 */
function instantiateHop(template: string, entity: string): string {
  return template.replaceAll('{entity}', entity).replace(/\s+/g, ' ').trim()
}

/**
 * @description Runs at most three sequential evidence-dependent retrieval hops.
 * @param originalQuery Original standalone query.
 * @param templates Structured planner output.
 * @param retrieveHop Retrieval function that preserves the original scope.
 * @param extractEntities Entity extractor restricted to selected evidence.
 * @param deadlineAt Absolute request deadline in milliseconds.
 * @returns Evidence grouped by hop and unresolved templates.
 */
export async function executeMultiHop(
  originalQuery: string,
  templates: HopTemplate[],
  retrieveHop: RetrieveHop,
  extractEntities: ExtractGroundedEntities,
  deadlineAt: number
): Promise<{
  evidence: HopEvidence[]
  unresolvedHops: string[]
}> {
  const evidence: HopEvidence[] = []
  const seen = new Set<string>()
  let groundedEntities: GroundedEntity[] = []
  let satisfied = false
  const boundedTemplates = templates.slice(0, 3)

  for (let index = 0; index < boundedTemplates.length; index += 1) {
    if (Date.now() > deadlineAt - 250) break

    const template = boundedTemplates[index]
    const grounded = groundedEntities[0]
    const query = template.requiresEntity
      ? instantiateHop(template.queryTemplate, grounded?.value ?? '')
      : template.queryTemplate || originalQuery
    const normalized = query.toLowerCase().replace(/\s+/g, ' ').trim().slice(0, 128)

    // Stop if a dependent hop has no evidence-backed entity.
    if (!normalized || (template.requiresEntity && !grounded)) break
    if (seen.has(normalized)) break
    seen.add(normalized)

    const result = await retrieveHop(normalized, index + 1)
    const dependsOn = template.requiresEntity && grounded
      ? [{
          hop: index,
          chunkId: grounded.chunkId,
          entity: grounded.value
        }]
      : []

    evidence.push({
      hop: index + 1,
      query: normalized,
      dependsOn,
      chunks: result.chunks,
      complete: result.sufficient
    })

    if (result.sufficient) {
      satisfied = true
      break
    }

    // Only selected evidence may provide entities for the next hop.
    groundedEntities = (await extractEntities(result.chunks, 8)).slice(0, 8)
  }

  return {
    evidence,
    unresolvedHops: satisfied
      ? []
      : boundedTemplates
          .slice(evidence.length)
          .map(template => template.queryTemplate)
  }
}
```

The planner creates templates, not evidence. `extractEntities` must return the supporting chunk ID for each value, and the next retrieval uses the same resolved scope object as the first.

### 19.8 Minimal runnable checks

```ts
// adaptive-rag.test.ts
import { describe, expect, it } from 'vitest'
import { analyzeQuery } from './query-analyzer.js'
import { reciprocalRankFusion } from './rrf.js'
import { resolveScope } from './retrieval-scope.js'
import type { RankedChunk } from './adaptive-rag.types.js'

/**
 * @description Returns deterministic English detection for analyzer tests.
 * @returns English detector result.
 */
function detectEnglish() {
  return {
    language: 'en',
    confidence: 0.99,
    mixed: false,
    candidates: [{ language: 'en', score: 0.99 }]
  }
}

/**
 * @description Returns deterministic Vietnamese detection for analyzer tests.
 * @returns Vietnamese detector result.
 */
function detectVietnamese() {
  return {
    language: 'vi',
    confidence: 0.99,
    mixed: false,
    candidates: [{ language: 'vi', score: 0.99 }]
  }
}

/**
 * @description Creates the smallest ranked chunk used by RRF tests.
 * @param id Stable test chunk ID.
 * @returns Ranked test chunk.
 */
const chunk = (id: string): RankedChunk => ({
  id,
  score: 1,
  scoreType: 'bm25',
  groupIndex: 'rag-chunks-test',
  source: {
    chunk_id: id,
    tenant_id: 't1',
    project_id: 'p1',
    dataset_id: 'd1',
    document_id: `doc-${id}`,
    text: id,
    source: {}
  }
})

describe('adaptive RAG mechanism', () => {
  it('selects multi-hop retrieval for relationship questions', () => {
    const intent = analyzeQuery(
      'Which customers depend on systems owned by Team A?',
      detectEnglish
    )

    expect(intent.language.primary).toBe('en')
    expect(intent.profile).toBe('RECALL')
    expect(intent.modifiers).toContain('MULTI_HOP')
    expect(intent.modifiers).toContain('ENTITY_CARRYOVER')
  })

  it('detects Vietnamese and applies its procedure rules', () => {
    const intent = analyzeQuery(
      'Làm thế nào để yêu cầu quyền truy cập production?',
      detectVietnamese
    )

    expect(intent.language.primary).toBe('vi')
    expect(intent.profile).toBe('BALANCED')
    expect(intent.modifiers).toContain('NEIGHBOR_EXPANSION')
  })

  it('fuses lexical and dense ranks without adding native scores', () => {
    const fused = reciprocalRankFusion([
      { weight: 1, chunks: [chunk('a'), chunk('b')] },
      { weight: 1, chunks: [chunk('b'), chunk('c')] }
    ])

    expect(fused[0].id).toBe('b')
    expect(fused[0].scoreType).toBe('rrf')
  })

  it('fails closed when explicit scope contains an unauthorized dataset', () => {
    expect(() => resolveScope({
      tenantId: 't1',
      userId: 'u1',
      principals: ['user:u1'],
      authorizedProjectIds: ['p1'],
      authorizedDatasetIds: ['d1']
    }, {
      query: 'policy',
      datasetIds: ['d2']
    })).toThrow('FORBIDDEN_DATASET_IDS')
  })
})
```

---

## 20. References

> **Adaptive mechanism covered:** Anchors OpenSearch query, vector, analyzer, multi-search, and fusion assumptions to their authoritative platform behavior.

- [OpenSearch JavaScript client](https://docs.opensearch.org/latest/clients/javascript/index/)
- [OpenSearch k-NN query and query-time parameters](https://docs.opensearch.org/latest/query-dsl/specialized/k-nn/index/)
- [OpenSearch filtered vector search](https://docs.opensearch.org/latest/vector-search/filter-search-knn/index/)
- [OpenSearch `knn_vector` mapping](https://docs.opensearch.org/latest/mappings/supported-field-types/knn-vector/)
- [OpenSearch Multi-Search API](https://docs.opensearch.org/latest/api-reference/search-apis/multi-search/)
- [OpenSearch multi-match query](https://docs.opensearch.org/latest/query-dsl/full-text/multi-match/)
- [OpenSearch text analysis and query-time analyzer compatibility](https://docs.opensearch.org/latest/analyzers/)
- [OpenSearch language analyzers](https://docs.opensearch.org/latest/analyzers/language-analyzers/index/)
- [OpenSearch score-ranker RRF processor](https://docs.opensearch.org/latest/search-plugins/search-pipelines/score-ranker-processor/)
- [RAGFlow: Run retrieval test](https://ragflow.io/docs/dev/run_retrieval_test)
- [RAGFlow: HTTP API - Retrieve chunks](https://ragflow.io/docs/dev/http_api_reference#retrieve-chunks)
