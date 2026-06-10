# Specification: Agent-Orchestrated Generative RAG Mode

## 1. Objective

Design an improved generative RAG orchestration solution for the existing RAG system.

This specification is intended to be used as input for **ChatGPT Codex Plan Mode** to create a detailed implementation plan.

The goal is to improve:

* cost efficiency
* output quality
* generation accuracy
* retrieval effectiveness
* hallucination control
* strict output-format compliance
* reuse of the existing orchestrator for both chat generative mode and agent standard mode

This document is **architecture and design guidance only**.
It should not include implementation code.

---

# 2. Target Modes

The system must support two generation modes.

---

## 2.1 Chat Generative Mode

In chat generative mode, the user input must follow this Markdown structure:

```md
# User profiles

# Task

# Context

# Keyword

# Output format
```

The system must parse these headers and use them as the primary generation contract.

### Required behavior

The orchestrator must:

* treat `# Task` as the main generation goal
* treat `# Context` as user-provided source context
* treat `# Keyword` as retrieval and domain hint
* treat `# User profiles` as tone, audience, role, and expectation guidance
* treat `# Output format` as the strict final output contract

The final generated output must not include any section outside `# Output format` unless explicitly requested.

---

## 2.2 Agent Standard Mode

In agent standard mode, the user may provide either:

* freestyle natural-language prompt
* partial Markdown headers
* full Markdown headers

Supported optional headers:

```md
# Task

# Context

# Keyword

# Output format
```

The agent itself has predefined instruction. The predefined instruction may include:

* agent role
* agent skill
* default user profile
* default output format
* default retrieval policy
* domain-specific behavior
* citation policy
* quality rules

### Required behavior

The existing orchestrator should be reused.

Do not create a completely separate pipeline for agent standard mode.

Instead, create a normalization layer that merges:

1. system rules
2. application generation rules
3. agent instruction
4. agent skill instruction
5. user prompt
6. user Markdown headers

The merged result becomes one normalized generation request used by the same orchestration pipeline.

---

# 3. Main Architecture Decision

The existing orchestration approach should be kept, but retrieval and reranking should be moved from global pipeline phases into the section generation phase.

---

## 3.1 Old Pipeline

```txt
Parser
→ Planner
→ Retriever
→ Reranker
→ Outliner
→ Section Writer
→ Stitch / Validate / Refine
```

---

## 3.2 Recommended New Pipeline

```txt
Input Normalizer
→ Intent & Requirement Analyzer
→ Smart Planner
→ Conditional Outliner
→ Section-by-Section Writer
   → Section-level Retrieval
   → Section-level Reranking
   → Evidence Sufficiency Check
   → Grounded Section Generation
   → Citation Binding
   → Section Validation
→ Output Assembler
→ Final Validation Only
```

---

## 3.3 Reason for Change

Global retrieval is not optimal because different output sections have different evidence needs.

Some sections may require:

* no retrieval
* user context only
* one existing document
* multiple related documents
* old examples as reference
* domain-specific knowledge
* strict source-grounded generation

Therefore, retrieval should happen per section, based on the smart plan.

This improves:

* relevance
* citation accuracy
* cost efficiency
* performance
* hallucination control
* output quality

---

# 4. Reuse Existing Orchestrator for Agent Standard Mode

## 4.1 Recommendation

The existing generative orchestrator should be reused for agent standard mode.

Agent standard mode should only add a normalization and policy layer before the orchestrator.

The core orchestration should remain shared.

---

## 4.2 Required Design

The system should have a normalized internal request model that contains:

* generation mode
* resolved user profile
* resolved task
* resolved context
* resolved keywords
* resolved output format
* agent instruction
* agent skill
* agent generation policy
* retrieval policy
* citation policy
* quality policy
* detected requirement headings

This normalized request becomes the single input for all later phases.

---

## 4.3 Merge Priority

When agent instruction and user prompt conflict, use this priority order:

```txt
System safety rules
>
Application generation rules
>
Agent instruction
>
Agent skill instruction
>
User Markdown headers
>
User freestyle prompt
```

However:

* tenant filter must never be overridden
* knowledge-base security rules must never be overridden
* system safety rules must never be overridden
* agent output format can only be overridden if the agent policy allows it
* agent retrieval policy can only be overridden if the agent policy allows it

---

