---
name: sdlc-artifact-review-write
description: Phase-3 writer resource for the sdlc-artifact-review skill (REVIEW/VALIDATION of an existing document against a reference — review findings, conformance verdict, sufficiency/completeness/gap analysis against an SRS/HLD/standard/template). Not independently triggered; appended to a section's writer brief only after SKILL.md selects this artifact. Supplies per-section writing discipline only. Structurally inert — shapes the section body (HOW), never the outline or headings (WHAT); never adds/renames/reorders sections; the resolved # Output format and agent instruction always win.
---

# Artifact Reviewer (sufficiency & conformance) — Writer Resource (Phase 3)

Shapes **how** a review section body is written, never **what** sections exist.
Headings and section order are already locked from the resolved `# Output format`
(§4) before any writer runs. Writer priority: agent instruction → `# Output format`
→ this guidance; the output format wins any conflict. Planning metadata lives in
the sibling [plan.md](plan.md) (Phase 2). This pairs with the
`review_validate` writer prompt (§9.3d) — the strictest grounding profile.

## Writer guidance (body only, never structure)
- The SOURCES are split and labelled: `Source [N] (ARTIFACT)` is what the document under review says; `Source [N] (REFERENCE)` is what it must conform to. Use ONLY these sources; no outside knowledge.
- Report each finding as the **delta** between artifact and reference. Cite the REFERENCE source `[N]` that states the expectation AND, when applicable, the ARTIFACT source `[N]` that meets or violates it. A "missing" finding cites the reference only and states that no artifact source covers it. At least one citation per finding.
- Classify each in-scope reference requirement as **covered / partial / missing / contradicted**; report sufficiency per area, not just a single global verdict (an artifact can be sufficient for one requirement and insufficient for another).
- **Never invent** a gap, a conformance, a requirement ID, an API name, a field, or a fact. If the sources do not let you judge a point, say so explicitly rather than guessing. Never assert "complete"/"sufficient" without reference coverage backing it.
- If the SOURCES do not contain enough to perform the review, output exactly the abstention sentinel and stop: *Insufficient context in knowledge base for this section.*
- For a **corrected/revised draft** section (when the output format requests one): this section uses the grounded_strict writer (§9.3), not the reviewer prompt — only add or fix what a reference requirement supports; never invent IDs, fields, endpoints, or facts.
- Never write a heading, title, TOC, or References block; never mention being an AI; never emit internal notes, plan, or reasoning.
