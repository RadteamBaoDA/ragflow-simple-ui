---
name: sdlc-use-case-plan
description: Use during the PLAN + OUTLINE phase (Phase 2) of the generative RAG orchestrator when the artifact is a use case specification (use case, UC, UML use case, actor/flow specification, scenario spec). Supplies plan metadata (detectedTask, retrievalMode, riskLevel, sub-query seeds) to bias the planner. Structurally inert — supplies no outline, never adds/renames/reorders sections, never overrides the user's # Output format. The companion sdlc-use-case-write skill handles Phase 3 writing.
---

# Use Case Specification — Plan Skill (Phase 2)

Biases the planner for a use case spec. The outline comes solely from the resolved
`# Output format` (user's, or the agent's fallback per §4); this skill supplies
**no outline** and **no writer prose** (that lives in `sdlc-use-case-write`).

## Plan hints (Phase 2)
- **detectedTask:** `reference_inspired` for "new UC from existing UC exemplars"; `transform_derive` for "UC from requirements/change requests".
- **retrievalMode by section kind:**
  - Overview, pre/postconditions, business rules → `grounded_strict` (cite existing UCs and BR chunks).
  - New main/alternative/exception flows → `reference_inspired` (mirror exemplar structure/voice; invent specifics); `grounded_strict` if the flow already exists in sources.
  - Open-questions / clarification sections → `none`.
- **riskLevel:** `normal` unless the use case covers a regulated domain (healthcare/legal/finance/safety) → `high`.
- **Sub-query seeds:** "<UC name/id> existing use case main flow"; "business rules BR-* for <module>"; "preconditions/postconditions for <feature>"; project glossary terms.
- **No-KB (§4.5):** if `noKnowledgeBase=true`, all sections forced to `retrievalMode="none"`.