# 5. Smart Planner Requirements

## 5.1 Purpose

The planner must become smarter and support many generation use cases.

It should not only create search queries.

It must decide:

* task type
* document type to generate
* domain
* required source material
* whether retrieval is needed
* which section needs retrieval
* what type of evidence is needed
* how to generate each section
* whether user context is enough
* whether retrieved knowledge is required
* whether an old document should be used as a reference
* whether the output must preserve user format exactly

---

## 5.2 Planner Must Support These Cases

The planner must support at least the following use cases:

### Case 1: Create new document from old similar document

Example:

```txt
Refer to old use case and create a new use case.
```

Expected planner behavior:

* retrieve old use case examples
* detect reusable structure
* detect what must be changed for the new case
* generate new content without copying blindly
* cite old chunks only if used as reference

---

### Case 2: Generate test case from requirement

Example:

```txt
Create test cases from this requirement.
```

Expected planner behavior:

* retrieve requirement chunks
* detect functional rules
* detect edge cases
* generate test scenarios
* generate test cases with precondition, steps, expected result
* ensure every test case maps to requirement evidence

---

### Case 3: Generate detail design from basic design

Expected planner behavior:

* retrieve basic design
* retrieve architecture constraints
* retrieve API, data model, workflow, or interface references
* generate detailed design only from supported evidence
* avoid invented API names, fields, or workflows

---

### Case 4: Generate from user context only

Expected planner behavior:

* detect that user-provided context is sufficient
* skip retrieval
* generate directly from user context
* do not add citations unless required by policy

---

### Case 5: Generate from knowledge base only

Expected planner behavior:

* retrieve target documents
* verify evidence sufficiency
* generate only from retrieved chunks
* require citations

---

### Case 6: Generate software development documents

The planner must support software development output types such as:

* SRS
* user story
* use case
* functional requirement
* non-functional requirement
* test case
* test specification
* basic design
* detail design
* API design
* database design
* screen design
* workflow design
* deployment design
* migration plan

---

### Case 7: Generate healthcare or domain-specific documents

The planner must support domain-sensitive generation.

For healthcare or regulated domains, the planner must:

* increase hallucination risk level
* require stronger evidence
* avoid unsupported medical or operational claims
* require citations when using knowledge base chunks
* avoid assumptions unless explicitly allowed

---

# 6. Requirement Heading Detection

## 6.1 Purpose

The system must detect not only fixed headers, but also custom requirement headings from user prompt or agent instruction.

Examples:

```md
# Requirement

## Functional Requirement

## Non-functional Requirement

## Screen Requirement

## API Requirement

## Constraint

## Acceptance Criteria
```

---

## 6.2 Required Behavior

The system must extract requirement-like headings and classify them as:

* task
* context
* requirement
* constraint
* acceptance criteria
* output format
* domain rule
* quality rule
* retrieval hint
* unknown

The planner must use these headings to improve:

* section planning
* retrieval strategy
* output validation
* requirement coverage checking
* citation requirements

---

# 7. Conditional Outliner

## 7.1 Is the Outliner Necessary?

The outliner should be kept, but it must be conditional.

It is useful for long or complex outputs.

It is not always necessary.

---

## 7.2 Use Outliner When

Use the outliner when:

* the output is long
* the task has many sections
* output format is ambiguous
* user asks for SRS, design document, test specification, or long-form document
* task requires transformation from multiple documents
* section dependencies exist
* agent instruction defines high-level output but not exact headings

---

## 7.3 Skip Outliner When

Skip the outliner when:

* `# Output format` already defines exact headings
* output is short
* user asks for one table only
* user asks for a direct conversion
* agent has a fixed strict template
* planner can map sections directly to output format

---

## 7.4 Outliner Rules

The outliner must:

* preserve the user-requested output format
* preserve heading order when required
* not add title unless requested
* not add table of contents unless requested
* not add references unless requested
* not add appendix unless requested
* not add validation notes
* not add internal reasoning

The outliner is a planning aid only.

It must not become a source of extra final content.

---

# 8. Section-by-Section Generation

## 8.1 Main Recommendation

Retrieval and reranking should be executed inside the section writer phase.

Each section should decide:

* whether retrieval is needed
* what query should be used
* what evidence is enough
* whether to retry retrieval
* whether citations are required
* whether generation can proceed

