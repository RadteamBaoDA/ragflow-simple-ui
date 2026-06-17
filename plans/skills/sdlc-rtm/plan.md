---
name: sdlc-rtm-plan
description: Phase-2 plan resource for the sdlc-rtm skill (Requirements Traceability Matrices — RTM, coverage matrix, requirement-to-test mapping, gap/orphan analysis). Not independently triggered; loaded by the planner only after SKILL.md selects this artifact. Supplies plan metadata to bias the single planner call. Structurally inert — supplies no outline, never adds/renames/reorders sections, never overrides the resolved # Output format.
---

# Requirements Traceability Matrix (RTM) — Plan Resource (Phase 2)

Biases the planner for an RTM. The outline comes solely from the resolved
`# Output format` (§4); this resource supplies **no outline** and **no writer prose**
(that lives in the sibling [write.md](write.md)). The resolved output format always wins. This
is the strictest grounding profile in the set.

## Plan hints (Phase 2)
- **detectedTask:** `synthesize_multi` (SRS + test cases + design docs → coverage links).
- **retrievalMode:** `grounded_strict` for every section, `mustCite=true`. Only state links explicitly supported by retrieved chunks; abstention (the sentinel) is *expected* for unverifiable links.
- **riskLevel:** `normal` by default; `high` for regulated programs (reinforces the strict grounding already mandated).
- **Sub-query seeds:** "requirement IDs REQ-* in scope"; "design items CMP-* / DLD-* referencing requirements"; "test cases TC-* mapping to requirement IDs".
- **acceptanceCriteria seeds (§9.2 step 10, §A.10.1):** e.g. "every stated link is explicitly supported by a retrieved document and cites it"; "every in-scope requirement is listed, even if uncovered"; "uncovered requirements are written 'NOT COVERED' — coverage is never inferred or invented"; "gaps and orphans (refs to unknown requirement IDs) are reported"; "ID conventions REQ-*/CMP-*/DLD-*/TC-* used exactly". Body properties only.
- **No-KB (§4.5):** if `noKnowledgeBase=true`, all sections forced to `retrievalMode="none"` — but an RTM with no KB has nothing to trace, so surface the `noKnowledgeBase` warning prominently.

> These hints are the **artifact-level** counterpart to the per-agent `agentPlanningHints` (§4.6): the planner fuses both (plus the section's `# Output format` item and any mapped requirement headings) into the final per-section plan. The resolved `# Output format` and security always win.
