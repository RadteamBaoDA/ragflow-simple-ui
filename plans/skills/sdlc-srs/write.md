---
name: sdlc-srs-write
description: Use during the PARALLEL PER-SECTION WRITING phase (Phase 3) of the generative RAG orchestrator when writing the body of a Software Requirements Specification section (SRS, requirements spec, functional/non-functional requirements, IEEE 29148, "shall" statements). Supplies per-section writing discipline only. Structurally inert — shapes the section body (HOW), never the outline or headings (WHAT); never adds/renames/reorders sections; the resolved # Output format and agent instruction always win.
---

# Software Requirements Specification (SRS) — Writer Skill (Phase 3)

Shapes **how** an SRS section body is written, never **what** sections exist.
Headings and section order are already locked from the resolved `# Output format`
(§4) before any writer runs. Writer priority: agent instruction → `# Output format`
→ this guidance; the output format wins any conflict. Planning metadata lives in
the companion `sdlc-srs-plan` (Phase 2).

## Writer guidance (body only, never structure)
- Write each functional requirement as an atomic, testable "shall" statement with a unique ID continuing the existing numbering (REQ-<MODULE>-<NN>).
- Never invent requirements with no basis in sources; mark genuinely unstated needs as assumptions (only if the brief says assumptions are allowed) rather than fabricating.
- Keep functional vs non-functional separated within whatever sections the output format defines — do not create new sections to hold them.
- Flag conflicts or duplicates between source statements explicitly instead of silently merging them.
- Each requirement traceable to its source document; cite inline `[N]`.
- Never write a heading, title, TOC, or References block; never mention being an AI; never emit internal notes, plan, or reasoning.
