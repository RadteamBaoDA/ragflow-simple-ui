---
name: sdlc-artifact-review
description: Generative RAG orchestrator artifact skill for REVIEW/VALIDATION of an existing document against a reference (e.g. "is this test spec complete and consistent with the SRS?", conformance check, sufficiency/completeness/gap analysis). Entry point for both the Phase-2 plan bias and the Phase-3 writer discipline. Drives the review_validate task with dual grounding. Structurally inert — never adds/renames/reorders sections, never overrides the resolved # Output format. Loads in chat generative mode; in agent mode it is a FALLBACK behind the agent instruction.
---

# Artifact Reviewer (sufficiency & conformance) — Artifact Skill

Artifact-specific guidance for **reviewing/validating** an existing artifact against
the reference it must conform to. This is the `review_validate` task type — the
strictest grounding profile, with dual grounding (artifact + reference). This
`SKILL.md` is the entry point; phase-specific guidance lives in two referenced files,
each loaded only by the phase that uses it:

- **[plan.md](plan.md)** — Phase 2 bias: `review_validate`, dual sub-query split (`subQueries`=artifact, `referenceQueries`=reference), `grounded_strict`, `mustCite=true`, `acceptanceCriteria` seeds, corrected-draft→`transform_derive` rule. No writer prose.
- **[write.md](write.md)** — Phase 3 discipline: report the delta between artifact and reference, cite each side, classify covered/partial/missing/contradicted, never invent gaps or conformance, abstention sentinel. Shapes the body (HOW), never the structure (WHAT).

## When this skill applies
The user (chat mode) or the resolved task asks whether an existing artifact is
complete / consistent / sufficient against a reference (SRS, standard, template,
upstream design), optionally with a corrected version.

## Mode rules (read first)
- **Chat generative mode** — no agent instruction exists; this skill is the primary
  source of review discipline. Both `plan.md` and `write.md` apply.
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
