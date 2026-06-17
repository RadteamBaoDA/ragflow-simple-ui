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
   > **Read §0.1 (Project Context) FIRST — and treat it as authoritative over your own discovery.** §0.1 carries the project-specific facts a coding agent **cannot** reliably infer from the code alone: the real retriever/reranker module paths and signatures, the LLM client and whether it supports constrained JSON decoding, the agent-standard storage shape, the SSE/job/config patterns to reuse, plus hard constraints and known gotchas. If any `> _(fill in: …)_` placeholder in §0.1 is still blank, **STOP and ask the user to supply it before planning** — do not guess, and do not silently fall back to assumptions. Where §0.1 and your own codebase reading disagree, surface the conflict to the user rather than picking one.
2. **Map this spec onto what exists.** For each phase below, identify whether existing code can be **reused**, **refactored**, or must be **newly created**, and which existing modules are **retired** (notably the standalone outliner, the standalone global retrieve/rerank phases, and the content-producing parts of the stitch/refine phase).
3. **Produce the detailed implementation plan** — file-by-file change list, new modules, retired modules, migration steps, configuration changes, and a test list covering Section 11 — and only then implement. The plan must explicitly cover: input normalization for both modes, the planner upgrade, moving retrieval+reranking into the section pipeline, the sufficiency gate, citation validation, the validate-only final phase, prevention of extra output sections, and the cost/quality/performance measures of Section 10.
4. **Treat every "MUST / MUST NOT" in this document as an acceptance criterion.** Section 11 consolidates them into a verification checklist.

Target stack discovered so far: Node.js / Express / TypeScript backend with a React frontend; the orchestrator from solution1.md may be partially implemented — verify rather than assume.

---

## 0.1 Project Context (authoritative — fill in before planning)

> **This section is authoritative over the coding agent's own codebase discovery (§0).** It records the project-specific facts an agent cannot reliably infer from the code alone. Every `> _(fill in: …)_` placeholder below MUST be supplied by the user/maintainer **before** any implementation plan is written. **If any placeholder is still blank, STOP and ask the user to supply it — do not guess, and do not silently fall back to assumptions.** Where this section and your own reading of the code disagree, surface the conflict to the user rather than picking one.

### 0.1.1 Retriever component (existing — reuse as-is, never reimplement)
- Module path / file: > _(fill in: where the custom retriever lives)_
- Function name + exact signature: > _(fill in: e.g. `retrieve(query: string, kbIds: string[], topK: number): Promise<ScoredChunk[]>`)_
- Input shape (query, kb ids, topK, any filters): > _(fill in)_
- Output shape (chunk fields: id, text, score, metadata, source doc): > _(fill in)_
- Sync vs async; throws vs error-return on failure: > _(fill in)_
- Where it is instantiated / how to obtain an instance: > _(fill in)_

### 0.1.2 Reranker component (existing — reuse as-is, never reimplement)
- Module path / file: > _(fill in)_
- Function name + exact signature: > _(fill in: e.g. `rerank(query: string, chunks: Chunk[]): Promise<Chunk[]>`)_
- Input / output shapes; sync vs async; failure behavior: > _(fill in)_
- Where it is instantiated: > _(fill in)_

### 0.1.3 LLM client abstraction
- Module path / how a completion is invoked: > _(fill in)_
- Local serving backend (Ollama / vLLM / llama.cpp / other) + model id(s): > _(fill in)_
- Cloud fallback present? how selected?: > _(fill in)_
- **Does it support schema/grammar-constrained JSON decoding?** (yes/no + how): > _(fill in — this gates the §3.2/§9 "schema-constrained + one retry" contract; if no, the agent must propose the fallback strategy)_
- Effective context window actually configured (spec assumes ~16k): > _(fill in)_

### 0.1.4 Agent Standard storage shape
- Where agent definitions/instructions are stored (table/collection/file): > _(fill in)_
- How an agent is loaded at request time: > _(fill in)_
- Agent record fields available (instruction text, `## Skill`, kbIds, policy flags, configured output formats for §4.3b): > _(fill in)_
- Where `agentPolicy` (allowUserFormatOverride / allowUserRetrievalOverride / citationPolicy) is stored or how it is derived: > _(fill in)_

### 0.1.5 Patterns to reuse
- Background-job pattern (for §10 resume / per-section state): > _(fill in)_
- Streaming/SSE-to-frontend pattern (for §10 section-completed events): > _(fill in)_
- Configuration mechanism (for the §11 config surface): > _(fill in)_
- Logging/observability stack (for §10 phase-boundary logs): > _(fill in)_
- Persistence/migrations approach; shared type-definition location: > _(fill in)_

### 0.1.6 Hard constraints & known gotchas
- Project-specific constraints not derivable from code (perf ceilings, tenancy quirks, deployment limits): > _(fill in)_
- Known gotchas in the retriever/reranker/LLM client (rate limits, concurrency limits, payload caps): > _(fill in)_
- Multi-tenant security context: how `tenantId` / `kbIds`/ACL are obtained from the session (§3.1 `security`, §4.1): > _(fill in)_

### 0.1.7 Existing chat-QA inline-citation contract (Phase 3 MUST reuse this — §6) **[merged-in]**
Phase 3 grounded sections MUST emit citations in the **same format the existing chat-QA feature already uses**, so the frontend renders them with the **same code**. Do NOT invent a new citation syntax or a parallel rendering path. Discover and record:
- Inline citation **token syntax** as the model/back end emits it (the spec writes `[N]` as a stand-in — replace with the real token): > _(fill in: e.g. `[1]`, `[[1]]`, `{{cite:chunkId}}`, `<cite id="…"/>`, or a sentinel the FE post-processes)_
- **Numbering / id scheme**: how a citation id is assigned and what it maps to (per-answer sequential, per-chunk-id, per-document, hash, etc.): > _(fill in)_
- **FE render contract**: the exact payload/shape the frontend consumes to render a citation + its "source" hover/panel (field names, marker→source mapping, where the source list is attached): > _(fill in)_
- Where this lives in code (the chat-QA writer prompt, the response serializer, the FE citation component): > _(fill in)_
> If the existing chat-QA scheme assigns ids **per single answer** and lacks a stable cross-message id, note it here — §6 requires a *cross-section* stable id (same chunk → same citation everywhere in one generated document), so the scheme is **reused and minimally extended** to carry that property, never forked into a second convention.

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

Total LLM work is similar or lower (the heuristic sufficiency tier and retrieval memoization in §6–§7 can remove small calls); the structural gain is **parallelism plus removed sequential gates**. The Target row counts the core path; conditional Phase-1 fallbacks (the §9.1 freestyle extractor and the §9.7 format-intent check) add **at most one small call each, agent-mode only**, and fire only when a header/format is absent — zero on this 6-section chat-mode example.

---
## 3. Data contracts (language-neutral; the coding agent maps these to the codebase's typing conventions)

Fields marked **[merged-in]** extend the original contract with content adopted from the second research output.

### 3.1 Canonical Request (output of Phase 1)

| Field | Type | Rules |
|---|---|---|
| `mode` | `"chat"` \| `"agent"` | Set by presence of an agent instruction |
| `userProfile` | string | Always populated (source per §4.2a chat / §4.2b agent) |
| `task` | string | Required, non-empty in both modes |
| `context` | string | May be empty; agent baseline + user context concatenated, agent first |
| `keyword` | string[] | Union-merged, deduplicated |
| `outputFormat` | string | Raw header body; empty string means "LLM may propose structure" |
| `outputFormatSource` | `"user"` \| `"agent"` \| `"default"` | Provenance for auditability |
| `outputFormatConflict` | boolean | True when user and agent both supplied a format and they differ |
| `agentInstruction` | string \| absent | Raw agent persona text, agent mode only. Goes to the **writer** as an opaque persona string; its *planning-relevant* content is NOT sent to the planner as prose — the normalizer extracts that into `agentPlanningHints`, `agentPolicy`, and `requirementHeadings` (see §4.6) so the planner consumes structured data, not prose (preserves the auditable precedence chain, §4.1). |
| `agentSkill` | string \| absent | **[merged-in]** The agent's `## Skill` block when separable; concatenated after `agentInstruction` for the writer persona, kept separate for precedence audit. Also the primary source the normalizer mines for `agentPlanningHints` and per-section `acceptanceCriteria` seeds (§4.6, §9.2). |
| `agentPolicy` | object \| absent | **[merged-in]** `{ allowUserFormatOverride: bool (default true), allowUserRetrievalOverride: bool (default true), citationPolicy?: "required"|"optional" }`. Read by the **planner** to bias evidence policy (citationPolicy="required" → grounded sections get `mustCite=true`, `minCitations≥1`). |
| `agentPlanningHints` | object \| absent | **[merged-in]** Structured, planner-facing distillation of the agent instruction + skill, populated by the normalizer (§4.6), NEVER from user prompt text. Shape: `{ defaultVerbosity?: "concise"|"standard"|"detailed", idConventions?: string[] (e.g. "UC-<MODULE>-<NN>"), terminology?: string[], requiredContent?: string[] (rules like "always include Open Questions"), forbiddenContent?: string[] (e.g. "never output real credentials"), domainRiskCues?: string[] (terms that imply riskLevel=high), retrievalHints?: string[], skillCriteria?: string[] (generic per-section quality rules from ## Skill, seed for acceptanceCriteria) }`. All fields optional; absent in chat mode. The planner reads it (§9.2); it carries no section structure (structure is `# Output format` only). |
| `requirementHeadings` | `{text, kind}[]` | **[merged-in]** Custom requirement-like headings detected in user prompt and agent instruction beyond the five canonical headers; `kind ∈ {requirement, constraint, acceptance_criteria, domain_rule, quality_rule, retrieval_hint, unknown}` (§4.4) |
| `agentScope` | `"all_kb"` \| `"specific_kb"` \| `"general"` \| absent | **[merged-in]** Agent mode only (absent in chat mode). The agent's retrieval scope, from agent config (never prompt text): `all_kb` = retrieve across every KB the tenant/ACL allows; `specific_kb` = retrieve from the agent's configured KB subset; `general` = the agent has **no KB access** and answers from the LLM's trained knowledge. Drives `noKnowledgeBase` (below). `all_kb`/`specific_kb` ⇒ grounded (behaves like chat); `general` ⇒ ungrounded. |
| `security` | object | **[merged-in]** `{ tenantId, kbIds/ACL }` — populated from the session, **never** from prompt text, never altered by any merge |
| `noKnowledgeBase` | boolean | **[merged-in]** Derived, never from prompt text. **Chat mode:** always `false` — chat REQUIRES a knowledge base; if none is wired the request is a hard error before generation (§4.5), it is never silently ungrounded. **Agent mode:** `true` iff `agentScope="general"` (or the effective KB set resolves empty for an `all_kb`/`specific_kb` agent). When `true`, the orchestrator forces every section to `retrievalMode: none` (§5) — generated from model knowledge + `# Context` alone, no retrieval, no citations. This is the **only** sanctioned ungrounded path; there is no `pure_generation` task type (§5.4). |
| `rawUserPrompt` | string | Preserved verbatim for traceability |

### 3.2 Plan (output of Phase 2 — the planner LLM's required JSON shape)

```json
{
  "detectedTask": "qa_with_citations | summarize_single | synthesize_multi | compare_analyze | transform_derive | reference_inspired | review_validate",
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
      "acceptanceCriteria": ["string — [merged-in] 0–6 testable, per-section quality/conformance checks the writer MUST satisfy and the coverage auditor (§9.6) checks against. Derived by the planner from: (a) the agent SKILL block, (b) the per-section item in # Output format, (c) matched requirement/acceptance_criteria/quality_rule headings (§4.4), and (d) the active artifact plan-skill (§A.10.1). Each criterion is an objective property of the finished section ('every test case cites a source requirement', 'each gap names the SRS clause it violates'), NEVER a new section or heading. Empty when nothing constrains the section beyond its brief."],
      "referenceQueries": [
        { "text": "[merged-in] retrieval query for the REFERENCE/ground-truth side only (review_validate sections) — what the artifact SHOULD conform to (e.g. the SRS, the template, the standard)", "keywordQueries": ["0–4 anchors"] }
      ],
      "subQueries": [
        { "text": "natural-language retrieval query (for review_validate: the ARTIFACT-UNDER-REVIEW side — what the artifact actually says)", "keywordQueries": ["0–4 sparse/BM25 anchor terms"] }
      ],
      "targetTokens": "int 80–1200",
      "dependsOn": ["sectionIds that must be written first; usually empty"]
    }
  ],
  "notes": "optional string"
}
```

Validation rules: 1–10 sections; ≤3 subQueries per section; ≤3 referenceQueries per section; ≤6 acceptanceCriteria per section; the schema MUST be enforced via grammar/schema-constrained decoding with exactly one retry (validation error appended to the prompt) before failing the request. Post-parse, the orchestrator deterministically forces `mustCite=true` and `assumptionsAllowed=false` on every `grounded_strict` section with `riskLevel=high`, regardless of what the LLM returned. **[merged-in]** Post-parse, every `review_validate` section is likewise forced to `retrievalMode=grounded_strict`, `mustCite=true`, `assumptionsAllowed=false` (a review may never invent a gap or fabricate conformance); `referenceQueries` is non-empty only for `review_validate` sections and is dropped (ignored) on every other task. `acceptanceCriteria` is advisory metadata, never structure: it is appended to the writer brief and handed to the coverage auditor, but it MUST NOT cause the assembler to add, rename, or reorder any section — Phase 4's forbidden-content scan (§8) strips anything a criterion accidentally tries to inject.

### 3.3 Written Section (output of each Phase 3 section run)

