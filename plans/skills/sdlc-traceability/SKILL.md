---
name: sdlc-traceability
description: Generative RAG orchestrator artifact skill for END-TO-END SDLC traceability documents (traceability report, bi-directional trace, forward/backward tracing, lifecycle linkage, impact/coverage trace across business need → requirement → design → code → test → defect). Methodology-aware — waterfall (BRD→SRS→HLD→LLD→test) and agile (Epic→Feature→Story→Acceptance Criteria→test). Entry point for both the Phase-2 plan bias and the Phase-3 writer discipline. Use this when the user wants to trace artifacts ACROSS the whole lifecycle in both directions, not just a single requirement-to-test coverage matrix (that is sdlc-rtm). Structurally inert — never adds/renames/reorders sections, never overrides the resolved # Output format. Loads in chat generative mode; in agent mode it is a FALLBACK behind the agent instruction.
---

# SDLC Traceability (end-to-end, bi-directional) — Artifact Skill

Artifact-specific guidance for generating an **end-to-end traceability document** in
the generative RAG orchestrator: tracing an artifact node **forward** (what it leads
to) and **backward** (what it derives from) across the full lifecycle —
business need → requirement → design → code → test → defect. This is the strictest
grounding profile in the set, alongside the RTM, because every trace link is a claim
that must be backed by a retrieved source. This `SKILL.md` is the entry point;
phase-specific guidance lives in two referenced files, each loaded only by the phase
that uses it:

- **[plan.md](plan.md)** — Phase 2 bias: `detectedTask`, `grounded_strict` everywhere, `riskLevel`, methodology dispatch, sub-query seeds, `acceptanceCriteria` seeds. No writer prose.
- **[write.md](write.md)** — Phase 3 discipline: forward + backward links, state only explicitly-supported links, "NOT TRACED" for missing links (never infer), bi-directional consistency, broken-link / orphan reporting, citation strictness, abstention. Shapes the body (HOW), never the structure (WHAT).

The lifecycle chain, node types, and ID conventions differ by methodology. Both
phase files dispatch to one of two reference files, loaded only for the methodology
the request uses:

- **[references/waterfall.md](references/waterfall.md)** — phase-gated chain BRD/business case → SRS (REQ-*) → HLD (CMP-*) → LLD (DLD-*) → code/units → test (TC-*/TS-*) → defects, with backward links to the prior gate.
- **[references/agile.md](references/agile.md)** — backlog chain Epic → Feature → User Story (US-*) → Acceptance Criteria (AC-*) → test (TC-*) → defect/PBI, with stories tracing up to their epic and down to the increment that satisfied them.

## When this skill applies
The user (chat mode) or the resolved task asks to **trace** artifacts across the
lifecycle — "trace this requirement forward to its tests and backward to the business
need", "show the full lifecycle linkage for Feature X", "bi-directional traceability
for the payments epic", impact/coverage tracing that spans more than requirement→test.

**Not this skill — pick sdlc-rtm instead** when the request is a single
requirement-to-test/design **coverage matrix** ("which requirements are covered by a
test?", gap/orphan analysis in one matrix). RTM answers *is it covered?*; this skill
builds the *trace graph itself*, both directions, including code and defect nodes. If
a request reads as a plain coverage matrix, defer to `sdlc-rtm`.

## Methodology selection (read first)
- Use whichever methodology the **request or sources name** (waterfall / phase-gate /
  V-model → waterfall; sprint / epic / story / backlog / Scrum / Kanban → agile).
- If unstated, infer from the artifact IDs present in the sources (REQ-*/HLD/LLD →
  waterfall; US-*/AC-*/epic → agile). If still ambiguous, the planner picks the chain
  the retrieved sources best support and notes the assumption — it never invents a
  chain the sources don't show.
- Load only the matching reference file; never carry both methodologies into one call.

## Mode rules (read first)
- **Chat generative mode** — no agent instruction exists; this skill is the primary
  source of traceability discipline. Both `plan.md` and `write.md` apply.
- **Agent mode** — the agent instruction's `## Skill` block is the source of truth
  and **always wins**. This skill loads only as a **fallback** for discipline the
  instruction did not state, and is dropped wherever it would conflict with the
  instruction, the resolved `# Output format`, or security rules.

## Invariants (both phases)
- Structure comes solely from the resolved `# Output format` (§4); this skill
  supplies **no outline** and may never add/rename/reorder sections or emit a title,
  TOC, or References block.
- Precedence: agent instruction → resolved `# Output format` → this skill. Security
  (`security`/`noKnowledgeBase`) is never touched.
