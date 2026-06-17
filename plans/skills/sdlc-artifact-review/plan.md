---
name: sdlc-artifact-review-plan
description: Phase-2 plan resource for the sdlc-artifact-review skill (REVIEW/VALIDATION of an existing document against a reference — conformance check, sufficiency/completeness/gap analysis). Not independently triggered; loaded by the planner only after SKILL.md selects this artifact. Supplies plan metadata to bias the planner toward review_validate with dual grounding. Structurally inert — supplies no outline, never adds/renames/reorders sections, never overrides the resolved # Output format.
---

# Artifact Reviewer (sufficiency & conformance) — Plan Resource (Phase 2)

Biases the planner for a **review/validation** of an existing artifact against the
reference it must conform to. The outline comes solely from the resolved
`# Output format` (user's, or the agent's fallback per §4); this resource supplies
**no outline** and **no writer prose** (that lives in the sibling [write.md](write.md)).
The resolved output format always wins. This is the strictest grounding profile
in the set, alongside the RTM.

## Plan hints (Phase 2)
- **detectedTask:** `review_validate` (§5 taxonomy). When the resolved `# Output format` asks for a corrected/revised draft as one of its items, that single section is `transform_derive` (grounded against the reference) with `dependsOn` on the findings sections.
- **retrievalMode:** `grounded_strict` for every findings/verdict section; `mustCite=true`, `assumptionsAllowed=false` are forced post-parse (§3.2). Abstention (the sentinel) is *expected* when grounding is genuinely absent — never assert a pass/gap without evidence.
- **Dual grounding (the defining trait, §5):** each review section emits BOTH
  - `subQueries` → retrieve the **artifact under review** (what the document actually says), and
  - `referenceQueries` → retrieve the **reference** it must conform to (the SRS, template, standard, upstream design).
  A finding is the *delta* between the two, each side cited separately.
- **riskLevel:** `normal` by default; `high` for regulated/safety-critical subject matter (reinforces the strict grounding already mandated).
- **Sub-query seeds (artifact side):** "<artifact id e.g. TS-CRM> procedures/sections"; "<artifact> test data / fields / steps".
- **referenceQuery seeds (reference side):** "<feature> requirements in the SRS"; "<standard/HLD> rules for <area>"; "template required sections for <artifact type>".
- **acceptanceCriteria seeds (§9.2 step 10, §A.10.1):** e.g. "every finding cites the reference clause it checks AND the artifact section it compares"; "no 'sufficient'/'complete' verdict without reference coverage to back it"; "each reference requirement in scope is classified covered / partial / missing / contradicted"; "no gap, conformance, requirement ID, or fact invented"; for a corrected-draft section: "every added/fixed item traces to a reference requirement; no invented IDs/fields/endpoints". Body properties only.
- **No-KB (§4.5):** if `noKnowledgeBase=true`, all sections forced to `retrievalMode="none"` — but a review with no KB has nothing to check against, so surface the `noKnowledgeBase` warning prominently (there is nothing to validate).

> These hints are the **artifact-level** counterpart to the per-agent `agentPlanningHints` (§4.6): the planner fuses both (plus the section's `# Output format` item and any mapped requirement headings) into the final per-section plan. The resolved `# Output format` and security always win.
