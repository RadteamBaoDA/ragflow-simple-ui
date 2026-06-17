---
name: sdlc-test-spec-plan
description: Phase-2 plan resource for the sdlc-test-spec skill (Test Specifications — test procedures, test data sets, environment setup, pass/fail criteria, evidence/teardown). Not independently triggered; loaded by the planner only after SKILL.md selects this artifact. Supplies plan metadata to bias the single planner call. Structurally inert — supplies no outline, never adds/renames/reorders sections, never overrides the resolved # Output format.
---

# Test Specification — Plan Resource (Phase 2)

Biases the planner for a test spec. The outline comes solely from the resolved
`# Output format` (§4); this resource supplies **no outline** and **no writer prose**
(that lives in the sibling [write.md](write.md)). The resolved output format always wins.

## Plan hints (Phase 2)
- **detectedTask:** `transform_derive` or `synthesize_multi` (Test Plan + Test Cases + LLD → executable spec).
- **retrievalMode by section kind:**
  - Environment setup, test data sets → `grounded_strict` against the environment catalog and LLD schema constraints.
  - Test procedures → grounded against the referenced test cases.
  - Pass/fail criteria & evidence → grounded where sourced.
- **riskLevel:** `normal` unless the system is regulated/safety-critical → `high`.
- **Sub-query seeds:** "test plan TP-* references"; "test cases TC-* for <module>"; "environment catalog versions/endpoints/accounts"; "LLD schema constraints for test data".
- **acceptanceCriteria seeds (§9.2 step 10, §A.10.1):** e.g. "each procedure expands a referenced test case into setup/execution/verification/teardown and cites it"; "test data sets give concrete valid/invalid/boundary values satisfying the LLD schema constraints"; "environment config (versions/endpoints/accounts/flags) comes from the catalog and cites it — never invented"; "credentials use the placeholder convention, never real values"; "test spec IDs use TS-<MODULE>-<NNN> mapped to TC IDs". Body properties only.
- **No-KB (§4.5):** if `noKnowledgeBase=true`, all sections forced to `retrievalMode="none"`.

> These hints are the **artifact-level** counterpart to the per-agent `agentPlanningHints` (§4.6): the planner fuses both (plus the section's `# Output format` item and any mapped requirement headings) into the final per-section plan. The resolved `# Output format` and security always win.
