---
name: sdlc-use-case-write
description: Use during the PARALLEL PER-SECTION WRITING phase (Phase 3) of the generative RAG orchestrator when writing the body of a use case specification section (use case, UC, UML use case, actor/flow specification, scenario spec). Supplies per-section writing discipline only. Structurally inert — shapes the section body (HOW), never the outline or headings (WHAT); never adds/renames/reorders sections; the resolved # Output format and agent instruction always win.
---

# Use Case Specification — Writer Skill (Phase 3)

Shapes **how** a use case section body is written, never **what** sections exist.
Headings and section order are already locked from the resolved `# Output format`
(§4) before any writer runs — this skill only fills the body of a section that
already exists. Writer priority: agent instruction → `# Output format` → this
guidance. If guidance ever implies an extra section, the output format wins and
this guidance is dropped for that section. Planning metadata lives in the
companion `sdlc-use-case-plan` (Phase 2).

## Writer guidance (body only, never structure)
- Mirror the numbering style, granularity, and voice of retrieved exemplar use cases.
- Write main flows as numbered actor-system step pairs ("Actor does X -> System does Y"); branch points in alternative/exception flows reference main-flow step numbers (e.g. "3a.", "5b.").
- Keep actors, business rules, and preconditions consistent with retrieved sources; do not invent UC IDs, actor names, or business-rule IDs not present in the sources.
- One user goal per use case; if a flow exceeds ~12 steps, note it rather than padding.
- Cite grounded sections inline `[N]`; reference-inspired flow sections carry no citations.
- Never write a heading, title, TOC, or References block; never mention being an AI; never emit internal notes, plan, or reasoning.