---

## 8.2 Section Writer Responsibilities

For each planned section, the section writer must:

1. read the section goal
2. check whether retrieval is required
3. create section-specific retrieval queries
4. retrieve candidate chunks when required
5. rerank retrieved chunks when required
6. check evidence sufficiency
7. retry retrieval if evidence is weak
8. generate the section
9. bind citations to used chunks
10. validate the generated section
11. retry generation if validation fails

---

## 8.3 Section Evidence Policy

Each section should have its own evidence policy.

The evidence policy should define:

* minimum evidence required
* maximum chunks allowed
* whether citation is required
* whether generation can continue without evidence
* whether assumptions are allowed
* whether user context alone is enough
* whether retrieved evidence is mandatory

---

## 8.4 Evidence Sufficiency Check

Before generating a section, the system must check whether the retrieved evidence is enough.

The evidence sufficiency check should answer:

* Are the required facts covered?
* Are the required requirement headings covered?
* Are the chunks relevant to the section?
* Are there missing facts?
* Are there conflicting chunks?
* Is retrieval retry needed?
* Is generation safe to continue?

This check can use a lightweight heuristic first.

Use an LLM judge only when:

* the section is high risk
* the task is complex
* evidence is weak
* evidence is conflicting
* the domain is sensitive
* the section failed previous validation

---

# 9. Citation Strategy

## 9.1 Citation Must Be Section-Aware

Citation should be handled during section generation, not only after generation.

When a section uses retrieved chunks, the section writer must provide those chunks to the LLM with stable citation numbers.

The generated section must cite only those chunks.

---

## 9.2 Citation Rules

The section writer must enforce:

* every citation must resolve to a chunk used by that section
* citations must not refer to chunks from another section
* the model must not invent citation numbers
* citation is required when knowledge base evidence is used
* citation is optional only when policy allows
* unsupported factual claims should be removed or regenerated

---

## 9.3 References Section

The system must not automatically add a references section.

Add references only when `# Output format` explicitly asks for it.

If references are not requested:

* keep inline citations if citation policy requires them
* store source metadata internally for UI inspection
* do not print a separate source list

---

# 10. Anti-Hallucination Design

## 10.1 Recommended Pattern

Use a lightweight section-level loop:

```txt
Retrieve
→ Check Evidence
→ Generate
→ Validate
→ Retry if needed
```

Do not use full ReAct for every section.

Use ReAct-like retrieval reasoning only when necessary.

---

## 10.2 When to Use ReAct-like Loop

Use a ReAct-like loop only when:

* retrieval is not enough
* task needs multi-step reasoning
* output depends on multiple documents
* evidence is conflicting
* domain is healthcare, legal, compliance, finance, security, or regulated workflow
* section validation fails
* citation check fails
* planner marks hallucination risk as high

---

## 10.3 Grounded Generation Rules

The section writer must:

* generate only the requested section
* follow output format strictly
* use user context as primary input when enough
* use retrieved chunks as evidence when needed
* cite every factual claim derived from chunks
* avoid inventing requirement IDs, API names, screen names, data fields, domain rules, or clinical facts
* omit unsupported details
* include assumptions only if output format allows assumptions
* never print internal reasoning
* never print evidence analysis
* never print validation results

---

# 11. Final Phase: Validation Only

## 11.1 Required Change

Replace the old final phase:

```txt
Stitch, Validate, Refine
```

With:

```txt
Validate Final Output Only
```

---

## 11.2 Final Validation Responsibilities

The final validator must check:

* output follows `# Output format`
* output satisfies `# Task`
* output respects `# User profiles`
* output uses `# Context` correctly
* output covers `# Keyword` when relevant
* required headings are present
* forbidden headings are absent
* heading order is correct
* citations are valid if required
* no unresolved placeholders exist
* no internal metadata is printed
* no validation report is printed
* no title, TOC, references, appendix, or notes are added unless requested

---

## 11.3 Final Validator Must Not

The final validator must not:

* rewrite the full document unless regeneration is required
* add new sections
* add a title
* add a TOC
* add references
* add explanation
* add comments
* print validation result to the user
* print internal reasoning

The final response to the user must contain only the requested output.

---

# 12. Output Assembler Rules

The output assembler is responsible only for formatting and combining generated sections.

It must:

* preserve requested heading structure
* preserve heading order
* remove internal metadata
* normalize Markdown spacing
* include only requested sections
* include citations only when allowed or required
* not create new content

The output assembler must not behave like a writer.

It must not invent or improve content.

---

# 13. Cost Optimization Guidelines

The design should reduce cost by:

* skipping retrieval when user context is enough
* retrieving only for sections that need evidence
* limiting retrieval attempts
* using heuristic evidence checks before LLM judges
* using LLM judges only for high-risk sections
* skipping outliner when output format is already strict
* avoiding unnecessary final rewrite
* caching retrieval results
* caching rerank results
* limiting section generation retries
* running independent sections in parallel with concurrency limit

---

# 14. Quality Optimization Guidelines

The design should improve quality by:

* using structured smart planning
* detecting custom requirement headings
* using section-specific retrieval
* checking evidence before generation
* requiring citations during generation
* validating each section
* validating final output format
* preventing extra sections
* preventing unsupported assumptions
* preserving user-requested output format exactly

---

# 15. Performance Optimization Guidelines

The design should improve performance by:

* running independent section retrieval in parallel
* running independent section generation in parallel
* limiting concurrency to avoid overload
* retrieving only top relevant candidates
* reranking only the best candidates
* skipping retrieval for context-only sections
* streaming output section by section when possible
* storing intermediate job state for retry and resume

---

# 16. Recommended Architecture Components

The implementation plan should include these components.

---

## 16.1 Input Normalizer

Purpose:

* parse chat Markdown headers
* parse agent freestyle prompt
* merge agent instruction with user prompt
* resolve default user profile
* resolve output format
* resolve keywords
* extract requirement headings
* produce normalized generation request

---

## 16.2 Intent and Requirement Analyzer

Purpose:

* detect task type
* detect domain
* detect target document type
* detect generation mode
* detect user-provided context sufficiency
* detect whether knowledge-base retrieval is required
* detect hallucination risk
* detect missing information

---

## 16.3 Smart Planner

Purpose:

* create section-level generation plan
* decide retrieval requirement per section
* define evidence policy per section
* define citation policy per section
* define generation mode per section
* map requirements to planned sections
* define final validation rules

---

## 16.4 Conditional Outliner

Purpose:

* create or preserve output structure
* skip itself when output format is already strict
* never add extra sections
* map planned sections to output headings

---

## 16.5 Section Writer

Purpose:

* generate each section
* perform section-level retrieval
* perform section-level reranking
* check evidence sufficiency
* generate grounded content
* bind citations
* validate section quality
* retry section if needed

---

## 16.6 Evidence Evaluator

Purpose:

* check whether retrieved chunks are enough
* detect missing evidence
* detect irrelevant evidence
* detect conflicting evidence
* recommend retrieval retry
* prevent generation with weak evidence when policy requires strong grounding

---

## 16.7 Citation Validator

Purpose:

* check that each citation resolves to a real chunk
* check that citation belongs to the section
* check that cited chunks were actually used
* reject invented citation numbers
* enforce citation policy

---

## 16.8 Output Assembler

Purpose:

* combine generated sections
* preserve requested output format
* remove metadata
* avoid adding new sections
* prepare final Markdown

---

## 16.9 Final Output Validator

Purpose:

* validate final output only
* check task compliance
* check output format compliance
* check citation correctness
* check missing or extra headings
* check unsupported placeholders
* return internal validation result only

---

# 17. Advanced System Prompt Samples

These prompts are samples for the implementation plan.
They are not final production prompts, but they define expected behavior for each phase.

---

## 17.1 Input Normalizer System Prompt

```txt
You are the Input Normalizer for a generative RAG orchestration system.

Your responsibility is to convert raw user input and optional agent instruction into a normalized generation request.

You must identify and extract:
- user profile
- task
- context
- keywords
- output format
- agent role
- agent skill
- custom requirement headings
- constraints
- domain hints
- retrieval hints

You must support two modes:
1. Chat generative mode with required Markdown headers:
   # User profiles
   # Task
   # Context
   # Keyword
   # Output format

2. Agent standard mode where the user may provide freestyle prompt or optional headers:
   # Task
   # Context
   # Keyword
   # Output format

Merge agent instruction and user prompt using this priority:
System rules > application rules > agent instruction > agent skill > user Markdown headers > user freestyle prompt.

Do not generate final content.
Do not answer the user.
Do not invent missing task details.
Do not add output sections.
Return only the normalized request object required by the orchestration pipeline.
```

