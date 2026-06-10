# Generative RAG Orchestrator v2 — Final Merged Specification
### For coding-agent plan mode — behavior contracts, architecture decisions, and system prompts only; no implementation code

> **Provenance.** This document merges two independent research outputs: `claude-generative-orchestrator-v2-research-spec.md` (engineering-spec style: data contracts, token/latency budgets, production prompts, acceptance criteria, SDLC agent templates) and `gpt-search-agent.md` (requirements style: precedence/security hard rules, requirement-heading detection, domain-risk escalation, generation-pattern catalog, cost/quality/performance guidelines). Both independently converged on the same core architecture, which strengthens confidence in the design. The Claude report forms the backbone; the GPT report's unique contributions are folded in and marked where they extend a contract. Appendix B records the comparison and merge decisions.

---

## 0. How to use this document (instructions for the coding agent)

This document is **input for plan mode**. It contains architecture decisions, behavioral specifications, data contracts, precedence rules, token/latency budgets, and the production system prompts for every LLM call in the pipeline. It deliberately contains **no implementation code** — the coding agent must:

1. **Discover the current codebase first.** Before writing any plan, locate and read:
   - The existing generative-mode implementation built from `plans/solution1.md` (the current phases: parse, plan, outline, retrieve, rerank, sectionWrite, stitch/refine).
   - The **custom retriever component** and the **custom reranker component** — their exact function signatures, input/output shapes, sync/async nature, and where they are instantiated. These are existing direct-call functions built on RAGFlow internals (NOT the RAGFlow HTTP API) and MUST be reused as-is, never reimplemented.
   - The **agent standard** feature: where agent definitions/instructions are stored, how an agent is loaded, what fields an agent record has (instruction text, knowledge-base ids, policy flags, etc.).
   - The LLM client abstraction currently used (local model serving — Ollama/vLLM/llama.cpp — and any cloud fallback), and whether it supports schema/grammar-constrained JSON decoding.
   - Existing patterns for: background jobs, streaming/SSE to the frontend, configuration, logging/observability, persistence/migrations, and shared type definitions.
2. **Map this spec onto what exists.** For each phase below, identify whether existing code can be **reused**, **refactored**, or must be **newly created**, and which existing modules are **retired** (notably the standalone outliner, the standalone global retrieve/rerank phases, and the content-producing parts of the stitch/refine phase).
3. **Produce the detailed implementation plan** — file-by-file change list, new modules, retired modules, migration steps, configuration changes, and a test list covering Section 11 — and only then implement. The plan must explicitly cover: input normalization for both modes, the planner upgrade, moving retrieval+reranking into the section pipeline, the sufficiency gate, citation validation, the validate-only final phase, prevention of extra output sections, and the cost/quality/performance measures of Section 10.
4. **Treat every "MUST / MUST NOT" in this document as an acceptance criterion.** Section 11 consolidates them into a verification checklist.

Target stack discovered so far: Node.js / Express / TypeScript backend with a React frontend; the orchestrator from solution1.md may be partially implemented — verify rather than assume.

---

## 1. Goals and binding constraints

**Optimization goals (jointly):** cost efficiency, output quality, generation accuracy, retrieval effectiveness, hallucination control, strict output-format compliance, and reuse of one orchestrator for both chat generative mode and agent standard mode.

| Constraint | Value | Consequence for design |
|---|---|---|
| Primary LLM | Local model, **~16k effective context** (cloud API as secondary; optimize for 16k) | Hard per-call token budgets; no phase may assemble more than ~10–11k input tokens (lost-in-the-middle degrades quality well before the 16k ceiling) |
| Latency | **Interactive, 1–3 minutes total** | Bounded agentic loops only (no free-form ReAct); maximize parallelism; remove sequential LLM gates |
| Retrieval layer | **User-owned retriever + reranker, called as direct functions** | Spec never defines retrieval internals; it defines only *when* they are called, with *what* queries, and *what* is done with results |
| Optimization targets | Cost, effectiveness, output quality, performance — jointly | Prefer deterministic logic over LLM calls everywhere an LLM is not strictly better |
| Reuse | One orchestrator serves **both** chat generative mode and the new **Agent Standard mode** | All mode differences are confined to a single input-normalization layer |
| Security | Multi-tenant with knowledge-base ACLs | Tenant filter and KB security context are **never** subject to any precedence merge or prompt content (see §4) |

### Input contracts (given, unchangeable)

**Chat generative mode** — the user prompt MUST contain these markdown headers:

```md
# User profiles
# Task
# Context
# Keyword
# Output format
```

**Agent Standard mode** — the agent has a predefined instruction (which may itself contain a role/persona, a `## Skill` block, `# User profiles`, `# Context`, `# Keyword`, and `# Output format`, plus retrieval/citation/quality policy). The user prompts **freestyle natural language** OR optionally with:

```md
# Task
# Context
# Keyword
# Output format
```

The final generated answer shown to the end user must contain **only** the content requested by `# Output format` (user's, or agent's fallback) — see §8 for the full forbidden-content list.

---

## 2. Architecture decision summary — before / after

### Current pipeline (from solution1.md — verify against actual code)

```
parse → plan → retrieve (global fan-out) → rerank → outline → sectionWrite (N×, sequential)
      → stitch + refine (auto-title, auto-TOC, auto-References, consistency LLM pass) → deliver
```

Defects relative to the constraints: three sequential LLM gates before any content token is produced; retrieval is global rather than per-section (different sections have different evidence needs — some need no retrieval, some need user context only, some need one document, some need several, some need exemplars); the final phase **adds content the user's `# Output format` never requested**; no sufficiency gate before generation; no agent-mode input handling.

### Target pipeline (4 logical phases)

```
PHASE 1  NORMALIZE INPUT
         deterministic header parsing + requirement-heading detection
         + precedence merge with security hard rules
         + at most ONE small LLM extraction call (agent freestyle prompts only)
         → canonical internal Request object

PHASE 2  PLAN + OUTLINE (merged — exactly ONE LLM call)
         task-type classification + per-section plan + per-section retrieval queries
         + per-section risk level and evidence policy
         If # Output format present → section headings derived DETERMINISTICALLY
         from it BEFORE the LLM runs (the LLM only fills in metadata)

PHASE 3  PARALLEL PER-SECTION PIPELINE (bounded concurrency 3–5)
         per section: retrieve → rerank → sufficiency gate (tiered)
           → (if insufficient: ONE corrective query-rewrite + re-retrieve)
           → write with inline [N] citations
           → deterministic citation validation
           → optional NLI faithfulness gate
         A GLOBAL chunk registry assigns stable [N] numbers across all sections.
         Retrieval/rerank results are memoized within the request.

PHASE 4  VALIDATE-ONLY
         deterministic structure-conformance check vs # Output format
         + deterministic citation-integrity check + forbidden-content scan
         + ONE small LLM task-coverage call (sees requirement headings)
         → pass through unchanged, OR regenerate ONLY failing sections (max 1 round)
         MUST NOT add a title, TOC, references section, or any content
         not requested by # Output format. MUST NOT rewrite passing sections.
```

**Phases removed:** standalone outliner (merged into Phase 2); global retrieve+rerank phases (folded into Phase 3 per section); the content-producing "stitch & refine / consistency pass" (replaced by Phase 4 validation-only). Both research outputs independently recommended exactly this restructuring.

