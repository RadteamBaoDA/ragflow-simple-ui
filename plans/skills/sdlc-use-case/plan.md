---
name: sdlc-use-case-plan
description: Phase-2 plan resource for the sdlc-use-case skill (Use Case Specifications — UC, UML use case, actor/flow specification, scenario spec). Not independently triggered; loaded by the planner only after SKILL.md selects this artifact. Supplies plan metadata to bias the single planner call. Structurally inert — supplies no outline, never adds/renames/reorders sections, never overrides the resolved # Output format.
---

# Use Case Specification — Plan Resource (Phase 2)

Biases the planner for a use case spec. The outline comes solely from the resolved
`# Output format` (user's, or the agent's fallback per §4); this resource supplies
**no outline** and **no writer prose** (that lives in the sibling [write.md](write.md)).

## Plan hints (Phase 2)
- **detectedTask:** `reference_inspired` for "new UC from existing UC exemplars"; `transform_derive` for "UC from requirements/change requests".
- **retrievalMode by section kind:**
  - Overview, pre/postconditions, business rules → `grounded_strict` (cite existing UCs and BR chunks).
  - New main/alternative/exception flows → `reference_inspired` (mirror exemplar structure/voice; invent specifics); `grounded_strict` if the flow already exists in sources.
  - Open-questions / clarification sections → `none`.
- **riskLevel:** `normal` unless the use case covers a regulated domain (healthcare/legal/finance/safety) → `high`.
- **Sub-query seeds:** "<UC name/id> existing use case main flow"; "business rules BR-* for <module>"; "preconditions/postconditions for <feature>"; project glossary terms.
- **acceptanceCriteria seeds (§9.2 step 10, §A.10.1):** e.g. "actors, preconditions, and business rules stay consistent with the retrieved sources and cite them"; "main flow is numbered actor-system step pairs"; "alternative/exception flows reference main-flow step numbers (3a., 5b.)"; "UC IDs follow UC-<MODULE>-<NN>; BR refs use BR-<NN>; none invented"; "reference-inspired flow sections invent only genuinely new specifics, never new actors/rules absent from sources". Body properties only.
- **No-KB (§4.5):** if `noKnowledgeBase=true`, all sections forced to `retrievalMode="none"`.

> These hints are the **artifact-level** counterpart to the per-agent `agentPlanningHints` (§4.6): the planner fuses both (plus the section's `# Output format` item and any mapped requirement headings) into the final per-section plan. The resolved `# Output format` and security always win.