---

## 17.2 Intent and Requirement Analyzer System Prompt

```txt
You are the Intent and Requirement Analyzer for a generative RAG system.

Your responsibility is to understand what kind of generation the user needs.

Analyze:
- user task
- user context
- keywords
- output format
- user profile
- agent instruction
- custom requirement headings

Classify:
- task type
- target document type
- source material need
- domain
- generation pattern
- hallucination risk
- retrieval need
- citation need
- missing information

Supported generation patterns include:
- generate from user context
- generate from retrieved knowledge
- transform existing document
- extend existing document
- create new document from old similar document
- summarize document
- compare documents
- create software development artifact
- create healthcare or domain-specific artifact

Do not generate the final document.
Do not create the section content.
Do not add unsupported assumptions.
Return only analysis information for the planner.
```

---

## 17.3 Smart Planner System Prompt

```txt
You are the Smart Planner for a generative RAG orchestration system.

Your responsibility is to create a section-level generation plan.

Use:
- normalized user request
- agent instruction
- task analysis
- detected requirement headings
- output format
- retrieval policy
- citation policy

For each planned section, decide:
- section purpose
- section type
- generation mode
- whether retrieval is required
- why retrieval is or is not required
- what evidence is needed
- whether user context is enough
- citation requirement
- quality rules
- dependency on other sections
- validation requirements

Important rules:
- Do not generate final user content.
- Do not write the output document.
- Do not add sections outside the requested output format.
- If output format is strict, preserve it exactly.
- If output format is ambiguous, create a minimal structure required to satisfy the task.
- Prefer section-level retrieval instead of global retrieval.
- Mark high-risk sections that need stronger evidence checks.
- Mark sections that can skip retrieval to reduce cost.

The plan must be practical for software development documents, healthcare documents, business requirements, test cases, design documents, summaries, and document transformation tasks.
```

---

## 17.4 Conditional Outliner System Prompt

```txt
You are the Conditional Outliner for a generative RAG system.

Your responsibility is to create or preserve the final document outline.

Use the smart plan and the requested output format.

Rules:
- If the user provided a strict output format, preserve it exactly.
- Do not add title unless requested.
- Do not add table of contents unless requested.
- Do not add references unless requested.
- Do not add appendix unless requested.
- Do not add validation notes.
- Do not add internal reasoning.
- Do not add extra headings.
- Only create an outline if needed for long or complex output.
- If outline is not needed, mark the outline phase as skipped.

The outline is only a generation guide.
It must not introduce new final content requirements.
```

---

## 17.5 Section Evidence Planner System Prompt

```txt
You are the Evidence Planner for one section of a generated document.

Your responsibility is to decide what evidence is needed before generating this section.

Use:
- section goal
- section type
- task
- user context
- output format
- keywords
- agent instruction
- retrieval policy
- citation policy

Decide:
- whether retrieval is required
- what kind of chunks are needed
- what document types are preferred
- what domain filters should apply
- what keywords should be used
- whether user-provided context is already enough
- whether generation can proceed without retrieved evidence
- whether citation is required

Do not generate the section.
Do not answer the user.
Do not invent facts.
Return only evidence planning information for this section.
```

---

## 17.6 Evidence Sufficiency Judge System Prompt

```txt
You are the Evidence Sufficiency Judge for a section-level RAG generation pipeline.

Your responsibility is to determine whether the retrieved evidence is enough to generate the requested section safely.

Evaluate:
- relevance of retrieved chunks
- coverage of section requirements
- coverage of user task
- coverage of custom requirement headings
- missing facts
- conflicting evidence
- citation suitability
- hallucination risk

Rules:
- Do not generate the section.
- Do not summarize the evidence for the user.
- Do not invent missing facts.
- If evidence is insufficient, explain what is missing for internal retry.
- If query rewrite is needed, suggest a better retrieval direction.
- Use strict judgment for healthcare, legal, compliance, finance, security, and regulated domains.

Return only the sufficiency decision for orchestration.
```

---

## 17.7 Section Writer System Prompt

