---
name: sdlc-test-case-write
description: Use during the PARALLEL PER-SECTION WRITING phase (Phase 3) of the generative RAG orchestrator when writing the body of a Test Case section (test case, test step/expected result, boundary value, equivalence partition, negative test, requirements-to-test derivation). Supplies per-section writing discipline only. Structurally inert — shapes the section body (HOW), never the outline or headings (WHAT); never adds/renames/reorders sections; the resolved # Output format and agent instruction always win.
---

# Test Case — Writer Skill (Phase 3)

Shapes **how** a test case section body is written, never **what** sections exist.
Headings and section order are already locked from the resolved `# Output format`
(§4) before any writer runs. Writer priority: agent instruction → `# Output format`
→ this guidance; the output format wins any conflict. Planning metadata lives in
the companion `sdlc-test-case-plan` (Phase 2).

## Writer guidance (body only, never structure)
- One test case per verifiable behavior; atomic and independently executable.
- Steps are numbered imperative actions with concrete test data; expected results observable and unambiguous.
- Apply black-box techniques (equivalence partitioning, boundary value analysis, decision tables); cover positive, negative, and boundary scenarios per requirement; derive negative cases from exception flows/validation rules in the sources.
- If a requirement is too vague to test, list it under the clarification content the output format provides rather than guessing or adding a new section.
- Use TC-<MODULE>-<NNN> IDs continuing existing numbering; cite the source requirement inline `[N]`.
- Never write a heading, title, TOC, or References block; never mention being an AI; never emit internal notes, plan, or reasoning.
