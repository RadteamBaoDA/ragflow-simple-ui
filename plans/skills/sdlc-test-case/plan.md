---
name: sdlc-test-case-plan
description: Phase-2 plan resource for the sdlc-test-case skill (Test Cases — test step/expected result, boundary value, equivalence partition, negative test, requirements-to-test derivation). Not independently triggered; loaded by the planner only after SKILL.md selects this artifact. Supplies plan metadata to bias the single planner call. Structurally inert — supplies no outline, never adds/renames/reorders sections, never overrides the resolved # Output format.
---

# Test Case — Plan Resource (Phase 2)

Biases the planner for test cases. The outline comes solely from the resolved
`# Output format` (§4); this resource supplies **no outline** and **no writer prose**
(that lives in the sibling [write.md](write.md)). The resolved output format always wins.

## Plan hints (Phase 2)
- **detectedTask:** `transform_derive` (requirements / use cases / LLD → test cases).
- **retrievalMode by section kind:**
  - Summary table, detailed cases, negative/boundary cases → `grounded_strict`, `mustCite=true`; each case cites the source requirement/flow it derives from.
  - Untestable / needs-clarification content → grounded with `minCitations: 0` (it lists gaps, not facts).
- **riskLevel:** `normal` unless the tested feature is regulated/safety-critical → `high`.
- **Sub-query seeds:** "<UC/REQ id> main flow"; "<feature> validation rules"; "exception flows for <feature>"; "duplicate/edge-case handling for <feature>".
- **acceptanceCriteria seeds (§9.2 step 10, §A.10.1):** seed each grounded section with testable, body-level checks the writer must satisfy and the coverage auditor re-checks — e.g. "every test case cites the source requirement/flow it derives from"; "each case has numbered steps with concrete test data and observable expected results"; "negative/boundary cases derive from exception flows or validation rules in the sources"; "no requirement/UC/TC ID appears that is absent from the sources". These are body properties only — never a new section/heading.
- **No-KB (§4.5):** if `noKnowledgeBase=true`, all sections forced to `retrievalMode="none"`.

> These hints are the **artifact-level** counterpart to the per-agent `agentPlanningHints` (§4.6): the planner fuses both (plus the section's `# Output format` item and any mapped requirement headings) into the final per-section plan. The resolved `# Output format` and security always win.
