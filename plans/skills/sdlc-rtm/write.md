---
name: sdlc-rtm-write
description: Use during the PARALLEL PER-SECTION WRITING phase (Phase 3) of the generative RAG orchestrator when writing the body of a Requirements Traceability Matrix section (RTM, traceability matrix, coverage matrix, requirement-to-test mapping, gap/orphan analysis). Supplies per-section writing discipline only. Structurally inert — shapes the section body (HOW), never the outline or headings (WHAT); never adds/renames/reorders sections; the resolved # Output format and agent instruction always win.
---

# Requirements Traceability Matrix (RTM) — Writer Skill (Phase 3)

Shapes **how** an RTM section body is written, never **what** sections exist.
Headings and section order are already locked from the resolved `# Output format`
(§4) before any writer runs. Writer priority: agent instruction → `# Output format`
→ this guidance; the output format wins any conflict. Planning metadata lives in
the companion `sdlc-rtm-plan` (Phase 2). This is the strictest grounding profile
in the set.

## Writer guidance (body only, never structure)
- State only links explicitly supported by retrieved documents (a test case citing a requirement ID, a design section referencing one). Where no link is found, write "NOT COVERED" — **never infer or invent coverage**. Honest abstention is the expected behavior, not a failure.
- List every in-scope requirement, even if uncovered; report gaps (no design/test linkage) and orphans (refs to unknown requirement IDs).
- Use the ID conventions REQ-*, CMP-*, DLD-*, TC-*; cite the linking source inline `[N]`.
- Never write a heading, title, TOC, or References block; never mention being an AI; never emit internal notes, plan, or reasoning.
