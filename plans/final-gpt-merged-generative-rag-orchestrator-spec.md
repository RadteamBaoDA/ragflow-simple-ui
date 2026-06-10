# Final Merged Report: Generative RAG Orchestrator v2 Specification

**Purpose:** This document merges the strongest ideas from the two researcher outputs into one final specification for **ChatGPT Codex Plan Mode**.  
**Scope:** Architecture, behavior contracts, data contracts, prompts, acceptance criteria, and implementation-planning guidance only.  
**Important:** This document intentionally contains **no implementation code**. Schema-like examples and prompt templates are included only as contracts for the coding agent.

---

## 0. Executive Decision

### Recommended base report

Use **Researcher B: `claude-generative-orchestrator-v2-research-spec.md` as the primary base**, because it is more implementation-ready and gives stronger engineering constraints:

- clearer 4-phase target pipeline
- concrete data contracts
- bounded latency/token budgets for local LLMs
- direct reuse of existing retriever/reranker functions
- deterministic citation validation
- global citation registry
- acceptance criteria and implementation order
- production-ready prompt templates

### Important additions kept from Researcher A

Merge in the strongest ideas from **Researcher A: `gpt-search-agent.md`**, especially:

- broader requirement-heading detection
- stronger domain-sensitive generation rules
- richer smart-planner responsibilities
- clearer architecture component breakdown
- explicit cost/quality/performance optimization guidelines
- stricter final-output rule: final answer must contain only what `# Output format` requests

### Final architecture decision

The final merged solution should use:

```txt
Phase 1: Input Normalizer
Phase 2: Planner + Conditional Outline Metadata
Phase 3: Parallel Section-Level RAG Pipeline
Phase 4: Validate-Only Final Phase
```

The final design **does not keep a standalone outliner LLM call**. The “conditional outliner” concept is kept, but it becomes deterministic outline extraction plus metadata assignment inside the single planner call.

---

## 1. Researcher Comparison

| Area | Researcher A: `gpt-search-agent.md` | Researcher B: `claude-generative-orchestrator-v2-research-spec.md` | Final merged decision |
|---|---|---|---|
| Overall architecture | Strong conceptual architecture with Input Normalizer, Analyzer, Planner, Conditional Outliner, Section Writer, Validator | Strong production architecture with 4 logical phases and removed legacy phases | Use Researcher B as backbone; preserve Researcher A components as logical responsibilities inside phases |
| Agent Standard reuse | Correctly recommends reusing the existing orchestrator with a normalization/policy layer | Stronger: all mode differences live in the normalizer; downstream pipeline stays shared | Adopt Researcher B’s cleaner reuse model |
| Input precedence | Gives global priority order but may make user headers too weak under agent instruction | Gives field-level precedence and clear user override behavior for output format | Use field-level precedence with security/policy locks |
| Planner | Broad and flexible; supports many SDLC and domain cases | More concrete taxonomy with 7 task types and 3 retrieval modes | Merge both: keep taxonomy, add broader use-case support and requirement-heading awareness |
| Outliner | Conditional standalone outliner | Remove standalone outliner; merge into planner for latency and format safety | Use Researcher B: no standalone outliner LLM call |
| Retrieval/reranking | Correctly moves retrieval/reranking into section writer | Stronger: parallel per-section pipeline, direct existing retriever/reranker reuse, topK guidance | Adopt Researcher B and keep Researcher A’s section evidence policy |
| Evidence sufficiency | Good conceptual evidence policy | Strong bounded CRAG-style loop with retry cap and sentinel output | Adopt Researcher B’s bounded loop |
| Citation | Section-aware citations, no automatic References | Stronger: global registry, deterministic validation, invalid citation stripping | Adopt Researcher B, keep Researcher A’s final-output constraints |
| Anti-hallucination | Lightweight loop, ReAct only when necessary | Stronger hard caps: 2 retrieval rounds, 1 generation, optional NLI gate | Adopt Researcher B |
| Final phase | Validate-only, no extra sections | Stronger targeted regeneration, no rewrite of passing sections | Adopt Researcher B |
| Prompts | Broad phase prompt samples | Production-ready prompts per actual LLM call | Use Researcher B prompts, add missing normalizer/analyzer requirements from A |
| Acceptance criteria | Good implementation-planning request | Strong checklist and performance constraints | Adopt Researcher B and expand with heading detection/domain rules |

---

## 2. Goals and Binding Constraints

| Goal | Final requirement |
|---|---|
| Cost efficiency | Skip unnecessary retrieval, outliner calls, final rewrites, and repeated LLM judging. Prefer deterministic logic where reliable. |
| Quality | Use section-specific retrieval, evidence sufficiency checks, section-level validation, and strict output-format preservation. |
| Performance | Support long-form generation interactively through bounded parallelism, not unbounded agent loops. |
| Accuracy | Ground factual sections in retrieved chunks; do not invent requirement IDs, APIs, fields, workflows, clinical facts, or business rules. |
| Citation reliability | Assign stable citation numbers before generation and validate them deterministically after generation. |
| Reuse | Chat Generative Mode and Agent Standard Mode must use the same orchestrator after normalization. |
| Format compliance | The final output shown to the user must contain only what `# Output format` asks for. |
| Local model constraint | Optimize for a local model with approximately 16k effective context. Per-call assembled context should stay below about 10k–11k tokens. |
| Latency target | Interactive long-generation tasks should generally complete within 1–3 minutes when using bounded concurrency and a local 7B–14B model. |
| Existing retrieval layer | Existing custom retriever/reranker functions must be reused directly. Do not reimplement retrieval/reranking internals. |

---

## 3. Supported Modes

## 3.1 Chat Generative Mode

The user input must contain these Markdown headers:

```md
# User profiles

# Task

# Context

# Keyword

# Output format
```

Required interpretation:

