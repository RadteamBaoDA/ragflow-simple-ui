# Adaptive RAG v2 — Codex Coding Contract

**Purpose:** Standalone implementation input for a coding agent.
**Target:** Node.js 22+, strict TypeScript, OpenSearch.
**Scope:** Retrieval only over already indexed chunks.
**Authority:** `adaptive-rag-spec-v2.md` remains authoritative if this contract is ambiguous.

## 0. Agent Instructions

Implement only the mechanisms in this file. Do not add document parsing, chunking, ingestion, embedding jobs, index creation, answer generation, autonomous web research, online self-training, or more than three synchronous retrieval hops.

Use these requirement levels:

- **MUST:** required for correctness, security, or interoperability.
- **SHOULD:** default unless deployment evidence justifies a different choice.
- **MAY:** optional and separately gated.
- Seed weights, score floors, and candidate counts are shadow-mode defaults. Production activation requires calibration.

Prefer small modules with injected dependencies. No framework-specific folder layout is required. Keep every adaptive decision versioned and observable.

## 1. Required Outcome

Build a retrieval service that adapts each request by:

1. Detecting query language and query family.
2. Selecting one base profile plus composable modifiers.
3. Resolving trusted tenant, project, dataset, metadata, and ACL scope.
4. Routing to a bounded set of projects and datasets.
5. Grouping compatible datasets into bounded OpenSearch work units.
6. Running lexical, dense, exact, and optional graph retrieval as selected.
7. Fusing, optionally reranking, deduplicating, diversifying, and assembling evidence.
8. Evaluating evidence sufficiency.
9. Running at most one retrieval/routing relaxation or at most three grounded hops.
10. Returning evidence, citations, coverage state, and an auditable decision trace.

```text
query + trusted identity
          |
          v
analyze -> authorize -> plan -> route -> grouped retrieval
                                             |
                                             v
                                  fuse -> rerank? -> assemble
                                             |
                                      evidence sufficient?
                                      /                  \
                                    yes                   no
                                     |          one bounded retry/hop
                                     v                    |
                              evidence + trace <----------+
```

## 2. Non-Negotiable Invariants

1. Authorization MUST run before catalog routing or chunk search.
2. User input MUST NOT supply raw OpenSearch Query DSL, index names, ACLs, tenant IDs, or routing keys.
3. Explicit unauthorized project or dataset scope MUST return `FORBIDDEN` and execute no search.
4. Every targeted index MUST come from an authorized catalog entry. Reject wildcard and implicit all-index searches.
5. Retrieval MUST use read APIs only.
6. Full search MUST remain bounded by project, dataset, physical-group, candidate, hop, context-token, concurrency, and deadline limits.
7. Do not issue one request per logical dataset when compatible datasets share a physical index. Group them.
8. Do not add raw BM25, vector, exact, translation, and reranker scores.
9. Reranked and non-reranked paths MUST use separate score semantics, floors, and calibration IDs.
10. A modifier MUST NOT expand authorized scope.
11. Partial failures MUST retain successful evidence and report incomplete coverage.
12. No qualifying evidence MUST return `INSUFFICIENT_EVIDENCE`; never fabricate a source.
13. Raw queries and pasted content MUST NOT be logged by default.
14. One request MUST use one immutable configuration and catalog snapshot version.
15. Runtime telemetry or model output MUST NOT mutate production configuration.

## 3. Core TypeScript Contracts

Use closed enums/unions and schema validation at request, configuration, catalog, and model boundaries.

The HTTP boundary is `POST /v2/adaptive-retrieve` and uses snake_case fields:

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

The TypeScript contracts below use camelCase internally; the HTTP adapter MUST map explicitly between the two forms. Tenant, user, principals, and ACL grants come only from trusted authentication middleware. `max_hops` may narrow but never raise the configured maximum. Metadata filters are allow-listed and may only narrow scope.

