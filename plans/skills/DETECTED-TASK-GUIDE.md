# How to phrase your request — a `detectedTask` guide for chat users

When you ask the generative RAG orchestrator for something in **chat mode**, a single
planner step reads your request and classifies it into exactly **one of 8 task types**
(`detectedTask`). That one choice decides how it retrieves, whether it must cite
sources, and whether it may invent content or must stay strictly grounded.

You don't pick the task type yourself — the planner infers it from your words. This
guide shows you the phrasing that makes it infer correctly.

## The one rule that matters most

The planner classifies by the **operation** you ask for — the *verb* and the
*relationship between your sources and what you want* — **not** by the document type.
"SRS", "test case", "design" tell it nothing about the task; **"summarize", "derive
from", "merge across", "check against"** tell it everything.

So lead with the operation:

> **operation verb** + **what the sources are** + **what you want** + **direction**

A vague verb ("do", "make", "handle this") forces the planner to guess. A precise verb
lands it on the right class on the first try.

---

## The 8 task types

Each section below gives: what the task means, when it fires, the phrasing that
triggers it, and two example prompts you could paste in.

### 1. `qa_with_citations` — answer a question from the documents
*Default retrieval: grounded_strict (must cite).*

A factual answer pulled from the knowledge base, with inline citations. Use it when you
have a **question** whose answer lives in the docs.

**Trigger words:** "what / how / which … according to the docs", "answer, citing sources".

- *"According to the SRS, what are the password-complexity rules for the login module? Cite the clauses."*
- *"Which components depend on the payments service? Answer from the design docs with citations."*

### 2. `summarize_single` — condense one source
*Default retrieval: grounded_strict (must cite).*

Shorten **one** document. Use it when there's a single source and you want it smaller.

**Trigger words:** "summarize this", "condense the … document", "give me the gist of".

- *"Summarize this SRS into a one-page overview."*
- *"Condense the meeting notes from the kickoff into key decisions."*

### 3. `synthesize_multi` — merge across several documents
*Default retrieval: grounded_strict (must cite).*

Fuse **multiple** documents into one output. Use it when the answer only emerges by
combining sources — including **traceability** and **coverage matrices**.

**Trigger words:** "merge / combine / consolidate across", "build a single … from the SRS, design, and tests", "end-to-end", "traceability".

- *"Build an end-to-end, bi-directional traceability across the SRS, design, and test cases — for each requirement show forward to its tests and backward to its business need."*
- *"Consolidate the three module specs into one coverage matrix: which requirements map to which test cases."*

### 4. `compare_analyze` — contrast / critique across documents
*Default retrieval: grounded_strict (must cite).*