| Header | Meaning |
|---|---|
| `# User profiles` | Audience, tone, user role, expected expertise level |
| `# Task` | Main generation goal |
| `# Context` | User-provided source context and disambiguation |
| `# Keyword` | Retrieval/domain hints |
| `# Output format` | Strict final output contract |

Hard rules:

- `# Task` is required.
- `# Output format` is required.
- Missing `# Task` or `# Output format` must fail before any LLM call.
- The final answer must not include sections outside `# Output format` unless explicitly requested.

---

## 3.2 Agent Standard Mode

The agent has predefined instruction. The user may provide:

- freestyle natural language
- partial Markdown headers
- full Markdown headers

Supported optional user headers:

```md
# Task

# Context

# Keyword

# Output format
```

Agent instruction may contain:

- role
- skill
- default user profile
- default context
- default keyword
- default output format
- retrieval policy
- citation policy
- domain rules
- quality rules
- safety or tenant constraints

Hard rule:

> Agent Standard Mode must not create a separate orchestration pipeline. It must use the same pipeline after the input normalizer creates a canonical request.

---

## 4. Final Target Pipeline

## 4.1 Retired legacy pipeline

The previous pipeline pattern should be retired:

```txt
Parser
→ Planner
→ Global Retriever
→ Global Reranker
→ Outliner
→ Section Writer
→ Stitch / Validate / Refine
```

Problems:

- Global retrieval gives generic chunks that are not specific enough for each section.
- Standalone outliner adds latency and can invent sections.
- Final stitch/refine may add unrequested title, TOC, references, notes, or rewrite grounded claims.
- No strong evidence sufficiency gate before generation.
- No clean Agent Standard input handling.

---

## 4.2 Final pipeline

```txt
PHASE 1 — INPUT NORMALIZER
  Deterministic header parsing
  Field-level precedence merge
  Requirement-heading detection
  Optional small extraction call only for agent freestyle prompt
  Output: Canonical Request

PHASE 2 — PLANNER + CONDITIONAL OUTLINE METADATA
  Exactly one LLM call
  Task classification
  Section plan
  Section retrieval mode
  Section evidence policy
  Section citation policy
  Section sub-queries
  If output format is strict, headings are derived deterministically before the LLM

PHASE 3 — PARALLEL SECTION-LEVEL RAG PIPELINE
  For each section:
    Retrieval required?
    Section-level retrieval
    Section-level reranking
    Evidence sufficiency check
    One corrective query rewrite if needed
    Grounded / reference-inspired / pure generation
    Citation binding
    Deterministic citation validation
    Optional faithfulness gate
  Bounded concurrency

PHASE 4 — VALIDATE-ONLY FINAL PHASE
  Assemble sections
  Validate heading structure
  Validate citations
  Run small task-coverage check
  Regenerate only failing sections, maximum one repair round
  Do not rewrite passing sections
  Do not add title, TOC, references, appendix, validation notes, or internal metadata
```

---

## 5. Architecture Components

These are logical components. The coding agent should map them to the existing codebase modules after inspection.

| Component | Responsibility |
|---|---|
| Input Normalizer | Parse headers, merge agent/user input, detect requirement-like headings, produce canonical request |
| Header Parser | Deterministically parse Markdown headers and tolerate case/singular/plural variants |
| Output Format Parser | Derive fixed headings from `# Output format` when provided |
| Requirement Heading Classifier | Classify custom headings as requirement, constraint, acceptance criteria, output format, quality rule, retrieval hint, etc. |
| Planner | One LLM call to classify task and assign section metadata |
| Section Executor | Runs section pipelines with dependency and concurrency control |
| Retriever Adapter | Thin adapter to existing custom retriever function |
| Reranker Adapter | Thin adapter to existing custom reranker function |
| Evidence Evaluator | Determines whether retrieved chunks are sufficient for a section |
| Query Rewriter | Produces one corrective retrieval attempt when evidence is insufficient |
| Chunk Registry | Deduplicates chunks and assigns stable global citation numbers |
| Section Writer | Generates only one section using one of three modes |
| Citation Validator | Strips invalid citations and flags citation failures |
| Faithfulness Gate | Optional NLI/cross-encoder check for grounded sections |
| Output Assembler | Concatenates sections in exact planned order without creating new content |
| Final Validator | Structure check, citation check, small task-coverage check, targeted repair |
| Observability Layer | Logs phase duration, token usage, retrieval counts, retries, flags |
| Config Surface | Concurrency, topK, max sections, NLI flag, coverage flag, token limits |

---

## 6. Canonical Request Contract

The Input Normalizer must emit one canonical request. Downstream phases should not branch on chat vs agent mode except for writer persona injection.

| Field | Type | Rules |
|---|---|---|
| `mode` | `chat` or `agent` | Set by route or presence of agent instruction |
| `userProfile` | string | Always resolved |
| `task` | string | Required and non-empty |
| `context` | string | May be empty; agent baseline and user context are merged when applicable |
| `keyword` | string array | Deduplicated union of agent and user keywords |
| `outputFormat` | string | Raw output-format body; empty only allowed in Agent Standard Mode when agent default is also empty |
| `outputFormatSource` | `user`, `agent`, or `default` | For auditability |
| `outputFormatConflict` | boolean | True when user and agent both provided different formats |
| `agentInstruction` | string or absent | Raw persona/skill text for writer only |
| `agentPolicy` | object or absent | Contains output override policy, retrieval policy, citation policy, security locks |
| `detectedHeadings` | array | Custom requirement-like headings extracted from user and agent text |
| `rawUserPrompt` | string | Preserved for traceability |

---

## 7. Field-Level Precedence Rules

## 7.1 Global non-overridable rules

These always win:

```txt
System safety rules
> Application security rules
> Tenant / KB access filters
> Knowledge-base security policy
> Agent immutable policy locks
```

A user prompt must never override:

- tenant filter
- knowledge-base access rules
- system safety rules
- protected agent policy
- disallowed output/citation/retrieval behavior