```ts
export type BaseProfile = 'PRECISION' | 'BALANCED' | 'RECALL' | 'NONE'

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

export type RetrievalStatus =
  | 'FOUND'
  | 'PARTIAL'
  | 'INSUFFICIENT_EVIDENCE'
  | 'NO_RETRIEVAL'
  | 'DEPENDENCY_ERROR'
  | 'FORBIDDEN'

export type RerankMode = 'auto' | 'on' | 'off'
export type ScoreType = 'rrf' | 'rerank' | 'exact'

export interface LanguageDecision {
  primary: string
  confidence: number
  source: 'detector' | 'hint' | 'tenant_default' | 'unknown'
  mixed: boolean
  analysisLanguages: string[]
  candidates: Array<{ language: string; score: number }>
}

export interface QuerySignals {
  tokenCount: number
  sentenceCount: number
  hasQuestion: boolean
  identifierHits: string[]
  quotedTokenCount: number
  looksLikePaste: boolean
  temporal: boolean
  tabular: boolean
  comparative: boolean
  relational: boolean
}

export interface RetrievalIntent {
  baseProfile: BaseProfile
  modifiers: Modifier[]
  language: LanguageDecision
  confidence: number
  classifier: string
  signals: QuerySignals
  keyTerms: string[]
  subqueries: string[]
  hopTemplates: string[]
}

export interface TrustedIdentity {
  tenantId: string
  userId: string
  principals: string[]
  allowedProjectIds: string[]
  allowedDatasetIds: string[]
}

export interface RetrievalRequest {
  query: string
  languageHint?: string
  projectIds?: string[]
  datasetIds?: string[]
  metadataFilters?: Record<string, unknown>
  asOf?: string
  rerankMode: RerankMode
  maxHops?: number
  useKnowledgeGraph?: boolean
  trace?: boolean
}

export interface AuthorizedScope {
  tenantId: string
  eligibleProjectIds: string[]
  eligibleDatasetIds?: string[]
  mandatoryDatasetIds: string[]
  metadataFilters: Record<string, unknown>
  scopePolicyVersion: string
}

export interface SearchGroup {
  clusterId: string
  index: string
  routingKey?: string
  datasetIds: string[]
  embeddingModelId: string
  vectorField: string
  vectorDimension: number
  distanceSpace: string
  lexicalSchemaId: string
}

export interface Candidate {
  chunkId: string
  tenantId: string
  projectId: string
  datasetId: string
  documentId: string
  text: string
  source: Record<string, unknown>
  nativeScores: Partial<Record<'lexical' | 'dense' | 'exact' | 'rerank', number>>
  ranks: Partial<Record<'lexical' | 'dense' | 'exact', number>>
  finalScore: number
  scoreType: ScoreType
  exactMatch: boolean
  expandedContext: boolean
  hop: number
}
```

The response MUST contain:

- `status`, `found`, and `coverageIncomplete`.
- Evidence chunks with stable IDs, project/dataset/document IDs, text, source provenance, final score, and score type.
- Base profile, modifiers, language decision, classifier, scoring path, and skip/degradation reasons.
- Config, scope-policy, router, catalog, model, and calibration versions.
- Eligible and selected scope counts, mandatory datasets, search groups, routing waves, and failures.
- Hop query hashes, dependencies, evidence IDs, unresolved hops, and completion state.
- Stage timings and total timing.

## 4. Query Analyzer

### 4.1 Language Detection

Run before language-specific intent rules:

1. Preserve original query; normalize an analysis copy with Unicode NFKC.
2. Separate identifiers, URLs, code, and quoted/pasted spans from natural-language text.
3. Run a local or approved private detector.
4. Normalize tags to BCP 47 base languages (`en-US -> en`).
5. Use authenticated locale or tenant default only as configured tie-breakers.
6. Mark mixed language when two qualified languages exceed the configured threshold.
7. Select one primary and at most two analysis languages.

Rules:

- Fewer than four natural-language tokens, identifier-only input, or code-heavy input becomes `und` unless the short-query confidence gate passes.
- `und` uses language-neutral rules, multilingual dense retrieval, and `text.universal` when available.
- Unsupported lexical languages fall back to universal lexical fields or dense-only retrieval; do not fail.
- Language is not a hard chunk filter unless the caller explicitly requests source language and policy permits it.
- Cache by tenant-scoped query hash plus detector and language-pack versions.
- Seed packs: English `en`, Vietnamese `vi`, Japanese `ja`. Packs provide tokenizer, stopwords, intent phrases, date expressions, and lexical fields.

### 4.2 Profiles and Modifiers

| Profile | Select when |
|---|---|
| `PRECISION` | One or a few direct chunks should answer a narrow lookup. |
| `BALANCED` | Normal question requiring moderate precision and recall. |
| `RECALL` | Summary, comparison, broad list, impact analysis, or diverse evidence. |
| `NONE` | Calibrated high-confidence conversational/meta input needs no retrieval. |

| Query signal | Required plan |
|---|---|
| Greeting, thanks, meta | `NONE` |
| Identifier/search terms | `PRECISION + LEXICAL` |
| Quoted/pasted source | `PRECISION + EXACT` |
| Direct fact | `PRECISION` |
| Acronym/internal jargon | `PRECISION + LEXICAL_EXPANSION` |
| Procedure/troubleshooting | `BALANCED + NEIGHBOR_EXPANSION` |
| Policy/eligibility | `BALANCED + MULTI_EVIDENCE` |
| Current/as-of policy | `BALANCED + TEMPORAL` |
| Table/numeric | `BALANCED + TABLE_AWARE` |
| Summary/exhaustive list | `RECALL + MULTI_EVIDENCE` |
| Independent comparison | `RECALL + DECOMPOSE + MULTI_EVIDENCE` |
| Root cause/dependency chain | `RECALL + MULTI_HOP + MULTI_EVIDENCE` |
| Later hop needs found entity | add `ENTITY_CARRYOVER` |
| Query/source language mismatch | add `CROSS_LINGUAL` |

Ordered merge rules:

1. Conflicting profiles resolve `RECALL > BALANCED > PRECISION`.
2. `NONE` is valid only with no retrieval modifier and calibrated precision at least `0.98`.
3. `MULTI_HOP` implies `MULTI_EVIDENCE`.
4. Ignore `ENTITY_CARRYOVER` without `MULTI_HOP`.
5. `DECOMPOSE` means parallel independent questions; `MULTI_HOP` means sequential dependent questions.
6. An identifier enables `LEXICAL`, not `EXACT`. `EXACT` requires copied or deliberately quoted text.
7. Exact search runs beside fuzzy retrieval unless an authorized unique exact hit is sufficient.
8. `TABLE_AWARE` retrieves row/header evidence; it does not calculate.
9. `TEMPORAL` uses a hard filter only for explicit dates or a validated `is_current` field. Otherwise prefer recent evidence while retaining older conflicts.
10. Language-neutral high-confidence modifiers cannot be removed by language-pack rules.

### 4.3 Deterministic and LLM Paths

The deterministic path computes token/sentence counts, interrogatives, identifiers, quotes, paste artifacts, glossary terms, temporal/table/comparison/relationship phrases, explicit scope references, and natural-language-to-code ratio.

At least 90% of queries SHOULD avoid the LLM classifier. If deterministic rules cannot select a profile:

- Use temperature `0` and closed structured output.
- Allow only one known profile, known modifiers, at most three subqueries, and at most three hop templates.
- Timeout after `800 ms`; on timeout or invalid output use `BALANCED`.
- Do not allow the model to alter scope, filters, language fields, or evidence.
- Cache by tenant, normalized-query hash, analyzer/model/prompt versions.

### 4.4 Decomposition and Multi-Hop

`DECOMPOSE`:

- At most three independent subqueries.
- Same authorized scope and global deadline.
- Reserve candidates per comparison side.
- Require qualifying evidence for every side or return incomplete coverage.

`MULTI_HOP`:

- At most three hops and three subqueries per hop.
- At most eight carryover entities per hop.
- Generated subquery at most 128 characters.
- Carry only allow-listed entities supported by selected evidence.
- Never reuse a normalized subquery or expand scope.
- Preserve original primary language unless an approved `CROSS_LINGUAL` variant is recorded.
- Stop on sufficient evidence, missing grounded entities, repeated query, or less than `250 ms` remaining.
- Return hop dependencies and unresolved hops. Never label partial hop chains complete.

## 5. Retrieval Plan and Seed Defaults

Candidate counts have separate meanings:

- `denseCandidateK`: ANN results per physical group.
- `lexicalCandidateK`: BM25 results per physical group.
- `fusionCandidateK`: fused results retained per group.
- `globalCandidateK`: global cap without reranking.
- `rerankCandidateK`: global pool sent to reranker.
- `contextTopN`: ranked anchors before neighbor expansion.

| Profile | Dense | Lexical | Fusion | Global | Rerank | Context | Context tokens | Max/document |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| `PRECISION` | 256 | 128 | 96 | 120 | 60 | 5 | 4,000 | 2 |
| `BALANCED` | 512 | 256 | 160 | 240 | 100 | 8 | 8,000 | 3 |
| `RECALL` | 1024 | 512 | 256 | 400 | 150 | 12 | 12,000 | 3 |
| `NONE` | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |

| Profile | Lexical RRF | Dense RRF | Exact RRF | RRF floor | Rerank min | Rerank timeout | Rerank floor |
|---|---:|---:|---:|---:|---:|---:|---:|
| `PRECISION` | 1.25 | 1.00 | 1.50 | 0.018 | 10 | 800 ms | 0.25 |
| `BALANCED` | 1.00 | 1.00 | 1.50 | 0.014 | 20 | 800 ms | 0.20 |
| `RECALL` | 0.90 | 1.10 | 1.50 | 0.010 | 30 | 1000 ms | 0.15 |

All profiles use seed `rrfK = 60`.

Modifier adjustments:

- `LEXICAL`: double lexical K, cap `1024`; add `0.50` lexical RRF weight, cap `2.0`; enable identifier normalization.
- `EXACT`: run locator in parallel; exact-hit datasets become mandatory; fuzzy profile remains active.
- `LEXICAL_EXPANSION`: tenant-approved terms only; at most eight variants and 128 expanded tokens.
- `MULTI_EVIDENCE`: require at least three chunks when available; enforce document/dataset diversity; permit one routing escalation.
- `NEIGHBOR_EXPANSION`: fetch previous/next/parent/heading after ranking; charge tokens, not `contextTopN`.
- `TEMPORAL`: use `effective_from`, `effective_to`, `is_current`, `source_updated_at`.
- `TABLE_AWARE`: prefer `table|table_row`; search headers/text/normalized values; preserve header and row context.
- `CROSS_LINGUAL`: prefer compatible multilingual vectors; at most two approved translated lexical variants with a seed `400 ms` translation timeout; never translate IDs, code, URLs, or filters.

Production MUST NOT use seed floors until calibrated for the exact model, analyzer, fields, list count, RRF weights, `rrfK`, translation policy, and reranker.

## 6. Authorization and Hierarchical Routing

### 6.1 Scale Strategy

| Deployment shape | Behavior |
|---|---|
| Explicit/few datasets with millions of chunks | Bypass broad dataset ranking; run filtered BM25 + ANN in target pools. |
| Thousands of datasets | Search compact project/dataset catalogs; fully search only bounded selections. |
| Thousands of datasets and huge chunk volume | Route hierarchically, group compatible selections, issue bounded `_msearch`. |
| Explicit authorized dataset IDs | Make mandatory and bypass ranking for those IDs. |

Routing levels:

- `L0`: trusted tenant, ACL, explicit scope, metadata allow-list, lifecycle, health.
- `L1`: project catalog.
- `L2`: dataset catalog.
- `L3`: chunk retrieval in selected physical groups.

Catalogs MUST use a globally compatible multilingual routing embedding model. Chunk pools MAY use different embedding models, but each search group requires a compatible query vector.

Dataset catalog entries MUST include tenant/project/dataset and ACL fields; name/description/tags/aliases; identifier prefixes; content languages; routing centroids; document/chunk counts; time range; cluster/index/routing key; embedding model/vector field/dimension/distance; lexical schema; freshness; health.

Use one immutable healthy catalog snapshot per request. A stale snapshot may be used only by policy and MUST emit `catalog_stale`.

### 6.2 Router Score and Budgets

Seed score:

```text
routeScore =
  0.55 * calibratedDense
+ 0.30 * calibratedLexical
+ 0.15 * metadataMatch
```

Historical popularity is telemetry only; do not rank with it.

| Level | Initial | Minimum | Hard maximum |
|---|---:|---:|---:|
| Projects | 3 | 1 | 8 |
| Datasets/project | 8 | 4 | 32 |
| Fully searched datasets | 16 | 4 | 64 |
| Physical groups | 4 | 1 | 8 |

Stop selection early when the next score is below the calibrated floor, the score margin is sufficient, and all mandatory datasets are included. Mandatory datasets consume hard maxima. If explicit authorized datasets exceed a cap, retain them, obey the deadline, and report partial coverage; never silently drop them.

### 6.3 Physical Search Groups

Group selected datasets by the exact tuple:

```text
clusterId + physicalIndexOrAlias + embeddingModelId + vectorField
+ vectorDimension + distanceSpace + lexicalSchemaId + routingPolicy
```

For each group:

1. Generate/reuse a compatible query vector.
2. Select lexical fields for analysis languages and schema.
3. Build one trusted filter for tenant, project IDs, dataset IDs, principals, lifecycle, and allow-listed metadata.
4. Put the same trusted scope into lexical and k-NN queries.
5. Add one lexical and one dense child search to `_msearch`.
6. Set size, `_source` allow-list, routing key, and cancellation timeout.
7. Parse each child independently; retain successes and record shard/group failures.

Caps: two OpenSearch request batches, eight concurrent searches, five concurrent shard requests, eight physical groups, candidate limits, seed `900 ms` child-search timeout, and total deadline.

## 7. OpenSearch Read Contract

Required chunk semantics:

| Field | Required use |
|---|---|
| `chunk_id` | Stable global dedupe key. |
| `tenant_id`, `project_id`, `dataset_id` | Trusted scope and diversity. |
| `document_id` | Caps, dedupe, citation. |
| `visibility`, `acl_principals`, `lifecycle_state` | Mandatory security filter. |
| `text`, `source` | Evidence and provenance. |
| `embedding`, `embedding_model_id` | ANN and compatibility. |
| Language-specific text fields | BM25 for supported languages. |
| `text.universal` | Recommended `und`/unsupported fallback. |

Recommended/optional mechanisms require: `title`, `section`, `identifiers`, `language`, adjacency IDs, `sequence`, `chunk_kind`, table fields, temporal fields, `content_hash`, and source timestamps.

The server MUST construct a filter equivalent to:

```json
{
  "bool": {
    "filter": [
      { "term": { "tenant_id": "trusted-tenant" } },
      { "terms": { "project_id": ["authorized-project"] } },
      { "terms": { "dataset_id": ["selected-dataset"] } },
      { "term": { "lifecycle_state": "active" } },
      {
        "bool": {
          "should": [
            { "term": { "visibility": "public" } },
            { "terms": { "acl_principals": ["trusted-principal"] } }
          ],
          "minimum_should_match": 1
        }
      }
    ]
  }
}
```

