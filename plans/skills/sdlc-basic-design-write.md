---
name: sdlc-basic-design-write
description: Use during the PARALLEL PER-SECTION WRITING phase (Phase 3) of the generative RAG orchestrator when writing the body of a Basic Design / High-Level Design section (HLD, basic design, system architecture, component design, requirement-to-component traceability). Supplies per-section writing discipline only. Structurally inert — shapes the section body (HOW), never the outline or headings (WHAT); never adds/renames/reorders sections; the resolved # Output format and agent instruction always win.
---

# Basic Design (High-Level Design) — Writer Skill (Phase 3)

Shapes **how** an HLD section body is written, never **what** sections exist.
Headings and section order are already locked from the resolved `# Output format`
(§4) before any writer runs. Writer priority: agent instruction → `# Output format`
→ this guidance; the output format wins any conflict. Planning metadata lives in
the companion `sdlc-basic-design-plan` (Phase 2).

## Writer guidance (body only, never structure)
- Decompose into components/modules with single responsibilities and explicit interfaces; use the project's component IDs (CMP-<NN>) and decision IDs (DD-<NN>).
- Describe data flow and control flow in numbered steps (textual; diagrams are described, not drawn).
- Never introduce technologies the project has not approved per the retrieved standards; never invent component or interface names absent from sources.
- In traceability content, map each design element to the requirement IDs it realizes; cite inline `[N]`.
- State design decisions with rationale and rejected alternatives only where sourced.
- Never write a heading, title, TOC, or References block; never mention being an AI; never emit internal notes, plan, or reasoning.
