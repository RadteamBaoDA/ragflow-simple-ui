---
name: sdlc-test-plan-plan
description: Use during the PLAN + OUTLINE phase (Phase 2) of the generative RAG orchestrator when the artifact is a Test Plan (test plan, test strategy, ISTQB/IEEE 829 plan, test scope, entry/exit criteria, test schedule, risk-based testing). Supplies plan metadata to bias the planner. Structurally inert — supplies no outline, never adds/renames/reorders sections, never overrides the user's # Output format. The companion sdlc-test-plan-write skill handles Phase 3 writing.
---

# Test Plan — Plan Skill (Phase 2)

Biases the planner for a test plan. The outline comes solely from the resolved
`# Output format` (§4); this skill supplies **no outline** and **no writer prose**
(that lives in `sdlc-test-plan-write`). A user-supplied output format always wins.

## Plan hints (Phase 2)
- **detectedTask:** `transform_derive` or `synthesize_multi` (SRS/design + test policy → plan).
- **retrievalMode by section kind:**
  - Scope, test approach/levels → `grounded_strict` (scope/items from the SRS feature list).
  - Entry/exit criteria, environment, roles/schedule → often `none` for boilerplate from the agent's context/test policy; grounded where sourced.
  - Risks → `grounded_strict` if sourced, else `none`.
- **riskLevel:** `normal` unless the release covers a regulated domain → `high`.
- **Sub-query seeds:** "SRS feature list in scope for <release>"; "test policy entry/exit criteria"; "environment catalog and tools"; "defect severity definitions".
- **No-KB (§4.5):** if `noKnowledgeBase=true`, all sections forced to `retrievalMode="none"`.