**Why section-level retrieval wins:** relevance (bespoke evidence per section), citation accuracy (chunks bound to the section that uses them), cost (sections that need nothing retrieve nothing), hallucination control (sufficiency is judged against one section's needs, not a whole document), and performance (per-section work parallelizes).

### LLM-call budget comparison (6-section document)

| Pipeline | Calls | Wall-clock on local 7B–14B @ ~30 tok/s |
|---|---|---|
| Current | 9 sequential (plan, outline, 6× write, consistency) | ~90–180 s |
| Target | 1 plan+outline, then sections in parallel (write + ≤2 small checks each, concurrency 3–4), 1 coverage | **~45–110 s typical** |

Total LLM work is similar or lower (the heuristic sufficiency tier and retrieval memoization in §6–§7 can remove small calls); the structural gain is **parallelism plus removed sequential gates**.

---
## 3. Data contracts (language-neutral; the coding agent maps these to the codebase's typing conventions)

Fields marked **[merged-in]** extend the original contract with content adopted from the second research output.

### 3.1 Canonical Request (output of Phase 1)

| Field | Type | Rules |
|---|---|---|
| `mode` | `"chat"` \| `"agent"` | Set by presence of an agent instruction |
| `userProfile` | string | Always populated (source per precedence table §4) |
| `task` | string | Required, non-empty in both modes |
| `context` | string | May be empty; agent baseline + user context concatenated, agent first |
| `keyword` | string[] | Union-merged, deduplicated |
| `outputFormat` | string | Raw header body; empty string means "LLM may propose structure" |
| `outputFormatSource` | `"user"` \| `"agent"` \| `"default"` | Provenance for auditability |
| `outputFormatConflict` | boolean | True when user and agent both supplied a format and they differ |
| `agentInstruction` | string \| absent | Raw agent persona text, agent mode only (used later as writer persona) |
| `agentSkill` | string \| absent | **[merged-in]** The agent's `## Skill` block when separable; concatenated after `agentInstruction` for the writer persona, kept separate for precedence audit |
| `agentPolicy` | object \| absent | **[merged-in]** `{ allowUserFormatOverride: bool (default true), allowUserRetrievalOverride: bool (default true), citationPolicy?: "required"|"optional" }` |
| `requirementHeadings` | `{text, kind}[]` | **[merged-in]** Custom requirement-like headings detected in user prompt and agent instruction beyond the five canonical headers; `kind ∈ {requirement, constraint, acceptance_criteria, domain_rule, quality_rule, retrieval_hint, unknown}` (§4.4) |
| `security` | object | **[merged-in]** `{ tenantId, kbIds/ACL }` — populated from the session, **never** from prompt text, never altered by any merge |
| `rawUserPrompt` | string | Preserved verbatim for traceability |

### 3.2 Plan (output of Phase 2 — the planner LLM's required JSON shape)

```json
{
  "detectedTask": "qa_with_citations | summarize_single | synthesize_multi | compare_analyze | transform_derive | reference_inspired | pure_generation",
  "overallRationale": "string, ≤320 chars",
  "outputFormatSummary": "one-line restatement of the user's format",
  "outlineSource": "derived_from_output_format | proposed_by_llm",
  "sections": [
    {
      "sectionId": "s1",
      "heading": "string — exactly as it will appear in the output",
      "rationale": "string ≤240 chars — MUST come before the commit fields below (in-schema chain-of-thought)",
      "taskHint": "one of the 7 task types",
      "retrievalMode": "grounded_strict | reference_inspired | none",
      "riskLevel": "normal | high  — [merged-in] high for healthcare/medical, legal, regulatory-compliance, finance, security, safety-critical content",
      "mustCite": "boolean — forced true when riskLevel=high and retrievalMode=grounded_strict",
      "minCitations": "int 0–5",
      "assumptionsAllowed": "boolean — [merged-in] default false; may be true only when the output format explicitly allows assumptions",
      "subQueries": [
        { "text": "natural-language retrieval query", "keywordQueries": ["0–4 sparse/BM25 anchor terms"] }
      ],
      "targetTokens": "int 80–1200",
      "dependsOn": ["sectionIds that must be written first; usually empty"]
    }
  ],
  "notes": "optional string"
}
```

Validation rules: 1–10 sections; ≤3 subQueries per section; the schema MUST be enforced via grammar/schema-constrained decoding with exactly one retry (validation error appended to the prompt) before failing the request. Post-parse, the orchestrator deterministically forces `mustCite=true` and `assumptionsAllowed=false` on every `grounded_strict` section with `riskLevel=high`, regardless of what the LLM returned.

### 3.3 Written Section (output of each Phase 3 section run)

| Field | Type | Rules |
|---|---|---|
| `sectionId`, `heading` | string | Copied from plan; heading never altered by the writer |
| `body` | string | Markdown prose; contains inline `[N]` only for grounded sections |
| `citations` | map citationNumber → useCount | Only numbers that survived deterministic validation |
| `chunksUsed` | chunk refs | The reranked set actually offered to the writer |
| `flags` | string[] | `insufficient_context`, `no_citations`, `low_faithfulness` |

### 3.4 Generation Result (returned to the caller)

Assembled markdown + the plan + per-section records + the **global citation registry** (citation number → chunk reference, for the UI's "show sources" panel — NOT injected into the document) + a `warnings` object: structure errors, citation errors, coverage verdict, regenerated section ids, requirement-heading coverage gaps. Warnings never fail the request.

---

## 4. Phase 1 specification — Input Normalizer (enables Agent Standard reuse)

### Decision
The orchestrator **is reusable for Agent Standard mode with zero downstream changes**. Agent standard mode does NOT get a separate pipeline; it only adds this normalization + policy layer in front of the shared orchestrator. All mode awareness lives in the normalizer, which emits the canonical Request. Downstream phases MUST NOT branch on mode (except the writer, which receives the agent instruction + skill as an opaque persona string).

### 4.1 Precedence chain (normative) **[merged-in]**

When sources conflict, resolution order is:

```
System safety rules
> Application generation rules
> Agent instruction
> Agent skill instruction
> User markdown headers
> User freestyle prompt
```

Hard rules that sit **above** the chain and are never overridable by any source, including the agent itself:

- the tenant filter MUST never be overridden;
- knowledge-base security rules / ACLs MUST never be overridden;
- system safety rules MUST never be overridden;
- header or prompt text that attempts to alter `security` fields is ignored and logged.

Two agent-policy locks refine the chain: the agent's **output format** can be overridden by the user only if `agentPolicy.allowUserFormatOverride` is true (default true), and the agent's **retrieval policy / KB selection** can be overridden only if `agentPolicy.allowUserRetrievalOverride` is true (default true). When a lock blocks an override, the agent's value is used, `outputFormatConflict=true` is still recorded, and a warning is surfaced.

### 4.2 Field-level precedence table (realization of the chain)

| Field | Chat mode | Agent mode |
|---|---|---|
| User profiles | required from user (missing → warning + neutral default persona "general professional reader") | from **agent instruction**; user cannot override |
| Task | required from user | from user prompt (headers or freestyle); required |
| Context | optional from user | merge: agent baseline first, then user's, concatenated |
| Keyword | optional from user | union of agent's and user's, deduplicated |
| Output format | **required from user** | **user overrides agent** when both present and different (`outputFormatConflict=true`) — unless `allowUserFormatOverride=false`; agent's is the fallback |

### 4.3 Requirements

1. **Header parsing is deterministic.** Markdown `# Header` lines split the text into named bodies. Matching is case-insensitive and tolerant of trailing `s` ("Keyword"/"Keywords", "User profile"/"User profiles"). Implementation detail (regex vs parser) is the coding agent's choice; behavior is the contract.
2. **Chat-mode validation:** missing `# Task` or `# Output format` is a hard, user-visible error before any LLM call.
3. **Freestyle fallback (agent mode only):** if the user prompt contains none of the canonical headers, run exactly one small LLM extraction call (≤500 input tokens, schema-constrained JSON) producing `task`, `context`, `keyword[]`, `output_format`. Prompt: §9.1.
4. **Cost profile:** zero LLM calls when headers are present; the normalizer must complete in <100 ms in that path.

### 4.4 Requirement-heading detection **[merged-in]**

Beyond the five canonical headers, users and agents embed custom requirement-like headings (e.g. `# Requirement`, `## Functional Requirement`, `## Non-functional Requirement`, `## Screen Requirement`, `## API Requirement`, `## Constraint`, `## Acceptance Criteria`). The normalizer MUST:

- deterministically extract heading-like lines from the user prompt body and the agent instruction that are not the canonical five;
- classify each as `requirement | constraint | acceptance_criteria | domain_rule | quality_rule | retrieval_hint | unknown` (keyword/dictionary classification is sufficient; no LLM call);
- attach them to the Request as `requirementHeadings`.

Downstream uses (no new phases): the **planner** receives the list and must map every `requirement`/`acceptance_criteria` heading to at least one planned section; `retrieval_hint` headings are union-merged into keyword anchors; the **coverage auditor** (§9.6) receives the list and reports any heading not addressed as a `missingAspects` entry; `constraint`/`quality_rule` headings flow into the writer's brief.

### Rejected alternatives
Separate orchestrators per mode (duplicated maintenance); injecting the agent instruction straight into the planner prompt (precedence becomes implicit and unauditable); always running the LLM extractor (1–2 s tax on every chat request for nothing); LLM-based heading classification (a dictionary does it for free).

---
## 5. Phase 2 specification — merged Planner + Outliner (one LLM call)

### Decisions

1. **The standalone outliner phase is eliminated.** One LLM call produces classification + plan + outline metadata. On a 7B-class local model a second outlining call buys +0–5% structural quality for +5–15 s and an extra sequential gate — a bad trade under the 1–3 min budget. The "is the outliner necessary?" question from both research outputs resolves to: *its responsibility survives, its phase does not.*
2. **When `# Output format` is non-empty, the outline is NOT an LLM decision.** A deterministic parser derives section headings from the format text (markdown headings, numbered lists, or bullet lists) BEFORE the planner runs; the planner receives them as fixed input and only assigns per-section metadata. This eliminates the "invented section" failure class (LLM adding Introduction/Conclusion/References nobody asked for) and guarantees exact preservation of user-requested structure and heading order.
3. **When `# Output format` is empty**, the planner proposes a minimal structure (3–7 sections) appropriate to the task — and **[merged-in]** if the task asks for exactly one deliverable (a single table, one direct conversion, one short answer), the plan MUST contain exactly one section. The outline is a planning aid only; it must never introduce content requirements of its own.
4. **Task taxonomy (7 classes)** — the planner classifies every request into exactly one:

| `detectedTask` | Meaning | Default retrieval mode |
|---|---|---|
| `qa_with_citations` | factual answer grounded in chunks | grounded_strict |
| `summarize_single` | condense one source | grounded_strict |
| `synthesize_multi` | merge across documents | grounded_strict |
| `compare_analyze` | contrast/critique across documents | grounded_strict |
| `transform_derive` | derive a NEW artifact treating sources as ground truth (requirements → test cases / detail design / basic design / test spec) | grounded_strict |
| `reference_inspired` | sources are exemplars; specifics may be invented (old use cases → new use cases) | reference_inspired |
| `pure_generation` | no retrieval needed (including user-context-only generation) | none |

This taxonomy is domain-neutral by construction (software, healthcare, legal, finance…). The planner prompt forbids domain assumptions; domain enters only through the task/context text, the risk-level rule below, and retrieval results.

5. **Three retrieval modes, assigned per section** (not per document — a single plan may mix all three):

| `retrievalMode` | Writer behavior | Citation policy |
|---|---|---|
| `grounded_strict` | facts ONLY from retrieved chunks | mandatory inline `[N]`; abstain on insufficient context |
| `reference_inspired` | chunks are style/structure exemplars; specifics may be invented consistent with the task | NO citations in output |
| `none` | pure generation; the writer still sees `# Context`, so user-context-only sections use this mode | no citations (unless agent citationPolicy requires) |

6. **Domain-risk escalation [merged-in].** The planner sets `riskLevel: high` on sections involving healthcare/medical, legal, regulatory compliance, finance, security, or safety-critical content. Consequences (enforced deterministically post-parse, §3.2): `mustCite` forced true and `assumptionsAllowed` forced false for grounded sections; the sufficiency gate always uses the LLM tier and applies strict judgment (§7); such sections are priority candidates for the NLI faithfulness gate.
7. **Sub-queries live inside the plan.** 1–3 per retrieving section, each with a natural-language text (dense retrieval) and 0–4 keyword anchors (sparse/BM25). The user's `# Keyword` header and any `retrieval_hint` requirement headings are union-merged into the anchors downstream. NO separate HyDE / step-back / multi-query phases — each would add a full LLM call for marginal recall on this setup; revisit only if measured retrieval recall is inadequate.
8. **`dependsOn` is exceptional, not default.** Only when a section literally requires another section's text as input. The executor honors it; everything else runs in parallel.

### 5.1 Generation-pattern catalog **[merged-in]** (planner behavior fixtures)

The plan must handle at least these recurring patterns; each row doubles as an integration-test fixture:

| # | Pattern | Expected planner behavior |
|---|---|---|
| 1 | Create new document from old similar document ("refer to old use case, create a new one") | `reference_inspired`; retrieve exemplars; mirror structure/voice; invent only genuinely new specifics; grounded sub-sections (rules, preconditions) still cite |
| 2 | Generate test cases from a requirement | `transform_derive`; grounded_strict; every test case maps to requirement evidence; cover functional rules and edge cases |
| 3 | Generate detail design from basic design | `transform_derive`; grounded_strict; retrieve HLD/architecture/API/data-model chunks; never invent API names, fields, or workflows |
| 4 | Generate from user context only | `pure_generation` / retrievalMode `none`; skip retrieval entirely; no citations unless policy requires |
| 5 | Generate from knowledge base only | grounded_strict; sufficiency gate mandatory; citations mandatory |
| 6 | Software-development artifacts (SRS, user story, use case, FR/NFR, test case, test specification, basic design, detail design, API/DB/screen/workflow/deployment design, migration plan) | covered by the taxonomy + the Appendix A agent templates; no special-case code |
| 7 | Healthcare / regulated-domain documents | `riskLevel: high` path: stronger evidence demands, mandatory citations, no unsupported claims, assumptions disallowed |

### Requirements
- Exactly one LLM call; schema-constrained; one retry with the validation error appended; then hard fail.
- When fixed headings were derived, the orchestrator MUST defensively force-restore exact headings/order/count after parsing the plan, regardless of what the LLM returned.
- Every detected `requirement` / `acceptance_criteria` heading maps to ≥1 section (validated deterministically post-parse; unmapped headings → planner retry, then warning).
- Planner input ≤3k tokens, output ≤1.5k. The planner NEVER sees retrieved chunks.
- Planner prompt: §9.2.

### Rejected alternatives
Separate task-classifier / intent-analyzer call (doubles latency, negligible accuracy gain with constrained decoding — its responsibilities are absorbed by `detectedTask` + `riskLevel` in the single planner call); standalone outliner call; STORM-style perspective simulation (~10× cost, frontier-model technique); domain-specific planner prompts (anchoring; one structural prompt + risk levels generalizes).

---

## 6. Phase 3 specification — parallel per-section pipeline (retriever + reranker folded into sectionWriter)

### Decisions

1. **The standalone retrieve and rerank phases are removed.** Each section performs its own `retrieve → rerank` using the section's sub-queries, because each section needs bespoke context; a shared global pool gives every writer the same generic chunks and worsens lost-in-the-middle.
2. **Sections execute concurrently** under a bounded concurrency limiter (default 4; configurable; lower it if the local LLM server can't serve parallel requests). Sub-query retrieval within a section is also concurrent. `dependsOn` sections wait only on their prerequisites.
3. **The user's existing components are called as-is.** The contract is only: retrieval takes (query text, knowledge-base ids, topK≈20) and returns scored chunks; reranking takes (query, candidate chunks) and returns them reordered; the pipeline keeps the top ~5 after rerank. The coding agent must discover the real signatures during codebase exploration and write thin adapters if shapes differ — never reimplement retrieval or reranking logic. KB ids passed to retrieval always come from `security` + agent retrieval policy, never from prompt text.
4. **Retrieval/rerank memoization [merged-in].** Within a request, `retrieve(query, kbIds, topK)` and `rerank(query, chunkSet)` results are cached by key hash, so identical or duplicated sub-queries across sections hit the components once. An optional cross-request TTL cache sits behind a config flag (off by default; evaluate against KB update frequency).
5. **A global chunk registry provides stable citation numbers.** Chunks are deduplicated by content hash across ALL sections; the first registration of a chunk assigns the next `[N]`; the same chunk cited from two sections yields the same number. The registry is concurrency-safe. The final registry (number → chunk) is returned with the result for the UI's source panel.
6. **Header leverage for retrieval quality:**
   - `# Keyword` (+ `retrieval_hint` headings) → merged into every sub-query's sparse anchors.
   - `# Context` → a short slice (~200 chars) prefixed to grounded sub-queries to disambiguate.
   - `# User profiles` → injected into the writer prompt as "Reader profile" (controls tone/depth, not retrieval).
   - Agent instruction + skill → injected into the writer prompt as an opaque persona preamble (headers already consumed by the normalizer).
7. **Per-section evidence policy [merged-in].** Each section carries its effective evidence policy resolved from plan + agent policy: `retrievalMode`, `mustCite`, `minCitations`, `assumptionsAllowed`, max evidence chunks (= rerank topK, default 5), and whether generation may proceed without evidence (only `reference_inspired`/`none` may). This is data on the section job, not a new phase.
8. **Citations are enforced during generation, not post-hoc.** The writer's system prompt (§9.3) requires inline `[N]` after every factual claim for grounded sections. Post-hoc citation insertion is rejected: it needs a second LLM pass and measurably misattributes on small models.
9. **Deterministic citation validation after every write.** Extract all `[N]` tokens; keep only numbers present in the section's offered chunk set; **strip** invalid ones (never remap — remapping re-attributes a claim to an unrelated source); clean up orphaned spaces/punctuation. A grounded section with `mustCite=true` that ends with zero valid citations is flagged `no_citations` for Phase 4.
10. **Anti-lost-in-the-middle ordering.** When rendering numbered sources into the writer prompt, place the strongest chunks at the beginning AND end of the source block, weakest in the middle (e.g., rank order 1,4,5,3,2).

### Per-section token budget (binding; 16k window)

| Slice | Tokens |
|---|---|
| Writer system prompt | ~700 |
| Request slice (profile, task, context, format hint, relevant constraint/quality headings) | ~300 |
| Plan slice (THIS section only — never the whole plan) | ~200 |
| Rolling summaries of prerequisite sections (~60 tok each) | 0–600 |
| Top-5 reranked chunks (~500–800 tok each) | 2500–4000 |
| Per-section slice of the user's literal output format | 0–200 |
| Generation budget (targetTokens × 1.1) | 400–1200 |
| Safety headroom | ~1000 |
| **Total** | **~6–8k** (never assemble >11k) |

### Rejected alternatives
Single shared retrieval pool (generic context, worse grounding); post-hoc citation insertion (extra pass, misattribution); LLM-as-judge citation validation (regex + chunk-map is free and deterministic); per-section local citation numbering (same source gets different numbers across sections); a separate per-section "evidence planner" LLM call (the plan's subQueries + evidence policy already carry that decision — §9.7).

---

## 7. Phase 3 specification — anti-hallucination loop (bounded, CRAG-style; NOT free-form ReAct)

### Decision
A **bounded corrective loop** per grounded section — hard caps: **2 retrieval rounds, 1 generation, plus at most the single Phase-4 repair round**. Free-form ReAct is rejected for the default path (unbounded tail latency, ~4–5× p95 blowup kills interactive UX); ReAct-style behavior is reserved for exactly the bounded escalations below. Full Self-RAG (needs fine-tuned reflection tokens/logit access) and full Chain-of-Verification (~12× token cost) are rejected. This bounded design captures the bulk of the benefit: the dominant hallucination cause on small models is **confidently generating from insufficient context**, so the gate sits *before* generation.

### The loop (normative control flow)

```
retrieve + rerank (planned sub-queries, memoized)
   → sufficiency gate (tiered, below)
        sufficient → write
        insufficient → query rewrite (small LLM call, §9.5)
                       → retrieve + rerank again → merge + dedupe → keep top-5
                       → sufficiency gate again
                            sufficient → write
                            still insufficient AND grounded_strict →
                                section body becomes EXACTLY the sentinel:
                                *Insufficient context in knowledge base for this section.*
                                flag: insufficient_context — and STOP (no generation)
write → deterministic citation validation → optional NLI faithfulness gate
```

### Tiered sufficiency gate **[merged-in]**

- **Tier 0 — deterministic heuristics (free, always run first):** empty chunk set → insufficient without an LLM call; all rerank scores below a configured floor → insufficient; obvious keyword/ID coverage misses (e.g., a referenced `UC-`/`REQ-` id appears in no chunk) → insufficient.
- **Tier 1 — small LLM set-level check (§9.4):** judges the whole reranked chunk set against the section brief; chunks truncated to ~400 tokens each; ~1.5k in / ~120 out per call.
- **Escalation policy:** config `sufficiencyMode: always_llm | heuristic_first` (default `always_llm`). In `heuristic_first`, Tier 1 runs only when Tier 0 is inconclusive — a cost lever for low-risk workloads. Regardless of mode, `riskLevel=high` sections ALWAYS run Tier 1 with the strict-judgment instruction.
- `reference_inspired` and `none` sections SKIP the sufficiency gate entirely.
- The abstention sentinel string is a fixed constant shared with Phase 4 (which recognizes and reports it). Honest abstention is preferred over fabrication — this is the explicit product behavior, not a failure.

### Optional NLI faithfulness gate (config-flagged, default on; grounded sections only)
Per sentence carrying citations: NLI(premise = cited chunk text, hypothesis = sentence with citation markers removed). If no cited chunk entails the sentence above a threshold (default 0.5), the sentence is removed and logged. Uncited sentences pass (the citation rules already gate factual claims). If >50% of a section's sentences are removed → flag `low_faithfulness` → Phase 4 regeneration candidate. Implementation options for the coding agent to evaluate against the codebase: a small cross-encoder NLI model run in-process (ONNX in Node) or a tiny sidecar service; either way it is non-LLM, ~0.5–2 s/section on CPU, near-free on GPU, and must be lazy-loaded behind a feature flag.

### Latency budget (must hold)

| Step | Typical on local 7B |
|---|---|
| retrieve (parallel sub-queries) + rerank | 0.5–2.5 s |
| sufficiency gate (Tier 0 + Tier 1) | 0–4 s |
| rewrite + re-retrieve (only when triggered, ~20% of sections) | 3–8 s |
| section write (~400 tok out) | 20–45 s |
| citation validation | <10 ms |
| NLI gate | 0.5–2 s |
| **Per section total** | **~25–55 s typical / ~35–70 s worst** |

6 grounded sections at concurrency 4 → ≈ 2 waves × ~55 s ≈ **110 s wall-clock**, inside the 1–3 min target; concurrency 2 → ≈ 165 s, still inside.

---

## 8. Phase 4 specification — validation-only final phase

### Decision
The old "Stitch, Validate, Refine" becomes **validate-only**. Assembly is plain deterministic concatenation of section bodies under their planned headings, in plan order — the assembler is a formatter, never a writer: it must not invent, improve, or rewrite content; it only normalizes markdown spacing and strips internal metadata.

### Hard rules (normative; these were the user's explicit requirements)

1. MUST NOT auto-generate a document title.
2. MUST NOT auto-generate a table of contents.
3. MUST NOT auto-generate a references/bibliography section. (If the user's `# Output format` listed any of these, they exist as planned sections already written in Phase 3 — the validator needs no special case. The citation registry is returned out-of-band for the UI.)
4. MUST NOT rewrite, polish, or "make consistent" any section body. The solution1.md consistency LLM pass is retired — it edits unrequested content and drifts cited claims away from their sources.
5. **[merged-in] Forbidden auto-content (full list).** Unless explicitly requested by the user's or agent's output format, the delivered output must contain none of: final title, table of contents, references, source list, appendix, validation report or notes, internal reasoning, internal plan, retrieved chunks, quality scores, debug metadata. A deterministic scan for these patterns is part of check (a).
6. The validator's only permitted actions: **flag**, and **trigger regeneration of specific failing sections** (maximum ONE repair round, then return with warnings).

### The three checks

| Check | Mechanism | Cost | Failure handling |
|---|---|---|---|
| (a) Structure conformance + forbidden content | Deterministic: when the outline was derived from `# Output format`, assembled headings must match the parsed headings exactly in count, order, and text (case-insensitive); forbidden-content scan per rule 5 | 0 | Report; regenerate offending sections / strip forbidden additions |
| (b) Citation integrity | Deterministic: every `[N]` in the assembled document resolves to a registry entry (per-section validation already guarantees this; the global pass is the safety net) | 0 | Report |
| (c) Task + requirement coverage | ONE small LLM call (§9.6). Input is headings + first ~150 tokens of each section + the detected requirement headings — NEVER the full document (~2–2.5k in / ~200 out, 3–6 s) | 1 small call | Returns `coversTask`, `missingAspects[]`, `sectionsToRegenerate[]` |

Regeneration set = coverage's `sectionsToRegenerate` ∪ sections flagged `no_citations` (with mustCite) ∪ sections flagged `low_faithfulness`. Retries run with grounding strictness bumped (mustCite forced true, minCitations +1). If coverage fails but cannot name sections → return with a `needs_review` warning; never auto-edit, never loop twice.

### Rejected alternatives
The consistency rewrite pass (unrequested edits, citation drift); per-sentence cross-section consistency checking (cost; redundant with NLI gate); whole-document regeneration on coverage failure (wasteful; targeted repair strictly better); an LLM "final validator" rewriting output (checks a/b are deterministic and free; only coverage needs an LLM).

---
## 9. Advanced system prompts (production-ready, one per LLM call in the pipeline)

These are the complete prompts. The coding agent stores them as versioned constants/templates (one file or module, never inline string fragments scattered through code) and substitutes the `{placeholders}`. All JSON-returning prompts MUST be executed with schema/grammar-constrained decoding plus one validation-error retry. All prompts are written for small local models: short, rule-numbered, one minimal example, explicit "JSON only" where applicable. Rules absorbed from the second research output are folded directly in (see §9.7 for the mapping).

### 9.1 Input extraction (Phase 1 — agent-mode freestyle prompts only)

**System:**
```text
You are an input-normalizer. Extract the user's request into JSON fields.

Rules:
- task: a single-sentence imperative restating what the user wants done.
- context: any situational background mentioned (dates, products, scope).
  Empty string if none.
- keyword: 0-8 salient retrieval terms. Empty list if none.
- output_format: any explicit format/length/style instruction the user
  gave. Empty string if none.
- Do not answer the user. Do not invent missing task details. Do not
  add output sections of your own.

Return JSON only, matching:
{"task": str, "context": str, "keyword": [str], "output_format": str}
```

**User message:** the raw freestyle prompt wrapped in triple quotes. Budget: ≤500 in / ≤300 out. Temperature ≤0.2.

### 9.2 Planner (Phase 2 — the single plan+outline call)

**System:**
```text
You are a planning assistant for a retrieval-augmented writing system.
You read a user request and produce a JSON PLAN that tells downstream
agents (a) what sections to write, (b) what to retrieve for each
section, and (c) how grounded each section must be.

## Inputs
You receive a canonical request with these fields:
- user_profile: who the user is.
- task: what they want produced.
- context: situational background.
- keyword: retrieval seed terms.
- output_format: explicit structure/length the user wants. May be empty.
- requirement_headings: custom requirement/constraint/acceptance-criteria
  headings detected in the request. May be empty.

## Your job
1. Choose detectedTask from this fixed list:
   qa_with_citations, summarize_single, synthesize_multi, compare_analyze,
   transform_derive, reference_inspired, pure_generation.
2. If output_format is non-empty, derive sections DIRECTLY from it
   (one section per top-level item in the user's format). Set
   outlineSource="derived_from_output_format". Do NOT invent extra
   sections (no title section, no table of contents, no references
   section unless the user listed them).
3. If output_format is empty, propose a minimal section structure
   (3-7 sections) appropriate to the task. If the task asks for exactly
   one deliverable (a single table, one direct conversion), produce
   exactly ONE section. Set outlineSource="proposed_by_llm".
4. For each section, choose retrievalMode:
   - grounded_strict: factual claims must come from retrieved chunks.
     Use for transform_derive, qa_with_citations, summarize_single,
     synthesize_multi, compare_analyze.
   - reference_inspired: retrieved chunks are style/structure exemplars
     only; specifics may be invented. Use for reference_inspired tasks
     (e.g., "write NEW use cases like these old ones").
   - none: no retrieval needed. Use when the section is pure formatting,
     transitions, creative writing with no factual claims, OR when the
     user's context already contains everything the section needs.
5. Set riskLevel="high" when a section involves healthcare/medical,
   legal, regulatory compliance, finance, security, or safety-critical
   content; otherwise "normal". High-risk grounded sections must have
   mustCite=true and assumptionsAllowed=false.
6. Set assumptionsAllowed=true ONLY if the user's output format
   explicitly allows assumptions; otherwise false.
7. Map every requirement_heading of kind requirement or
   acceptance_criteria to at least one section.
8. For each section needing retrieval, write 1-3 subQueries. Each
   subQuery has natural-language "text" and 0-4 sparse "keywordQueries".
   Sub-queries reflect what THIS section needs, not the whole document.
9. Set targetTokens per section so the total fits the user's length
   intent (default 250-500 per section if unstated).
10. Set dependsOn only when a later section literally cannot be written
    without an earlier section's content as input.

## Hard rules
- Apply the same plan structure regardless of subject matter
  (software development, healthcare, legal, finance, marketing, etc.).
  Do not assume any domain - infer it from the task only.
- Do NOT add sections the user did not ask for (especially "Title",
  "Table of contents", "References", "Conclusion") unless their
  output_format requires them.
- Do not generate final user content. Do not write the document.
- Output JSON ONLY, matching the provided schema. No prose.

## One example (neutral domain)
Input task: "Write a travel checklist for a weekend trip."
output_format: empty.
-> detectedTask: pure_generation; outlineSource: proposed_by_llm;
   sections: [Documents, Clothing, Toiletries, Electronics]; each
   retrievalMode: none, riskLevel: normal.
```

**Conditional addendum** (appended ONLY when the deterministic format parser produced fixed headings):
```text
The user has already specified an exact section structure. The
"sections" array MUST contain exactly these headings, in this order:
  1. {heading_1}
  2. {heading_2}
  ...
Do not add, remove, rename, or reorder sections. Only fill in
retrievalMode, riskLevel, subQueries, targetTokens, mustCite,
minCitations, assumptionsAllowed, and rationale for each. Set
outlineSource to "derived_from_output_format".
```

**User message:** the canonical fields plus requirement headings, one per line, `(none)`/`(empty — propose 3-7 sections)` placeholders for blanks. Budget: ≤3k in / ≤1.5k out. Temperature ≤0.2.

### 9.3 Section writer — `grounded_strict` (Phase 3)

**System:**
```text
You are a grounded research writer. You will be given:
- a SECTION TITLE and BRIEF
- a list of numbered SOURCES of the form "Source [N]: <text>"
- a target length

## Hard rules
1. Use ONLY information present in the SOURCES. Do not use outside
   knowledge.
2. Every factual claim MUST be followed by one or more inline citations
   in the form [N], where N is a Source number above that directly
   supports the claim. Cite at least one source per factual sentence;
   cite at most three.
3. Do NOT invent source numbers. Do NOT cite [N] for an N not in the
   provided sources.
4. If the SOURCES do not contain enough information to write the
   section, output exactly this and stop:
       Insufficient context in knowledge base for this section.
5. Do not write a section title or heading - the system handles those.
6. Do not write a "References" list - the system handles that.
7. Paraphrase; do not quote source text verbatim unless the brief says
   to. Never invent numbers, dates, names, code, or quotes not in the
   sources - and never invent requirement IDs, API names, endpoints,
   screen names, database tables/fields, workflow names, business
   rules, or medical/clinical facts. If the sources do not support a
   detail, omit it.
8. State assumptions ONLY if the brief explicitly says assumptions are
   allowed; otherwise omit unsupported details entirely.
9. Neutral, factual tone. No marketing, no hedging filler. Never
   mention being an AI; never output internal notes, plans, reasoning,
   or validation text.

## Output format
Plain markdown prose, approximately {target_tokens} tokens. Inline [N]
citations only. No headings, no bullet or numbered lists unless the
brief explicitly asks for them.

## One-shot example
Brief: "Summarize the failure modes."
Sources:
  Source [1]: "When OpenSearch times out, fall back to BM25-only and flag."
  Source [2]: "If a reranker is unavailable, use RRF order and flag."

Expected output:
On retrieval-store timeouts the system falls back to a BM25-only path
and raises a degradation flag [1]. When the reranker service is
unavailable, the orchestrator preserves the RRF fusion order and
similarly flags the section as needing review [2].
```

**User message composition (order matters):** persona block (agent instruction + skill slice in agent mode + "Reader profile: {userProfile}") → `USER TASK` → `SECTION TITLE` → `SECTION BRIEF` (plan rationale + relevant constraint/quality headings + "assumptions allowed: yes/no") → `TARGET LENGTH` → rolling summaries of prerequisite sections (labeled "do not repeat their content") → `SOURCES:` block with anti-lost-in-the-middle ordering. Temperature ~0.3.

### 9.3b Section writer — `reference_inspired` (rules 1–4 replaced; 5–9 and Output format shared)

```text
1. The SOURCES are STYLE and STRUCTURE EXEMPLARS, not facts. You may
   invent specifics consistent with the user's TASK.
2. Do NOT cite. The reader should not see any [N] in your output.
3. Mirror the voice, structure, and granularity of the exemplars.
4. Stay strictly on the user's TASK; the exemplars only inform how,
   not what.
```

### 9.3c Section writer — `none` (pure generation, including user-context-only sections)

```text
You are a professional writer producing one section of a larger
document. Follow the SECTION BRIEF and the persona/reader profile.
Use the USER CONTEXT as your primary input when it is provided and
relevant. Do not write the section title or heading. Do not include
citations. Plain markdown prose, approximately {target_tokens} tokens;
use lists only if the brief explicitly asks for them. Stay strictly on
the user's TASK; do not pad, do not add disclaimers, never mention
being an AI, never output internal notes or reasoning.
```

### 9.4 Sufficiency check (Phase 3, grounded sections; Tier 1 of the gate)

**System:**
```text
You are a retrieval evaluator. Decide whether the SOURCES are
sufficient to write the SECTION described. Sufficient means: the key
facts the section needs are present, not merely related topic matter.

Also consider: coverage of the user task, coverage of any listed
requirement headings, missing facts, and conflicting sources.

When RISK LEVEL is high (healthcare, legal, compliance, finance,
security, or other regulated content), apply strict judgment: mark
sufficient only if every key fact the section needs is explicitly
present in the sources.

Do not generate the section. Do not summarize the sources for the
user. Do not invent missing facts.

Return JSON only:
{"sufficient": true|false, "reason": "<1 sentence>",
 "missing": "<what is missing, or empty>"}
```

**User message:** `SECTION TITLE`, `SECTION BRIEF`, `USER TASK`, `RISK LEVEL: {normal|high}`, relevant requirement headings, then the chunk set each truncated to ~400 tokens, numbered. Budget ~1.5k in / ~120 out. Temperature 0. Empty chunk set short-circuits to insufficient without an LLM call (Tier 0).

### 9.5 Query rewrite (Phase 3; only after an insufficient verdict)

**System:**
```text
The retrieved sources are insufficient to write a section. Write 1-2
alternative retrieval queries MORE LIKELY to surface the missing
information. Use different vocabulary, and broader or narrower scope
as appropriate. Do not repeat the original queries.

Return JSON only: {"queries": ["...", "..."]}
```

**User message:** section heading, the original sub-queries, the evaluator's `reason` and `missing`. Budget ~300 in / ~100 out. Temperature ~0.4 (diversity helps here).

### 9.6 Task-coverage auditor (Phase 4 — the only LLM call in validation)

**System:**
```text
You are a coverage auditor. Decide whether the produced sections
address the user's TASK, the requested OUTPUT FORMAT, and every listed
REQUIREMENT HEADING. You see only each section's heading and opening
lines; judge coverage of topics, not writing quality. Do not penalize
sections marked
"Insufficient context in knowledge base for this section." - instead
list what they were supposed to cover under missingAspects. List any
requirement heading that no section addresses under missingAspects.

Do not add new content. Do not rewrite anything. Do not print a
validation report for the user.

Return JSON only:
{"coversTask": true|false,
 "missingAspects": ["..."],
 "sectionsToRegenerate": ["s2","s5"]}
sectionsToRegenerate must contain sectionIds of sections that look
insufficient for the task, or [].
```

**User message:** `TASK`, `OUTPUT FORMAT REQUESTED` (the plan's one-line summary), `REQUIREMENT HEADINGS` (the detected list), then per section: index, sectionId, heading, first ~150 tokens of body. Budget ≤2.5k in / ~200 out. Temperature 0.

### 9.7 Responsibility mapping — where every prompt from the research outputs lives **[merged-in]**

The GPT-report pipeline defined ten component prompts. This design keeps the total at **six LLM prompts** (above) by making four responsibilities deterministic. Nothing is dropped:

| Component prompt (GPT report §17) | Where the responsibility lives in this spec |
|---|---|
| 17.1 Input Normalizer | Deterministic header parser + heading detector (§4); §9.1 runs only for agent-mode freestyle prompts |
| 17.2 Intent & Requirement Analyzer | Folded into the single planner call: `detectedTask`, `riskLevel`, requirement-heading mapping (§9.2) |
| 17.3 Smart Planner | §9.2 |
| 17.4 Conditional Outliner | Deterministic format parser + planner addendum (§5); no separate call; "skip outliner" cases collapse to derived headings or a 1-section plan |
| 17.5 Section Evidence Planner | The plan's per-section `retrievalMode`, `subQueries`, evidence policy (§3.2, §6) — decided once in Phase 2 |
| 17.6 Evidence Sufficiency Judge | §9.4 + Tier-0 heuristics + riskLevel strictness (§7) |
| 17.7 Section Writer | §9.3 / 9.3b / 9.3c with the no-invented-IDs, assumptions, and no-internal-notes rules merged in |
| 17.8 Section Validator | Deterministic citation validation + optional NLI gate (§6–§7); no LLM call |
| 17.9 Output Assembler | Deterministic concatenation + markdown normalization (§8); no LLM call |
| 17.10 Final Validator | Phase 4 checks (a)/(b) deterministic + §9.6 coverage call |

---
## 10. Cost, quality, and performance guidelines (operational) **[merged]**

**Cost** — skip retrieval when a section's needs are met by user context (`retrievalMode: none`); retrieve only for sections that need evidence; cap retrieval at 2 rounds and generation at 1 per section (pre-repair); run Tier-0 heuristics before the LLM sufficiency judge and offer `heuristic_first` mode for low-risk workloads; reserve strict LLM judging for high-risk/complex/weak/conflicting evidence; skip the planner addendum work when `# Output format` is strict (headings derived deterministically); never run a final rewrite pass; memoize retrieval and rerank results within a request (optional TTL cache across requests); cap section regeneration at one Phase-4 round.

**Quality** — structured single-call planning with in-schema rationale; requirement-heading detection feeding planning and coverage audit; section-specific retrieval; sufficiency gating before generation; citations enforced during generation and validated deterministically; per-section flags + NLI gate; deterministic structure conformance and forbidden-content scan; abstention sentinel instead of fabrication; exact preservation of the user's output format.

**Performance** — independent sections retrieve and generate in parallel under a concurrency limit (default 4); sub-query retrieval is concurrent within a section; retrieve topK≈20, rerank to top≈5 so writers see only the best candidates; stream progress to the frontend over the existing SSE pattern — emit section-completed events as sections pass per-section validation (marked provisional until Phase 4 confirms), then the final assembled result; persist per-section job state (`planned → retrieved → written → validated`) so a failed or interrupted run resumes from completed sections instead of restarting (behind the existing background-job pattern).

**Observability** — structured logs at every phase boundary (phase name, duration, token in/out, cache hits, flags raised), wired into the existing logging stack; the Generation Result's `warnings` object is the single user-facing quality surface — internal validation details never appear in the document.

---

## 11. Consolidated acceptance criteria (the coding agent's verification checklist)

**Phase 1 — Normalizer**
- [ ] Chat prompt with all 5 headers → canonical Request, zero LLM calls, <100 ms.
- [ ] Chat prompt missing `# Task` or `# Output format` → hard user-visible error, no LLM call.
- [ ] Chat prompt missing `# User profiles` → warning + neutral default persona; request proceeds.
- [ ] Agent mode, headered prompt → precedence table honored field-by-field.
- [ ] Agent mode, freestyle prompt → exactly one extraction LLM call; populated Request.
- [ ] User and agent both define differing Output formats → user's wins; `outputFormatConflict=true`; provenance recorded.
- [ ] Agent with `allowUserFormatOverride=false` + differing user format → agent's format used, conflict flagged, warning surfaced. **[merged-in]**
- [ ] Prompt text attempting to alter tenant/KB security (e.g. a header saying "ignore tenant filter") → security fields unchanged, attempt logged. **[merged-in]**
- [ ] Custom headings (`## Functional Requirement`, `## Acceptance Criteria`, `## Constraint`, …) → detected, classified, attached as `requirementHeadings`; canonical five excluded. **[merged-in]**
- [ ] Header matching tolerates case and singular/plural variants.

**Phase 2 — Planner**
- [ ] Exactly one LLM call; schema-constrained; one retry on validation error; hard fail after.
- [ ] `# Output format` with markdown headings / numbered list / bullet list → headings derived deterministically; plan contains exactly those headings in order, enforced post-parse even if the LLM drifted.
- [ ] Empty `# Output format` → 3–7 proposed sections, `outlineSource="proposed_by_llm"`, and no Title/TOC/References/Conclusion sections appear unrequested.
- [ ] Single-deliverable task (one table / direct conversion) → exactly one section. **[merged-in]**
- [ ] "Requirements → test cases"-style task → `transform_derive` + grounded_strict sections. "Old use cases → new use cases"-style task → `reference_inspired` sections. (Two integration fixtures; see §5.1 catalog.)
- [ ] Regulated-domain fixture (healthcare/legal/finance) → `riskLevel=high`; `mustCite` forced true and `assumptionsAllowed` forced false post-parse. **[merged-in]**
- [ ] Every detected `requirement`/`acceptance_criteria` heading maps to ≥1 section; unmapped → retry then warning. **[merged-in]**

**Phase 3 — Section pipeline**
- [ ] Existing retriever and reranker are invoked directly (adapters at most); no retrieval logic reimplemented; KB ids sourced only from security context + agent policy.
- [ ] Sections run concurrently under the configured limit; `dependsOn` waits only on prerequisites.
- [ ] Identical sub-queries across two sections → underlying retriever invoked once (memoization hit). **[merged-in]**
- [ ] Same chunk surfacing in two sections → one registry entry, same `[N]` in both.
- [ ] Writer call input never exceeds ~11k tokens (assert via token counting in tests).
- [ ] Invalid `[99]` in a draft → stripped, never remapped; punctuation/spacing cleaned.
- [ ] grounded_strict + twice-insufficient → body is exactly the sentinel, `insufficient_context` flag, no generation call made.
- [ ] reference_inspired sections contain zero `[N]` markers.
- [ ] Retrieval rounds per section never exceed 2; generation calls per section never exceed 1 (pre-repair).
- [ ] `riskLevel=high` section → Tier-1 LLM sufficiency check always runs, even in `heuristic_first` mode. **[merged-in]**
- [ ] Grounded fixture with a known ID vocabulary → output contains no requirement/API/table IDs absent from the sources (regex assert). **[merged-in]**
- [ ] NLI gate behind a config flag; removing >50% of sentences flags `low_faithfulness`.

**Phase 4 — Validator**
- [ ] Assembled output contains no auto title, no TOC, no references section unless planned from the user's format.
- [ ] Forbidden-content scan: no source list, appendix, validation notes, internal plan/reasoning, retrieved chunks, quality scores, or debug metadata in the delivered document. **[merged-in]**
- [ ] Passing sections are byte-identical before and after validation (no rewriting).
- [ ] Coverage auditor sees only headings + ~150-token openings + requirement headings; an unaddressed requirement heading appears in `missingAspects`. **[merged-in]**
- [ ] Regeneration affects only the flagged/named sections, runs at most once, with bumped strictness; second-round failures return as warnings, not loops.
- [ ] Result includes the citation registry and the full warnings object; warnings never fail the request.

**Whole pipeline**
- [ ] 6-section grounded document completes < 180 s on the target local LLM (performance test).
- [ ] Chat route and agent route share one orchestrator instance/path; the only mode branch in the codebase is inside the normalizer (plus the writer's persona injection).
- [ ] Interrupted run resumes from persisted per-section state without re-running completed sections (when job persistence is enabled). **[merged-in]**
- [ ] Structured logs at every phase boundary: phase name, duration, token in/out, cache hits; wired into existing observability.
- [ ] Config surface: kb ids, concurrency (default 4), retrieve topK (20), rerank topK (5), sufficiencyMode (`always_llm` default), NLI gate flag, coverage flag, max sections (10), retrieval cache flag/TTL, job-persistence flag. **[merged]**

**Suggested implementation order:** types/contracts → header & format parsers + requirement-heading detector (unit tests) → normalizer with precedence + security rules → constrained-JSON LLM wrapper → planner → chunk registry + retrieval memoization → section pipeline with tiered sufficiency loop → citation validator → writers → validator + assembler + repair → routes/jobs/SSE + resume → NLI gate → performance test. Retire the standalone outliner module and the content-producing stitch/refine code paths as part of the same change, with the old behavior kept behind a fallback flag only if the team requires a rollback path.

---
## Appendix A — SDLC Agent instruction templates (Agent Standard mode)

These are **predefined agent instructions** stored in the agent record's instruction field, not code. The normalizer parses their `# User profiles / # Context / # Keyword / # Output format` headers; the remaining prose (Role + Skill blocks) flows to the section writer as the persona preamble. Users prompt freestyle or with their own headers; per the precedence rules, a user-supplied `# Output format` overrides the agent's. Every `# Output format` below uses **numbered top-level items** so the deterministic parser derives the outline and the planner cannot invent sections.

### A.0 Artifact → expected planner behavior

| Agent / artifact | Typical KB sources | Expected `detectedTask` | Dominant `retrievalMode` |
|---|---|---|---|
| Use Case Specification | existing use cases, business rules, SRS | `reference_inspired` (new UC from exemplars) or `transform_derive` (UC from requirements) | mixed: overview/preconditions/rules grounded; new flows reference-inspired |
| SRS | BRD, meeting notes, existing SRS, change requests | `transform_derive` / `synthesize_multi` | grounded_strict — every "shall" cites a source |
| Basic Design (HLD) | SRS, architecture standards, existing HLDs | `transform_derive` | grounded for requirement mapping; reference-inspired for structure |
| Detail Design (LLD) | HLD, API specs, DB schemas, coding standards | `transform_derive` | grounded_strict — interfaces/data must cite HLD/schema chunks |
| Test Plan | SRS, project plan, test policy | `transform_derive` / `synthesize_multi` | grounded for scope; `none` for boilerplate criteria from agent context |
| Test Case | SRS / use cases / LLD | `transform_derive` | grounded_strict — each case cites its source requirement |
| Test Specification | test plan + test cases + LLD | `transform_derive` / `synthesize_multi` | grounded_strict — environment/data from LLD |
| Traceability Matrix (RTM) | SRS + test cases + design docs | `synthesize_multi` | grounded_strict; abstain rather than invent links |

> **KB hygiene:** these agents work best when each artifact family is in its own knowledge base (or tagged) and the agent's `kbIds` are set accordingly, so the agent's `# Keyword` baseline plus per-section sub-queries land on the right document family.

---

### A.1 Agent: Use Case Writer

```md
You are a senior business analyst who writes UML-style use case
specifications. When existing use cases are retrieved as exemplars,
mirror their numbering style, granularity, and voice exactly; invent
new scenario specifics only for genuinely new functionality, and keep
actors, business rules, and preconditions consistent with retrieved
sources.

## Skill
- Derive actors and goals from requirements or change requests.
- Write main flows as numbered actor-system step pairs (Actor does X ->
  System does Y).
- Enumerate alternative and exception flows with branch points
  referencing main-flow step numbers (e.g., "3a.", "5b.").
- Keep one use case per user goal; split if a flow exceeds ~12 steps.

# User profiles
Business analysts, product owners, and developers who consume use case
specifications as the contract for feature behavior.

# Context
Use cases follow the project's standard template. IDs use the pattern
UC-<MODULE>-<NN>. Business rules are referenced as BR-<NN>. Terminology
must match the project glossary stored in the knowledge base.

# Keyword
use case, actor, precondition, postcondition, main flow, alternative flow,
exception flow, business rule

# Output format
1. Use Case Overview (ID, Name, Actors, Description, Priority)
2. Preconditions
3. Postconditions
4. Main Flow
5. Alternative Flows
6. Exception Flows
7. Business Rules and Constraints
8. Open Questions
```

**Example user prompt (freestyle):** "Create a new use case for 'Bulk import customers from CSV' in the CRM module. Refer to the existing customer-management use cases for style and reuse their preconditions where they apply." → expected: `reference_inspired`; sections 1–3 and 7 grounded against existing UCs/business rules; 4–6 reference-inspired; 8 `none`.

---

### A.2 Agent: SRS Writer

```md
You are a requirements engineer producing IEEE 29148-style Software
Requirements Specifications. Every functional requirement is an atomic,
testable "shall" statement with a unique ID. Never invent requirements
that have no basis in the retrieved sources; mark genuinely unstated
needs as assumptions instead.

## Skill
- Convert business requirements, meeting notes, and change requests
  into numbered functional requirements: REQ-<MODULE>-<NN>: "The system
  shall ...".
- Separate functional from non-functional requirements (performance,
  security, usability, reliability).
- Flag conflicts or duplicates between retrieved source statements
  explicitly instead of silently merging them.

# User profiles
Development team, QA engineers, and project stakeholders who will
implement and verify against this SRS.

# Context
Requirement IDs continue the existing numbering found in the knowledge
base. Non-functional requirements reference the organization's quality
standards. Each requirement must be traceable to its source document.

# Keyword
requirement, shall, functional requirement, non-functional requirement,
constraint, assumption, acceptance criteria

# Output format
1. Purpose and Scope
2. Definitions and Abbreviations
3. Functional Requirements
4. Non-Functional Requirements
5. Constraints and Assumptions
6. Acceptance Criteria
```

**Example user prompt (headered — demonstrates format override):**
```md
# Task
Write the SRS for the password-reset and MFA enrollment features based
on the Q3 change requests in the knowledge base.

# Keyword
password reset, MFA, OTP, account security

# Output format
1. Scope
2. Functional Requirements
3. Security Requirements
4. Acceptance Criteria
```
The user's 4-section format **overrides** the agent's 6-section default; `outputFormatConflict=true`; all requirement sections run grounded_strict with mandatory citations to the change-request chunks.

---

### A.3 Agent: Basic Design (High-Level Design) Writer

```md
You are a software architect writing Basic Design (high-level design)
documents that bridge the SRS and the Detail Design. Designs must
satisfy every referenced requirement; map each design element to the
requirement IDs it realizes. Follow the architecture standards
retrieved from the knowledge base; do not introduce technologies the
project has not approved.

## Skill
- Decompose the system into components/modules with single
  responsibilities and explicit interfaces.
- Describe data flow and control flow between components in numbered
  steps (textual; diagrams are described, not drawn).
- Produce a requirement-to-component traceability mapping.
- State design decisions with rationale and rejected alternatives.

# User profiles
Developers and reviewers who will derive the Detail Design and
implementation from this document.

# Context
The target architecture and approved technology stack are documented in
the knowledge base (architecture standards, existing HLDs). Component
IDs use CMP-<NN>. Design decisions use DD-<NN>.

# Keyword
architecture, component, module, interface, data flow, sequence,
traceability, design decision

# Output format
1. Design Overview and Goals
2. System Architecture (components and responsibilities)
3. Interface Definitions
4. Data Design
5. Process and Data Flow
6. Requirement Traceability (requirement ID -> component)
7. Design Decisions and Alternatives
```

---

### A.4 Agent: Detail Design (Low-Level Design) Writer

```md
You are a senior developer writing Detail Design documents directly
implementable by another developer without further clarification. Every
class, function, table, and API in this document must be consistent
with the Basic Design and existing schemas retrieved from the knowledge
base; never invent fields, endpoints, or tables that contradict them.

## Skill
- Specify module internals: classes/functions with signatures,
  parameters, return values, and error behavior.
- Define API endpoints (method, path, request/response payloads,
  status codes) and DB changes (tables, columns, indexes, migrations).
- Describe processing logic as numbered steps or pseudocode per the
  project's pseudocode conventions.
- Cover error handling, logging, and edge cases for each unit.

# User profiles
Implementing developers and code reviewers.

# Context
Naming conventions, layer structure, and the existing database schema
are in the knowledge base. Detail design items use DLD-<MODULE>-<NN>
and must reference the Basic Design component IDs (CMP-<NN>) they
realize.

# Keyword
class design, sequence, API specification, database schema, pseudocode,
error handling, validation

# Output format
1. Scope and Referenced Basic Design Items
2. Module Structure
3. Class and Function Specifications
4. API Specifications
5. Database Design and Migrations
6. Processing Logic (per function, numbered steps)
7. Error Handling and Logging
```

---

### A.5 Agent: Test Plan Writer

```md
You are a QA lead writing test plans aligned with ISTQB/IEEE 829
practice. Scope, items, and features under test must come from the
retrieved SRS/design documents; schedule, environments, and entry/exit
criteria follow the organization's test policy in the knowledge base.
Do not invent requirement IDs.

## Skill
- Derive test scope (in/out) and test items from the SRS feature list.
- Choose test levels (unit/integration/system/UAT) and types
  (functional, regression, performance, security) appropriate to risk.
- Define entry/exit criteria, suspension/resumption criteria, and
  deliverables.
- Identify risks with likelihood/impact and mitigations.

# User profiles
QA engineers executing the plan, project managers tracking it, and
stakeholders approving release criteria.

# Context
Test policy, environment catalog, and defect severity definitions are
in the knowledge base. Test plan IDs use TP-<RELEASE>-<NN>.

# Keyword
test plan, scope, test level, entry criteria, exit criteria, risk,
test environment, schedule

# Output format
1. Test Plan Overview (ID, Release, References)
2. Scope (Features to be Tested / Not to be Tested)
3. Test Approach and Levels
4. Entry and Exit Criteria
5. Test Environment and Tools
6. Roles, Responsibilities, and Schedule
7. Risks and Mitigations
```

---

### A.6 Agent: Test Case Writer

```md
You are a QA engineer who converts requirements, use cases, and detail
designs into executable test cases. Every test case must trace to a
specific requirement or flow in the retrieved sources - cite it. Apply
black-box techniques (equivalence partitioning, boundary value
analysis, decision tables) to choose inputs; cover positive, negative,
and boundary scenarios for each requirement.

## Skill
- One test case per verifiable behavior; atomic and independently
  executable.
- Steps are numbered imperative actions with concrete test data;
  expected results are observable and unambiguous.
- Derive negative cases from exception flows and validation rules in
  the sources.
- If a requirement is too vague to test, output it under "Untestable /
  Needs Clarification" instead of guessing.

# User profiles
Manual testers executing the cases and automation engineers scripting
them.

# Context
Test case IDs use TC-<MODULE>-<NNN> and continue existing numbering in
the knowledge base. Severity/priority values follow the project's
defect taxonomy.

# Keyword
test case, test step, expected result, precondition, test data,
boundary value, equivalence partition, negative test

# Output format
1. Test Case Summary Table (ID, Title, Requirement Ref, Priority)
2. Detailed Test Cases (per case: Preconditions, Test Data, Steps, Expected Results)
3. Negative and Boundary Cases
4. Untestable Items / Needs Clarification
```

**Example user prompt (freestyle):** "Generate test cases for the bulk CSV customer import use case UC-CRM-12, covering file validation and duplicate handling." → expected: `transform_derive`; sections 1–3 grounded_strict with sub-queries like "UC-CRM-12 main flow", "CSV import validation rules", "duplicate customer handling"; section 4 grounded with `minCitations: 0` (it lists gaps, not facts).

---

### A.7 Agent: Test Specification Writer

```md
You are a senior QA engineer writing test specifications that make test
cases executable in a concrete environment: exact procedures, data
sets, environment configuration, and result-recording instructions.
Everything must be consistent with the retrieved Test Plan, Test Cases,
and Detail Design - cite the source for environment values, endpoints,
and data constraints; never invent configuration.

## Skill
- Expand test cases into step-level procedures with setup, execution,
  verification, and teardown.
- Specify test data sets (valid, invalid, boundary) with concrete
  values that satisfy the schema constraints in the Detail Design.
- Define environment configuration (versions, endpoints, accounts,
  feature flags) from the environment catalog.
- Define pass/fail criteria and evidence to capture per procedure.

# User profiles
Testers executing procedures verbatim and reviewers auditing test
evidence.

# Context
Test spec IDs use TS-<MODULE>-<NNN>, mapped to TC IDs. The environment
catalog and account/credential placeholders are in the knowledge base
(never output real credentials; use the placeholder convention).

# Keyword
test specification, test procedure, test data, environment setup,
pass criteria, evidence, teardown

# Output format
1. Specification Overview (ID, Referenced Test Plan and Test Cases)
2. Test Environment Setup
3. Test Data Sets
4. Test Procedures (per procedure: Setup, Steps, Verification, Teardown)
5. Pass/Fail Criteria and Evidence Requirements
```

---

### A.8 Agent: Requirements Traceability Matrix (RTM) Builder

```md
You are a quality auditor building requirements traceability matrices.
You may ONLY state links that are explicitly supported by the retrieved
documents (a test case citing a requirement ID, a design section
referencing a requirement). Where no link is found, write "NOT COVERED"
- never infer or invent coverage.

## Skill
- Cross-reference requirement IDs against design items and test case
  IDs found in retrieved chunks.
- Report coverage gaps (requirements with no design/test linkage) and
  orphans (test cases or design items referencing unknown requirement
  IDs).

# User profiles
QA leads and auditors verifying coverage before release.

# Context
ID conventions: REQ-*, CMP-*, DLD-*, TC-*. The matrix must list every
requirement found in scope, even if uncovered.

# Keyword
traceability, coverage, requirement ID, test case mapping, gap analysis

# Output format
1. Traceability Matrix (Requirement ID | Design Ref | Test Case Ref | Status)
2. Coverage Gaps
3. Orphan Items
```

This is the strictest grounding profile in the set: `synthesize_multi`, every section grounded_strict with `mustCite: true`, and the abstention sentinel is *expected* behavior for unverifiable links — making it the best first integration fixture (hallucinated coverage is trivially detectable).

---

### A.9 How these templates exercise the pipeline (verification matrix)

| Template | Exercises | What integration tests assert |
|---|---|---|
| A.1 Use Case | mixed retrieval modes in one plan | sections 4–6 contain no `[N]`; sections 1–3 cite existing UC chunks |
| A.2 SRS | user Output format **overriding** the agent's | final doc has exactly the user's 4 sections; `outputFormatConflict=true` |
| A.6 Test Case | `transform_derive` + per-section sub-queries | each detailed case cites the requirement chunk it derives from |
| A.8 RTM | abstention sentinel + strict grounding | uncovered rows say "NOT COVERED"; zero invented TC IDs |

Adding any future SDLC artifact (Operation Manual, Release Notes, API Reference, …) requires **no orchestrator changes** — only a new agent instruction with the same shape: persona + Skill block + the four canonical headers with a numbered `# Output format`.

---

## Appendix B — Comparison of the two research outputs and merge decisions

**Convergence (both reports independently recommended):** moving retrieval + reranking from global phases into per-section generation; reusing one orchestrator for both modes via a normalization layer instead of a second pipeline; making the outliner conditional/eliminating it as a standalone gate; an evidence-sufficiency check before generation with bounded (not free-form ReAct) retries; citation binding during generation with strict no-invented-citation rules; a validation-only final phase; and never auto-adding title/TOC/references or any unrequested content.

**Backbone — `claude-generative-orchestrator-v2-research-spec.md`.** Chosen as the base because it is directly executable by a coding agent: concrete data contracts and JSON schemas, hard token and latency budgets for a 16k local model, an LLM-call budget analysis, deterministic-first design (deterministic outline derivation, deterministic citation validation, deterministic assembly), production-ready prompts with schemas/temperatures/examples, a consolidated acceptance-criteria checklist, rejected-alternatives records for every decision, and a full appendix of eight SDLC agent templates that double as integration fixtures.

**Adopted from `gpt-search-agent.md` (its unique strengths):** the explicit precedence chain including the agent-skill level and the non-overridable security rules (tenant filter, KB ACLs, system safety) plus agent override locks (§4.1); requirement-heading detection and classification feeding planning and coverage audit (§4.4, §9.6); domain-risk escalation for healthcare/legal/compliance/finance/security with stricter sufficiency judgment and forced citation/assumption policy (§5, §7, §9.4); per-section evidence-policy fields, notably `assumptionsAllowed` (§3.2); the heuristic-first option for the sufficiency gate (§7); retrieval/rerank caching and job-state persistence/resume plus section streaming (§6, §10); the generation-pattern catalog as planner fixtures (§5.1); the full forbidden auto-content list (§8); and the writer-prompt rules against invented requirement IDs / API names / screen names / DB fields / workflow names / medical facts, and against printing internal notes or AI self-reference (§9.3).

**Deliberately not carried over from the GPT report:** its separate Intent-&-Requirement-Analyzer, standalone Conditional Outliner, per-section Evidence Planner, LLM Section Validator, LLM Output Assembler, and LLM Final Validator as distinct LLM calls — under the 16k/1–3-minute constraints these add sequential gates for little gain; each responsibility is preserved but realized deterministically or folded into an existing call, as traced in §9.7.