## 7.2 Field precedence

| Field | Chat Generative Mode | Agent Standard Mode |
|---|---|---|
| User profiles | Required from user | From agent instruction by default; user cannot override unless agent policy explicitly allows it |
| Task | Required from user | From user prompt; headers preferred over freestyle extraction |
| Context | User context | Agent baseline first, then user context |
| Keyword | User keywords | Union of agent keywords and user keywords, deduplicated |
| Output format | Required from user | User overrides agent default unless agent policy locks output format |
| Retrieval policy | Application default plus user keyword hints | Agent policy plus planner section policy; user may hint but not override security |
| Citation policy | Application default | Agent/default citation policy plus section mode; grounded sections must cite |

Final recommended rule for output format:

> In Agent Standard Mode, the user’s `# Output format` should override the agent’s default format by default, but only if the agent policy allows output-format override. When overridden, set `outputFormatConflict=true`.

---

## 8. Requirement Heading Detection

The normalizer must detect not only the canonical headers but also custom requirement-like headings.

Examples:

```md
# Requirement
## Functional Requirement
## Non-functional Requirement
## Screen Requirement
## API Requirement
## Constraint
## Acceptance Criteria
## Business Rule
## Glossary
## Assumption
## Open Question
```

Each detected heading should be classified as one of:

| Classification | Purpose |
|---|---|
| `task` | Additional task intent |
| `context` | Additional source context |
| `requirement` | Business/functional requirement |
| `constraint` | Technical/business limitation |
| `acceptance_criteria` | Validation target |
| `output_format` | Requested output shape |
| `domain_rule` | Domain-specific rule |
| `quality_rule` | Quality or style requirement |
| `retrieval_hint` | Keyword/source hint |
| `unknown` | Preserve for planner but do not assume meaning |

The planner must use detected headings to improve:

- section planning
- retrieval query construction
- requirement coverage mapping
- citation policy
- validation
- gap/open-question generation

---

## 9. Planner Contract

## 9.1 Planner goals

The planner must decide:

- task type
- target document type
- domain
- generation pattern
- output sections
- per-section retrieval mode
- per-section evidence requirement
- per-section citation requirement
- per-section query plan
- dependencies between sections
- validation requirements
- hallucination risk

## 9.2 Task taxonomy

Every request should be classified into exactly one dominant task type:

| Task type | Meaning | Default retrieval mode |
|---|---|---|
| `qa_with_citations` | Answer factual question from KB/source chunks | `grounded_strict` |
| `summarize_single` | Summarize one source/document | `grounded_strict` |
| `synthesize_multi` | Combine multiple sources/documents | `grounded_strict` |
| `compare_analyze` | Compare, critique, or analyze multiple sources | `grounded_strict` |
| `transform_derive` | Derive new artifact from source facts, e.g. requirements to test cases | `grounded_strict` |
| `reference_inspired` | Use old docs as style/structure examples for new artifact | `reference_inspired` |
| `pure_generation` | No retrieval needed | `none` |

## 9.3 Retrieval modes

| Retrieval mode | Writer behavior | Citation behavior |
|---|---|---|
| `grounded_strict` | Use only retrieved chunks and user context. Abstain when evidence is insufficient. | Inline citations required |
| `reference_inspired` | Use retrieved chunks as style/structure examples. New specifics may be invented if consistent with task. | No citations in final output |
| `none` | Generate from task/context/profile only. | No citations |

A single document may mix retrieval modes section by section.

Example:

- Use case overview and business rules may be `grounded_strict`.
- Main flow for a new feature may be `reference_inspired`.
- Open questions may be `none` or `grounded_strict` depending on whether they list missing evidence.

## 9.4 Planner output contract

The plan must include:

| Field | Rules |
|---|---|
| `detectedTask` | One of the task taxonomy values |
| `overallRationale` | Short internal rationale, not user-facing |
| `outputFormatSummary` | One-line format summary |
| `outlineSource` | `derived_from_output_format` or `proposed_by_llm` |
| `sections` | 1–10 sections |
| `sectionId` | Stable ID such as `s1`, `s2` |
| `heading` | Exact final heading |
| `rationale` | Short section purpose |
| `taskHint` | Section-level task type |
| `retrievalMode` | `grounded_strict`, `reference_inspired`, or `none` |
| `mustCite` | true/false |
| `minCitations` | 0–5 |
| `subQueries` | 0–3 section-specific queries |
| `targetTokens` | 80–1200 |
| `dependsOn` | Other section IDs only when strictly necessary |

Validation rules:

- If `# Output format` contains parseable headings/list items, section headings must be derived deterministically before the planner call.
- The planner must not add title, TOC, references, conclusion, appendix, or notes unless the user requested them.
- If the LLM returns renamed or reordered headings, the orchestrator must force-restore the deterministic heading list.
- Planner uses exactly one LLM call with schema/grammar-constrained output and one retry on schema failure.
- Planner must not see retrieved chunks.
- Planner input should be kept under about 3k tokens and output under about 1.5k tokens.

---

## 10. Output Format Handling

## 10.1 When `# Output format` is strict

If the output format defines headings, numbered sections, bullet sections, or a table structure:

- derive the final outline deterministically
- preserve heading text
- preserve order
- preserve count
- do not add unrequested sections
- planner may only attach metadata to those sections

## 10.2 When `# Output format` is empty or ambiguous

Only in allowed Agent Standard cases:

- planner may propose a minimal 3–7 section structure
- no title, TOC, references, appendix, or conclusion unless required by the task or agent format
- proposed structure must be practical for the target artifact

## 10.3 Output assembler rule

The assembler is not a writer. It may only:

- concatenate validated sections
- preserve heading order
- normalize Markdown spacing
- remove internal metadata
- keep inline citations when required

It must not:

- invent content
- improve wording
- add new headings
- add references/source list
- add validation notes
- add a title

---

## 11. Section-Level Retrieval and Reranking

