---
name: sdlc-srs-plan
description: Use during the PLAN + OUTLINE phase (Phase 2) of the generative RAG orchestrator when the artifact is a Software Requirements Specification (SRS, requirements spec, functional/non-functional requirements, IEEE 29148, "shall" statements). Supplies plan metadata to bias the planner. Structurally inert — supplies no outline, never adds/renames/reorders sections, never overrides the user's # Output format. The companion sdlc-srs-write skill handles Phase 3 writing.
---

# Software Requirements Specification (SRS) — Plan Skill (Phase 2)

Biases the planner for an SRS. The outline comes solely from the resolved
`# Output format` (§4); this skill supplies **no outline** and **no writer prose**
(that lives in `sdlc-srs-write`). A user-supplied output format always wins.

## Plan hints (Phase 2)
- **detectedTask:** `transform_derive` or `synthesize_multi` (BRD/notes/change requests → numbered requirements).
- **retrievalMode by section kind:**
  - Functional/non-functional requirement sections → `grounded_strict`; every "shall" must cite a source chunk.
  - Definitions, constraints/assumptions → `grounded_strict` where sourced; assumptions only when the output format explicitly permits.
- **riskLevel:** `high` for healthcare/legal/compliance/finance/security → forces `mustCite=true`, `assumptionsAllowed=false`.
- **Sub-query seeds:** "<feature> change request requirements"; "existing requirement numbering REQ-<module>-*"; "non-functional requirements quality standards <domain>"; "acceptance criteria for <feature>".
- **No-KB (§4.5):** if `noKnowledgeBase=true`, all sections forced to `retrievalMode="none"`.
