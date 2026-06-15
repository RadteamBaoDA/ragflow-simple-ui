---
name: sdlc-detail-design-plan
description: Use during the PLAN + OUTLINE phase (Phase 2) of the generative RAG orchestrator when the artifact is a Detail Design / Low-Level Design document (LLD, detail design, class/function specs, API specification, database design, processing logic, pseudocode). Supplies plan metadata to bias the planner. Structurally inert — supplies no outline, never adds/renames/reorders sections, never overrides the user's # Output format. The companion sdlc-detail-design-write skill handles Phase 3 writing.
---

# Detail Design (Low-Level Design) — Plan Skill (Phase 2)

Biases the planner for an LLD. The outline comes solely from the resolved
`# Output format` (§4); this skill supplies **no outline** and **no writer prose**
(that lives in `sdlc-detail-design-write`). A user-supplied output format always wins.

## Plan hints (Phase 2)
- **detectedTask:** `transform_derive` (HLD → LLD).
- **retrievalMode by section kind:**
  - Class/function specs, API specs, DB design → `grounded_strict`; interfaces and data must cite HLD/schema chunks.
  - Processing logic, error handling → grounded where they depend on existing contracts.
- **riskLevel:** `normal` unless the module is regulated/safety-critical → `high`.
- **Sub-query seeds:** "Basic Design component CMP-<NN> for <module>"; "existing database schema tables and columns"; "API spec endpoints request/response for <feature>"; "coding standards / pseudocode conventions".
- **No-KB (§4.5):** if `noKnowledgeBase=true`, all sections forced to `retrievalMode="none"`.
