---
name: sdlc-basic-design-plan
description: Use during the PLAN + OUTLINE phase (Phase 2) of the generative RAG orchestrator when the artifact is a Basic Design / High-Level Design document (HLD, basic design, system architecture, component design, requirement-to-component traceability). Supplies plan metadata to bias the planner. Structurally inert — supplies no outline, never adds/renames/reorders sections, never overrides the user's # Output format. The companion sdlc-basic-design-write skill handles Phase 3 writing.
---

# Basic Design (High-Level Design) — Plan Skill (Phase 2)

Biases the planner for an HLD. The outline comes solely from the resolved
`# Output format` (§4); this skill supplies **no outline** and **no writer prose**
(that lives in `sdlc-basic-design-write`). A user-supplied output format always wins.

## Plan hints (Phase 2)
- **detectedTask:** `transform_derive` (SRS → HLD).
- **retrievalMode by section kind:**
  - Interfaces, data design, process/data flow, requirement traceability → `grounded_strict` (map elements to requirement IDs; cite architecture-standard chunks).
  - Overview, architecture shape, design decisions → structure may be `reference_inspired` against existing HLDs, but technology choices stay grounded.
- **riskLevel:** `normal` unless the system is in a regulated domain → `high`.
- **Sub-query seeds:** "SRS requirements for <module>"; "approved architecture standards / technology stack"; "existing HLD component decomposition <system>"; "interface and data model definitions".
- **No-KB (§4.5):** if `noKnowledgeBase=true`, all sections forced to `retrievalMode="none"`.
