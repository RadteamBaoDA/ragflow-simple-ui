---
name: sdlc-traceability-plan
description: Phase-2 plan resource for the sdlc-traceability skill (end-to-end, bi-directional SDLC traceability — forward/backward tracing across business need → requirement → design → code → test → defect, in waterfall or agile). Not independently triggered; loaded by the planner only after SKILL.md selects this artifact. Supplies plan metadata to bias the single planner call. Structurally inert — supplies no outline, never adds/renames/reorders sections, never overrides the resolved # Output format.
---

# SDLC Traceability — Plan Resource (Phase 2)

Biases the planner for an end-to-end traceability document. The outline comes solely
from the resolved `# Output format` (§4); this resource supplies **no outline** and
**no writer prose** (that lives in the sibling [write.md](write.md)). The resolved
output format always wins. This is the strictest grounding profile in the set,
alongside the RTM — every link is a claim that needs a citation on both ends.

## Plan hints (Phase 2)
- **detectedTask:** `synthesize_multi` (multiple lifecycle artifacts — requirements, design, code refs, tests, defects — fused into a trace). When the request traces a single seed node outward from one already-retrieved artifact, `transform_derive` is acceptable.
- **retrievalMode:** `grounded_strict` for every trace/findings section, `mustCite=true`, `assumptionsAllowed=false`. Only state links explicitly supported by retrieved chunks; abstention (the sentinel) is *expected* for links the sources cannot prove — never assert a link to make the chain look complete.
- **Methodology dispatch (the defining trait):** decide waterfall vs agile first (see SKILL.md "Methodology selection"), then seed the sub-queries from the matching reference file — [references/waterfall.md](references/waterfall.md) or [references/agile.md](references/agile.md). Load only the one that matches; the chain shape and ID conventions come from there.
- **Bi-directional retrieval:** for each node in scope, seed sub-queries in **both directions** — its upstream source (what it derives from) and its downstream consumers (what derives from it) — so a trace can be confirmed from either side rather than asserted from one.
- **riskLevel:** `normal` by default; `high` for regulated/safety-critical programs where traceability is an audit obligation (reinforces the strict grounding already mandated).
- **Sub-query seeds (methodology-agnostic skeleton; the reference file supplies the concrete IDs):** "<node id> upstream source / parent it derives from"; "<node id> downstream items / children that reference it"; "tests citing <requirement/story id>"; "code units / commits referencing <design or story id>"; "defects linked to <requirement/test id>".
- **acceptanceCriteria seeds (§9.2 step 10, §A.10.1):** e.g. "every trace link is explicitly supported by a retrieved document and cites the source on each end it touches"; "each in-scope node shows BOTH its backward link (source) and forward link (consumer), or 'NOT TRACED' where a side is absent — links are never inferred or invented"; "forward and backward links are mutually consistent (if A traces forward to B, B traces backward to A)"; "broken links (references to IDs not found in the sources) and orphans (nodes with no link either direction) are reported, not silently dropped"; "ID conventions match the selected methodology — never mixed, never invented". Body properties only.
- **No-KB (§4.5):** if `noKnowledgeBase=true`, all sections forced to `retrievalMode="none"` — but a traceability document with no KB has nothing to trace, so surface the `noKnowledgeBase` warning prominently (there is nothing to link).

> These hints are the **artifact-level** counterpart to the per-agent `agentPlanningHints` (§4.6): the planner fuses both (plus the section's `# Output format` item and any mapped requirement headings) into the final per-section plan. The resolved `# Output format` and security always win.
