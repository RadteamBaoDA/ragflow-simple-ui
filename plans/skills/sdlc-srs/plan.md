---
name: sdlc-srs-plan
description: Phase-2 plan resource for the sdlc-srs skill (Software Requirements Specifications — SRS, functional/non-functional requirements, IEEE 29148, "shall" statements). Not independently triggered; loaded by the planner only after SKILL.md selects this artifact. Supplies plan metadata to bias the single planner call. Structurally inert — supplies no outline, never adds/renames/reorders sections, never overrides the resolved # Output format.
---

# Software Requirements Specification (SRS) — Plan Resource (Phase 2)

Biases the planner for an SRS. The outline comes solely from the resolved
`# Output format` (§4); this resource supplies **no outline** and **no writer prose**
(that lives in the sibling [write.md](write.md)). The resolved output format always wins.

## Plan hints (Phase 2)
- **detectedTask:** `transform_derive` or `synthesize_multi` (BRD/notes/change requests → numbered requirements).
- **retrievalMode by section kind:**
  - Functional/non-functional requirement sections → `grounded_strict`; every "shall" must cite a source chunk.
  - Definitions, constraints/assumptions → `grounded_strict` where sourced; assumptions only when the output format explicitly permits.
- **riskLevel:** `high` for healthcare/legal/compliance/finance/security → forces `mustCite=true`, `assumptionsAllowed=false`.
- **Sub-query seeds:** "<feature> change request requirements"; "existing requirement numbering REQ-<module>-*"; "non-functional requirements quality standards <domain>"; "acceptance criteria for <feature>".
- **acceptanceCriteria seeds (§9.2 step 10, §A.10.1):** e.g. "every functional requirement is an atomic, testable 'shall' statement with a unique REQ-<MODULE>-<NN> ID continuing existing numbering"; "each requirement cites its source document"; "functional and non-functional requirements are separated"; "no requirement invented without a basis in the sources — unstated needs are marked as assumptions only when the output format permits"; "conflicts/duplicates between sources are flagged, not silently merged". Body properties only.
- **No-KB (§4.5):** if `noKnowledgeBase=true`, all sections forced to `retrievalMode="none"`.

> These hints are the **artifact-level** counterpart to the per-agent `agentPlanningHints` (§4.6): the planner fuses both (plus the section's `# Output format` item and any mapped requirement headings) into the final per-section plan. The resolved `# Output format` and security always win.