Dense search MUST use the group's vector field, dimension, distance contract, and compatible query vector. Put the trusted filter inside the k-NN clause when supported by the configured Lucene/Faiss engine. Lexical search MUST use mapped fields compatible with index-time analyzers. `_source` MUST use an allow-list.

## 8. Retrieval Sources

### 8.1 Lexical and Dense

Run BM25 and ANN for every selected group unless the plan or dependency failure disables a source. Preserve native scores only for diagnostics. Missing one source MAY continue through the calibrated remaining-source path.

### 8.2 Exact Locator

When `EXACT` is enabled:

1. Normalize NFKC, case, whitespace, smart quotes, dashes, and line-break hyphenation.
2. Separate pasted content from the optional question only at high confidence.
3. Select two to four high-IDF shingles of 8–15 tokens.
4. Run phrase and cross-chunk phrase search.
5. Fall back to character 4-gram search with an edit-distance ceiling.
6. Return dataset/document/chunk/page/section/span/confidence.

Unique high-confidence hits enter an `exact` priority band. Repeated text returns multiple provenances and MUST NOT be called unique. On miss return `found: false`; optionally label nearest results `similar_not_exact`.

### 8.3 Optional Knowledge Graph

KG retrieval is off by default. Run only when explicitly requested or enabled by a calibrated rule for a healthy authorized graph. Keep separate quotas and provenance. KG failure MUST NOT fail text retrieval.

## 9. Fusion, Reranking, and Context

Portable default weighted RRF:

```text
score(c) =
  lexicalWeight / (rrfK + lexicalRank(c))
+ denseWeight   / (rrfK + denseRank(c))
+ exactWeight   / (rrfK + exactRank(c))
```

Missing ranks contribute zero.

Required order:

1. Retrieve candidate lists per physical group.
2. Join lists globally.
3. Deduplicate by stable chunk ID.
4. Compute weighted RRF from ranks.
5. Apply per-dataset and mandatory-dataset quotas.
6. Cap global rerank/non-rerank pool.
7. Optionally rerank with original query, chunk text, and minimal title/section.
8. Apply the active calibrated floor.
9. Deduplicate content, diversify, expand neighbors, and trim context.

Do not min-max or z-score each dataset independently. Calibrated global score fusion MAY replace RRF only after compatibility evaluation.

`rerankMode`:

- `off`: calibrated RRF path.
- `on`: reranker required; otherwise `DEPENDENCY_ERROR`.
- `auto`: enable only when profile permits, breaker is closed, enough candidates survive, and remaining deadline is greater than timeout plus `100 ms`.
- Skip in `auto` for an authorized unique exact hit that satisfies precision lookup.
- Record: `request_off`, `profile_off`, `exact_sufficient`, `too_few_candidates`, `deadline`, or `circuit_open`.

When the reranker breaker opens, atomically switch to the profile's complete non-reranked policy and record `degradedMode: 'no_rerank'`.

Deduplication order: exact content hash, normalized token hash, then MinHash-estimated Jaccard. Preserve alternate provenance. Diversity cannot promote a candidate below its floor. Expanded neighbors are context only, not independent evidence.

Context assembly MUST preserve:

- At least one qualifying group for every `DECOMPOSE` side.
- The evidence chain for every carried multi-hop entity.
- Provenance metadata.
- Exact hits before lower-value fuzzy evidence.

## 10. Sufficiency, Retry, and Failure

Evidence is insufficient when any applies:

- No result survives the active floor.
- Fewer than `min(contextTopN, 3)` chunks survive.
- `MULTI_EVIDENCE` has fewer than three chunks.
- `MULTI_EVIDENCE` lacks dataset diversity when multiple selected datasets had candidates.
- A `DECOMPOSE` side has no qualifying evidence.
- A `MULTI_HOP` dependency remains unresolved and time remains.
- Top score is below the calibrated sufficiency floor.
- More than 25% of selected groups or shards failed.

Allow at most one retrieval retry and at most one routing escalation. Both share the original deadline and neither may recursively trigger itself.