## 11.1 Why retrieval must be per section

Global retrieval is not optimal because different sections need different evidence. Some sections may require:

- no retrieval
- user context only
- old examples as style references
- exact source facts
- API/schema evidence
- workflow evidence
- business rules
- healthcare/domain-specific evidence
- compliance/security constraints

Therefore:

> Retrieval and reranking must be folded into the section-generation phase.

## 11.2 Section pipeline

For each section:

```txt
Read section plan
→ Decide if retrieval is required
→ Build section-specific queries
→ Retrieve candidate chunks
→ Rerank candidates
→ Register chunks in global citation registry
→ Check evidence sufficiency
→ Rewrite query once if insufficient
→ Generate section
→ Validate citations
→ Optional faithfulness check
→ Return section result
```

## 11.3 Existing retriever/reranker reuse

The coding agent must inspect the codebase and find:

- custom retriever function
- custom reranker function
- their input/output signatures
- sync/async behavior
- where knowledge base IDs and tenant filters are applied

Hard rule:

> Do not reimplement retrieval or reranking. Use adapters only if existing shapes differ from the orchestration contract.

Recommended defaults:

| Parameter | Default |
|---|---|
| retrieve topK | 20 |
| rerank topK | 5 |
| section concurrency | 4 |
| max sections | 10 |
| max retrieval rounds per grounded section | 2 |
| max generation calls per section before repair | 1 |
| final repair rounds | 1 |

## 11.4 Header leverage for retrieval

| Source | Use |
|---|---|
| `# Keyword` | Merge into sparse/BM25 anchors for every retrieval section |
| `# Context` | Add short disambiguation slice to grounded section queries |
| custom requirement headings | Use as query anchors and coverage targets |
| agent instruction | Use for writer persona, not raw retrieval, unless it contains explicit keyword/context headers |
| user profile | Use for tone/depth, not retrieval |

---

## 12. Evidence Sufficiency and Anti-Hallucination Loop

## 12.1 Bounded loop

Use a bounded CRAG-style corrective loop, not free-form ReAct.

```txt
retrieve + rerank
→ sufficiency check
   → sufficient: write section
   → insufficient: rewrite query once
       → retrieve + rerank again
       → sufficiency check again
          → sufficient: write section
          → still insufficient:
              if grounded_strict:
                output sentinel and stop
              else:
                continue according to section mode
```

Sentinel:

```txt
Insufficient context in knowledge base for this section.
```

Rules:

- The sufficiency check is skipped for `reference_inspired` and `none` sections.
- If no chunks are retrieved for `grounded_strict`, mark insufficient without an LLM sufficiency call.
- Query rewrite produces only 1–2 alternative retrieval queries.
- Do not run unbounded ReAct loops.
- Honest abstention is preferred over unsupported generation.

## 12.2 Evidence sufficiency check

The check must answer:

- Are required facts covered?
- Are requirement headings covered?
- Is evidence relevant to this section?
- Are there missing facts?
- Are there conflicting chunks?
- Is query rewrite needed?
- Is generation safe?

Use deterministic heuristics first when possible. Use a small LLM judge when:

- section is high risk
- evidence is weak
- evidence conflicts
- domain is regulated
- validation previously failed

## 12.3 Sensitive-domain rules

For healthcare, legal, compliance, finance, security, regulated workflow, or operationally risky documents:

- increase hallucination risk level
- require stronger evidence
- prefer `grounded_strict`
- require citations when using KB chunks
- avoid unsupported medical/legal/financial/operational claims
- output assumptions only if requested by the output format
- use insufficiency sentinel rather than guessing

---

## 13. Citation Strategy

## 13.1 Citation assignment

A global chunk registry must assign stable citation numbers across all sections.

Rules:

- Deduplicate chunks by stable content hash or source/chunk ID.
- First registration assigns citation number `[N]`.
- Same chunk reused in another section keeps the same `[N]`.
- Registry must be concurrency-safe.
- The final citation registry is returned out-of-band for the UI source panel.
- Do not automatically print a references/source list unless requested.

## 13.2 Citation during generation

For `grounded_strict` sections:

- section writer receives only the chunks registered for that section
- each chunk is rendered as `Source [N]`
- writer must cite factual claims with provided `[N]`
- writer must not invent citation numbers
- citation is generated during writing, not inserted after writing

Post-hoc citation insertion is rejected because it increases cost and can misattribute claims.

## 13.3 Deterministic citation validation

After section generation:

- extract all `[N]` markers
- keep only citations that exist in the offered chunk set
- strip invalid citations such as `[99]`
- never remap invalid citation numbers
- clean spacing/punctuation after stripping
- if a `mustCite=true` section ends with zero valid citations, flag `no_citations`

## 13.4 Optional faithfulness gate

For grounded sections, optionally run a non-LLM faithfulness/NLI gate:

- premise: cited chunk text
- hypothesis: generated sentence with citation markers removed
- if no cited chunk entails the sentence above threshold, remove or flag the sentence
- if more than 50% of cited sentences fail, flag `low_faithfulness`
- keep this behind a config flag

---

## 14. Writer Modes

## 14.1 `grounded_strict`

Use for:

- factual QA
- summarization from KB
- multi-document synthesis
- requirements to test cases
- basic design to detail design
- SRS generation from change requests
- compliance/healthcare/legal/security sections

Rules:

- Use only provided user context and retrieved chunks.
- Every factual claim from KB must cite provided source numbers.
- Do not invent IDs, APIs, tables, fields, flows, dates, numbers, clinical facts, or business rules.
- If evidence is insufficient, output the insufficiency sentinel.
- Do not write section heading; assembler handles headings.

## 14.2 `reference_inspired`

Use for:

- “Create a new use case based on old similar use cases”
- “Follow the style/template of previous documents”
- “Generate new artifact using examples as structure reference”

Rules:

- Sources are exemplars, not facts.
- Mirror structure, granularity, and style.
- Do not cite.
- New specifics may be created if consistent with the user task.
- Do not copy blindly.

## 14.3 `none`

Use for:

- pure generation from user context
- open questions
- formatting-only sections
- generic non-factual guidance
- boilerplate allowed by agent policy

Rules:

- No retrieval.
- No citations.
- Stay within task and output format.
- Do not add disclaimers or extra headings.

---

## 15. Final Validate-Only Phase

## 15.1 Hard rules

The final phase must not:

- auto-generate a title
- auto-generate a table of contents
- auto-generate references/bibliography/source list
- add an appendix
- add validation notes
- add internal reasoning
- rewrite passing sections
- polish the whole document
- run a consistency rewrite that drifts cited claims away from sources

## 15.2 Validation checks

| Check | Mechanism | Failure behavior |
|---|---|---|
| Structure conformance | Deterministic heading/order/count check against parsed output format | Flag and regenerate offending section only |
| Citation integrity | Deterministic `[N]` registry lookup | Flag citation errors; do not invent fixes |
| Task coverage | One small LLM check using headings and first ~150 tokens per section | Regenerate named failing sections only |
| Placeholder/internal metadata | Deterministic string/regex checks | Flag and targeted repair |

## 15.3 Repair policy

- Regenerate only failing sections.
- Maximum one final repair round.
- Bump strictness for regenerated grounded sections:
  - `mustCite=true`
  - `minCitations + 1` within limit
  - stronger instruction against unsupported claims
- Passing sections must remain byte-identical.
- If coverage fails but no section can be identified, return with `needs_review` warning rather than rewriting everything.

---

## 16. Data Contracts

## 16.1 Section Plan

| Field | Meaning |
|---|---|
| `sectionId` | Stable section ID |
| `heading` | Exact output heading |
| `rationale` | Internal section purpose |
| `taskHint` | Section-level task category |
| `retrievalMode` | `grounded_strict`, `reference_inspired`, or `none` |
| `evidencePolicy` | Minimum evidence, max chunks, retry behavior, assumptions allowed |
| `mustCite` | Whether citations are mandatory |
| `minCitations` | Minimum valid citations if grounded |
| `subQueries` | Section-specific retrieval queries |
| `targetTokens` | Generation budget |
| `dependsOn` | Section IDs that must be written first |
| `validationRules` | Section-level checks |

## 16.2 Written Section

| Field | Meaning |
|---|---|
| `sectionId` | Copied from plan |
| `heading` | Copied from plan |
| `body` | Generated Markdown body only |
| `citations` | Citation number to use count |
| `chunksUsed` | Registered chunk references offered to writer |
| `flags` | `insufficient_context`, `no_citations`, `low_faithfulness`, etc. |
| `warnings` | Non-fatal section warnings |

## 16.3 Final Generation Result

| Field | Meaning |
|---|---|
| `markdown` | Final assembled Markdown shown to user |
| `canonicalRequest` | Normalized request for audit/debug |
| `plan` | Final plan |
| `sections` | Per-section records |
| `citationRegistry` | Out-of-band source map for UI |
| `warnings` | Structure/citation/coverage/repair warnings |
| `metrics` | Phase durations, token counts, retrieval counts, retries |

Warnings must not be printed inside the final user-facing generated document unless the user explicitly asks for diagnostics.

---

## 17. Token, Latency, and Performance Budgets

## 17.1 Per-section writer budget

| Slice | Target tokens |
|---|---:|
| Writer system prompt | ~700 |
| Request slice | ~300 |
| Current section plan only | ~200 |
| Dependency summaries | 0–600 |
| Top 5 reranked chunks | 2500–4000 |
| Output-format slice | 0–200 |
| Generation budget | 400–1200 |
| Safety headroom | ~1000 |
| Total | ~6000–8000, never above ~11000 |

## 17.2 LLM call budget

For a 6-section grounded document:

| Phase | Calls |
|---|---:|
| Input normalizer | 0 if headers present; 1 small call only for agent freestyle |
| Planner | 1 |
| Section sufficiency | 1 per grounded section, plus retry check only when needed |
| Section writer | 1 per section |
| Final coverage auditor | 1 small call |
| Final repair | only failing sections, max 1 round |

## 17.3 Concurrency

- Default section concurrency: 4
- Recommended range: 3–5
- Lower concurrency if local LLM server cannot handle parallel requests.
- `dependsOn` sections wait only for dependencies.
- Independent retrieval sub-queries may run concurrently.

---

## 18. Advanced System Prompt Templates

These prompts are production-oriented templates. The coding agent should store them as versioned prompt constants/templates and wire them to schema-constrained output where required.

---

## 18.1 Agent Freestyle Input Extraction Prompt

Use only when Agent Standard Mode user prompt contains no recognized headers.

```txt
You are an input-normalizer. Extract the user's request into JSON fields.

Rules:
- task: a single-sentence imperative restating what the user wants done.
- context: any situational background mentioned. Empty string if none.
- keyword: 0-8 salient retrieval terms. Empty list if none.
- output_format: any explicit format/length/style instruction. Empty string if none.

Return JSON only:
{
  "task": string,
  "context": string,
  "keyword": string[],
  "output_format": string
}
```

---

## 18.2 Planner Prompt

```txt
You are the planner for a retrieval-augmented writing system.

Your job is to produce a section-level JSON plan.

Inputs:
- user_profile
- task
- context
- keyword
- output_format
- detected requirement headings
- agent policy

You must:
1. Choose exactly one detectedTask:
   qa_with_citations, summarize_single, synthesize_multi,
   compare_analyze, transform_derive, reference_inspired, pure_generation.

2. If output_format is non-empty and fixed headings were supplied,
   preserve exactly those headings in the same order. Do not add, remove,
   rename, or reorder sections.

3. If output_format is empty and policy allows it, propose only the
   minimal useful structure.

4. For every section, decide:
   - section purpose
   - retrievalMode
   - mustCite
   - minCitations
   - evidence need
   - 0-3 subQueries
   - targetTokens
   - dependsOn

5. Use custom requirement headings to improve planning and coverage.

Hard rules:
- Do not generate final user content.
- Do not add unrequested title, TOC, references, appendix, or conclusion.
- Do not assume domain-specific facts.
- Planner never sees retrieved chunks.
- Output JSON only.
```

