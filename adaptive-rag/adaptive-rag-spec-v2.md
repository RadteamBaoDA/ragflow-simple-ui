# Technical Specification: Adaptive RAG v2

**Version:** 2.0 (Draft)
**Status:** For Review
**Language:** English only
**Scope:** Query-adaptive retrieval with hierarchical routing for large, multi-project RAG deployments
**Baseline:** RAGFlow-style hybrid retrieval parameters and score semantics

---

## 1. Executive Summary

Adaptive RAG v2 selects retrieval behavior from the query instead of applying one static configuration to every request. It is designed for deployments with:

- One to thousands of datasets per authorized scope.
- Many independent projects and tenants.
- Very large total document and chunk counts.
- Hybrid lexical and dense retrieval.
- Optional cross-encoder reranking.
- Exact or near-exact lookup for text pasted from source documents.

The system has five stages:

1. Analyze the standalone English query.
2. Select a base retrieval profile and independent modifiers.
3. Resolve the caller's authorized project and dataset scope.
4. Route hierarchically to a bounded set of datasets.
5. Retrieve, optionally rerank, assemble context, and record the decision.

The design intentionally does **not** query every eligible dataset. At large scale, physical fan-out across every dataset is incompatible with bounded latency and cost. Instead, every request produces a versioned, auditable routing decision, and routing quality is enforced through an offline `Routing Recall@M` acceptance target.

---

## 2. Goals and Non-Goals

### 2.1 Goals

- **G1 - Fast deterministic analysis:** At least 90% of queries use rules only, with less than 5 ms p95 analyzer latency.
- **G2 - Query-adaptive retrieval:** Select precision, balanced, recall, or no-retrieval behavior from query signals.
- **G3 - Explicit score semantics:** Support reranked and non-reranked retrieval without treating reranker scores as vector cosine scores.
- **G4 - Large-scale routing:** Keep the number of fully searched datasets bounded even when the eligible scope contains thousands of datasets.
- **G5 - Auditable routing:** Record enough information to reconstruct why datasets were selected or not selected.
- **G6 - High routing recall:** Achieve at least 99.5% `Routing Recall@M` on the labeled routing evaluation set.
- **G7 - Exact source lookup:** Return the source in the top three results for at least 95% of supported pasted-fragment queries.
- **G8 - Safe degradation:** Fall back from reranked to calibrated non-reranked retrieval without applying incompatible score thresholds.
- **G9 - Versioned configuration:** Apply validated configuration changes without redeployment and retain the last known-good version.
- **G10 - Tenant and project isolation:** Apply authorization before routing and never expose unauthorized dataset existence through results or telemetry.

### 2.2 Non-Goals

- Multilingual analysis or retrieval optimization.
- Querying every eligible dataset for every request.
- Training a custom classifier in v2.
- Answer generation or prompt design after context assembly.
- Multi-turn query rewriting. The system receives a standalone query.
- Replacing each dataset's underlying chunk retrieval engine.
- Using historical popularity as a hard routing signal.
- Enabling knowledge-graph retrieval for every analytical query.

---

## 3. Design Principles and Invariants

1. **Authorization precedes routing.** Unauthorized projects and datasets never enter router candidate sets.
2. **Query intent and retrieval properties are separate.** A query may be analytical and lexical, or summary-oriented and verbatim, at the same time.
3. **Routing is bounded.** Full retrieval is limited by configured project, dataset, candidate, and time budgets.
4. **No silent routing decisions.** Selected and non-selected datasets are explainable from the request scope, catalog version, router version, and score policy.
5. **Exact scores are not hybrid scores.** Exact phrase hits use a separate priority band and are not numerically blended with semantic scores.
6. **Reranked and non-reranked scores are not interchangeable.** Each path has separate weights, score floors, calibration versions, and fallbacks.
7. **Retrieval failure is not evidence absence.** Partial coverage, failed shards, and timeouts are surfaced explicitly.
8. **Profile values are seed configurations.** Production activation requires evaluation and score calibration for the selected embedding and rerank models.

