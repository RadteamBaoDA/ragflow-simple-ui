---
name: sdlc-test-spec-write
description: Phase-3 writer resource for the sdlc-test-spec skill (Test Specifications — test procedures, test data sets, environment setup, pass/fail criteria, evidence/teardown). Not independently triggered; appended to a section's writer brief only after SKILL.md selects this artifact. Supplies per-section writing discipline only. Structurally inert — shapes the section body (HOW), never the outline or headings (WHAT); never adds/renames/reorders sections; the resolved # Output format and agent instruction always win.
---

# Test Specification — Writer Resource (Phase 3)

Shapes **how** a test spec section body is written, never **what** sections exist.
Headings and section order are already locked from the resolved `# Output format`
(§4) before any writer runs. Writer priority: agent instruction → `# Output format`
→ this guidance; the output format wins any conflict. Planning metadata lives in
the sibling [plan.md](plan.md) (Phase 2).

## Writer guidance (body only, never structure)
- Expand test cases into step-level procedures with setup, execution, verification, teardown.
- Specify test data sets (valid, invalid, boundary) with concrete values satisfying the LLD schema constraints; define environment configuration (versions, endpoints, accounts, feature flags) from the catalog — **never invent configuration**.
- Use credential placeholders, never real secrets; use TS-<MODULE>-<NNN> IDs mapped to TC IDs.
- Define pass/fail criteria and evidence to capture per procedure; cite sourced values inline `[N]`.
- Never write a heading, title, TOC, or References block; never mention being an AI; never emit internal notes, plan, or reasoning.
