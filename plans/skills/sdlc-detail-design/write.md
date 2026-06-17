---
name: sdlc-detail-design-write
description: Use during the PARALLEL PER-SECTION WRITING phase (Phase 3) of the generative RAG orchestrator when writing the body of a Detail Design / Low-Level Design section (LLD, detail design, class/function specs, API specification, database design, processing logic, pseudocode). Supplies per-section writing discipline only. Structurally inert — shapes the section body (HOW), never the outline or headings (WHAT); never adds/renames/reorders sections; the resolved # Output format and agent instruction always win.
---

# Detail Design (Low-Level Design) — Writer Skill (Phase 3)

Shapes **how** an LLD section body is written, never **what** sections exist.
Headings and section order are already locked from the resolved `# Output format`
(§4) before any writer runs. Writer priority: agent instruction → `# Output format`
→ this guidance; the output format wins any conflict. Planning metadata lives in
the companion `sdlc-detail-design-plan` (Phase 2).

## Writer guidance (body only, never structure)
- Specify module internals: classes/functions with signatures, parameters, return values, error behavior.
- Define APIs (method, path, request/response payloads, status codes) and DB changes (tables, columns, indexes, migrations) — **never invent fields, endpoints, or tables** that contradict the retrieved HLD/schema.
- Describe processing logic as numbered steps or pseudocode per the project's conventions; cover error handling, logging, and edge cases per unit.
- Reference the Basic Design component IDs (CMP-<NN>) each detail item realizes; use DLD-<MODULE>-<NN> IDs; cite inline `[N]`.
- Never write a heading, title, TOC, or References block; never mention being an AI; never emit internal notes, plan, or reasoning.