| Field | Type | Rules |
|---|---|---|
| `sectionId`, `heading` | string | Copied from plan; heading never altered by the writer |
| `body` | string | Markdown prose; contains inline `[N]` only for grounded sections |
| `citations` | map citationNumber → useCount | Only numbers that survived deterministic validation |
| `chunksUsed` | chunk refs | The reranked set actually offered to the writer; for `review_validate` sections, split into artifact-side and reference-side sets so the coverage auditor and source panel can show both |
| `flags` | string[] | `insufficient_context`, `no_citations`, `low_faithfulness`, **[merged-in]** `unmet_acceptance_criteria` (raised when the deterministic post-write checks in §6 cannot confirm a section's `acceptanceCriteria` — e.g. a criterion says "every test case cites a source requirement" but an uncited row exists) |

### 3.4 Generation Result (returned to the caller)

Assembled markdown (inline citations in the **chat-QA token format**, §0.1.7) + the plan + per-section records + the **global citation registry** (citation id → chunk reference, emitted in the **same payload shape the chat-QA feature uses** so the FE's existing "show sources" panel renders it unchanged — NOT injected into the document) + a `warnings` object: structure errors, citation errors, coverage verdict, regenerated section ids, requirement-heading coverage gaps, a `noKnowledgeBase` flag (set when the document was generated ungrounded because no KB was available — §4.5), a `formatResolutionFailed` flag (§4.3b), and the **operational-robustness fields** `partial`, `failedSections[]`, `deadlineHit`, `deadlineSkippedSections[]`, `cancelled`, `dependencyEdgesDropped[]` (§7a). Warnings never fail the request.

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

### 4.2 Field resolution per mode

The two modes resolve the canonical Request fields by **fundamentally different models**, so they are specified separately below. The difference is confined to *how each field is sourced* — both modes emit the **identical canonical Request** (§3.1), so §5–§8 never branch on mode (the core reuse invariant, §4 Decision).

- **Chat generative mode = single-source.** Every field comes from **one** place: the user's markdown headers. The five headers (`# User profiles / # Task / # Context / # Keyword / # Output format`) are the whole input; `# Task` and `# Output format` are **required** (§4.3.2). No agent, no tool, no precedence merge — just deterministic header parsing. See §4.2a.
- **Agent Standard mode = multi-source with precedence.** Fields are assembled from **several** sources — the agent instruction, the agent `## Skill` block, the output-format resolver tool (§4.3b), and the user's prompt (headers OR freestyle) — resolved through the precedence chain (§4.1). The **five headers are NOT required**; the user may prompt in freestyle natural language and the missing structured fields are recovered from the agent + tool + the §9.1 extractor. See §4.2b.

#### 4.2a Chat generative mode — fields from user headers only

| Field | Source (all from the user's headers) |
|---|---|
| User profiles | from `# User profiles`; **optional** — missing → warning + neutral default persona "general professional reader" |
| Task | from `# Task`; **required** (missing → hard error, §4.3.2) |
| Context | from `# Context`; optional, may be empty |
| Keyword | from `# Keyword`; optional |
| Output format | from `# Output format`; **required** (missing → hard error, §4.3.2) |

No agent instruction, no resolver tool, no precedence merge applies in chat mode. `agentInstruction`/`agentSkill`/`agentPolicy`/`agentPlanningHints` are absent; `outputFormatSource="user"` always. The normalizer is pure deterministic header parsing here (zero LLM calls, <100 ms).

#### 4.2b Agent Standard mode — fields from multiple sources (precedence-resolved)

The five headers are **not required**; the user prompt may be freestyle. Each field is resolved from the sources below, top-of-chain (§4.1) winning. Where the user supplied a header, it participates per the rule shown; where the user is freestyle, the value comes from the §9.1 extractor and/or the agent.

| Field | Sources & resolution rule (agent mode) |
|---|---|
| User profiles | from the **agent instruction**; the user cannot override (the agent defines its audience). |
| Task | from the **user prompt** (a `# Task` header, or extracted from freestyle via §9.1); **required** — a request with no discernible task is a hard error. |
| Context | **merge**: agent baseline context first, then the user's `# Context` (or freestyle-extracted), concatenated. |
| Keyword | **union** of the agent's baseline keywords and the user's, deduplicated. |
| Output format | resolved in priority order: (1) user's `# Output format` if present **overrides** the agent — unless `allowUserFormatOverride=false` (then agent wins, `outputFormatConflict=true`, warning); (2) else, if the prompt hints at a configured format, the **resolver tool** (§4.3b) supplies it at the agent level; (3) else the agent's **default** `# Output format`; (4) else the planner proposes structure (§5). `outputFormatSource` records which won (`user`/`agent`). |

All four agent-mode source signals beyond the headers — instruction persona, `## Skill`, retrieval/citation policy, configured formats — are themselves resolved/distilled by the normalizer (§4.3b resolver tool, §4.6 `agentPlanningHints`, §4.4 requirement headings) **before** they populate the Request, so downstream phases still receive only the flat canonical Request.

### 4.3 Requirements

1. **Header parsing is deterministic.** Markdown `# Header` lines split the text into named bodies. Matching is case-insensitive and tolerant of trailing `s` ("Keyword"/"Keywords", "User profile"/"User profiles"). Implementation detail (regex vs parser) is the coding agent's choice; behavior is the contract.
2. **Chat-mode validation:** missing `# Task` or `# Output format` is a hard, user-visible error before any LLM call. **[merged-in]** Chat mode also **requires a knowledge base**: if the effective KB set is empty (none wired for the session), the request is a hard, user-visible error before generation — chat mode is RAG-over-internal-data and is never silently answered from model knowledge (which would reintroduce cut-off-knowledge hallucination and model bias). Ungrounded generation is reachable only via an agent with `agentScope="general"` (§4.5).
3. **Freestyle fallback (agent mode only):** if the user prompt contains none of the canonical headers, run exactly one small LLM extraction call (≤500 input tokens, schema-constrained JSON) producing `task`, `context`, `keyword[]`, `output_format`. Prompt: §9.1.
4. **Output-format resolution via tool (agent mode only) [merged-in]:** when no `# Output format` is resolved from the user prompt (neither a header nor the freestyle extractor produced one) AND the prompt hints at using a configured format, the normalizer resolves the format through the output-format resolver tool (§4.3b) before falling back to the agent's default format. Scope is **output format only** — it does not fill task/context/keyword.
5. **Cost profile:** zero LLM calls when headers are present; the normalizer must complete in <100 ms in that path. The §4.3b resolver adds an LLM call ONLY on its Tier-1 fallback (deterministic hint-scan finds nothing), never when a header is present.

### 4.3b Output-format resolver tool **[merged-in]** (agent mode only; not yet implemented — contract here)

**Intent.** Agent admins configure named output-format templates on the agent. When the user omits `# Output format` but signals "use the existing/standard format," the normalizer fetches the configured format via a resolver tool instead of erroring or letting the planner invent structure. The tool itself is **not built yet**; this section is the contract a later implementation must satisfy. Until it exists, the orchestrator behaves exactly as today (agent's default `# Output format` is the fallback).

**Two-tier trigger (deterministic-first, mirrors §4.3.3).** Runs ONLY in agent mode, ONLY when no `# Output format` was resolved from the prompt (no header, and the §9.1 extractor returned an empty `output_format`):
- **Tier 0 — deterministic hint scan (free, always first):** match the prompt against a small dictionary of format-reference phrases — e.g. "use the (standard|existing|configured|default|usual) (output )?format", "use the <name> template/format", "format it like the <name>", "theo định dạng <…>". A match yields an optional `formatName` (the captured `<name>`, may be empty → "the agent's default configured format").
- **Tier 1 — LLM check (fallback, only if Tier 0 finds nothing):** one small schema-constrained call (≤300 in / ≤60 out, temperature 0, §9.7) answering: does the prompt ask to use a pre-existing/configured output format, and if so what name? `{ "useConfiguredFormat": bool, "formatName": string|"" }`. Skipped entirely when Tier 0 already matched.
- If neither tier indicates a configured format → no tool call; proceed to the agent's default format (or, if none, the planner proposes structure per §5).

**Resolver tool contract (to implement later).** `resolveOutputFormat({ agentId, tenantId, formatName? }) → { found: bool, outputFormat?: string, resolvedName?: string }`.
- Inputs come from **session/agent config**, never from prompt text — `agentId`/`tenantId` are taken from `security`/agent context (a prompt cannot name another agent's or tenant's format). `formatName` is the only prompt-derived input and is used solely as a lookup key against the calling agent's own configured formats; an unknown/unauthorized name → `found:false` (NOT an error, NOT a guess).
- On `found:true`, the returned `outputFormat` populates `Request.outputFormat`, with `outputFormatSource="agent"` (it is the agent's configured format) and provenance noted (`resolvedName`).
- On `found:false` (or tool error/timeout) → fall back to the agent's default `# Output format`; if the agent has none, the planner proposes structure (§5). A `formatResolutionFailed` warning is surfaced when a format was clearly requested by name but not found. Never blocks the request.

**Precedence & security (unchanged invariants).** A tool-resolved format sits at the **agent level** of §4.1 — below system/application rules, and overridable by a later user-supplied `# Output format` under `allowUserFormatOverride` exactly like the agent's static fallback. It can never alter `security`/`noKnowledgeBase`. Chat mode is unaffected: missing `# Output format` in chat mode remains a hard error (§4.3.2) — this resolver does not run there.

### 4.4 Requirement-heading detection **[merged-in]**

Beyond the five canonical headers, users and agents embed custom requirement-like headings (e.g. `# Requirement`, `## Functional Requirement`, `## Non-functional Requirement`, `## Screen Requirement`, `## API Requirement`, `## Constraint`, `## Acceptance Criteria`). The normalizer MUST:

- deterministically extract heading-like lines from the user prompt body and the agent instruction that are not the canonical five;
- classify each as `requirement | constraint | acceptance_criteria | domain_rule | quality_rule | retrieval_hint | unknown` (keyword/dictionary classification is sufficient; no LLM call);
- attach them to the Request as `requirementHeadings`.

Downstream uses (no new phases): the **planner** receives the list and must map every `requirement`/`acceptance_criteria` heading to at least one planned section; `retrieval_hint` headings are union-merged into keyword anchors; the **coverage auditor** (§9.6) receives the list and reports any heading not addressed as a `missingAspects` entry; `constraint`/`quality_rule` headings flow into the writer's brief.

### 4.5 Grounding mode by intent & agent scope (`noKnowledgeBase` derivation) **[merged-in]**

Whether the orchestrator generates **grounded** (from retrieved chunks) or **ungrounded** (from the model's trained knowledge) is decided **deterministically** from the request mode and the agent's scope — never from the planner's discretion and never from prompt text. The derived boolean `noKnowledgeBase` records the outcome.

**Chat generative intent — always grounded.** Chat mode is RAG over the user's internal data; its purpose is to *override the model's training cut-off and its lack of the org's private data*, and to keep the output free of hallucination and model bias. Therefore:
- Chat mode **requires a knowledge base**. `noKnowledgeBase` is always `false` in chat mode.
- If the effective KB set is empty (none wired), the request is a **hard error** before generation (§4.3.2) — chat is never silently answered from model knowledge.
- Every factual section retrieves; if after retrieve→rerank the evidence is missing or unusable, the section **abstains with the per-section sentinel** (§7) — it does NOT fall back to ungrounded generation. The "insufficient context" message is the correct, intended response per stage of the plan.

**Agent Standard mode — grounding follows `agentScope` (§3.1):**
- `agentScope="all_kb"` (1) or `"specific_kb"` (2) → a KB exists → `noKnowledgeBase=false` → behaves exactly like chat: grounded retrieval per section, abstain on insufficient context. (If an `all_kb`/`specific_kb` agent resolves to a genuinely empty effective KB — misconfiguration — treat as `noKnowledgeBase=true` and surface a warning, since there is nothing to retrieve.)
- `agentScope="general"` (3) → the agent has **no KB access** → `noKnowledgeBase=true` → the document is generated from the LLM's trained knowledge plus the user's `# Context`. This is the **only** sanctioned ungrounded path in the whole system.

**Derivation rules (security-grade):** `noKnowledgeBase` and `agentScope` are derived **only** from session/agent config + the security layer, exactly like `security`. Prompt text MUST NOT set, clear, or influence them. A header or prompt fragment that says "skip the knowledge base" / "don't retrieve" is ignored and, if it attempts to alter KB selection, logged per §4.1.

**Consequence when `noKnowledgeBase=true` (agent `general` only) — no new phase, no `pure_generation` task:** Phase 2 still classifies the request into one of the **7** task types (§5.4); then, deterministically and unconditionally, the orchestrator forces `retrievalMode="none"`, `mustCite=false`, `minCitations=0`, and drops all `subQueries`/`referenceQueries` on **every** section — overriding whatever the planner returned. Ungrounded generation is thus a **retrieval condition (`retrievalMode="none"`), never a task type**. Phase 3 takes the `none` writer path (§9.3c) for every section — no retrieve, no rerank, no sufficiency gate, no citations, no abstention sentinel (there is no KB against which to declare "insufficient"; honest generation from model knowledge is intended here, and *only* here).

### 4.6 Agent instruction → planner: structured distillation (NOT raw prose) **[merged-in]**

**Requirement (agent mode):** the agent's instruction and `## Skill` block are **configuration that MUST shape Phase 2 planning**, not just Phase 3 writing. The normalizer is the single place that reads the instruction; it converts every *planning-relevant* signal in the instruction into **structured fields** the planner consumes (`agentPlanningHints`, `agentPolicy`, `requirementHeadings`). The raw persona prose itself is NOT forwarded to the planner — only to the writer (§6 item 6 / §9.3) — which keeps the precedence chain (§4.1) explicit and auditable: the planner acts on typed data whose provenance is recorded, never on free text whose effect is opaque.

The normalizer populates `agentPlanningHints` deterministically (keyword/dictionary extraction, no LLM call) by mining the instruction + skill for:

- **Length/verbosity default** → `defaultVerbosity`: phrases like "concise"/"brief" vs "detailed"/"comprehensive". The planner uses it for `targetTokens` only when the user gave no length intent.
- **ID & terminology conventions** → `idConventions` / `terminology`: patterns like `UC-<MODULE>-<NN>`, glossary terms. The planner folds these into sub-query keyword anchors so retrieval lands on the right documents; the writer also receives them (§9.3) to reproduce exact IDs.
- **Required / forbidden content rules** → `requiredContent` / `forbiddenContent`: "always include an Open Questions section", "never output real credentials". Required-content rules that name a deliverable inside an existing section become per-section `acceptanceCriteria`; rules that would imply a *new section* are dropped (structure is `# Output format` only — they cannot add sections). Forbidden-content rules merge into the Phase-4 forbidden-content scan (§8) and into `acceptanceCriteria`.
- **Domain / risk cues** → `domainRiskCues`: healthcare/legal/finance/security/safety wording in the instruction biases the planner's `riskLevel=high` even when the *user prompt* is domain-neutral (the agent's standing context, e.g. a "Clinical Protocol Writer", carries the risk).
- **Retrieval / citation policy** → already in `agentPolicy` + `retrievalHints`: `citationPolicy="required"` forces `mustCite`/`minCitations` on grounded sections; retrieval hints union-merge into anchors.
- **Generic skill discipline** → `skillCriteria`: artifact-independent quality rules from `## Skill` ("every test case cites a source requirement", "never invent API names") that seed per-section `acceptanceCriteria` (§9.2 job item 10).

**Precedence preserved:** these hints sit at the *Agent instruction / Agent skill* levels of §4.1 — below system/application rules and above user freestyle, but a user `# Output format` still overrides agent structure (subject to `allowUserFormatOverride`), and **nothing here can touch `security`/`noKnowledgeBase`**. When a hint conflicts with a higher level, the higher level wins and the dropped hint is logged.

### Rejected alternatives
Separate orchestrators per mode (duplicated maintenance); **injecting the agent instruction as raw prose straight into the planner prompt** (precedence becomes implicit and unauditable, and persona text crowds the ≤3k planner budget — instead the instruction's planning-relevant content reaches the planner as the structured `agentPlanningHints`/`agentPolicy`/`requirementHeadings` fields, §4.6); always running the LLM extractor (1–2 s tax on every chat request for nothing); LLM-based heading classification (a dictionary does it for free); LLM-based instruction distillation (the dictionary/keyword extraction in §4.6 is free and deterministic — escalate to a small LLM pass only if a future agent's instruction is too unstructured to mine, behind the same one-call budget as §9.1).

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
| `review_validate` | **[merged-in]** judge an EXISTING artifact against a retrieved reference (template / standard / upstream artifact) and report completeness, consistency, and grounding gaps — optionally with a corrected draft (e.g. "is this test spec complete and consistent with the SRS?", "review this design against the architecture standard") | grounded_strict |

**There is no `pure_generation` task type [merged-in].** `detectedTask` describes *what the user wants done*; whether the output is grounded is a separate axis carried by `retrievalMode` + `noKnowledgeBase`/`agentScope` (§3.1, §4.5). Ungrounded generation is therefore **a retrieval condition, not a task**: it occurs only when `noKnowledgeBase=true` (agent `agentScope="general"`, or an empty effective KB), at which point the orchestrator deterministically forces `retrievalMode="none"` on every section regardless of which of the 7 task types was detected. The planner is **forbidden to choose an ungrounded plan when a KB is available** — chat mode always has a KB; an `all_kb`/`specific_kb` agent always has a KB; in those cases every factual section retrieves and **abstains on insufficient context** (§7) rather than generating from model knowledge. This is what keeps chat-mode RAG free of cut-off-knowledge hallucination and model bias.

This taxonomy is domain-neutral by construction (software, healthcare, legal, finance…). The planner prompt forbids domain assumptions; domain enters only through the task/context text, the risk-level rule below, and retrieval results.

**`review_validate` is the dual-grounding task.** Unlike the other grounded tasks (which retrieve *one* kind of source), a review judges an **artifact-under-review** against a **reference/ground-truth**, so the planner emits BOTH `subQueries` (artifact side — what the document actually says) and `referenceQueries` (reference side — what it should conform to). A finding is the *delta* between the two, each side cited separately. It is the strictest grounding profile alongside the RTM (§A.8): `mustCite` and `assumptionsAllowed=false` are forced post-parse, and the abstention sentinel is *expected* when grounding is genuinely absent — the writer must never invent a gap or fabricate a "pass". When the resolved `# Output format` asks for a corrected/revised draft as one of its items, that single section runs `transform_derive`-style (grounded against the reference) while the findings/verdict sections stay `review_validate` — one plan, mixed section behavior, exactly like the Use Case agent (§A.1).

5. **Three retrieval modes, assigned per section** (not per document — a single plan may mix all three):

| `retrievalMode` | Writer behavior | Citation policy |
|---|---|---|
| `grounded_strict` | facts ONLY from retrieved chunks | mandatory inline `[N]`; abstain on insufficient context |
| `reference_inspired` | chunks are style/structure exemplars; specifics may be invented consistent with the task | NO citations in output |
| `none` | pure generation; the writer still sees `# Context`, so user-context-only sections use this mode | no citations (unless agent citationPolicy requires) |

6. **Domain-risk escalation [merged-in].** The planner sets `riskLevel: high` on sections involving healthcare/medical, legal, regulatory compliance, finance, security, or safety-critical content. Consequences (enforced deterministically post-parse, §3.2): `mustCite` forced true and `assumptionsAllowed` forced false for grounded sections; the sufficiency gate always uses the LLM tier and applies strict judgment (§7); such sections are priority candidates for the NLI faithfulness gate.
7. **Sub-queries live inside the plan.** 1–3 per retrieving section, each with a natural-language text (dense retrieval) and 0–4 keyword anchors (sparse/BM25). The user's `# Keyword` header and any `retrieval_hint` requirement headings are union-merged into the anchors downstream. NO separate HyDE / step-back / multi-query phases — each would add a full LLM call for marginal recall on this setup; revisit only if measured retrieval recall is inadequate.
8. **`dependsOn` is exceptional, not default.** Only when a section literally requires another section's text as input. The executor honors it; everything else runs in parallel.
9. **No-knowledge-base short-circuit [merged-in].** When the Request's `noKnowledgeBase` flag is `true` (only an agent with `agentScope="general"`, §4.5; chat mode is never here), retrieval is impossible, so the orchestrator skips the retrieve phase for the entire document and generates from the LLM's trained knowledge only. Realization: the planner still classifies `detectedTask` normally from the **7** task types (there is no `pure_generation` type, §5.4) and the no-KB addendum (§9.2) tells it to emit **no `subQueries`/`referenceQueries`**; then, **post-parse and unconditionally**, the orchestrator forces `retrievalMode="none"`, `mustCite=false`, `minCitations=0`, and drops any `subQueries`/`referenceQueries` on **every** section — overriding whatever the LLM returned (the same defensive post-parse pattern used for high-risk `mustCite`). Ungrounded generation is thus a **retrieval condition (`retrievalMode="none"`), not a task type**. The outline is still derived deterministically from `# Output format` when present; only the evidence policy changes. This is independent of `detectedTask` and `riskLevel`: even a high-risk task generates ungrounded when there is genuinely no KB (a warning is surfaced — see §11).

### 5.1 Generation-pattern catalog **[merged-in]** (planner behavior fixtures)

The plan must handle at least these recurring patterns; each row doubles as an integration-test fixture:

| # | Pattern | Expected planner behavior |
|---|---|---|
| 1 | Create new document from old similar document ("refer to old use case, create a new one") | `reference_inspired`; retrieve exemplars; mirror structure/voice; invent only genuinely new specifics; grounded sub-sections (rules, preconditions) still cite |
| 2 | Generate test cases from a requirement | `transform_derive`; grounded_strict; every test case maps to requirement evidence; cover functional rules and edge cases |
| 3 | Generate detail design from basic design | `transform_derive`; grounded_strict; retrieve HLD/architecture/API/data-model chunks; never invent API names, fields, or workflows |
| 4 | Generate from user context / model knowledge only (agent `agentScope="general"`, or genuinely empty KB) | NOT a task type — the detected task stays one of the 7; the no-KB condition (§4.5) forces `retrievalMode="none"` on every section; skip retrieval entirely; no citations. In chat mode this does NOT apply (chat requires a KB; empty KB → hard error). |
| 5 | Generate from knowledge base only | grounded_strict; sufficiency gate mandatory; citations mandatory |
| 6 | Software-development artifacts (SRS, user story, use case, FR/NFR, test case, test specification, basic design, detail design, API/DB/screen/workflow/deployment design, migration plan) | covered by the taxonomy + the Appendix A agent templates; no special-case code |
| 7 | Healthcare / regulated-domain documents | `riskLevel: high` path: stronger evidence demands, mandatory citations, no unsupported claims, assumptions disallowed |
| 8 | **[merged-in]** Review/validate an artifact against a reference ("check this test spec is complete and consistent with the SRS"; "review this detail design against the HLD and the coding standard") | `review_validate`; grounded_strict; per section emit `subQueries` (artifact side) AND `referenceQueries` (reference side); `mustCite=true`, `assumptionsAllowed=false`; each finding cites the artifact chunk AND the reference chunk it conflicts with; abstain (sentinel) rather than assert a pass/gap with no evidence; if the output format requests a corrected draft, that one section is `transform_derive` grounded against the reference |

### Requirements
- Exactly one LLM call; schema-constrained; one retry with the validation error appended; then hard fail.
- When fixed headings were derived, the orchestrator MUST defensively force-restore exact headings/order/count after parsing the plan, regardless of what the LLM returned.
- Every detected `requirement` / `acceptance_criteria` heading maps to ≥1 section (validated deterministically post-parse; unmapped headings → planner retry, then warning).
- Planner input ≤3k tokens, output ≤1.5k. The planner NEVER sees retrieved chunks.
- Planner prompt: §9.2.

### Rejected alternatives
Separate task-classifier / intent-analyzer call (doubles latency, negligible accuracy gain with constrained decoding — its responsibilities are absorbed by `detectedTask` + `riskLevel` in the single planner call); standalone outliner call; STORM-style perspective simulation (~10× cost, frontier-model technique); domain-specific planner prompts (anchoring; one structural prompt + risk levels generalizes).

**Splitting plan and outline into two calls — rejected even under a tool-calling harness.** A natural objection is that if the orchestrator runs as (or under) a tool-calling harness agent, a separate `propose_outline` step would let the harness inspect/approve the outline before committing to per-section retrieval. It does not pay off here, for reasons that hold regardless of who drives the orchestrator:
- **No split of intelligence to make.** When `# Output format` is present (the common agent-mode case — every Appendix-A agent ships a numbered format), the outline is derived **deterministically before the LLM runs** (decision 2); the LLM only attaches metadata to fixed headings. A separate outliner call would have nothing to decide on that path.
- **Same context, no new information.** Outlining and planning consume the *same* inputs (task + resolved `# Output format` + `agentPlanningHints` + requirement headings) and *neither* sees retrieved chunks (the planner never does). Splitting a single-context decision into two calls just pays a round-trip to hand the model back its own output — a pure sequential gate with no parallelism to hide it, the exact cost this phase exists to remove.
- **The inspection checkpoint already exists, for free.** Schema/grammar-constrained decoding makes the single call emit one validated, inspectable plan-plus-outline object. A harness (or a human) can read it, reject it, and trigger the one allowed retry **without a second LLM call** — so the harness's "inspect before commit" benefit comes from the *structured output*, not from a second gate. The genuinely irreversible work (retrieval + writing) is downstream in Phase 3 and is already gated there by the sufficiency checks (§7).
- **Empirical escape hatch only.** Revisit the split solely if measurement on the target model shows the single call produces a good outline but measurably degraded per-section metadata (or vice-versa) — i.e. the call is overloaded. Until that is observed, merged is correct; do **not** turn the orchestrator's planner into a free-roaming agentic loop (that failure mode is rejected wholesale in §7).

---

## 6. Phase 3 specification — parallel per-section pipeline (retriever + reranker folded into sectionWriter)

### Decisions

1. **The standalone retrieve and rerank phases are removed.** Each section performs its own `retrieve → rerank` using the section's sub-queries, because each section needs bespoke context; a shared global pool gives every writer the same generic chunks and worsens lost-in-the-middle.
2. **Sections execute concurrently** under a bounded concurrency limiter (default 4; configurable; lower it if the local LLM server can't serve parallel requests). Sub-query retrieval within a section is also concurrent. `dependsOn` sections wait only on their prerequisites.
3. **The user's existing components are called as-is.** The contract is only: retrieval takes (query text, knowledge-base ids, topK≈20) and returns scored chunks; reranking takes (query, candidate chunks) and returns them reordered; the pipeline keeps the top ~5 after rerank. The coding agent must discover the real signatures during codebase exploration and write thin adapters if shapes differ — never reimplement retrieval or reranking logic. KB ids passed to retrieval always come from `security` + agent retrieval policy, never from prompt text.
4. **Retrieval/rerank memoization [merged-in].** Within a request, `retrieve(query, kbIds, topK)` and `rerank(query, chunkSet)` results are cached by key hash, so identical or duplicated sub-queries across sections hit the components once. An optional cross-request TTL cache sits behind a config flag (off by default; evaluate against KB update frequency).
5. **Citation format & numbering REUSE the existing chat-QA contract — do not invent a new one (§0.1.7) [merged-in].** Phase 3 grounded sections MUST emit inline citations in the **exact format the existing chat-QA feature already produces**, and assign citation ids using the **same numbering/id scheme**, so the frontend renders Phase-3 citations with the **same component and code path** as chat-QA — no new syntax, no parallel render path. Throughout this spec, **`[N]` is a stand-in for that real chat-QA token** (discovered per §0.1.7), not a mandated literal. The orchestrator's job is only to *populate* the existing citation shape, not redefine it.
   - **Stable cross-section id (the one property the multi-section pipeline adds):** a global chunk registry deduplicates chunks by content hash across ALL sections so the same chunk cited from two sections yields the **same** citation id; the registry is concurrency-safe; its final (id → chunk) map is returned with the result for the FE's source panel **in the chat-QA payload shape (§0.1.7)**. If chat-QA's native scheme already assigns a stable per-chunk id, reuse it directly; if chat-QA numbers per-answer only, the registry **extends** that scheme minimally to carry the cross-section stable id — it never forks a second convention. This is the only addition to the chat-QA citation behavior; format, marker, and FE contract are otherwise inherited unchanged.
6. **Header leverage for retrieval quality:**
   - `# Keyword` (+ `retrieval_hint` headings) → merged into every sub-query's sparse anchors.
   - `# Context` → a short slice (~200 chars) prefixed to grounded sub-queries to disambiguate.
   - `# User profiles` → injected into the writer prompt as "Reader profile" (controls tone/depth, not retrieval).
   - Agent instruction + skill → injected into the writer prompt as an opaque persona preamble (headers already consumed by the normalizer; the *planning-relevant* content was distilled into `agentPlanningHints` for Phase 2, §4.6).
   - `agentPlanningHints.idConventions` + `.terminology` → also passed to the writer so it reproduces exact IDs and project vocabulary (the same hints that anchored retrieval in Phase 2).
7. **Per-section evidence policy [merged-in].** Each section carries its effective evidence policy resolved from plan + agent policy: `retrievalMode`, `mustCite`, `minCitations`, `assumptionsAllowed`, max evidence chunks (= rerank topK, default 5), and whether generation may proceed without evidence (only `reference_inspired`/`none` may). This is data on the section job, not a new phase.
8. **Citations are enforced during generation, not post-hoc.** The writer's system prompt (§9.3) requires an inline citation (in the chat-QA token form, §0.1.7 / decision 5 — written here as `[N]`) after every factual claim for grounded sections. Post-hoc citation insertion is rejected: it needs a second LLM pass and measurably misattributes on small models.
9. **Deterministic citation validation after every write.** Parse all inline citation tokens **using the chat-QA token's grammar (§0.1.7)** — written here as `[N]`; keep only ids present in the section's offered chunk set; **strip** invalid ones (never remap — remapping re-attributes a claim to an unrelated source); clean up orphaned spaces/punctuation. A grounded section with `mustCite=true` that ends with zero valid citations is flagged `no_citations` for Phase 4. (The validator is format-aware of the chat-QA token; if that token is not a simple `[N]`, the extraction regex/parser matches the real syntax.)
10. **Anti-lost-in-the-middle ordering.** When rendering numbered sources into the writer prompt, place the strongest chunks at the beginning AND end of the source block, weakest in the middle (e.g., rank order 1,4,5,3,2).
11. **Deterministic acceptance-criteria check after every write [merged-in].** For each of the section's `acceptanceCriteria` that is mechanically checkable, run a cheap deterministic test against the written body — no LLM. Examples: a criterion like "every row/test case cites a source requirement" → assert no list item lacks a `[N]`; "no invented requirement IDs" → assert every `REQ-`/`UC-`/`TC-`-style token in the body appears in the offered chunks; "each finding cites artifact AND reference" (review_validate) → assert each finding paragraph carries at least one artifact-side and one reference-side `[N]`. Criteria that aren't mechanically expressible are left for the coverage auditor (§9.6). If any checkable criterion fails, raise the `unmet_acceptance_criteria` flag (the natural-language failing criteria travel with it) for Phase 4 — never auto-edit the body here. This is the per-section enforcement half of the quality lever; the auditor is the cross-section half.

### Per-section token budget (binding; 16k window)

| Slice | Tokens |
|---|---|
| Writer system prompt | ~700 |
| Request slice (profile, task, context, format hint, relevant constraint/quality headings) | ~300 |
| Plan slice (THIS section only — never the whole plan; includes its `acceptanceCriteria`) | ~250 |
| Writer-guidance slice (selected artifact skill's `write.md` for THIS section only; §A.10.3; agent mode often 0 when the instruction covers it) | 0–250 |
| Rolling summaries of prerequisite sections (~60 tok each) | 0–600 |
| Top-5 reranked chunks (~500–800 tok each) | 2500–4000 |
| Per-section slice of the user's literal output format | 0–200 |
| Generation budget (targetTokens × 1.1) | 400–1200 |
| Safety headroom | ~1000 |
| **Total** | **~6–8k** (never assemble >11k) |

### Rejected alternatives
Single shared retrieval pool (generic context, worse grounding); post-hoc citation insertion (extra pass, misattribution); LLM-as-judge citation validation (regex + chunk-map is free and deterministic); per-section local citation numbering (same source gets different numbers across sections); a separate per-section "evidence planner" LLM call (the plan's subQueries + evidence policy already carry that decision — §9.8).

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

## 7a. Operational robustness — failure, deadline, cancellation, dependency cycles **[merged-in]**

The bounded loops of §7 cap *logical* work (retrieval rounds, generation, repair). This section covers the *infrastructure* failure modes the orchestrator must handle so a single dependency hiccup never silently corrupts or hangs a request. Guiding principle, consistent with the rest of the spec: **degrade to partial-with-warnings, never fabricate and never hang.** All four behaviors surface through the existing `warnings` object (§3.4); none alter `security`.

### 7a.1 Dependency-failure handling (retriever / reranker / LLM)
The orchestrator's own dependencies can fail independently of model quality:
- **Transient infra errors** (LLM server 5xx / connection reset, retriever or reranker throws/times out) get **one bounded retry with short backoff** (default 1 retry, ~500 ms–2 s backoff; configurable). This retry is **separate from and additional to** the §7 logical retrieval rounds — it covers transport failure, not insufficient evidence.
- **Reranker unavailable** → fall back to the retriever's own score order (RRF/raw) for that section and flag `reranker_degraded`; never block the section on the reranker.
- **Retriever unavailable** after the bounded retry → the section cannot be grounded: a `grounded_strict` section emits the §7 abstention sentinel with flag `retriever_unavailable`; a `reference_inspired`/`none` section proceeds (it needs no retrieval).
- **LLM call fails** after the bounded retry → that **section** fails (flag `generation_failed`), not the whole request. The run continues; the failed section is delivered as the sentinel and listed in `warnings.failedSections`.
- **Partial delivery is first-class.** If some sections succeed and others fail, the request returns **HTTP success** with the assembled successful sections, the failed sections shown as sentinels, and `warnings.failedSections[]` + `warnings.partial=true`. A request fails outright (error to caller) ONLY when Phase 1 or Phase 2 cannot complete (no plan can be produced) — never because an individual section failed.
- **No silent fallback.** Every degradation raises a named flag; the orchestrator never swaps in a different model/KB/empty result without surfacing it (§10 observability).

### 7a.2 Global wall-clock deadline (soft, enforced)
The 1–3 min target (§1) becomes an **enforced soft deadline**, not just a goal:
- Config `requestDeadlineMs` (default 180 000). A monotonic timer starts at Phase 1.
- On deadline expiry the orchestrator **stops scheduling new section jobs**, lets in-flight sections finish their current LLM call (no mid-call kill), then proceeds to Phase 4 with whatever completed. Unstarted/incomplete sections are delivered as the sentinel with flag `deadline_skipped` and listed in `warnings.deadlineSkippedSections[]`, `warnings.deadlineHit=true`.
- The Phase-4 coverage call and deterministic checks still run on the partial document (they are cheap and bounded); the single repair round is **skipped** if the deadline already passed.
- This guarantees a bounded response time regardless of how pathological the plan is — the per-section latency budget (§7) is the *typical* case; the deadline is the *hard ceiling*.

### 7a.3 Cancellation (caller-initiated abort)
- The request carries a cancellation signal (e.g. an `AbortSignal`/cancellation token from the route/job layer — discover the existing pattern per §0.1.5).
- On cancel: stop scheduling new sections, abort in-flight retrieval/LLM calls where the client supports it (else let the current call return and discard its result), release the concurrency limiter, and return promptly. No Phase 4, no repair.
- If job persistence is enabled (§10), completed per-section state is persisted so a later resume does not re-run finished sections; cancellation is distinct from failure (`warnings.cancelled=true`, no `failedSections` framing).
- Cancellation never leaves a half-written document in any store; partial state is internal-only until a run completes or is explicitly resumed.

### 7a.4 `dependsOn` cycle & integrity check (deterministic, Phase 2 post-parse)
- After the planner returns, the orchestrator builds the section dependency graph and runs a deterministic check **before** Phase 3 starts:
  - **Cycle detection** (e.g. topological sort / DFS back-edge): any cycle (`s1→s2→s1`) is rejected.
  - **Dangling reference:** a `dependsOn` naming a non-existent `sectionId` is rejected.
- On failure → **one planner retry** with the violation appended to the prompt (same pattern as schema-validation retry, §3.2/§5). If the retry still produces a cycle/dangling ref, the orchestrator **deterministically drops the offending `dependsOn` edges** (treating those sections as independent) and surfaces `warnings.dependencyEdgesDropped[]` — it never deadlocks the executor and never fails the request over a planner graph error.
- The executor (§6 decision 2) may assume the graph is a valid DAG because this gate runs first.

### Data-contract additions (extend §3.4 `warnings`)
`warnings` gains: `partial:bool`, `failedSections[]`, `deadlineHit:bool`, `deadlineSkippedSections[]`, `cancelled:bool`, `dependencyEdgesDropped[]`, and the per-section degradation flags (`reranker_degraded`, `retriever_unavailable`, `generation_failed`, `deadline_skipped`) which also appear on the Written Section `flags` (§3.3). As with all warnings, these never fail the request (except the genuine Phase-1/Phase-2 hard-fail cases above).

### Rejected alternatives
Whole-request failure on any section/dependency error (loses completed work; partial-with-warnings is strictly better); hard-killing in-flight LLM calls at the deadline (wastes the near-complete call and risks corrupt partial output — let it finish, just stop scheduling more); unbounded infra retries (reintroduces the tail-latency blowup §7 rejects — exactly one bounded retry); failing the request on a planner-produced dependency cycle (a planner glitch shouldn't be user-visible as an error — drop edges and warn).

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
| (c) Task + requirement + acceptance-criteria coverage | ONE small LLM call (§9.6). Input is headings + first ~150 tokens of each section + the detected requirement headings + each section's `acceptanceCriteria` — NEVER the full document (~2–2.5k in / ~200 out, 3–6 s) | 1 small call | Returns `coversTask`, `missingAspects[]`, `unmetCriteria[]`, `sectionsToRegenerate[]` |

Regeneration set = coverage's `sectionsToRegenerate` ∪ sections named in `unmetCriteria` ∪ sections flagged `no_citations` (with mustCite) ∪ sections flagged `low_faithfulness` ∪ **[merged-in]** sections flagged `unmet_acceptance_criteria` by the deterministic post-write checks (§6). Retries run with grounding strictness bumped (mustCite forced true, minCitations +1) and the unmet criteria re-emphasized in the brief. If coverage fails but cannot name sections → return with a `needs_review` warning; never auto-edit, never loop twice.

### Rejected alternatives
The consistency rewrite pass (unrequested edits, citation drift); per-sentence cross-section consistency checking (cost; redundant with NLI gate); whole-document regeneration on coverage failure (wasteful; targeted repair strictly better); an LLM "final validator" rewriting output (checks a/b are deterministic and free; only coverage needs an LLM).

---
## 9. Advanced system prompts (production-ready, one per LLM call in the pipeline)

These are the complete prompts. The coding agent stores them as versioned constants/templates (one file or module, never inline string fragments scattered through code) and substitutes the `{placeholders}`. All JSON-returning prompts MUST be executed with schema/grammar-constrained decoding plus one validation-error retry. All prompts are written for small local models: short, rule-numbered, one minimal example, explicit "JSON only" where applicable. Rules absorbed from the second research output are folded directly in (see §9.8 for the mapping).

**Shared brevity rule (applies to EVERY prompt below — output tokens are the dominant cost) [merged-in].** Every system prompt MUST instruct the model to be **terse-but-complete**: emit **only** the required content; no preamble ("Here is…", "Sure,…"), no restating of the task/inputs, no postamble or summary of what was done, no meta-commentary, no filler or hedging. Brevity MUST NOT drop anything a downstream phase needs — required facts, inline `[N]` citations, JSON fields, acceptance-criteria coverage, or output-format sections are all "required content" and are never trimmed to save tokens. In short: **shortest output that fully satisfies the contract.** This is a quality-preserving constraint, not "write less" — a section that needs 400 tokens to cover its brief still gets them; what's cut is everything the contract did not ask for. The token *budgets* (§5, §6) cap the ceiling; this rule trims the slack under it.

### 9.0 Output encoding & wire format (JSON vs markdown; short-key optimization) **[merged-in]**

**Decision: structured phases stay JSON; only the section writer emits markdown.** The planner (§9.2), sufficiency check (§9.4), query rewrite (§9.5), coverage auditor (§9.6), input extractor (§9.1), and format-intent check (§9.7) return **JSON under grammar/schema-constrained decoding**. The section writer (§9.3/b/c/d) emits **markdown prose** — it already does, and that is where the bulk of output tokens live.

**Why not switch the structured phases to markdown to save tokens?** JSON does spend ~10–20% more *output* tokens than markdown on structural punctuation (`{}`, `"`, `:`, repeated quoted keys). But on this pipeline that trade does not pay:
- The structured phases are the **cheap** calls (planner ~1.5k out once; sufficiency ~120 out; coverage ~200 out). The expensive output is the **writer**, which is already markdown. Optimizing JSON overhead optimizes the wrong 10%.
- The structured outputs are mostly **short enums/flags** (`retrievalMode`, `mustCite`, `riskLevel`) — the cheapest possible JSON and the **highest** parse-risk in markdown. A 7B model's markdown formatting drifts (`- f: v` vs `**f**: v` vs a sentence), so a markdown→struct parser passes in tests then **silently mis-parses** in production — exactly the silent-failure class this design avoids.
- Constrained JSON gives a **parse guarantee** (the decoder masks illegal tokens, so invalid JSON cannot be produced); markdown parsing is best-effort. The whole anti-hallucination/validation design depends on reliably machine-readable plan/verdict objects, so the guarantee outweighs the marginal token saving.

**Token-saving lever that KEEPS the guarantee — short keys on the wire, full names everywhere else.** Where output-token budget is tight, the constrained schema MAY use **short field keys on the wire** (e.g. `rm` for `retrievalMode`, `mc` for `mustCite`, `rl` for `riskLevel`, `sid` for `sectionId`, `ac` for `acceptanceCriteria`, `sq`/`rq` for `subQueries`/`referenceQueries`). This recovers most of the JSON overhead **without giving up constrained decoding**. To preserve readability and debuggability:
- A deterministic **code adapter owns a single short↔full key map** and expands the model's short-key JSON into the **full-name canonical objects of §3.2/§3.3 immediately on receipt**. Every phase downstream of an LLM call sees only full-name objects; no short keys leak past the adapter.
- The data contracts (§3) and every other section of this spec are authored in **full names** — short keys are a wire/serialization detail confined to the constrained-decoding schema + the adapter, nothing else.
- **Developer & Langfuse view = expanded full JSON.** Traces log the **expanded full-name JSON** (plus the raw short-key string preserved in a `rawOutput` trace field for byte-level debugging), so humans and the observability stack (§10) never read cryptic keys except in that one raw field. Token counts are recorded on the raw output.
- Config flag `shortKeyWire` (default **off** for maximum readability; turn **on** when the planner output token budget is the measured bottleneck). Both behaviors use the same adapter; only the schema's key strings differ.

**Rejected alternatives.** Markdown output for the structured phases (loses the constrained-decoding parse guarantee; small-model markdown drift causes silent mis-parse; saves tokens only on the cheap calls). A bespoke non-JSON DSL (needs a custom grammar AND a custom parser for no gain over short-key JSON). Dropping constrained decoding to save the retry (reintroduces invalid-output handling everywhere). Hand-mapping keys per call site instead of one central adapter (drift between phases; the single short↔full map is the only safe place for it).

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
- agent_planning_hints: a STRUCTURED distillation of the agent's
  instruction + skill (agent mode), already extracted for you. May be
  absent (chat mode). Fields (any may be empty):
    defaultVerbosity, idConventions[], terminology[], requiredContent[],
    forbiddenContent[], domainRiskCues[], retrievalHints[], skillCriteria[].
  You MUST honor these when planning (see job steps 5, 9, 10, 11). They
  are quality/evidence/risk signals only - they NEVER add, rename, or
  reorder sections. You receive NO raw persona prose; structure comes
  only from output_format (or your proposal when it is empty).
- agent_policy: { citationPolicy?, allowUserFormatOverride,
  allowUserRetrievalOverride }. May be absent. When
  citationPolicy="required", every grounded section MUST have
  mustCite=true and minCitations>=1.

## Your job
1. Choose detectedTask from this fixed list of 7:
   qa_with_citations, summarize_single, synthesize_multi, compare_analyze,
   transform_derive, reference_inspired, review_validate.
   Choose review_validate when the task is to CHECK or REVIEW an existing
   artifact against a reference (template, standard, or upstream document)
   and report whether it is complete/consistent/sufficient - e.g. "is this
   test spec enough given the SRS?", "review this design against the HLD".
   There is NO "pure_generation" / ungrounded task. When a knowledge base
   is available you MUST pick a grounded task and write subQueries; do not
   plan a section to be answered from your own knowledge. (Ungrounded
   generation happens only via the no-knowledge-base addendum below, which
   the orchestrator enforces deterministically — it is never your choice.)
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
     synthesize_multi, compare_analyze, and review_validate.
   - reference_inspired: retrieved chunks are style/structure exemplars
     only; specifics may be invented. Use for reference_inspired tasks
     (e.g., "write NEW use cases like these old ones").
   - none: no retrieval needed. Use when the section is pure formatting,
     transitions, creative writing with no factual claims, OR when the
     user's context already contains everything the section needs.
5. Set riskLevel="high" when a section involves healthcare/medical,
   legal, regulatory compliance, finance, security, or safety-critical
   content; otherwise "normal". ALSO set riskLevel="high" for any section
   matching agent_planning_hints.domainRiskCues, even when the user's
   task wording looks neutral (the agent's standing role carries the
   risk). High-risk grounded sections must have mustCite=true and
   assumptionsAllowed=false. If agent_policy.citationPolicy="required",
   set mustCite=true and minCitations>=1 on every grounded section.
6. Set assumptionsAllowed=true ONLY if the user's output format
   explicitly allows assumptions; otherwise false.
7. Map every requirement_heading of kind requirement or
   acceptance_criteria to at least one section.
8. For each section needing retrieval, write 1-3 subQueries. Each
   subQuery has natural-language "text" and 0-4 sparse "keywordQueries".
   Sub-queries reflect what THIS section needs, not the whole document.
   Fold agent_planning_hints.idConventions, .terminology, and
   .retrievalHints (plus the user's keyword list) into keywordQueries so
   retrieval lands on the right document family. For review_validate
   sections, subQueries retrieve the ARTIFACT being reviewed (what the
   document actually says).
9. For review_validate sections ONLY, ALSO write 1-3 referenceQueries
   that retrieve the REFERENCE the artifact must conform to (the SRS, the
   template, the standard, the upstream design). The writer reports the
   delta between artifact and reference, citing each side. Leave
   referenceQueries empty for every other task.
10. Set acceptanceCriteria for each section: 0-6 short, testable quality
    or conformance checks the finished section must satisfy. Derive them
    from (a) agent_planning_hints.skillCriteria (the agent's "## Skill"
    discipline, e.g. "every test case cites a source requirement", "never
    invent API names"), (b) the matching item in output_format (what that
    section is supposed to deliver), (c) any requirement/
    acceptance_criteria/quality_rule heading mapped to the section, and
    (d) agent_planning_hints.requiredContent / .forbiddenContent /
    .idConventions that apply to this section (e.g. "use UC-<MODULE>-<NN>
    IDs", "never output real credentials"). Each criterion is an
    objective property of the finished text - NOT a new section, heading,
    title, TOC, or References block. A requiredContent rule that would
    need a NEW section is dropped (structure is output_format only).
    Empty list when nothing constrains the section beyond its brief.
11. Set targetTokens per section so the total fits the user's length
    intent. If the user gave no length intent, fall back to
    agent_planning_hints.defaultVerbosity (concise ~150-300, standard
    ~250-500, detailed ~500-900 per section); default 250-500 if neither
    is present.
12. Set dependsOn only when a later section literally cannot be written
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

## One example (neutral domain, grounded)
Input task: "Summarize our refund policy and the steps to request one."
output_format: empty. (A knowledge base is available.)
-> detectedTask: qa_with_citations; outlineSource: proposed_by_llm;
   sections: [Refund Eligibility, How to Request a Refund, Processing
   Time]; each retrievalMode: grounded_strict, mustCite=true,
   riskLevel: normal, with subQueries like "refund eligibility rules",
   "refund request steps", "refund processing time". (Do not plan any
   section as ungrounded — a KB is available.)

## One example (review_validate)
Input task: "Check whether the test specification is complete and
consistent with the SRS, and produce a corrected version."
output_format:
  1. Completeness and Consistency Findings
  2. Gaps Against the SRS
  3. Corrected Test Specification
-> detectedTask: review_validate; outlineSource: derived_from_output_format.
   Section 1 & 2: review_validate, grounded_strict, mustCite=true,
     subQueries retrieve the test spec, referenceQueries retrieve the SRS;
     acceptanceCriteria e.g. ["each finding names the SRS clause it checks",
     "no gap asserted without an artifact AND a reference citation"].
   Section 3: transform_derive, grounded_strict against the SRS+findings,
     dependsOn ["s1","s2"]; acceptanceCriteria e.g. ["every added item
     traces to an SRS requirement", "no invented requirement IDs"].
```

**Conditional addendum** (appended ONLY when the deterministic format parser produced fixed headings):
```text
The user has already specified an exact section structure. The
"sections" array MUST contain exactly these headings, in this order:
  1. {heading_1}
  2. {heading_2}
  ...
Do not add, remove, rename, or reorder sections. Only fill in
retrievalMode, riskLevel, subQueries, referenceQueries (review_validate
only), acceptanceCriteria, targetTokens, mustCite, minCitations,
assumptionsAllowed, and rationale for each. Set outlineSource to
"derived_from_output_format".
```

**No-knowledge-base addendum** (appended ONLY when `noKnowledgeBase` is true — agent `agentScope="general"`, §4.5):
```text
No knowledge base is available for this request (the agent has general
scope). You CANNOT retrieve any sources. Therefore:
- Still classify detectedTask normally from the 7 types (what the user
  wants done) — there is no "pure_generation" type.
- Set retrievalMode to "none" for EVERY section.
- Set mustCite=false and minCitations=0 for every section.
- Do NOT write any subQueries or referenceQueries (leave them empty).
Plan the sections from the task, context, and output format alone. The
writer will produce each section from its own general knowledge and the
user's # Context. (The orchestrator enforces these evidence settings
deterministically regardless of your output.)
```

**User message:** the canonical fields plus requirement headings, one per line, `(none)`/`(empty — propose 3-7 sections)` placeholders for blanks. Budget: ≤3k in / ≤1.5k out. Temperature ≤0.2.

### 9.3 Section writer — `grounded_strict` (Phase 3; the GROUNDED prompt — chat mode and agent `agentScope` = `all_kb`/`specific_kb`)

This is the prompt for every section that has a knowledge base behind it: chat generative mode, and agent scope (1) `all_kb` / (2) `specific_kb`. The model writes **strictly from the retrieved SOURCES** and cites them. (Agent scope (3) `general` / `noKnowledgeBase=true` uses the separate ungrounded prompt §9.3c instead — no SOURCES, no citations.)

> **Citation token = the existing chat-QA format (§0.1.7, §6 decision 5).** The `[N]` written in this prompt and its example is a **stand-in**; when instantiating the template, substitute the real chat-QA inline-citation token and the matching "Source [N]: …" labeling so the model emits exactly what chat-QA emits and the FE renders it identically. If chat-QA's token is not `[N]`, change the marker in every rule, the example, and the `Source [N]:` source-label format together — keep the prompt's *rules* identical, swap only the surface token.

**System:**
```text
You are a grounded research writer. You will be given:
- a SECTION TITLE and BRIEF
- a list of numbered SOURCES of the form "Source [N]: <text>"
- a target length

## Hard rules
1. Use ONLY information present in the SOURCES. Do not use outside or
   prior knowledge, even if you believe you know the answer. Every
   statement must be traceable to a SOURCE; if it is not in the SOURCES,
   it does not go in the section. This is strict grounding — it exists to
   prevent hallucination and stale/biased model knowledge from leaking in.
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
10. Output ONLY this section's content — exactly what the BRIEF and the
    output format ask for, nothing else. No preamble ("Here is…"), no
    restating the task or brief, no introduction or conclusion unless
    the format requires one, no postamble or summary of what you wrote.
    Be terse-but-complete: the shortest text that fully covers the brief
    and its acceptance criteria. Do NOT pad to reach the target length —
    {target_tokens} is a ceiling, not a quota. (Saves output tokens; the
    assembler concatenates sections verbatim, so any extra prose ships to
    the user and is stripped/flagged in Phase 4.)

## Output format
Plain markdown prose, AT MOST ~{target_tokens} tokens (fewer is fine if
the brief is fully covered). Inline [N] citations only. No headings, no
bullet or numbered lists unless the brief explicitly asks for them. No
text before the first sentence or after the last.

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

**User message composition (order matters):** persona block (agent instruction + skill slice in agent mode + "Reader profile: {userProfile}") → `USER TASK` → `SECTION TITLE` → `SECTION BRIEF` (plan rationale + relevant constraint/quality headings + the active artifact skill's **writer-guidance** block, if any (§A.10) + "assumptions allowed: yes/no") → `ACCEPTANCE CRITERIA` (the section's `acceptanceCriteria` list, rendered as "Your section MUST satisfy: 1) … 2) …"; **[merged-in]** these are quality constraints on the body, never instructions to add structure) → `TARGET LENGTH` → rolling summaries of prerequisite sections (labeled "do not repeat their content") → `SOURCES:` block with anti-lost-in-the-middle ordering. The skill guidance and acceptance criteria shape the body only; the heading is fixed and the writer never alters it. Temperature ~0.3.

### 9.3b Section writer — `reference_inspired` (rules 1–4 replaced; 5–9 and Output format shared)

```text
1. The SOURCES are STYLE and STRUCTURE EXEMPLARS, not facts. You may
   invent specifics consistent with the user's TASK.
2. Do NOT cite. The reader should not see any [N] in your output.
3. Mirror the voice, structure, and granularity of the exemplars.
4. Stay strictly on the user's TASK; the exemplars only inform how,
   not what.
```

### 9.3c Section writer — `retrievalMode="none"` (the UNGROUNDED prompt — agent `agentScope="general"` / `noKnowledgeBase=true`, and user-context-only sections)

This is the separate prompt for sections with **no retrieved chunks**: agent scope (3) `general`, and any section whose evidence is fully in the user's `# Context`. There are no SOURCES and no `[N]` citations — the model writes from its own general knowledge plus the USER CONTEXT. (Chat mode and agent scope 1/2 never use this prompt; they use the grounded §9.3.)

```text
You are a professional writer producing one section of a larger
document. Follow the SECTION BRIEF and the persona/reader profile.
Use the USER CONTEXT as your primary input when it is provided and
relevant. Do not write the section title or heading. Do not include
citations.
Output ONLY this section's content — exactly what the BRIEF and output
format ask for, nothing else. No preamble, no restating the task, no
introduction/conclusion unless the format requires it, no postamble.
Be terse-but-complete: the shortest text that fully covers the brief;
{target_tokens} is a ceiling, not a quota — do not pad to reach it.
Plain markdown prose, AT MOST ~{target_tokens} tokens; use lists only
if the brief explicitly asks for them. Stay strictly on the user's
TASK; do not add disclaimers, never mention being an AI, never output
internal notes or reasoning. No text before the first sentence or after
the last.
```

### 9.3d Section writer — `review_validate` (rules 1–4 replaced; 5–9 and Output format shared) **[merged-in]**

```text
1. You are reviewing an ARTIFACT against a REFERENCE. The SOURCES are
   split and labelled: "Source [N] (ARTIFACT): <text>" is what the
   document under review actually says; "Source [N] (REFERENCE): <text>"
   is what it must conform to (the SRS, template, standard, or upstream
   design). Use ONLY these sources; do not use outside knowledge.
2. Report findings as the DELTA between artifact and reference. For each
   finding, cite the REFERENCE source [N] that states the expectation
   AND, when applicable, the ARTIFACT source [N] that meets or violates
   it. A "missing" finding cites the reference only and states no
   artifact source covers it. Cite at least one source per finding.
3. Do NOT invent gaps, conformance, requirement IDs, or facts. If the
   sources do not let you judge a point, say so explicitly rather than
   guessing. Never assert "complete"/"sufficient" without reference
   coverage to back it.
4. If the SOURCES do not contain enough to perform the review, output
   exactly this and stop:
       Insufficient context in knowledge base for this section.
```

(When a `review_validate` plan also contains a corrected-draft section, that section uses the §9.3 `grounded_strict` writer grounded against the reference — not this reviewer prompt.)

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
address the user's TASK, the requested OUTPUT FORMAT, every listed
REQUIREMENT HEADING, and each section's ACCEPTANCE CRITERIA. You see
only each section's heading, opening lines, and its acceptance criteria;
judge coverage of topics and whether the opening lines plausibly meet
the criteria, not writing quality. Do not penalize sections marked
"Insufficient context in knowledge base for this section." - instead
list what they were supposed to cover under missingAspects. List any
requirement heading that no section addresses under missingAspects, and
any acceptance criterion a section clearly fails under unmetCriteria.

Do not add new content. Do not rewrite anything. Do not print a
validation report for the user.

Return JSON only:
{"coversTask": true|false,
 "missingAspects": ["..."],
 "unmetCriteria": [{"sectionId": "s2", "criterion": "..."}],
 "sectionsToRegenerate": ["s2","s5"]}
sectionsToRegenerate must contain sectionIds of sections that look
insufficient for the task or that fail an acceptance criterion, or [].
```

**User message:** `TASK`, `OUTPUT FORMAT REQUESTED` (the plan's one-line summary), `REQUIREMENT HEADINGS` (the detected list), then per section: index, sectionId, heading, its `acceptanceCriteria` list, and first ~150 tokens of body. Budget ≤2.5k in / ~200 out. Temperature 0.

### 9.7 Output-format intent check (Phase 1 — agent mode, Tier-1 fallback only) **[merged-in]**

Runs ONLY when §4.3b's deterministic hint scan (Tier 0) finds nothing AND no `# Output format` was otherwise resolved. Decides whether the prompt asks to reuse a pre-configured format.

**System:**
```text
You decide whether the user is asking to use a PRE-EXISTING, configured
output format (a saved template) rather than describing a new one.

Rules:
- useConfiguredFormat=true ONLY if the prompt refers to an existing /
  standard / saved / named format or template to reuse.
- If the user describes a format inline, or says nothing about format,
  useConfiguredFormat=false.
- formatName: the template name the user referred to, or "" if they
  referred to the default/standard format without naming one.
- Do not invent a format. Do not answer the user's task.

Return JSON only: {"useConfiguredFormat": true|false, "formatName": str}
```
**User message:** the raw user prompt (no agent config). Budget ≤300 in / ≤60 out. Temperature 0. A `true` result triggers the §4.3b resolver tool; `false` proceeds to the agent's default format.

### 9.8 Responsibility mapping — where every prompt from the research outputs lives **[merged-in]**

The GPT-report pipeline defined ten component prompts. This design keeps the **core pipeline** at **six LLM call sites** (§9.1–§9.6) by making four responsibilities deterministic — the Section Writer is one call site with mode-specific prompt variants (9.3 / 9.3b / 9.3c / 9.3d), and `review_validate` reuses it rather than adding a new call. The only additional call is §9.7, a **conditional Phase-1 fallback** (agent mode, deterministic-scan miss only) — zero cost on the common path, in the same "free unless a header is absent" family as the §9.1 extractor. Nothing is dropped:

| Component prompt (GPT report §17) | Where the responsibility lives in this spec |
|---|---|
| 17.1 Input Normalizer | Deterministic header parser + heading detector (§4); §9.1 runs only for agent-mode freestyle prompts |
| 17.2 Intent & Requirement Analyzer | Folded into the single planner call: `detectedTask`, `riskLevel`, requirement-heading mapping (§9.2) |
| 17.3 Smart Planner | §9.2 |
| 17.4 Conditional Outliner | Deterministic format parser + planner addendum (§5); no separate call; "skip outliner" cases collapse to derived headings or a 1-section plan |
| 17.5 Section Evidence Planner | The plan's per-section `retrievalMode`, `subQueries`, `referenceQueries`, `acceptanceCriteria`, evidence policy (§3.2, §6) — decided once in Phase 2 |
| 17.6 Evidence Sufficiency Judge | §9.4 + Tier-0 heuristics + riskLevel strictness (§7) |
| 17.7 Section Writer | §9.3 / 9.3b / 9.3c / 9.3d (review_validate) with the no-invented-IDs, assumptions, acceptance-criteria, and no-internal-notes rules merged in |
| 17.8 Section Validator | Deterministic citation validation + optional NLI gate (§6–§7); no LLM call |
| 17.9 Output Assembler | Deterministic concatenation + markdown normalization (§8); no LLM call |
| 17.10 Final Validator | Phase 4 checks (a)/(b) deterministic + §9.6 coverage call |

---
## 10. Cost, quality, and performance guidelines (operational) **[merged]**

**Cost** — skip retrieval when a section's needs are met by user context (`retrievalMode: none`); retrieve only for sections that need evidence; cap retrieval at 2 rounds and generation at 1 per section (pre-repair); run Tier-0 heuristics before the LLM sufficiency judge and offer `heuristic_first` mode for low-risk workloads; reserve strict LLM judging for high-risk/complex/weak/conflicting evidence; skip the planner addendum work when `# Output format` is strict (headings derived deterministically); never run a final rewrite pass; memoize retrieval and rerank results within a request (optional TTL cache across requests); cap section regeneration at one Phase-4 round.

**Quality** — structured single-call planning with in-schema rationale; requirement-heading detection feeding planning and coverage audit; **the agent instruction is configuration that shapes Phase 2 planning, not just Phase 3 writing — the normalizer distills it into structured `agentPlanningHints`/`agentPolicy` (verbosity, ID/terminology conventions, required/forbidden content, domain-risk cues, retrieval/citation policy, skill criteria) that bias `detectedTask`, `riskLevel`, evidence policy, sub-query anchors, `targetTokens`, and `acceptanceCriteria` (§4.6, §9.2) — keeping precedence auditable while ensuring the configured agent behaves consistently**; **per-section `acceptanceCriteria` fused from agent skill + output format + requirement/quality headings, enforced in the writer brief and re-checked by the coverage auditor (§9.6) — the main lever for output consistent with what the agent/user expects**; section-specific retrieval; sufficiency gating before generation; citations enforced during generation and validated deterministically; **dual-grounding `review_validate` for conformance/sufficiency review against a reference**; per-section flags + NLI gate; deterministic structure conformance and forbidden-content scan; abstention sentinel instead of fabrication; exact preservation of the user's output format.

**Performance** — independent sections retrieve and generate in parallel under a concurrency limit (default 4); sub-query retrieval is concurrent within a section; retrieve topK≈20, rerank to top≈5 so writers see only the best candidates; stream progress to the frontend over the existing SSE pattern — emit section-completed events as sections pass per-section validation (marked provisional until Phase 4 confirms), then the final assembled result; persist per-section job state (`planned → retrieved → written → validated`) so a failed or interrupted run resumes from completed sections instead of restarting (behind the existing background-job pattern).

**Observability (Langfuse tracing for the 4-phase pipeline)** — every request is **one Langfuse trace**; each LLM call and each deterministic gate is a **span** under it, mirroring the new pipeline so a developer can replay any run end-to-end. Structured logs at every phase boundary (phase name, duration, token in/out, cache hits, flags raised) are emitted as span attributes and also wired into the existing logging stack. Trace/span layout:

- **Trace (root)** = the whole request: tags `mode` (chat/agent), `detectedTask`, `agentId`/`tenantId` (from `security`), `noKnowledgeBase`; trace-level token + latency totals; final `warnings` object attached.
- **Phase 1 — Normalize** span: which path ran (header-parse / §9.1 freestyle extractor / §4.3b resolver Tier-0/Tier-1), resolved `outputFormatSource`, `requirementHeadings` count, `agentPlanningHints` keys populated. The §9.1 and §9.7 LLM calls (when they fire) are **generation** sub-spans.
- **Phase 2 — Plan** span: one **generation** sub-span for the planner (§9.2) with prompt, the **expanded full-name JSON** plan as output (plus `rawOutput` short-key string if `shortKeyWire` on, §9.0), token in/out, retry count, and the deterministic post-parse forcings applied (high-risk `mustCite`, `review_validate`, no-KB, `dependsOn` cycle/edge drops §7a.4).
- **Phase 3 — Sections** span with **one child span per section** (run concurrently; spans may overlap in time): each contains generation sub-spans for sufficiency (§9.4), query-rewrite (§9.5 when triggered), and the writer (§9.3/b/c/d), plus deterministic events for citation validation and the acceptance-criteria check; section attributes include `retrievalMode`, `riskLevel`, retrieval rounds used, chunks offered, flags raised (`insufficient_context`, `no_citations`, `low_faithfulness`, `unmet_acceptance_criteria`, `reranker_degraded`, `retriever_unavailable`, `generation_failed`, `deadline_skipped`). Memoized retrieve/rerank hits are marked as cache-hit events, not new spans.
- **Phase 4 — Validate** span: deterministic structure/citation/forbidden-content checks as events; one **generation** sub-span for the coverage auditor (§9.6); the regeneration set and any repair-round section spans nested under it.
- **LLM generation spans** record model id, prompt, output, token in/out, temperature, and constrained-decoding retry count; all structured outputs are logged in **expanded full-name JSON** (§9.0) so traces are human-readable. Internal trace/log detail NEVER appears in the delivered document; the Generation Result's `warnings` object remains the single user-facing quality surface.
- Implementation: discover the existing Langfuse client/config per §0.1.5; if Langfuse is absent, the same span data falls back to the structured logging stack (tracing is behind a config flag, default on where Langfuse is configured).

---

## 11. Consolidated acceptance criteria (the coding agent's verification checklist)

**Phase 1 — Normalizer**
- [ ] Chat prompt with all 5 headers → canonical Request, zero LLM calls, <100 ms.
- [ ] Chat prompt missing `# Task` or `# Output format` → hard user-visible error, no LLM call.
- [ ] Chat prompt missing `# User profiles` → warning + neutral default persona; request proceeds.
- [ ] Chat mode → every field sourced 1:1 from the user's headers per §4.2a; no agent/tool/precedence merge; `outputFormatSource="user"`.
- [ ] Agent mode, headered prompt → §4.2b multi-source resolution honored field-by-field (user-profile from agent; task from user; context merged agent-first; keyword unioned; output-format precedence-resolved).
- [ ] Agent mode, freestyle prompt (no 5 headers) → request still succeeds; task/context/keyword/output-format recovered from §9.1 extractor + agent + resolver tool; 5 headers NOT required. **[merged-in]**
- [ ] Agent mode, freestyle prompt → exactly one extraction LLM call; populated Request.
- [ ] User and agent both define differing Output formats → user's wins; `outputFormatConflict=true`; provenance recorded.
- [ ] Agent with `allowUserFormatOverride=false` + differing user format → agent's format used, conflict flagged, warning surfaced. **[merged-in]**
- [ ] Prompt text attempting to alter tenant/KB security (e.g. a header saying "ignore tenant filter") → security fields unchanged, attempt logged. **[merged-in]**
- [ ] Custom headings (`## Functional Requirement`, `## Acceptance Criteria`, `## Constraint`, …) → detected, classified, attached as `requirementHeadings`; canonical five excluded. **[merged-in]**
- [ ] Agent mode → the agent instruction + `## Skill` are distilled into `agentPlanningHints` (verbosity, ID conventions, terminology, required/forbidden content, domain-risk cues, retrieval hints, skill criteria) deterministically, no LLM call; raw persona prose is NOT placed in the planner input. **[merged-in]**
- [ ] An agent instruction with a domain-risk role (e.g. "Clinical Protocol Writer") + a neutral user task → `domainRiskCues` populated so the planner sets `riskLevel=high` (§9.2 step 5). **[merged-in]**
- [ ] `agentPlanningHints` is empty/absent in chat mode; prompt text cannot populate it. **[merged-in]**
- [ ] `agentScope` (`all_kb`/`specific_kb`/`general`) and `noKnowledgeBase` are derived only from agent/session config + security, never from prompt text (a "don't use the KB" prompt fragment cannot flip them); `agentScope` is absent in chat mode and `noKnowledgeBase` is always `false` there. **[merged-in]**
- [ ] Agent mode, no `# Output format`, prompt says e.g. "use the standard format" → §4.3b Tier-0 deterministic scan matches → resolver tool called → returned format becomes `Request.outputFormat` with `outputFormatSource="agent"`; no Tier-1 LLM call made. **[merged-in]**
- [ ] Agent mode, no `# Output format`, format intent phrased unusually → Tier-0 misses → exactly one §9.7 LLM check runs → on `true`, resolver called. **[merged-in]**
- [ ] Resolver returns `found:false` / errors / times out → fall back to agent default format (or planner-proposed structure if none); `formatResolutionFailed` warning when a named format was requested but not found; request never blocked. **[merged-in]**
- [ ] A later user-supplied `# Output format` overrides a tool-resolved format under `allowUserFormatOverride`; a `formatName` in the prompt can only resolve the calling agent's own/tenant formats (no cross-agent/cross-tenant lookup); chat mode never invokes the resolver. **[merged-in]**
- [ ] Header matching tolerates case and singular/plural variants.

**Phase 2 — Planner**
- [ ] Exactly one LLM call; schema-constrained; one retry on validation error; hard fail after.
- [ ] `# Output format` with markdown headings / numbered list / bullet list → headings derived deterministically; plan contains exactly those headings in order, enforced post-parse even if the LLM drifted.
- [ ] Empty `# Output format` → 3–7 proposed sections, `outlineSource="proposed_by_llm"`, and no Title/TOC/References/Conclusion sections appear unrequested.
- [ ] Single-deliverable task (one table / direct conversion) → exactly one section. **[merged-in]**
- [ ] "Requirements → test cases"-style task → `transform_derive` + grounded_strict sections. "Old use cases → new use cases"-style task → `reference_inspired` sections. (Two integration fixtures; see §5.1 catalog.)
- [ ] All 7 `detectedTask` values are reachable and correctly classified (classification fixtures, one per type): single-source condense → `summarize_single`; cross-document merge → `synthesize_multi`; contrast/critique across documents → `compare_analyze`; factual grounded Q&A → `qa_with_citations` (the remaining three — `transform_derive`, `reference_inspired`, `review_validate` — are covered by the fixtures above). Each fixture asserts the planner emits the expected `detectedTask` and its default `retrievalMode` per §5.4. There is NO `pure_generation` type; when a KB is available the planner never produces an all-`none` ungrounded plan. **[merged-in]**
- [ ] "Is this test spec complete/consistent with the SRS?"-style task → `detectedTask=review_validate`; findings sections grounded_strict with both `subQueries` (artifact) and non-empty `referenceQueries` (reference); `mustCite` forced true and `assumptionsAllowed` forced false post-parse; a requested "corrected draft" item → that one section `transform_derive` with `dependsOn` on the findings. (Integration fixture; §5.1 row 8.) **[merged-in]**
- [ ] `referenceQueries` is non-empty ONLY on `review_validate` sections; dropped post-parse on every other task. **[merged-in]**
- [ ] Each section gets `acceptanceCriteria` (0–6) derived from `agentPlanningHints.skillCriteria` + the section's output-format item + mapped requirement/quality headings + applicable `requiredContent`/`forbiddenContent`/`idConventions`; criteria are testable body properties, never new sections/headings/title/TOC/References. **[merged-in]**
- [ ] Agent config demonstrably shapes the plan (agent mode): `agentPolicy.citationPolicy="required"` → all grounded sections `mustCite=true`/`minCitations≥1`; `idConventions`/`terminology`/`retrievalHints` appear in sub-query anchors; `defaultVerbosity` drives `targetTokens` when the user gave no length intent; a `requiredContent` rule needing a new section is dropped (structure stays bound to `# Output format`). **[merged-in]**
- [ ] Regulated-domain fixture (healthcare/legal/finance) → `riskLevel=high`; `mustCite` forced true and `assumptionsAllowed` forced false post-parse. **[merged-in]**
- [ ] Every detected `requirement`/`acceptance_criteria` heading maps to ≥1 section; unmapped → retry then warning. **[merged-in]**
- [ ] Chat mode with empty effective KB → **hard error before generation** (chat requires a KB, §4.3.2); never silently ungrounded. **[merged-in]**
- [ ] Agent `agentScope="general"` (`noKnowledgeBase=true`) → every section forced to `retrievalMode="none"`, `mustCite=false`, `minCitations=0`, no `subQueries`/`referenceQueries`, enforced post-parse even if the LLM proposed grounded sections; `detectedTask` is still one of the 7 (no `pure_generation`); the outline (from `# Output format`) is still preserved exactly. **[merged-in]**
- [ ] Agent `agentScope="all_kb"`/`"specific_kb"` (KB present) → behaves like chat: grounded sections retrieve and abstain (sentinel) on insufficient context; the planner does not produce ungrounded sections. **[merged-in]**

**Phase 3 — Section pipeline**
- [ ] Existing retriever and reranker are invoked directly (adapters at most); no retrieval logic reimplemented; KB ids sourced only from security context + agent policy.
- [ ] Sections run concurrently under the configured limit; `dependsOn` waits only on prerequisites.
- [ ] Identical sub-queries across two sections → underlying retriever invoked once (memoization hit). **[merged-in]**
- [ ] Same chunk surfacing in two sections → one registry entry, same `[N]` in both.
- [ ] Inline citations use the **existing chat-QA token format and FE payload shape** (§0.1.7), not a new convention: the FE renders Phase-3 citations with the same component/code path as chat-QA (assert against a chat-QA fixture); the citation validator parses the real chat-QA token grammar, not a hardcoded `[N]`. **[merged-in]**
- [ ] Cross-section stable id holds in the chat-QA scheme: same chunk → same citation id across sections; if chat-QA numbers per-answer, the registry extends it for the document without forking a second convention. **[merged-in]**
- [ ] Writer call input never exceeds ~11k tokens (assert via token counting in tests).
- [ ] Invalid `[99]` in a draft → stripped, never remapped; punctuation/spacing cleaned.
- [ ] grounded_strict + twice-insufficient → body is exactly the sentinel, `insufficient_context` flag, no generation call made.
- [ ] reference_inspired sections contain zero `[N]` markers.
- [ ] `review_validate` section retrieves artifact (subQueries) AND reference (referenceQueries); sources are labelled ARTIFACT/REFERENCE to the writer; each finding cites a reference (and artifact where applicable); no pass/gap asserted without a citation; twice-insufficient → abstention sentinel. **[merged-in]**
- [ ] A section whose `acceptanceCriteria` cannot be confirmed by deterministic post-write checks (§6) is flagged `unmet_acceptance_criteria` and becomes a Phase-4 regeneration candidate. **[merged-in]**
- [ ] Retrieval rounds per section never exceed 2; generation calls per section never exceed 1 (pre-repair).
- [ ] `riskLevel=high` section → Tier-1 LLM sufficiency check always runs, even in `heuristic_first` mode. **[merged-in]**
- [ ] Grounded fixture with a known ID vocabulary → output contains no requirement/API/table IDs absent from the sources (regex assert). **[merged-in]**
- [ ] NLI gate behind a config flag; removing >50% of sentences flags `low_faithfulness`.
- [ ] `noKnowledgeBase=true` (agent `agentScope="general"`) → zero retrieve calls and zero rerank calls across the whole run; every section takes the `none` writer path (§9.3c); delivered document contains zero `[N]` markers and no abstention sentinel; a `noKnowledgeBase` warning is surfaced (request still succeeds). **[merged-in]**
- [ ] Grounded request (chat, or agent `all_kb`/`specific_kb`) where a section's reranked context is empty/unusable → that section abstains with the per-section sentinel + `insufficient_context` (per stage of the plan); it does NOT fall back to ungrounded generation — guarding against cut-off-knowledge hallucination/bias. **[merged-in]**
- [ ] Grounded sections use the §9.3 prompt (SOURCES + `[N]`, strict-from-sources); ungrounded (`retrievalMode="none"`) sections use the §9.3c prompt (no SOURCES, no `[N]`) — the two are distinct system prompts selected by retrieval mode. **[merged-in]**
- [ ] Writer output contains ONLY the section's required content: no preamble ("Here is…"), no task restatement, no intro/conclusion unless the output format requires it, no postamble — asserted on a fixture (delivered section body starts at the first content sentence and ends at the last). **[merged-in]**
- [ ] Brevity rule holds without quality loss: `targetTokens` treated as a ceiling not a quota (no padding); a section is not penalized for being shorter when its brief + acceptance criteria are fully covered; required facts/citations/criteria are never trimmed to save tokens. **[merged-in]**

**Phase 4 — Validator**
- [ ] Assembled output contains no auto title, no TOC, no references section unless planned from the user's format.
- [ ] Forbidden-content scan: no source list, appendix, validation notes, internal plan/reasoning, retrieved chunks, quality scores, or debug metadata in the delivered document. **[merged-in]**
- [ ] Passing sections are byte-identical before and after validation (no rewriting).
- [ ] Coverage auditor sees only headings + ~150-token openings + requirement headings + per-section `acceptanceCriteria`; an unaddressed requirement heading appears in `missingAspects`; a clearly failed criterion appears in `unmetCriteria` and its section enters the regeneration set. **[merged-in]**
- [ ] Regeneration affects only the flagged/named sections, runs at most once, with bumped strictness; second-round failures return as warnings, not loops.
- [ ] Result includes the citation registry and the full warnings object; warnings never fail the request.
- [ ] Artifact skill active (plan hints + writer guidance) → delivered section count, headings, and order are byte-identical to what `# Output format` dictates; the skill adds no section, title, TOC, or References. Skill guidance influences only section bodies (the `HOW`), never structure (the `WHAT`). **[merged-in]**

**Skills — loading & token discipline (§A.10.3)**
- [ ] Skill selection reads only each `SKILL.md` `name`+`description`; no skill body is loaded to decide relevance; `SKILL.md` prose body never enters any LLM call. **[merged-in]**
- [ ] At most one artifact skill is loaded per request; the other 9 skills' `plan.md`/`write.md` never enter any prompt; ties break deterministically (or none loaded). **[merged-in]**
- [ ] Phase 2 loads only the selected skill's `plan.md`; Phase 3 loads only its `write.md`; never both in one call. **[merged-in]**
- [ ] Agent-mode request whose instruction covers the artifact → no skill body loaded (fallback skipped); skill body loads only to fill uncovered discipline. **[merged-in]**
- [ ] `plan.md` hints count against the planner ≤3k budget (distilled, not pasted whole); the `write.md` slice occupies the ≤~250-token writer-guidance line of the §6 per-section table; an over-budget skill file is sliced/truncated, never allowed to overflow. **[merged-in]**
- [ ] A request needing no artifact skill pays only the metadata-catalog scan (no skill body in any prompt). **[merged-in]**

**Operational robustness (§7a)**
- [ ] Transient infra error (LLM 5xx / retriever or reranker throw/timeout) → exactly one bounded retry with backoff, separate from the §7 logical retrieval rounds. **[merged-in]**
- [ ] Reranker unavailable → section falls back to retriever score order, `reranker_degraded` flag; section not blocked. **[merged-in]**
- [ ] Retriever unavailable after retry → grounded_strict section emits sentinel + `retriever_unavailable`; reference_inspired/none sections proceed. **[merged-in]**
- [ ] One section's LLM call fails after retry → that section delivered as sentinel + `generation_failed`; run continues; `warnings.partial=true`, `failedSections[]` populated; request returns success (not error). **[merged-in]**
- [ ] Request fails outright ONLY when Phase 1 or Phase 2 cannot produce a plan — never because an individual section failed. **[merged-in]**
- [ ] Deadline (`requestDeadlineMs`, default 180 000) reached → stop scheduling new sections, let in-flight calls finish, proceed to Phase 4 on the partial; unstarted sections → sentinel + `deadline_skipped`; `warnings.deadlineHit=true`; repair round skipped if past deadline. **[merged-in]**
- [ ] Caller cancellation → new sections not scheduled, in-flight aborted/discarded, limiter released, prompt return; `warnings.cancelled=true`; no half-written document persisted; resume (if enabled) skips completed sections. **[merged-in]**
- [ ] Planner emits a `dependsOn` cycle or dangling ref → deterministic Phase-2 post-parse check rejects it → one planner retry → if still bad, offending edges dropped + `warnings.dependencyEdgesDropped[]`; executor never deadlocks; request not failed. **[merged-in]**

**Whole pipeline**
- [ ] 6-section grounded document completes < 180 s on the target local LLM (performance test).
- [ ] Chat route and agent route share one orchestrator instance/path; the only mode branch in the codebase is inside the normalizer (plus the writer's persona injection).
- [ ] Interrupted run resumes from persisted per-section state without re-running completed sections (when job persistence is enabled). **[merged-in]**
- [ ] Each request emits ONE Langfuse trace with a span per phase and a generation sub-span per LLM call (§10); section spans nest under Phase 3; coverage + repair under Phase 4; token/latency totals at trace root; `warnings` attached. **[merged-in]**
- [ ] All structured LLM outputs appear in traces as **expanded full-name JSON** (§9.0); short-key wire form (if `shortKeyWire` on) appears only in the `rawOutput` span field; no short keys leak past the adapter into any downstream object or contract. **[merged-in]**
- [ ] Constrained-JSON outputs round-trip through the short↔full adapter into the §3.2/§3.3 canonical objects; with `shortKeyWire` off, wire keys equal full names (adapter is identity). **[merged-in]**
- [ ] Langfuse absent → span data falls back to the structured logging stack; tracing behind a config flag (default on where Langfuse configured). **[merged-in]**
- [ ] Config surface: kb ids, concurrency (default 4), retrieve topK (20), rerank topK (5), sufficiencyMode (`always_llm` default), NLI gate flag, coverage flag, max sections (10), retrieval cache flag/TTL, job-persistence flag, skill loading (`agentSkillMode: skip_if_covered | always_fallback`, default `skip_if_covered`; §A.10.3), operational-robustness knobs (`requestDeadlineMs` default 180 000, `infraRetries` default 1 + backoff; §7a), `shortKeyWire` (default off; §9.0), and Langfuse tracing flag (default on where configured; §10). **[merged]**

**Suggested implementation order:** types/contracts → header & format parsers + requirement-heading detector (unit tests) → normalizer with precedence + security rules → constrained-JSON LLM wrapper → planner (incl. `dependsOn` cycle/integrity gate, §7a.4) → chunk registry + retrieval memoization → section pipeline with tiered sufficiency loop + infra-retry/degradation handling (§7a.1) → citation validator → writers → validator + assembler + repair → routes/jobs/SSE + resume + deadline + cancellation (§7a.2–7a.3) → NLI gate → performance test. Retire the standalone outliner module and the content-producing stitch/refine code paths as part of the same change, with the old behavior kept behind a fallback flag only if the team requires a rollback path.

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
| **Artifact Reviewer (e.g. Test Spec vs SRS, LLD vs HLD)** **[merged-in]** | the artifact under review + its reference (SRS / standard / upstream design), both in the KB | `review_validate` (+ `transform_derive` for an optional corrected draft) | grounded_strict, dual-grounding: `subQueries` hit the artifact, `referenceQueries` hit the reference; abstain rather than assert pass/gap without evidence |
| **End-to-end Traceability (A.8c)** | the lifecycle artifacts to be linked — requirements, design, code/commit refs, tests, defects — across waterfall (BRD→SRS→HLD→LLD→test) or agile (Epic→Feature→Story→AC→test) | `synthesize_multi` (or `transform_derive` for tracing a single seed node outward) | grounded_strict, bi-directional: seed sub-queries for each node's upstream source AND downstream consumers; "NOT TRACED" rather than infer a link; broader than the RTM (whole-lifecycle, both directions, code+defect nodes) |

> **KB hygiene:** these agents work best when each artifact family is in its own knowledge base (or tagged) and the agent's `kbIds` are set accordingly, so the agent's `# Keyword` baseline plus per-section sub-queries land on the right document family. For the Artifact Reviewer, the artifact and its reference should be retrievable from the agent's `kbIds` (same KB tagged by document type, or two KBs) so `subQueries` and `referenceQueries` can each land on the right side.

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

### A.8b Agent: Artifact Reviewer (sufficiency & conformance) **[merged-in]**

```md
You are a senior reviewer who checks whether a produced artifact is
complete, consistent, and sufficient against the reference it must
conform to (its SRS, standard, template, or upstream design). You judge
the DELTA between what the artifact says and what the reference
requires. You never invent gaps and never declare conformance without
reference evidence; where the retrieved sources do not let you judge a
point, you say so explicitly instead of guessing.

## Skill
- Treat ARTIFACT sources (the document under review) and REFERENCE
  sources (what it must satisfy) as two separate bodies of evidence.
- For each reference requirement, decide: covered, partially covered,
  missing, or contradicted by the artifact - and cite both sides.
- Report sufficiency per area, not just a global verdict; an artifact
  can be sufficient for one requirement and insufficient for another.
- When asked for a corrected version, only add/fix what a reference
  requirement supports; never invent IDs, fields, endpoints, or facts.

# User profiles
Reviewers, QA leads, and authors who must decide whether the artifact
is ready or what is missing before sign-off.

# Context
The artifact under review and its reference both live in the knowledge
base. ID conventions follow the project (REQ-*, UC-*, TC-*, TS-*,
CMP-*, DLD-*). "Sufficient" means every reference requirement in scope
is addressed by the artifact with no contradiction.

# Keyword
review, conformance, completeness, consistency, sufficiency, gap,
coverage, reference, requirement

# Output format
1. Review Summary and Verdict (sufficient / insufficient, with scope)
2. Conformance Findings (per requirement: covered / partial / missing / contradicted, with citations)
3. Gaps and Missing Coverage
4. Inconsistencies and Contradictions
5. Corrected Artifact (only if requested)
```

**Example user prompt (freestyle):** "Review whether the test specification TS-CRM is complete and consistent with the SRS for the customer-import feature, and give me a corrected version." → expected: `detectedTask=review_validate`; sections 1–4 `review_validate`, grounded_strict, `mustCite=true`, each with `subQueries` hitting the test spec (`"TS-CRM procedures"`, `"TS-CRM test data"`) and `referenceQueries` hitting the SRS (`"customer-import requirements"`, `"CSV validation rules"`); `acceptanceCriteria` e.g. `["every finding cites the SRS clause and the TS-CRM section it compares", "no 'sufficient' verdict without reference coverage"]`; section 5 `transform_derive`, grounded against the SRS, `dependsOn ["s1","s2","s3","s4"]`. If the user omits "corrected version", section 5 is absent (the user's `# Output format` controls it).

> **Why this is a strong integration fixture:** like the RTM it makes hallucination trivially detectable — a fabricated "covered" or invented requirement ID has no reference citation and fails deterministic citation validation; an asserted gap with no artifact-side and reference-side citation is caught the same way.

---

### A.9 How these templates exercise the pipeline (verification matrix)

| Template | Exercises | What integration tests assert |
|---|---|---|
| A.1 Use Case | mixed retrieval modes in one plan | sections 4–6 contain no `[N]`; sections 1–3 cite existing UC chunks |
| A.2 SRS | user Output format **overriding** the agent's | final doc has exactly the user's 4 sections; `outputFormatConflict=true` |
| A.6 Test Case | `transform_derive` + per-section sub-queries | each detailed case cites the requirement chunk it derives from |
| A.8 RTM | abstention sentinel + strict grounding | uncovered rows say "NOT COVERED"; zero invented TC IDs |
| A.8b Artifact Reviewer | `review_validate` dual-grounding + `acceptanceCriteria` | findings cite an artifact chunk AND a reference chunk; no verdict without reference citation; optional corrected-draft section only when the output format requests it |

Adding any future SDLC artifact (Operation Manual, Release Notes, API Reference, …) requires **no orchestrator changes** — only a new agent instruction with the same shape: persona + Skill block + the four canonical headers with a numbered `# Output format`.

---

### A.10 Artifact skills (skill-creator–generated) — one skill per phase per artifact

Each Appendix-A artifact has **one skill folder** under `plans/skills/sdlc-<artifact>/`, Anthropic-style: a `SKILL.md` entry point plus two phase-specific resource files — `plan.md` (Phase 2) and `write.md` (Phase 3). `SKILL.md` is the always-loaded front door (artifact identity, trigger, mode rules, invariants); the phase files are loaded on demand by the phase that consumes them. Splitting by phase mirrors the orchestrator's own boundary: Phase 2 is a single planning call that never sees retrieved chunks, while Phase 3 is N parallel writer calls that never re-plan. Each phase file therefore loads only into the phase that consumes it — the planner never carries writer prose, and writers never carry planning metadata.

**Scope & mode (the skill is a chat-mode asset; an agent-mode fallback).** Skills carry artifact discipline for **chat generative mode**, where there is no agent instruction to supply it. In **agent mode**, the agent instruction (its persona + `## Skill` block, reaching the writer per §6 item 6, and its planning-relevant content distilled into `agentPlanningHints` per §4.6) is the **source of truth and always wins**; the artifact skill loads only as a **fallback** that fills discipline the instruction did not state, and is dropped wherever it would conflict with the instruction, the resolved `# Output format`, or security. This removes the agent-mode redundancy between an artifact skill and the agent's own `## Skill` block: the instruction is primary, the skill is backup.

Both skills are deliberately **structurally inert**: they influence *how* the orchestrator plans and writes, never *what sections exist or their order*.

**The outline is never a skill's job.** Section structure is derived solely from the resolved `# Output format` (user's, or the agent's fallback per precedence §4); when no output format is present, the planner proposes structure (§5). No skill may add, remove, rename, or reorder any section, or emit a title, table of contents, or References block. This is what keeps the delivered response **strictly bound to the user's `# Output format`**.

**A.10.1 Phase 2 — plan resource (`sdlc-<artifact>/plan.md`).** Supplies planning *metadata* for the artifact type — expected `detectedTask`, dominant `retrievalMode` per section kind, `riskLevel` cue, sub-query seeds, `acceptanceCriteria` seeds, and the no-KB rule (§4.5) — to bias the single planner call (§5/§9.2). It is the artifact-specific counterpart to the per-agent `agentPlanningHints` (§4.6): where `agentPlanningHints` distills *this agent's* instruction, the plan skill carries *this artifact type's* reusable planning defaults; both feed the planner as structured data, and the same precedence applies (output format and security always win). It supplies **no outline** and **no writer prose**.

**A.10.2 Phase 3 — writer resource (`sdlc-<artifact>/write.md`) — `HOW`, never `WHAT`.** Supplies per-section **writing discipline** (tone, citation strictness, "do not invent requirement IDs / API names / DB fields", abstention expectations) appended to the writer's brief for sections of that artifact. Because the outline and headings are already locked from `# Output format` before any writer runs, this guidance can only shape the *body* of an existing section — it cannot introduce structure. The writer remains bound, in priority order, by: the **agent instruction** → the resolved **`# Output format`** → then the **writer guidance**. In agent mode the agent's `## Skill` block already carries this discipline and wins; `write.md` then only fills gaps (it is primarily the chat-mode source). If guidance ever conflicts with the output format (e.g. it implies an extra section), the output format wins and the guidance is dropped for that section.

**How the orchestrator loads the writer resource (Phase 3):** the resolved `write.md` guidance block is treated like the agent persona preamble — an opaque guidance string concatenated into the SECTION BRIEF (§9.3 user-message composition), after the persona and before the sources. It is subject to the same forbidden-content scan (§8) as everything else, so any structural content it accidentally introduces is stripped in Phase 4. Phase 1 (deterministic parsing) and Phase 4 (deterministic checks plus one artifact-agnostic coverage call) do **not** get per-artifact skills.

**Convention for each artifact skill (Anthropic-style folder):**

- **One folder per artifact** under `plans/skills/sdlc-<artifact>/`, containing `SKILL.md` (entry point), `plan.md` (Phase-2 resource), and `write.md` (Phase-3 resource), for each of `use-case`, `srs`, `basic-design`, `detail-design`, `test-plan`, `test-case`, `test-spec`, `rtm`, plus the A.8b `artifact-review` folder and the A.8c `traceability` folder — **10 folders, 32 files**. The reviewer's `write.md` carries the dual-grounding discipline (cite artifact AND reference; never assert pass/gap without evidence); its `plan.md` seeds `review_validate`, the artifact/reference sub-query split (`subQueries` vs `referenceQueries`), and the strict-citation `acceptanceCriteria`. The A.8c `traceability` folder adds two on-demand methodology reference files (`references/waterfall.md`, `references/agile.md`) — hence 5 files in that one folder — loaded only for the methodology a request uses; its `plan.md`/`write.md` carry bi-directional, no-invented-link discipline ("NOT TRACED" rather than inferred coverage).
- **`SKILL.md`** is the only triggerable entry point: YAML frontmatter (`name`, `description`) + body covering artifact identity, when it applies, the **chat-primary / agent-fallback mode rule**, and the structural invariants. `plan.md` and `write.md` are referenced resources loaded by their phase, not independently triggered.
- Every **`plan.md`** carries an `acceptanceCriteria` seeds block (§9.2 step 10, §A.10.1) and positions itself as the artifact-level counterpart to the per-agent `agentPlanningHints` (§4.6); every **`write.md`** carries body-only discipline (no-invented-IDs, citation strictness, abstention) appended to the writer brief (§9.3).
- **No outline / no numbered section list in any of the three files** — structure belongs to `# Output format`.

**Coverage:** skill folders exist for all eight templates A.1–A.8, the A.8b Artifact Reviewer, **and** the A.8c end-to-end Traceability builder (10 folders, 32 files). Adding a future artifact means creating one new `sdlc-<artifact>/` folder with its three files (plus on-demand reference files where a methodology/variant split helps, as in A.8c); no orchestrator code changes, and the output-format binding is unaffected.

**A.10.3 Skill loading & token budget (progressive disclosure) [merged-in].**

Skills MUST load by **progressive disclosure**, never eagerly. With 10 artifact skills, concatenating skill bodies into a prompt would multiply the per-phase token budget and break it; the contract below keeps the cost near-zero on requests that don't need a skill and bounded when one does. These are acceptance criteria, not advice.

1. **Selection is metadata-only.** To decide *which* artifact skill applies, the orchestrator reads ONLY each `SKILL.md`'s `name` + `description` (the always-resident catalog: a few dozen tokens per skill, a few hundred total for all 10). A skill **body is never loaded to determine relevance** — only after a skill is selected. The `SKILL.md` prose body itself is a human/selection front door and is **never injected into any LLM call**. (The A.8c traceability skill's `references/waterfall.md` / `references/agile.md` are likewise never read for selection — they load only after selection, and only for the methodology in play.)
2. **At most one artifact skill per request.** Selection yields zero or one artifact skill. Tie-break deterministically (best description match; if still tied, do not load any and let `agentPlanningHints`/the bare planner handle it — never load two). The 9 unselected skills' `plan.md`/`write.md` never enter any prompt. (sdlc-rtm and sdlc-traceability are deliberately disjoint in their descriptions — a plain coverage-matrix request resolves to rtm, an end-to-end bi-directional trace to traceability — so the selector does not tie between them.)
3. **Load only the current phase's file.** The selected skill's `plan.md` is loaded **only in Phase 2**; its `write.md` **only in Phase 3** — never both in the same call. Each phase pays for ~half the skill at most.
4. **Distill once, carry the distillate.** Phase 2 folds `plan.md`'s hints into the structured plan (per-section `acceptanceCriteria`, retrieval/risk metadata). Phase 3 writers then carry the **short per-section `acceptanceCriteria` and the `write.md` guidance slice for that section's artifact only** — not the whole skill, not the plan skill. The distilled criteria are what cross the phase boundary, not the source files.
5. **Agent-mode skip.** When the request is agent mode and the agent instruction already covers the artifact (its `## Skill` block + `agentPlanningHints`), the skill body is a fallback and **may be skipped entirely** — load it only to fill discipline the instruction did not state (§A.10 mode rule). The common agent-mode path loads **no skill body at all**.
6. **Budget slots (binding).** The loaded slice MUST fit the existing per-phase budgets: in Phase 2 the `plan.md`-derived hints count against the planner's **≤3k input** (§5) — distilled, not pasted whole; in Phase 3 the `write.md` guidance slice occupies the **"writer-guidance slice" line of the per-section token table (§6)** (≤~250 tokens), inside the ~6–8k per-section assembly. If a skill file is larger than its slot, the orchestrator loads a truncated/relevant slice — it never overflows the budget to fit a skill.

**Net effect:** a request that needs no artifact skill pays only the tiny metadata-catalog scan; a request that needs one pays for one phase-file slice at a time, distilled to fit. Adding more artifact skills grows the metadata catalog linearly (cheap) but never the per-call prompt size (one skill max).

---

## Appendix B — Comparison of the two research outputs and merge decisions

**Convergence (both reports independently recommended):** moving retrieval + reranking from global phases into per-section generation; reusing one orchestrator for both modes via a normalization layer instead of a second pipeline; making the outliner conditional/eliminating it as a standalone gate; an evidence-sufficiency check before generation with bounded (not free-form ReAct) retries; citation binding during generation with strict no-invented-citation rules; a validation-only final phase; and never auto-adding title/TOC/references or any unrequested content.

**Backbone — `claude-generative-orchestrator-v2-research-spec.md`.** Chosen as the base because it is directly executable by a coding agent: concrete data contracts and JSON schemas, hard token and latency budgets for a 16k local model, an LLM-call budget analysis, deterministic-first design (deterministic outline derivation, deterministic citation validation, deterministic assembly), production-ready prompts with schemas/temperatures/examples, a consolidated acceptance-criteria checklist, rejected-alternatives records for every decision, and a full appendix of eight SDLC agent templates that double as integration fixtures.

**Adopted from `gpt-search-agent.md` (its unique strengths):** the explicit precedence chain including the agent-skill level and the non-overridable security rules (tenant filter, KB ACLs, system safety) plus agent override locks (§4.1); requirement-heading detection and classification feeding planning and coverage audit (§4.4, §9.6); domain-risk escalation for healthcare/legal/compliance/finance/security with stricter sufficiency judgment and forced citation/assumption policy (§5, §7, §9.4); per-section evidence-policy fields, notably `assumptionsAllowed` (§3.2); the heuristic-first option for the sufficiency gate (§7); retrieval/rerank caching and job-state persistence/resume plus section streaming (§6, §10); the generation-pattern catalog as planner fixtures (§5.1); the full forbidden auto-content list (§8); and the writer-prompt rules against invented requirement IDs / API names / screen names / DB fields / workflow names / medical facts, and against printing internal notes or AI self-reference (§9.3).

**Deliberately not carried over from the GPT report:** its separate Intent-&-Requirement-Analyzer, standalone Conditional Outliner, per-section Evidence Planner, LLM Section Validator, LLM Output Assembler, and LLM Final Validator as distinct LLM calls — under the 16k/1–3-minute constraints these add sequential gates for little gain; each responsibility is preserved but realized deterministically or folded into an existing call, as traced in §9.8.