---

## 4. Terminology

| Term | Definition |
|---|---|
| Eligible project | A project the caller is authorized to search after hard scope filters. |
| Eligible dataset | A dataset the caller is authorized to search after project, tenant, ACL, and request filters. |
| Dataset catalog | A small routing index containing dataset-level representations rather than document chunks. |
| Exact locator index | A central positional phrase and character n-gram index mapping normalized text to dataset, document, and chunk locations. |
| Base profile | One of `PRECISION`, `BALANCED`, `RECALL`, or `NONE`. |
| Modifier | An independent retrieval behavior added to a base profile. |
| Routing wave | One bounded selection and retrieval attempt over a set of projects or datasets. |
| Candidate | A chunk returned before final context selection. |
| Context chunk | A final chunk passed to answer generation. |
| Calibration version | The versioned mapping or threshold set used to interpret retrieval or rerank scores. |

---

## 5. High-Level Architecture

```text
Standalone query
      |
      v
+-------------------------+
| 1. Query Analyzer       |
| - normalization         |
| - deterministic rules   |
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
| - score calibration and fusion                    |
| - optional cross-encoder rerank                    |
| - deduplication, diversity, neighbor expansion    |
+----------------------------------------------------+
      |
      | Final chunks
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
- Exact locator index.
- Classifier cache.
- Score calibration registry.
- Circuit-breaker state.
- Telemetry and evaluation stores.

---

## 6. Query Analyzer

### 6.1 Output Contract

```json
{
  "base_profile": "PRECISION",
  "modifiers": ["LEXICAL"],
  "confidence": 0.91,
  "classifier": "rule:R_IDENTIFIER",
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

### 6.2 Base Profiles

| Profile | Use |
|---|---|
| `PRECISION` | A narrow lookup expected to have one or a few directly relevant chunks. |
| `BALANCED` | A normal question needing moderate recall and precision. |
| `RECALL` | A summary, comparison, broad list, or analysis needing diverse evidence. |
| `NONE` | High-confidence conversational or meta input that requires no retrieval. |

### 6.3 Modifiers

| Modifier | Effect |
|---|---|
| `LEXICAL` | Increases lexical candidate quota and lexical influence for identifiers or keyword-style queries. |
| `EXACT` | Runs the exact locator path for quoted or pasted source content. |
| `MULTI_EVIDENCE` | Requires source diversity, raises evidence minimums, and may trigger routing escalation. |
| `NEIGHBOR_EXPANSION` | Fetches adjacent or parent chunks after ranking to preserve procedures and local context. |

Modifiers compose with profiles. For example:

- `PRECISION + LEXICAL`: "Who approved PO-2231?"
- `RECALL + EXACT + MULTI_EVIDENCE`: "Summarize this pasted policy section."
- `BALANCED + NEIGHBOR_EXPANSION`: "How do I reset the device?"

### 6.4 Normalized Signals

The rule path computes:

- Character, token, and sentence counts.
- Question mark and interrogative lead.
- English imperative and intent phrases.
- Quoted span length.
- Identifier patterns configured by project.
- Uppercase, punctuation, and newline density.
- Paste artifacts such as bullets, page headers, repeated line breaks, and hyphenation.
- Stopword ratio for sufficiently long queries.
- Explicit dataset or project references.

English-only operation uses one tokenizer and one stopword set. Named-entity recognition is not required on the fast path.

### 6.5 Ordered Rules

Rules produce independent base-profile and modifier decisions:

```text
R01 high-confidence greeting, thanks, or meta request
    -> NONE

R02 pasted prose or quoted span >= 8 tokens
    -> EXACT

R03 configured document, invoice, order, ticket, or error identifier
    -> LEXICAL

R04 summary, overview, compare, differences, list all, or across
    -> RECALL + MULTI_EVIDENCE

R05 why, impact, implication, root cause, or what-if
    -> RECALL + MULTI_EVIDENCE

R06 how to, steps, procedure, instructions, or troubleshoot
    -> BALANCED + NEIGHBOR_EXPANSION

R07 short interrogative expecting one entity or value
    -> PRECISION

R08 one to four non-sentence search terms
    -> PRECISION + LEXICAL

R09 normal question
    -> BALANCED

R10 insufficient evidence
    -> LLM fallback
```

An identifier adds `LEXICAL`; it does not imply `EXACT`. `EXACT` requires evidence that query text was copied or deliberately quoted.

### 6.6 Rule Confidence

Rule confidence values must be calibrated from labeled traffic:

- A configured threshold controls whether the LLM fallback runs.
- Each rule reports precision, recall, and sample size.
- Uncalibrated rule scores are called `rule_score`, not probability.
- Production `confidence` is emitted only after calibration.

### 6.7 LLM Fallback

The LLM fallback:

- Runs only when deterministic rules cannot choose a base profile.
- Uses temperature `0` and structured output.
- May return one base profile and zero or more valid modifiers.
- Cannot alter scope or authorization.
- Times out after 800 ms.
- Falls back to `BALANCED` on timeout or invalid output.
- Caches results by normalized query hash, analyzer version, model version, prompt version, and tenant.
- Never shares cache entries across tenants.

---

## 7. Retrieval Parameter Model

### 7.1 Separation of Concerns

Adaptive RAG v2 separates five candidate counts:

| Parameter | Meaning |
|---|---|
| `dense_candidate_k` | Dense ANN candidates requested from each selected dataset. |
| `lexical_candidate_k` | Lexical/BM25 candidates requested from each selected dataset. |
| `fusion_candidate_k` | Candidates retained after lexical-dense fusion per dataset. |
| `rerank_candidate_k` | Globally pooled candidates sent to the cross-encoder. |
| `context_top_n` | Final chunks passed to answer generation before neighbor expansion. |

This avoids overloading RAGFlow-style `top_k` with candidate generation, reranking, and context responsibilities.

### 7.2 RAGFlow Parameter Mapping

| RAGFlow-style parameter | Adaptive RAG v2 interpretation |
|---|---|
| `top_n` | `context_top_n` |
| `top_k` | Closest to `dense_candidate_k`; it is not the final rerank or context count. |
| `similarity_threshold` | A calibrated hybrid score floor for the non-reranked path. |
| `vector_similarity_weight` without reranker | `dense_score_weight` in lexical-dense fusion. |
| `vector_similarity_weight` with reranker | `rerank_score_weight` in lexical-rerank final scoring. |
| `rerank_model` | `rerank.enabled` plus a versioned model ID. |
| `keyword` or `keyword_boost` | Lexical query expansion and lexical candidate generation policy. |
| `use_knowledge_graph` | A separately gated retrieval source, not a default profile switch. |

### 7.3 Non-Reranked Scoring

For candidate `c`:

```text
hybrid_score(c) =
    dense_score_weight   * calibrated_dense_score(c)
  + lexical_score_weight * calibrated_lexical_score(c)
  + exact_identifier_bonus(c)
```

Where:

```text
lexical_score_weight = 1 - dense_score_weight
```

Requirements:

- Dense and lexical scores must be calibrated before weighted addition.
- Reciprocal Rank Fusion may replace weighted addition when reliable score calibration is unavailable.
- `exact_identifier_bonus` is non-zero only when a normalized configured identifier exactly matches an indexed identifier or lexical field.
- The identifier bonus is capped at `0.10`, requires a qualifying lexical match, and is included in score calibration.
- The non-reranked score floor is versioned by embedding model, lexical engine, profile, and calibration version.
- Exact locator hits are not inserted into this formula.

### 7.4 Reranked Scoring

The reranked path has two steps.

**Candidate generation:**

```text
candidate_score(c) =
    candidate_dense_weight   * calibrated_dense_score(c)
  + candidate_lexical_weight * calibrated_lexical_score(c)
```

**Final scoring:**

```text
final_score(c) =
    rerank_score_weight * calibrated_rerank_score(c)
  + lexical_score_weight * calibrated_lexical_score(c)
  + exact_identifier_bonus(c)
```

Where:

```text
lexical_score_weight = 1 - rerank_score_weight
```

Dense cosine determines candidate recall but does not masquerade as the cross-encoder score. Reranker score floors are calibrated independently from non-reranked hybrid score floors.

### 7.5 Seed Base Profiles

These values are shadow-mode starting points, not universal production constants.

| Profile | Dense K | Lexical K | Fusion K | Rerank K | Context N | Dense weight, no rerank | Rerank weight | Max per document |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| `PRECISION` | 256 | 128 | 96 | 60 | 5 | 0.45 | 0.80 | 2 |
| `BALANCED` | 512 | 256 | 160 | 100 | 8 | 0.55 | 0.75 | 3 |
| `RECALL` | 1024 | 512 | 256 | 150 | 12 | 0.65 | 0.70 | 3 |
| `NONE` | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |

### 7.6 Modifier Adjustments

#### LEXICAL

- Double `lexical_candidate_k`, capped at 1024.
- Reduce non-reranked `dense_score_weight` by `0.20`, floor `0.15`.
- Enable configured identifier normalization and exact-term bonuses.
- Do not lower the final score floor solely because an identifier exists.

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

### 7.7 Score Floors

Seed floors may be used only in shadow mode:

| Path | Precision | Balanced | Recall |
|---|---:|---:|---:|
| Non-reranked hybrid | 0.18 | 0.14 | 0.10 |
| Reranker | 0.25 | 0.20 | 0.15 |

Production floors require a calibration report. Changing an embedding model, lexical engine, reranker, fusion formula, or score normalization invalidates the relevant calibration version.

### 7.8 Empty-Result Retry

At most one retrieval retry is allowed:

1. If no candidates were generated, expand dense and lexical candidate counts by 2x.
2. If candidates existed but were filtered by the score floor, use the profile's calibrated low-recall floor.
3. Do not lower an exact-match confidence threshold.
4. Do not retry `NONE`.
5. Record the retry reason and parameter delta.

### 7.9 Reranker Circuit Breaker

The reranker circuit breaker opens on configured timeout or error-rate thresholds.

When open:

- Use the profile's complete non-reranked scoring configuration.
- Apply the non-reranked calibration version and score floor.
- Do not reuse the reranked threshold.
- Record `degraded_mode: "no_rerank"`.

---

## 8. Hierarchical Routing

### 8.1 Routing Hierarchy

Routing has four levels:

```text
L0: authorization and explicit scope
L1: project catalog routing
L2: dataset catalog routing
L3: full chunk retrieval in selected datasets
```

Document and chunk counts do not affect L1 and L2 search complexity. The router searches compact project and dataset catalog entries.

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
- Catalog freshness timestamp.
- Health state.

Large or heterogeneous datasets may publish multiple centroids. Centroids are routing summaries, not replacements for chunk retrieval.

### 8.5 Catalog Maintenance

Catalog entries are refreshed:

- On dataset creation, deletion, or ACL change.
- After document ingestion completes.
- After a configurable content-change threshold.
- At least once every 24 hours.

Catalog updates are versioned and atomic. A request uses one catalog snapshot version for its entire routing decision.

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

Selection may stop below the initial limit when:

- The next route score is below the calibrated routing floor.
- The score margin after the last selected item is sufficiently large.
- All mandatory inclusions have been added.

Mandatory inclusions do not consume the minimum selection count but do consume the hard maximum unless the caller explicitly requests otherwise.

### 8.8 Exact Locator Shortcut

For `EXACT` queries:

1. Search the exact locator index across the authorized scope.
2. Add datasets containing high-confidence phrase or n-gram hits as mandatory inclusions.
3. Skip catalog ranking when locator confidence is high and all hits fit within the dataset budget.
4. Run catalog routing in parallel for fuzzy fallback or ambiguous repeated text.

This provides broad exact-text coverage without sending a full retrieval request to every dataset.

### 8.9 Routing Wave 1

Wave 1:

1. Select projects.
2. Select datasets within those projects.
3. Add mandatory datasets from explicit scope, identifiers, and exact locator hits.
4. Group datasets by retrieval engine and embedding model.
5. Execute full retrieval with bounded concurrency and a shared deadline.
6. Fuse candidates globally.
7. Evaluate evidence sufficiency.

### 8.10 Evidence Sufficiency

Wave 1 is insufficient when any configured condition is true:

- No result survives the applicable score floor.
- Fewer than `min(context_top_n, 3)` chunks survive.
- `MULTI_EVIDENCE` has fewer than three evidence chunks.
- `MULTI_EVIDENCE` results come from only one dataset when multiple selected datasets produced candidates.
- The top score is below the calibrated sufficiency floor.
- More than 25% of selected datasets failed or timed out.

### 8.11 Routing Escalation

At most one synchronous escalation is allowed:

- Expand to the next project and dataset candidates up to the configured maxima.
- Do not rerun datasets completed in Wave 1.
- Preserve mandatory inclusions.
- Use the remaining request deadline.
- Stop when the total fully searched dataset cap is reached.

If results remain insufficient, return an honest no-result or partial-coverage outcome. The system does not fan out to every eligible dataset.

### 8.12 Auditable Routing

Per-query telemetry stores:

- Scope policy and authorized-scope count.
- Project and dataset catalog versions.
- Router model and calibration versions.
- Selected projects and datasets with scores and reasons.
- Mandatory inclusions and their reasons.
- Selection floors, margins, and budgets.
- Escalation decision.
- Failed and timed-out datasets.
- A normalized query hash rather than raw pasted text.

The full list of thousands of non-selected datasets is not copied into every request log. The decision is reconstructable from:

```text
query hash + normalized routing features + scope policy version
+ catalog snapshot version + router version + selection policy
```

### 8.13 Routing Quality Metric

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

---

## 9. Exact and Verbatim Retrieval

### 9.1 Ingestion Additions

The indexing pipeline adds:

- Unicode-normalized source text.
- Lowercased English token stream.
- Positional term index for phrase search.
- Character 4-gram index for OCR and punctuation variation.
- Chunk adjacency and parent-section links.
- Cross-chunk windows spanning the end of one chunk and start of the next.
- Dataset, document, page, section, and chunk provenance.

These fields may live in a separate exact locator index and do not require replacing the main hybrid retrieval index.

### 9.2 Query Normalization

Normalize pasted text with:

- Unicode NFKC.
- Case folding.
- Whitespace collapsing.
- Smart quote normalization.
- Dash and hyphen normalization.
- Line-break dehyphenation.
- Removal of repeated page headers and footers when confidently detected.

Original text is preserved for display and answer generation.

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

Unlike v1, fuzzy fallback is not forced to near-pure lexical scoring. Dense retrieval remains available to handle OCR changes, paraphrases, and partial edits. Translation recovery is outside the English-only v2 scope.

### 9.7 Miss Handling

If no exact or qualified fuzzy result is found:

- Return `found: false`.
- Do not invent a source.
- Include partial-coverage and failed-dataset information.
- Optionally return nearest fuzzy results labeled `similar_not_exact`.

---

## 10. Candidate Fusion and Context Assembly

### 10.1 Per-Dataset Candidate Quotas

Each selected dataset returns at most `fusion_candidate_k` candidates. The global pool applies:

- A hard `rerank_candidate_k` cap when reranking is enabled.
- A hard `global_candidate_k` cap when reranking is disabled.
- A minimum quota for mandatory datasets.
- A maximum quota per dataset to prevent one large dataset from monopolizing the pool.

### 10.2 Cross-Dataset Merge

The system does not min-max or z-score each result list independently. Those methods can make the best result from an irrelevant dataset appear globally strong.

Use one of:

1. Calibrated global scores for compatible retrieval backends.
2. Reciprocal Rank Fusion when score calibration is unavailable.
3. Global cross-encoder reranking over quota-balanced candidates.

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

---

## 11. Knowledge-Graph Retrieval

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

### 12.1 Example

```yaml
adaptive_rag:
  version: "2.0.0"
  language: "en"

  analyzer:
    rule_confidence_min: 0.82
    llm_fallback:
      enabled: true
      timeout_ms: 800
      cache_ttl_hours: 24

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
        dense_score_weight: 0.45
        identifier_bonus_max: 0.10
        score_floor: 0.18
        calibration_id: "hybrid-precision-v1"
      rerank:
        enabled: true
        rerank_score_weight: 0.80
        identifier_bonus_max: 0.10
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
        dense_score_weight: 0.55
        identifier_bonus_max: 0.10
        score_floor: 0.14
        calibration_id: "hybrid-balanced-v1"
      rerank:
        enabled: true
        rerank_score_weight: 0.75
        identifier_bonus_max: 0.10
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
        dense_score_weight: 0.65
        identifier_bonus_max: 0.10
        score_floor: 0.10
        calibration_id: "hybrid-recall-v1"
      rerank:
        enabled: true
        rerank_score_weight: 0.70
        identifier_bonus_max: 0.10
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
    max_dataset_concurrency: 16
    dataset_timeout_ms: 900
    total_timeout_ms:
      no_rerank: 1500
      rerank: 3000

  telemetry:
    raw_query_logging: false
    decision_retention_days: 30
```

### 12.2 Validation

Configuration reload is atomic:

1. Parse and schema-validate the new version.
2. Verify every referenced calibration and model ID.
3. Verify all weights and candidate limits.
4. Run deterministic configuration smoke tests.
5. Activate the entire version or retain the last known-good version.

No request may combine fields from two configuration versions.

---

## 13. Internal API

### 13.1 Request

```http
POST /v2/adaptive-retrieve
```

```json
{
  "query": "Why did incident E-4402 occur?",
  "project_ids": ["project-a"],
  "dataset_ids": null,
  "metadata_filters": null,
  "rerank_mode": "auto",
  "use_knowledge_graph": false,
  "trace": true
}
```

`rerank_mode` values:

- `auto`: Use profile configuration and circuit-breaker state.
- `on`: Require reranking; fail explicitly if unavailable.
- `off`: Use the calibrated non-reranked path.

### 13.2 Response

```json
{
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
    "modifiers": ["LEXICAL", "MULTI_EVIDENCE"],
    "classifier": "rule:R05+R03",
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
      "waves": 1,
      "failed_datasets": []
    },
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

---

## 14. Observability and Privacy

### 14.1 Metrics

Record:

- Rules-only and LLM-fallback rates.
- Base profile and modifier distributions.
- Classification quality by rule.
- Project and dataset `Routing Recall@M`.
- Selected and fully searched dataset counts.
- Escalation rate and benefit.
- Candidate counts at each stage.
- Retrieval Recall@K, MRR, and nDCG.
- Exact top-3 source rate.
- Reranker usage, latency, timeout, and circuit-breaker state.
- Context diversity and duplicate removal.
- Partial-coverage and shard-failure rates.
- Latency and infrastructure cost per profile and scoring path.

### 14.2 Query Privacy

- Raw queries and pasted content are not logged by default.
- Query hashes use a tenant-specific keyed hash.
- Debug logging of raw content requires an explicit short-lived permission.
- Classifier cache entries are tenant-scoped.
- Telemetry never includes unauthorized dataset names or IDs.

### 14.3 Offline Evaluation

The evaluation set includes:

- Precision lookups.
- Identifiers and search-style keyword queries.
- Procedures spanning adjacent chunks.
- Broad summaries and comparisons.
- Analytical multi-evidence questions.
- Exact fragments within one chunk.
- Exact fragments spanning chunk boundaries.
- OCR and punctuation variations.
- Repeated boilerplate across documents.
- Queries where the relevant dataset is newly created or rarely used.

---

## 15. Failure Modes

| Failure | Required behavior |
|---|---|
| Rule analyzer uncertain | Use LLM fallback, then `BALANCED` on failure. |
| LLM classifier timeout | Use `BALANCED`; do not delay retrieval beyond 800 ms. |
| Project catalog unavailable | Use explicit project and dataset scope; otherwise use the last healthy snapshot and flag degradation. |
| Dataset catalog unavailable | Search mandatory datasets and configured project defaults only; never fan out to every dataset. |
| Catalog stale | Use the last snapshot, include recently changed mandatory entries, and flag `catalog_stale`. |
| Exact locator unavailable | Continue with fuzzy hierarchical retrieval and flag `exact_locator_unavailable`. |
| Reranker unavailable in `auto` | Use the calibrated non-reranked profile. |
| Reranker unavailable in `on` | Return an explicit dependency failure. |
| Dataset timeout | Return partial results with failed dataset IDs visible only when authorized. |
| More than 25% selected datasets fail | Set `coverage_incomplete: true`. |
| Empty after escalation | Return `found: false`; do not fabricate evidence. |
| Invalid config reload | Keep the last known-good version and alert. |

---

## 16. Acceptance Criteria

### 16.1 Analyzer

- Rules-only analyzer latency is less than 5 ms p95.
- At least 90% of production queries avoid classifier LLM calls.
- Base-profile macro F1 is at least 0.90.
- Each production modifier has precision and recall of at least 0.90.
- `NONE` precision is at least 0.98 to avoid incorrectly skipping retrieval.

### 16.2 Routing

- Overall `Routing Recall@M` is at least 99.5%.
- No critical project or tenant slice is below 98%.
- Routing p95 is at most 100 ms with 10,000 eligible dataset catalog entries.
- A request fully searches no more than 64 datasets unless explicit authorized dataset IDs exceed the cap.
- New-dataset routing quality is reported separately and meets at least 98% recall.

### 16.3 Retrieval Quality

- Each base profile matches or exceeds the static RAGFlow-style baseline on Recall@K and nDCG.
- `PRECISION` improves MRR without reducing Recall@5 by more than one percentage point.
- `RECALL + MULTI_EVIDENCE` improves relevant-source coverage over the static baseline.
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

### 16.6 Operations

- A validated config change takes effect within 60 seconds without redeployment.
- Every response identifies its config, router, catalog, and calibration versions.
- No request crosses tenant or project authorization boundaries.
- Invalid configuration never replaces the last known-good version.

---

## 17. Rollout Plan

### Phase 0 - Baseline

- Build the labeled analyzer, routing, retrieval, and exact-fragment evaluation sets.
- Measure the static RAGFlow-style baseline.
- Establish score calibrations for reranked and non-reranked paths.

### Phase 1 - Analyzer and Profiles

- Run analyzer and profile selection in shadow mode.
- Compare selected plans with the static baseline.
- Calibrate rule confidence and modifier decisions.

### Phase 2 - Hierarchical Router

- Build project and dataset catalogs.
- Run routing in shadow mode while full baseline retrieval remains authoritative.
- Measure `Routing Recall@M` and tune selection budgets.

### Phase 3 - Exact Locator

- Add positional, character n-gram, adjacency, and cross-chunk indexes.
- Enable exact routing and source-location evaluation.

### Phase 4 - Controlled Activation

- Activate adaptive profiles for low-risk tenants.
- Enable hierarchical routing after the 99.5% routing recall gate passes.
- Enable reranker circuit-breaker fallback.

### Phase 5 - Scale and General Availability

- Load test with at least 10,000 eligible dataset catalog entries.
- Validate isolation across multiple tenants and projects.
- Enable canary config rollout and automated rollback.

---

## 18. Deferred Options

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

## 19. References

- [RAGFlow: Run retrieval test](https://ragflow.io/docs/dev/run_retrieval_test)
- [RAGFlow: HTTP API - Retrieve chunks](https://ragflow.io/docs/dev/http_api_reference#retrieve-chunks)