---

## 18.3 Grounded Section Writer Prompt

```txt
You are a grounded section writer.

You receive:
- user task
- reader profile
- section title
- section brief
- target length
- numbered sources: Source [N]

Hard rules:
1. Generate only the assigned section body.
2. Do not write the section title.
3. Use only information present in the sources and user context.
4. Every factual claim from sources must cite one or more provided [N].
5. Do not invent citation numbers.
6. Do not invent requirement IDs, API names, fields, database tables,
   workflows, dates, numbers, clinical facts, or business rules.
7. If sources are insufficient, output exactly:
   Insufficient context in knowledge base for this section.
8. Do not add references, validation notes, internal reasoning, or metadata.

Output:
Plain Markdown body only, approximately the target length.
```

---

## 18.4 Reference-Inspired Section Writer Prompt

```txt
You are writing one section using retrieved sources as style and structure exemplars.

Rules:
1. Sources are examples, not ground truth facts.
2. Mirror structure, tone, granularity, and naming style where useful.
3. New specifics may be created if consistent with the user's task.
4. Do not cite.
5. Do not copy blindly.
6. Generate only the section body.
7. Do not write the section title.
8. Do not add references, validation notes, or internal reasoning.
```

---

## 18.5 Pure Generation Section Writer Prompt

```txt
You are writing one section of a larger document.

Rules:
1. Follow the user task, reader profile, and section brief.
2. Use the provided user context.
3. Do not retrieve, cite, or mention sources.
4. Do not add headings unless the section brief requires them.
5. Do not pad, disclaim, or add unrelated content.
6. Generate only the section body.
```

---

## 18.6 Evidence Sufficiency Prompt

```txt
You are a retrieval evaluator.

Decide whether the provided sources are sufficient to write the requested section safely.

Sufficient means:
- key facts required by the section are present
- sources are relevant, not merely related
- required requirement headings are covered
- no critical conflict prevents generation

Return JSON only:
{
  "sufficient": boolean,
  "reason": "one sentence",
  "missing": "what is missing, or empty"
}
```

---

## 18.7 Query Rewrite Prompt

```txt
The retrieved sources are insufficient for the section.

Write 1-2 alternative retrieval queries that are more likely to find the missing information.

Rules:
- Use different vocabulary from the original query.
- Broaden or narrow scope as needed.
- Do not repeat the original queries.
- Return JSON only:
{
  "queries": ["...", "..."]
}
```

---

## 18.8 Final Coverage Auditor Prompt

```txt
You are a coverage auditor.

Decide whether the produced sections address the user's task and requested output format.

You see:
- user task
- requested output format summary
- section IDs
- headings
- first opening lines of each section

Judge coverage only, not writing style.

Do not penalize sections that honestly say:
"Insufficient context in knowledge base for this section."
Instead, list what they were supposed to cover.

Return JSON only:
{
  "coversTask": boolean,
  "missingAspects": string[],
  "sectionsToRegenerate": string[]
}
```

---

## 19. Agent Standard Templates

These are recommended predefined agent instructions. They are not implementation code. Store them in agent records and let the normalizer parse their headers.

---

## 19.1 Use Case Writer Agent

```md
You are a senior business analyst who writes UML-style use case specifications.
When existing use cases are retrieved as exemplars, mirror their numbering style,
granularity, and voice. Invent new scenario specifics only for genuinely new
functionality and keep actors, business rules, and preconditions consistent with sources.

## Skill
- Derive actors and goals from requirements or change requests.
- Write main flows as numbered actor-system step pairs.
- Enumerate alternative and exception flows with branch points.
- Keep one use case per user goal.

# User profiles
Business analysts, product owners, and developers.

# Context
Use cases follow the project's standard template. IDs use UC-<MODULE>-<NN>.
Business rules use BR-<NN>.

# Keyword
use case, actor, precondition, postcondition, main flow, alternative flow, exception flow, business rule

# Output format
1. Use Case Overview
2. Preconditions
3. Postconditions
4. Main Flow
5. Alternative Flows
6. Exception Flows
7. Business Rules and Constraints
8. Open Questions
```

---

## 19.2 SRS Writer Agent

```md
You are a requirements engineer producing IEEE 29148-style SRS documents.
Every functional requirement is atomic and testable. Never invent requirements
with no source basis; mark unstated needs as assumptions only when the format allows it.

## Skill
- Convert business requirements and change requests into "shall" requirements.
- Separate functional and non-functional requirements.
- Flag conflicts and duplicates explicitly.

# User profiles
Development team, QA engineers, and project stakeholders.

# Context
Requirement IDs continue existing numbering in the knowledge base. Each requirement must be traceable.

# Keyword
requirement, shall, functional requirement, non-functional requirement, constraint, assumption, acceptance criteria

# Output format
1. Purpose and Scope
2. Definitions and Abbreviations
3. Functional Requirements
4. Non-Functional Requirements
5. Constraints and Assumptions
6. Acceptance Criteria
```

---

## 19.3 Basic Design Writer Agent

```md
You are a software architect writing Basic Design / High-Level Design documents.
Designs must satisfy referenced requirements and follow retrieved architecture standards.

## Skill
- Decompose the system into components/modules.
- Describe data flow and control flow.
- Produce requirement-to-component traceability.
- State design decisions and alternatives.

# User profiles
Developers and reviewers deriving detail design and implementation.

# Context
Approved architecture standards and existing HLDs are in the knowledge base.

# Keyword
architecture, component, module, interface, data flow, sequence, traceability, design decision

# Output format
1. Design Overview and Goals
2. System Architecture
3. Interface Definitions
4. Data Design
5. Process and Data Flow
6. Requirement Traceability
7. Design Decisions and Alternatives
```