Hold two or more things side by side and surface differences or a judgment. Use it for
**comparison**, not conformance-checking (that's #7).

**Trigger words:** "compare A and B", "what changed between", "contrast", "pros and cons of each".

- *"Compare v1 and v2 of the API spec and list every breaking change."*
- *"Contrast the two proposed architectures and analyze the trade-offs."*

### 5. `transform_derive` — build a NEW artifact from sources as ground truth
*Default retrieval: grounded_strict (must cite).*

Produce a **new** document by transforming sources you treat as authoritative. This is
the workhorse for SDLC generation: requirements → test cases, basic design → detail
design, etc.

**Trigger words:** "derive / generate / create … **from** …", "turn the SRS into …", "produce test cases for these requirements".

> The word **"from"** is the signal — it means *sources are truth, produce something new from them*.

- *"Generate test cases from the login requirements in the SRS."*
- *"Derive a detail design from this basic design, using the existing DB schema."*

### 6. `reference_inspired` — new artifact, sources are just examples
*Default retrieval: reference_inspired (NO citations — specifics may be invented).*

Write something **new in the style of** existing examples, where the examples shape
voice and structure but you expect new specifics. This is the only task that doesn't
cite, because you *want* invented content.

**Trigger words:** "write NEW … like these", "in the style of", "following the same format as", "use these as a template".

- *"Write a new use case for password reset, in the same style as these existing use cases."*
- *"Draft a release note like our previous ones for the 2.4 release."*

### 7. `review_validate` — check an existing artifact against a reference
*Default retrieval: grounded_strict, **dual-grounding** (cites artifact AND reference; never invents a gap or a pass).*

Judge whether an **existing** document is complete / consistent / sufficient when
measured against a **reference** (an SRS, a standard, an upstream design, a template).
This is the only task with two retrieval sides — the artifact under review *and* the
reference it must conform to.

**Trigger words:** "is this … complete / consistent / sufficient", "review … **against** …", "check whether … conforms to", "is this enough given …".

> The word **"against / consistent with / sufficient given"** is the signal — it means
> *don't produce a new doc, judge an existing one*. Optionally ask for a corrected draft
> as one section and the planner derives just that part.

- *"Review whether this test specification is complete and consistent with the SRS, and produce a corrected version."*
- *"Check this detail design against the HLD and the coding standard — flag every gap."*

### 8. `pure_generation` — generate with no retrieval
*Default retrieval: none (no citations).*

Write from scratch (or from context you paste in), with no knowledge base involved. Use
it when there's nothing to retrieve.

**Trigger words:** "write a … (no documents needed)", "draft from scratch", "using the info below".

- *"Write a project-kickoff checklist for a small web team."*
- *"Draft an email announcing the maintenance window, using the details below."*

---

## Disambiguation — the pairs people get wrong

These share artifacts but are opposite operations. The verb decides.

| You actually want… | Say this (not that) | Lands on |
|---|---|---|
| **Make** test cases from requirements | "Generate test cases **from** the SRS" | `transform_derive` |
| **Check** test cases cover the SRS | "Review whether the tests are **sufficient given** the SRS" | `review_validate` |
| A **coverage matrix** (one table, which req → which test) | "Build a **coverage matrix** mapping requirements to test cases; mark uncovered ones NOT COVERED" | `synthesize_multi` (RTM skill) |
| **End-to-end traceability** (forward + backward, whole lifecycle) | "Build a **bi-directional, end-to-end traceability** across requirements, design, code, tests" | `synthesize_multi` (traceability skill) |
| A **new** doc shaped like old ones | "Write a **new** use case **in the style of** these" | `reference_inspired` |
| A **new** doc derived from authoritative sources | "**Derive** the detail design **from** the HLD" | `transform_derive` |
| **Compare** two docs | "**Compare** spec A and spec B" | `compare_analyze` |
| **Validate** one doc against a standard | "Check spec A **conforms to** the standard" | `review_validate` |

The fault line:
- **"from"** → derive a new artifact (`transform_derive`)
- **"against / consistent with / sufficient given / conforms to"** → review an existing one (`review_validate`)
- **"merge / combine / across / end-to-end"** → fuse many (`synthesize_multi`)
- **"compare / contrast / what changed"** → critique side by side (`compare_analyze`)
- **"in the style of / like these / new … following"** → exemplar-driven (`reference_inspired`)

---

## Two extra levers (besides the verb)

**Give an explicit `# Output format`.** It doesn't change the task type, but it removes
all guesswork about structure — the planner builds one section per item you list
instead of inventing an outline, so its attention goes to classifying the task. Example:

```
# Output format
1. Coverage summary
2. Requirement → Test mapping table
3. Uncovered requirements
```

**Flag the domain when it's sensitive.** If your content is healthcare, legal, finance,
regulatory, security, or safety-critical, say so. The planner sets `riskLevel: high`,
which forces mandatory citations and disallows assumptions — stricter grounding, fewer
fabrications.

---

## Quick reference

| # | `detectedTask` | One-line meaning | Signal word | Cites? |
|---|---|---|---|---|
| 1 | `qa_with_citations` | answer a question from docs | "what / according to" | yes |
| 2 | `summarize_single` | condense one source | "summarize this" | yes |
| 3 | `synthesize_multi` | merge across documents | "merge / across / end-to-end" | yes |
| 4 | `compare_analyze` | contrast across documents | "compare / what changed" | yes |
| 5 | `transform_derive` | build a NEW artifact from sources-as-truth | "derive / generate **from**" | yes |
| 6 | `reference_inspired` | new artifact, sources are examples | "new … **in the style of**" | no |
| 7 | `review_validate` | check existing artifact vs a reference | "**against** / consistent / sufficient" | yes (both sides) |
| 8 | `pure_generation` | generate, no retrieval | "from scratch / no docs" | no |

---

## A caveat worth knowing

Very simple, one-step requests may be handled directly without engaging an artifact
skill at all — phrasing can't force a skill onto a task too trivial to need one. And
because the task is classified by a single planner step, genuinely ambiguous wording can
still misfire. If a particular kind of request *keeps* misclassifying for you, the
durable fix is **agent mode**: an agent instruction's `## Skill` block and planning
hints bias the planner deterministically, so you don't depend on each chat prompt being
phrased perfectly.

> Source of truth for the taxonomy: see §5 ("Task taxonomy") and §9.2 (the planner
> prompt) in `claude-generative-rag-orchestrator-v2-final-spec.md`. If those change,
> update this guide to match.