```txt
You are the Grounded Section Writer for a generative RAG system.

Your responsibility is to generate only one assigned section of the final output.

You must follow:
- user task
- user profile
- user context
- output format
- section plan
- agent instruction
- evidence chunks
- citation policy

Rules:
- Generate only the assigned section.
- Do not generate other sections.
- Do not add headings outside the section instruction.
- Follow the requested output format exactly.
- Use user context when it is provided and relevant.
- Use retrieved evidence only when supplied.
- When using retrieved evidence, cite the relevant chunk with its provided citation number.
- Do not cite chunks that were not provided.
- Do not invent citation numbers.
- Do not invent requirement IDs, API names, screen names, database fields, workflow names, medical facts, business rules, or system behavior.
- If evidence is missing, omit unsupported details.
- Include assumptions only if the output format explicitly allows assumptions.
- Do not print internal notes.
- Do not print reasoning.
- Do not print validation result.
- Do not mention that you are an AI model.

The output must be ready to assemble into the final document.
```

---

## 17.8 Section Validator System Prompt

```txt
You are the Section Validator for a generative RAG system.

Your responsibility is to validate one generated section.

Check:
- section follows assigned section goal
- section follows output format
- section does not contain extra headings
- section does not contain unsupported claims
- citations are valid when required
- citations resolve to provided chunks
- no invented citation numbers exist
- no placeholders remain
- no internal notes are printed
- no assumptions are included unless allowed
- section covers required requirements

Do not rewrite the section unless explicitly instructed by the orchestration policy.
Do not generate missing content.
Do not print user-facing validation notes.
Return only internal validation result and issue list.
```

---

## 17.9 Output Assembler System Prompt

```txt
You are the Output Assembler for a generative RAG system.

Your responsibility is to combine validated generated sections into the final Markdown output.

Rules:
- Preserve the requested output format.
- Preserve the requested heading order.
- Do not add new sections.
- Do not add title unless requested.
- Do not add table of contents unless requested.
- Do not add references unless requested.
- Do not add appendix unless requested.
- Do not add validation notes.
- Do not add internal metadata.
- Do not rewrite section content.
- Only normalize Markdown formatting when necessary.

The result must contain only the user-requested final output.
```

---

## 17.10 Final Validator System Prompt

```txt
You are the Final Output Validator for a generative RAG system.

Your responsibility is to validate the final assembled output.

Check:
- final output satisfies the user task
- final output follows the requested output format
- final output respects the user profile
- final output uses provided context correctly
- final output covers relevant keywords
- required headings are present
- forbidden headings are absent
- heading order is correct
- citations are valid if required
- no unresolved placeholders exist
- no internal metadata is visible
- no validation report is visible
- no title, TOC, references, appendix, or notes were added unless requested

Do not add new content.
Do not rewrite the final output unless orchestration explicitly requests targeted regeneration.
Do not print validation result to the user.
Return only internal validation status.
```

---

# 18. Recommended Final Pipeline

The final architecture should use this pipeline:

```txt
1. Input Normalizer
2. Intent and Requirement Analyzer
3. Smart Planner
4. Conditional Outliner
5. Section-by-Section Writer
   5.1 Evidence Planning
   5.2 Section Retrieval
   5.3 Section Reranking
   5.4 Evidence Sufficiency Check
   5.5 Grounded Section Generation
   5.6 Citation Binding
   5.7 Section Validation
6. Output Assembler
7. Final Output Validator
```

---

# 19. Final Output Rule

The final generated answer shown to the end user must include only the content requested by `# Output format`.

The system must not automatically print:

* final title
* table of contents
* references
* source list
* appendix
* validation report
* reasoning
* internal plan
* retrieved chunks
* quality score
* debug metadata

Unless explicitly requested by the user or agent output format.

---

# 20. Implementation Planning Request for Codex

Use this specification to create a detailed implementation plan for the current source code.

The implementation plan should identify:

* which existing modules should be reused
* which modules should be refactored
* which new modules are needed
* how to support chat generative mode
* how to support agent standard mode
* how to normalize input
* how to upgrade the planner
* how to move retrieval and reranking into section writer
* how to implement evidence sufficiency checking
* how to implement citation validation
* how to make outliner conditional
* how to make final phase validation-only
* how to prevent extra final output sections
* how to reduce cost
* how to improve quality
* how to improve performance

Do not generate implementation code in the plan unless explicitly requested later.
