---
name: sdlc-test-case-plan
description: Use during the PLAN + OUTLINE phase (Phase 2) of the generative RAG orchestrator when the artifact is Test Cases (test case, test step/expected result, boundary value, equivalence partition, negative test, requirements-to-test derivation). Supplies plan metadata to bias the planner. Structurally inert — supplies no outline, never adds/renames/reorders sections, never overrides the user's # Output format. The companion sdlc-test-case-write skill handles Phase 3 writing.
---

# Test Case — Plan Skill (Phase 2)

Biases the planner for test cases. The outline comes solely from the resolved
`# Output format` (§4); this skill supplies **no outline** and **no writer prose**
(that lives in `sdlc-test-case-write`). A user-supplied output format always wins.

## Plan hints (Phase 2)
- **detectedTask:** `transform_derive` (requirements / use cases / LLD → test cases).
- **retrievalMode by section kind:**
  - Summary table, detailed cases, negative/boundary cases → `grounded_strict`, `mustCite=true`; each case cites the source requirement/flow it derives from.
  - Untestable / needs-clarification content → grounded with `minCitations: 0` (it lists gaps, not facts).
- **riskLevel:** `normal` unless the tested feature is regulated/safety-critical → `high`.
- **Sub-query seeds:** "<UC/REQ id> main flow"; "<feature> validation rules"; "exception flows for <feature>"; "duplicate/edge-case handling for <feature>".
- **No-KB (§4.5):** if `noKnowledgeBase=true`, all sections forced to `retrievalMode="none"`.