Retrieval retry:

1. If zero candidates: double dense and lexical K within caps.
2. If candidates were floor-filtered: use the profile's calibrated low-recall floor.
3. Never lower exact confidence or retry `NONE`.

Routing escalation:

1. Expand to the next project/dataset candidates up to maxima.
2. Preserve mandatory datasets and do not rerun completed datasets.
3. Stop at two total routing waves.

Neither path may exceed the deadline or search every eligible dataset.

After the bounded attempt, return `PARTIAL` or `INSUFFICIENT_EVIDENCE`.

Required degradation:

| Failure | Behavior |
|---|---|
| Language detector fails | trusted hint, else `und` + neutral rules + multilingual dense |
| Language pack missing | universal lexical or dense-only |
| LLM analyzer fails | `BALANCED` |
| Project catalog fails | explicit scope or permitted last healthy snapshot |
| Dataset catalog fails | mandatory datasets/configured defaults only |
| Exact locator fails | fuzzy retrieval + degradation flag |
| Embedding fails | calibrated lexical-only, else `DEPENDENCY_ERROR` |
| Vector dimension/model mismatch | skip group, return partial, alert catalog corruption |
| Reranker fails in `auto` | calibrated RRF |
| Reranker fails in `on` | `DEPENDENCY_ERROR` |
| `_msearch` child/shard fails | retain successes, report `PARTIAL` |
| Multi-hop planner fails | original query once with `RECALL + MULTI_EVIDENCE` |
| No grounded entity/deadline | stop; completed evidence + unresolved hops |
| Config invalid | retain last known-good version |

Total p95 deadlines: no-rerank `1500 ms`, reranked `3000 ms`, multi-hop `5000 ms`, exact locator `250 ms`.

## 11. Configuration, Telemetry, and Privacy

Configuration MUST version:

- Language detector, thresholds, packs, lexical fields, and cross-lingual policy.
- Analyzer rules and optional LLM model/prompt/cache.
- Request limits: 8,000 query characters, 64 explicit projects, 256 explicit datasets.
- Profiles, modifiers, candidates, context budgets, scores, and calibration IDs.
- Catalog/router weights, selection budgets, freshness, and aliases.
- Embedding models, vector contracts, translation, exact locator, reranker, and breakers.
- Concurrency, search, hop, and total deadlines.
- OpenSearch source allow-list.

Reload atomically: parse/schema validate, verify language/model/calibration references, validate limits, run deterministic multilingual smoke tests, then activate whole version or retain last known-good.

Record metrics for language/analyzer quality, profile/modifier distribution, routing recall, selected scope/groups/shards, candidates, retrieval quality, exact top-3 rate, reranking, duplicates/diversity, partial coverage, hop completion, latency, and cost.

Privacy:

- Use tenant-keyed query hashes.
- Keep classifier caches tenant-scoped.
- Raw-content debug logging requires explicit short-lived permission.
- Never log unauthorized dataset identities.
- Do not copy thousands of unselected datasets into each trace; reconstruct from query hash, normalized routing features, scope/catalog/router versions, and selection policy.

## 12. Portable Module Boundaries

Implement these responsibilities; names may match the host codebase:

1. `config`: schema, immutable snapshot, atomic activation.
2. `languageDetector`: BCP 47 decision and language packs.
3. `queryAnalyzer`: signals, rules, LLM fallback, intent.
4. `scopeResolver`: trusted authorization and allowed filters.
5. `catalogRouter`: project/dataset search and selection.
6. `searchPlanner`: compatible grouping and bounded plan.
7. `openSearchRetriever`: `_msearch`, lexical, ANN, timeout/failure parsing.
8. `exactRetriever`: optional exact-locator path.
9. `fusion`: weighted RRF and quotas.
10. `reranker`: activation policy, breaker, calibrated result.
11. `multiHopExecutor`: decomposition, grounded hops, stop rules.
12. `contextAssembler`: dedupe, diversity, neighbors, token budget.
13. `evidenceEvaluator`: sufficiency and one relaxation.
14. `telemetry`: sanitized decision trace and metrics.
15. `adaptiveRetriever`: orchestration only.

