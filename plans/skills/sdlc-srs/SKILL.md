---
name: sdlc-srs
description: Generative RAG orchestrator artifact skill for Software Requirements Specifications (SRS, requirements spec, functional/non-functional requirements, IEEE 29148, "shall" statements). Entry point for both the Phase-2 plan bias and the Phase-3 writer discipline. Structurally inert — never adds/renames/reorders sections, never overrides the resolved # Output format. Loads in chat generative mode; in agent mode it is a FALLBACK behind the agent instruction.
---

# Software Requirements Specification (SRS) — Artifact Skill

Artifact-specific guidance for generating an **SRS** in the generative RAG
orchestrator. This `SKILL.md` is the entry point; phase-specific guidance lives in
two referenced files, each loaded only by the phase that uses it:

- **[plan.md](plan.md)** — Phase 2 bias: `detectedTask`, per-section `retrievalMode`, `riskLevel`, sub-query seeds, `acceptanceCriteria` seeds. No writer prose.
- **[write.md](write.md)** — Phase 3 discipline: atomic testable "shall" statements, REQ-ID numbering, functional vs non-functional separation, no-invented-requirements, citation strictness. Shapes the body (HOW), never the structure (WHAT).

## When this skill applies
The user (chat mode) or the resolved task asks for a software requirements
specification derived from a BRD, meeting notes, or change requests.

## Mode rules (read first)
- **Chat generative mode** — no agent instruction exists; this skill is the primary
  source of SRS discipline. Both `plan.md` and `write.md` apply.
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