---

## 19.4 Detail Design Writer Agent

```md
You are a senior developer writing Detail Design / Low-Level Design documents.
Every class, function, table, and API must be consistent with Basic Design and retrieved schemas.
Never invent fields, endpoints, or tables that contradict sources.

## Skill
- Specify module internals.
- Define APIs and DB changes.
- Describe processing logic.
- Cover error handling, logging, and edge cases.

# User profiles
Implementing developers and code reviewers.

# Context
Naming conventions, layer structure, and existing database schema are in the knowledge base.

# Keyword
class design, sequence, API specification, database schema, pseudocode, error handling, validation

# Output format
1. Scope and Referenced Basic Design Items
2. Module Structure
3. Class and Function Specifications
4. API Specifications
5. Database Design and Migrations
6. Processing Logic
7. Error Handling and Logging
```

---

## 19.5 Test Plan Writer Agent

```md
You are a QA lead writing test plans aligned with standard QA practice.
Scope, items, and features under test must come from retrieved SRS/design documents.

## Skill
- Derive test scope from SRS feature list.
- Choose test levels and types based on risk.
- Define entry/exit criteria and deliverables.
- Identify risks and mitigations.

# User profiles
QA engineers, project managers, and release stakeholders.

# Context
Test policy, environment catalog, and defect severity definitions are in the knowledge base.

# Keyword
test plan, scope, test level, entry criteria, exit criteria, risk, test environment, schedule

# Output format
1. Test Plan Overview
2. Scope
3. Test Approach and Levels
4. Entry and Exit Criteria
5. Test Environment and Tools
6. Roles, Responsibilities, and Schedule
7. Risks and Mitigations
```

---

## 19.6 Test Case Writer Agent

```md
You are a QA engineer who converts requirements, use cases, and detail designs into executable test cases.
Every test case must trace to a specific requirement or flow.

## Skill
- Create atomic, independently executable test cases.
- Write numbered steps with concrete test data.
- Cover positive, negative, and boundary scenarios.
- Put vague requirements under "Untestable / Needs Clarification."

# User profiles
Manual testers and automation engineers.

# Context
Test case IDs use TC-<MODULE>-<NNN> and continue existing numbering.

# Keyword
test case, test step, expected result, precondition, test data, boundary value, equivalence partition, negative test

# Output format
1. Test Case Summary Table
2. Detailed Test Cases
3. Negative and Boundary Cases
4. Untestable Items / Needs Clarification
```

---

## 19.7 Test Specification Writer Agent

```md
You are a senior QA engineer writing test specifications that make test cases executable in a concrete environment.

## Skill
- Define exact procedures, data sets, and environment configuration.
- Specify result-recording instructions.
- Map specifications to test cases and requirements.
- Avoid inventing environment details not found in source documents.

# User profiles
QA engineers, automation engineers, and release reviewers.

# Context
Environment, tools, datasets, and execution policies are in the knowledge base.

# Keyword
test specification, test procedure, test data, environment, execution, expected result, requirement mapping

# Output format
1. Test Specification Overview
2. Referenced Requirements and Test Cases
3. Test Environment
4. Test Data
5. Test Procedures
6. Result Recording and Evidence
7. Execution Risks and Notes
```

---

## 19.8 RTM Builder Agent

```md
You are a requirements traceability analyst building a traceability matrix.
Never invent trace links. If a source requirement has no matching test/design item, mark it as uncovered.

## Skill
- Map requirements to design elements and test cases.
- Identify uncovered requirements.
- Identify orphan tests/design elements.
- Preserve IDs exactly as written in sources.

# User profiles
QA leads, project managers, auditors, and development leads.

# Context
Requirement, design, and test IDs must be preserved from retrieved documents.

# Keyword
traceability matrix, requirement ID, test case ID, design ID, coverage, uncovered, orphan

# Output format
1. Traceability Matrix
2. Uncovered Requirements
3. Orphan Test Cases or Design Items
4. Coverage Summary
5. Open Issues
```

---

## 20. Cost Optimization Guidelines

- Skip retrieval when user context is enough.
- Skip retrieval for `none` sections.
- Skip sufficiency checks for `reference_inspired` and `none`.
- Use exactly one planner call.
- Do not use a standalone outliner LLM call.
- Do not use post-hoc citation insertion.
- Avoid final full-document rewrite.
- Use deterministic structure and citation checks.
- Cache retrieval results by query + KB + filters.
- Cache rerank results by query + candidate chunk IDs.
- Limit retrieval rounds to 2.
- Limit final repair to 1 round.
- Run independent sections concurrently under a configurable limit.

---

## 21. Quality Optimization Guidelines

- Preserve user `# Output format` exactly.
- Use section-specific retrieval.
- Check evidence before grounded generation.
- Use requirement-heading detection to improve coverage.
- Use stable citation numbers during generation.
- Validate citations deterministically.
- Use targeted repair instead of global rewrite.
- Prevent unsupported assumptions.
- For regulated domains, require stronger evidence and cite every factual claim.
- Return insufficiency rather than hallucinating.

---

## 22. Performance Optimization Guidelines

- Merge planner and outline metadata into one LLM call.
- Run section retrieval and generation concurrently.
- Use dependency scheduling only when required.
- Keep top reranked chunks small enough to avoid lost-in-the-middle.
- Prefer top 5 reranked chunks per section.
- Use anti-lost-in-the-middle source ordering.
- Stream completed sections when frontend supports it.
- Store intermediate job state for retry/resume.
- Log duration and token counts per phase.

---

## 23. Observability and Configuration

## 23.1 Required logs

At each phase boundary log:

