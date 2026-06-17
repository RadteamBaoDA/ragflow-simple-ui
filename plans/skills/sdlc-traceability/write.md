---
name: sdlc-traceability-write
description: Phase-3 writer resource for the sdlc-traceability skill (end-to-end, bi-directional SDLC traceability — forward/backward tracing across business need → requirement → design → code → test → defect, in waterfall or agile). Not independently triggered; appended to a section's writer brief only after SKILL.md selects this artifact. Supplies per-section writing discipline only. Structurally inert — shapes the section body (HOW), never the outline or headings (WHAT); never adds/renames/reorders sections; the resolved # Output format and agent instruction always win.
---

# SDLC Traceability — Writer Resource (Phase 3)

Shapes **how** a traceability section body is written, never **what** sections exist.
Headings and section order are already locked from the resolved `# Output format`
(§4) before any writer runs. Writer priority: agent instruction → `# Output format`
→ this guidance; the output format wins any conflict. Planning metadata lives in the
sibling [plan.md](plan.md) (Phase 2). This is the strictest grounding profile in the
set, alongside the RTM.

The lifecycle chain and ID conventions for the section come from the methodology
selected in Phase 2 — see [references/waterfall.md](references/waterfall.md) or
[references/agile.md](references/agile.md). Use the chain that the brief's sources
actually show; do not mix methodologies within one document.

## Writer guidance (body only, never structure)
- For each in-scope node, state its **backward link** (the source it derives from) and its **forward link** (what derives from it). A trace is bi-directional by nature — a one-sided entry is incomplete, so show both sides or mark the missing one.
- State only links **explicitly supported** by a retrieved document — a test citing a requirement/story ID, a design section referencing a requirement, a commit message naming a story, a defect referencing a test. Where the sources show no link for a side, write **"NOT TRACED"** — never infer or invent a link to make the chain look whole. Honest "NOT TRACED" is the expected behavior, not a failure.
- Keep forward and backward links **mutually consistent**: if A traces forward to B, B's backward link must be A. When the sources show one direction but not its mirror, report the link on the side that has evidence and mark the other side unconfirmed rather than fabricating the mirror.
- Report **broken links** (a node referencing an ID not found in the sources) and **orphans** (a node with no link in either direction) explicitly — they are findings, not rows to drop.
- Use the ID conventions of the selected methodology exactly (waterfall: REQ-*, CMP-*, DLD-*, TC-*, TS-*; agile: epic/feature names, US-*, AC-*, TC-*); never invent an ID, and never silently coin one to bridge a gap.
- Cite the linking source inline `[N]` — for a link, cite the document that states it (ideally the source on each end the link touches). A link with no citation is not a link; mark it "NOT TRACED".
- If the SOURCES do not contain enough to trace the requested scope, output exactly the abstention sentinel and stop: *Insufficient context in knowledge base for this section.*
- Never write a heading, title, TOC, or References block; never mention being an AI; never emit internal notes, plan, or reasoning.
