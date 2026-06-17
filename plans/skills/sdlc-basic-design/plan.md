---
name: sdlc-basic-design-plan
description: Phase-2 plan resource for the sdlc-basic-design skill (Basic Design / High-Level Design — HLD, system architecture, component design, requirement-to-component traceability). Not independently triggered; loaded by the planner only after SKILL.md selects this artifact. Supplies plan metadata to bias the single planner call. Structurally inert — supplies no outline, never adds/renames/reorders sections, never overrides the resolved # Output format.
---

# Basic Design (High-Level Design) — Plan Resource (Phase 2)

Biases the planner for an HLD. The outline comes solely from the resolved
`# Output format` (§4); this resource supplies **no outline** and **no writer prose**
(that lives in the sibling [write.md](write.md)). The resolved output format always wins.

## Plan hints (Phase 2)
- **detectedTask:** `transform_derive` (SRS → HLD).
- **retrievalMode by section kind:**
  - Interfaces, data design, process/data flow, requirement traceability → `grounded_strict` (map elements to requirement IDs; cite architecture-standard chunks).
  - Overview, architecture shape, design decisions → structure may be `reference_inspired` against existing HLDs, but technology choices stay grounded.
- **riskLevel:** `normal` unless the system is in a regulated domain → `high`.
- **Sub-query seeds:** "SRS requirements for <module>"; "approved architecture standards / technology stack"; "existing HLD component decomposition <system>"; "interface and data model definitions".
- **acceptanceCriteria seeds (§9.2 step 10, §A.10.1):** e.g. "every component maps to the requirement IDs it realizes (requirement-to-component traceability)"; "no technology introduced that the project has not approved per the retrieved standards"; "interfaces and data flows are described in numbered steps and cite their source"; "component IDs use CMP-<NN>, design decisions DD-<NN>; none invented"; "each design decision states rationale and rejected alternatives". Body properties only.
- **No-KB (§4.5):** if `noKnowledgeBase=true`, all sections forced to `retrievalMode="none"`.

> These hints are the **artifact-level** counterpart to the per-agent `agentPlanningHints` (§4.6): the planner fuses both (plus the section's `# Output format` item and any mapped requirement headings) into the final per-section plan. The resolved `# Output format` and security always win.