Keep OpenSearch, detector, embedder, translator, reranker, config store, and telemetry behind small injectable ports. Do not create factories for single implementations unless the host codebase requires them.

## 13. Implementation Order

1. Define types, schemas, config snapshot, statuses, and decision trace.
2. Implement scope resolution and trusted-filter tests first.
3. Implement language detection and deterministic analyzer.
4. Implement profile/modifier planning and seed config.
5. Implement catalog reads, routing, compatibility grouping, and caps.
6. Implement grouped BM25/ANN `_msearch`.
7. Implement RRF, quotas, dedupe, sufficiency, and context assembly.
8. Add reranker policy and circuit-breaker fallback.
9. Add exact, temporal, table, neighbor, and cross-lingual paths behind capability flags.
10. Add decomposition, then bounded multi-hop.
11. Add API, telemetry, privacy controls, and atomic config reload.
12. Shadow, calibrate, canary, and activate only after gates pass.

## 14. Minimum Verification

Security:

- Unauthorized explicit scope executes zero OpenSearch calls.
- Every lexical/dense child contains identical trusted tenant/project/dataset/ACL/lifecycle filters.
- Wildcard index and raw user DSL are rejected.
- Cross-tenant classifier-cache access is impossible.

Analyzer:

- Cover `en`, `vi`, `ja`, mixed, `und`, short, identifier-only, and code-heavy queries.
- Cover every query-family plan and modifier merge rule.
- Invalid/timeout LLM output becomes `BALANCED`.

Routing and scale:

- Explicit dataset bypass; few huge datasets; 10,000 eligible datasets; mixed physical groups.
- Never exceed 64 fully searched datasets or eight groups unless explicit authorized scope requires it.
- Do not rerun Wave 1 datasets during escalation.
- 50-million-chunk pool test validates bounded ANN/BM25 behavior.

Retrieval:

- RRF ranking with missing lists and weights.
- Separate RRF and reranker floors/calibration.
- Reranker `off`, `on`, `auto`, timeout, and breaker.
- Exact unique, repeated, cross-chunk, OCR/punctuation, and miss.
- Temporal conflicts, table row+header, neighbor context, cross-lingual fallback.
- Partial `_msearch` and vector mismatch.

Complex queries:

- Three independent comparison sides.
- Two-hop and three-hop dependencies.
- Reject ungrounded entities, repeated queries, scope expansion, and fourth hop.
- Preserve evidence chain and unresolved hops.

Acceptance gates:

- Analyzer rules avoid LLM for at least 90% of traffic.
- Base-profile macro F1 `>= 0.90`; modifier precision/recall `>= 0.90`.
- Supported language F1 `>= 0.95`; mixed-language F1 `>= 0.90`.
- Overall Routing Recall@M `>= 99.5%`; critical slices `>= 98%`.
- Routing p95 `<= 100 ms` over 10,000 eligible datasets.
- Exact/near-exact source top-3 `>= 95%`; unique-source precision `>= 99%`.
- Each profile matches or beats the static baseline on Recall@K and nDCG.
- No-rerank/rerank/multi-hop p95 `<= 1.5/3/5 seconds`.
- No OpenSearch writes, authorization crossing, implicit all-index search, or invalid config activation.

## 15. Definition of Done

The implementation is complete only when:

- All mandatory invariants and contracts are implemented.
- Seed settings are externalized, validated, versioned, and clearly marked uncalibrated.
- Security, analyzer, routing, retrieval, failure, multilingual, scale, and multi-hop checks pass.
- Every response identifies its active configuration and decision path.
- Missing optional index capabilities degrade explicitly.
- Shadow evaluation meets activation gates before production enablement.
- The service remains retrieval-only.
