---
name: sdlc-test-spec-plan
description: Use during the PLAN + OUTLINE phase (Phase 2) of the generative RAG orchestrator when the artifact is a Test Specification (test spec, test procedures, test data sets, environment setup, pass/fail criteria, evidence/teardown). Supplies plan metadata to bias the planner. Structurally inert — supplies no outline, never adds/renames/reorders sections, never overrides the user's # Output format. The companion sdlc-test-spec-write skill handles Phase 3 writing.
---

# Test Specification — Plan Skill (Phase 2)

Biases the planner for a test spec. The outline comes solely from the resolved
`# Output format` (§4); this skill supplies **no outline** and **no writer prose**
(that lives in `sdlc-test-spec-write`). A user-supplied output format always wins.

## Plan hints (Phase 2)
- **detectedTask:** `transform_derive` or `synthesize_multi` (Test Plan + Test Cases + LLD → executable spec).
- **retrievalMode by section kind:**
  - Environment setup, test data sets → `grounded_strict` against the environment catalog and LLD schema constraints.
  - Test procedures → grounded against the referenced test cases.
  - Pass/fail criteria & evidence → grounded where sourced.
- **riskLevel:** `normal` unless the system is regulated/safety-critical → `high`.
- **Sub-query seeds:** "test plan TP-* references"; "test cases TC-* for <module>"; "environment catalog versions/endpoints/accounts"; "LLD schema constraints for test data".
- **No-KB (§4.5):** if `noKnowledgeBase=true`, all sections forced to `retrievalMode="none"`.
