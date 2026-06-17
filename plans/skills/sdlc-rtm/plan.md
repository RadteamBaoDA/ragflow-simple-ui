---
name: sdlc-rtm-plan
description: Use during the PLAN + OUTLINE phase (Phase 2) of the generative RAG orchestrator when the artifact is a Requirements Traceability Matrix (RTM, traceability matrix, coverage matrix, requirement-to-test mapping, gap/orphan analysis). Supplies plan metadata to bias the planner. Structurally inert — supplies no outline, never adds/renames/reorders sections, never overrides the user's # Output format. The companion sdlc-rtm-write skill handles Phase 3 writing.
---

# Requirements Traceability Matrix (RTM) — Plan Skill (Phase 2)

Biases the planner for an RTM. The outline comes solely from the resolved
`# Output format` (§4); this skill supplies **no outline** and **no writer prose**
(that lives in `sdlc-rtm-write`). A user-supplied output format always wins. This
is the strictest grounding profile in the set.

## Plan hints (Phase 2)
- **detectedTask:** `synthesize_multi` (SRS + test cases + design docs → coverage links).
- **retrievalMode:** `grounded_strict` for every section, `mustCite=true`. Only state links explicitly supported by retrieved chunks; abstention (the sentinel) is *expected* for unverifiable links.
- **riskLevel:** `normal` by default; `high` for regulated programs (reinforces the strict grounding already mandated).
- **Sub-query seeds:** "requirement IDs REQ-* in scope"; "design items CMP-* / DLD-* referencing requirements"; "test cases TC-* mapping to requirement IDs".
- **No-KB (§4.5):** if `noKnowledgeBase=true`, all sections forced to `retrievalMode="none"` — but an RTM with no KB has nothing to trace, so surface the `noKnowledgeBase` warning prominently.