- request ID
- mode
- phase name
- duration
- token input/output
- retrieval count
- rerank count
- number of chunks used
- retries
- section flags
- final warnings

Do not log sensitive source text unless allowed by the application security policy.

## 23.2 Config surface

| Config | Default |
|---|---:|
| `sectionConcurrency` | 4 |
| `retrieveTopK` | 20 |
| `rerankTopK` | 5 |
| `maxSections` | 10 |
| `maxRetrievalRounds` | 2 |
| `maxFinalRepairRounds` | 1 |
| `nliFaithfulnessEnabled` | optional / false initially if infra not ready |
| `coverageAuditorEnabled` | true |
| `maxWriterInputTokens` | 11000 |
| `plannerInputTokenBudget` | 3000 |
| `plannerOutputTokenBudget` | 1500 |

---

## 24. Acceptance Criteria

## 24.1 Phase 1 — Input Normalizer

- [ ] Chat prompt with all 5 required headers produces canonical request with zero LLM calls.
- [ ] Chat prompt missing `# Task` or `# Output format` fails before any LLM call.
- [ ] Agent headered prompt respects field-level precedence.
- [ ] Agent freestyle prompt triggers exactly one small extraction call.
- [ ] Header matching tolerates case and singular/plural variants.
- [ ] User/agent output-format conflict records `outputFormatConflict=true`.
- [ ] Tenant/KB/security rules cannot be overridden.
- [ ] Requirement-like headings are detected and classified.

## 24.2 Phase 2 — Planner

- [ ] Exactly one planner LLM call.
- [ ] Schema/grammar-constrained output is used where supported.
- [ ] One retry is allowed after schema validation failure.
- [ ] Fixed output-format headings are derived deterministically.
- [ ] Planner cannot add unrequested title/TOC/references/conclusion.
- [ ] Plan contains 1–10 sections.
- [ ] Each section has retrieval mode, citation policy, target tokens, and sub-queries.
- [ ] Requirements-to-test-cases tasks classify as `transform_derive`.
- [ ] Old-document-as-example tasks classify as `reference_inspired`.

## 24.3 Phase 3 — Section Pipeline

- [ ] Existing retriever and reranker are invoked directly.
- [ ] No retrieval logic is reimplemented.
- [ ] Independent sections run concurrently under configured limit.
- [ ] `dependsOn` sections wait only on prerequisites.
- [ ] Same chunk reused across sections gets the same citation number.
- [ ] Writer input never exceeds configured token budget.
- [ ] Invalid citation numbers are stripped, not remapped.
- [ ] Grounded sections with twice-insufficient evidence output the sentinel and do not generate unsupported content.
- [ ] `reference_inspired` sections contain no `[N]` citations.
- [ ] Retrieval rounds per section never exceed 2.
- [ ] NLI/faithfulness gate is config-controlled.

## 24.4 Phase 4 — Final Validator

- [ ] Assembled output contains no auto title, TOC, references, appendix, validation notes, or internal metadata unless requested.
- [ ] Passing sections are byte-identical before and after validation.
- [ ] Coverage auditor sees only headings and short openings, not full document.
- [ ] Regeneration affects only flagged/named sections.
- [ ] Regeneration runs at most once.
- [ ] Second-round failures return warnings, not infinite loops.
- [ ] Final result includes citation registry and warnings out-of-band.

## 24.5 Whole Pipeline

- [ ] Chat route and agent route share the same orchestrator path after normalization.
- [ ] Six-section grounded document can complete under 180 seconds on target local LLM setup.
- [ ] Structured logs exist at all phase boundaries.
- [ ] Config supports concurrency, topK, rerankTopK, NLI flag, coverage flag, and max sections.
- [ ] Old standalone outliner and content-producing stitch/refine paths are retired or gated behind a rollback flag.

---

## 25. Recommended Implementation Planning Order for Codex

The coding agent should not implement immediately. It should first inspect the codebase and produce a detailed plan.

Recommended planning order:

1. Discover existing implementation from `plans/solution1.md`.
2. Locate current generative-mode phases.
3. Locate custom retriever and reranker functions.
4. Locate agent standard feature and agent instruction storage.
5. Locate LLM client abstraction and schema/JSON support.
6. Locate route/job/SSE/logging/config patterns.
7. Define shared contracts/types.
8. Implement header parser and output-format parser plan.
9. Implement input normalizer plan.
10. Implement planner+outline metadata plan.
11. Implement chunk registry plan.
12. Implement section pipeline and dependency scheduler plan.
13. Implement evidence sufficiency and query rewrite plan.
14. Implement citation validator plan.
15. Implement writer mode prompts plan.
16. Implement output assembler and final validator plan.
17. Implement targeted repair plan.
18. Add observability and config plan.
19. Add tests and performance fixtures.
20. Retire or gate old outliner and stitch/refine code paths.

---

## 26. Final Output Rule

The end-user-visible generated answer must contain only the content requested by `# Output format`.

Do not automatically print:

- final title
- table of contents
- references
- source list
- appendix
- validation report
- reasoning
- internal plan
- retrieved chunks
- quality score
- debug metadata

Unless explicitly requested by the user or the agent’s allowed output format.

---

## 27. Final Recommendation

Adopt the merged design with these final decisions:

1. **Use one shared orchestrator** for Chat Generative Mode and Agent Standard Mode.
2. **Confine mode differences to Input Normalizer**.
3. **Use one planner call** that includes outline metadata.
4. **Do not keep a standalone outliner LLM call**.
5. **Move retrieval/reranking into section execution**.
6. **Use section-specific evidence policy**.
7. **Use bounded retrieval correction, not free-form ReAct**.
8. **Use global citation registry and deterministic validation**.
9. **Use validate-only final phase with targeted repair**.
10. **Never add unrequested final output sections**.
11. **Keep source metadata out-of-band for UI source inspection**.
12. **Make performance, token, and retry budgets explicit in config and tests**.
