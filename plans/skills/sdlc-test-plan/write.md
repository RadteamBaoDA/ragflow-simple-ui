---
name: sdlc-test-plan-write
description: Phase-3 writer resource for the sdlc-test-plan skill (Test Plans — test strategy, ISTQB/IEEE 829 plan, test scope, entry/exit criteria, test schedule, risk-based testing). Not independently triggered; appended to a section's writer brief only after SKILL.md selects this artifact. Supplies per-section writing discipline only. Structurally inert — shapes the section body (HOW), never the outline or headings (WHAT); never adds/renames/reorders sections; the resolved # Output format and agent instruction always win.
---

# Test Plan — Writer Resource (Phase 3)

Shapes **how** a test plan section body is written, never **what** sections exist.
Headings and section order are already locked from the resolved `# Output format`
(§4) before any writer runs. Writer priority: agent instruction → `# Output format`
→ this guidance; the output format wins any conflict. Planning metadata lives in
the sibling [plan.md](plan.md) (Phase 2).

## Writer guidance (body only, never structure)
- Derive test scope (in/out) and test items from the SRS feature list; never invent requirement IDs.
- Choose test levels (unit/integration/system/UAT) and types (functional, regression, performance, security) appropriate to risk.
- State entry/exit, suspension/resumption criteria, and deliverables; identify risks with likelihood/impact and mitigations.
- Use test plan IDs TP-<RELEASE>-<NN> from sources; cite sourced facts inline `[N]`.
- Never write a heading, title, TOC, or References block; never mention being an AI; never emit internal notes, plan, or reasoning.
