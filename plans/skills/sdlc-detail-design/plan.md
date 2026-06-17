---
name: sdlc-detail-design-plan
description: Phase-2 plan resource for the sdlc-detail-design skill (Detail Design / Low-Level Design — LLD, class/function specs, API specification, database design, processing logic, pseudocode). Not independently triggered; loaded by the planner only after SKILL.md selects this artifact. Supplies plan metadata to bias the single planner call. Structurally inert — supplies no outline, never adds/renames/reorders sections, never overrides the resolved # Output format.
---

# Detail Design (Low-Level Design) — Plan Resource (Phase 2)

Biases the planner for an LLD. The outline comes solely from the resolved
`# Output format` (§4); this resource supplies **no outline** and **no writer prose**
(that lives in the sibling [write.md](write.md)). The resolved output format always wins.

## Plan hints (Phase 2)
- **detectedTask:** `transform_derive` (HLD → LLD).
- **retrievalMode by section kind:**
  - Class/function specs, API specs, DB design → `grounded_strict`; interfaces and data must cite HLD/schema chunks.
  - Processing logic, error handling → grounded where they depend on existing contracts.
- **riskLevel:** `normal` unless the module is regulated/safety-critical → `high`.
- **Sub-query seeds:** "Basic Design component CMP-<NN> for <module>"; "existing database schema tables and columns"; "API spec endpoints request/response for <feature>"; "coding standards / pseudocode conventions".
- **acceptanceCriteria seeds (§9.2 step 10, §A.10.1):** e.g. "every class/function/table/API is consistent with the Basic Design and existing schemas — no invented fields, endpoints, or tables that contradict them"; "each DLD item references the CMP-<NN> it realizes; IDs use DLD-<MODULE>-<NN>"; "function specs state signatures, parameters, returns, and error behavior"; "API specs give method/path/payloads/status codes; DB changes list tables/columns/indexes/migrations"; "processing logic covers error handling and edge cases". Body properties only.
- **No-KB (§4.5):** if `noKnowledgeBase=true`, all sections forced to `retrievalMode="none"`.

> These hints are the **artifact-level** counterpart to the per-agent `agentPlanningHints` (§4.6): the planner fuses both (plus the section's `# Output format` item and any mapped requirement headings) into the final per-section plan. The resolved `# Output format` and security always win.
