---
name: sdlc-test-plan-plan
description: Phase-2 plan resource for the sdlc-test-plan skill (Test Plans — test strategy, ISTQB/IEEE 829 plan, test scope, entry/exit criteria, test schedule, risk-based testing). Not independently triggered; loaded by the planner only after SKILL.md selects this artifact. Supplies plan metadata to bias the single planner call. Structurally inert — supplies no outline, never adds/renames/reorders sections, never overrides the resolved # Output format.
---

# Test Plan — Plan Resource (Phase 2)

Biases the planner for a test plan. The outline comes solely from the resolved
`# Output format` (§4); this resource supplies **no outline** and **no writer prose**
(that lives in the sibling [write.md](write.md)). The resolved output format always wins.

## Plan hints (Phase 2)
- **detectedTask:** `transform_derive` or `synthesize_multi` (SRS/design + test policy → plan).
- **retrievalMode by section kind:**
  - Scope, test approach/levels → `grounded_strict` (scope/items from the SRS feature list).
  - Entry/exit criteria, environment, roles/schedule → often `none` for boilerplate from the agent's context/test policy; grounded where sourced.
  - Risks → `grounded_strict` if sourced, else `none`.
- **riskLevel:** `normal` unless the release covers a regulated domain → `high`.
- **Sub-query seeds:** "SRS feature list in scope for <release>"; "test policy entry/exit criteria"; "environment catalog and tools"; "defect severity definitions".
- **acceptanceCriteria seeds (§9.2 step 10, §A.10.1):** e.g. "scope and test items trace to the SRS feature list and cite it"; "test levels/types are chosen per risk"; "entry/exit, suspension/resumption criteria and deliverables are defined"; "risks list likelihood/impact and mitigations"; "test plan IDs use TP-<RELEASE>-<NN>; no requirement IDs invented". Body properties only.
- **No-KB (§4.5):** if `noKnowledgeBase=true`, all sections forced to `retrievalMode="none"`.

> These hints are the **artifact-level** counterpart to the per-agent `agentPlanningHints` (§4.6): the planner fuses both (plus the section's `# Output format` item and any mapped requirement headings) into the final per-section plan. The resolved `# Output format` and security always win.
