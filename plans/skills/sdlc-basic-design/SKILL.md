---
name: sdlc-basic-design
description: Generative RAG orchestrator artifact skill for Basic Design / High-Level Design documents (HLD, basic design, system architecture, component design, requirement-to-component traceability). Entry point for both the Phase-2 plan bias and the Phase-3 writer discipline. Structurally inert — never adds/renames/reorders sections, never overrides the resolved # Output format. Loads in chat generative mode; in agent mode it is a FALLBACK behind the agent instruction.
---

# Basic Design (High-Level Design) — Artifact Skill

Artifact-specific guidance for generating a **Basic Design / HLD** in the generative
RAG orchestrator. This `SKILL.md` is the entry point; phase-specific guidance lives
in two referenced files, each loaded only by the phase that uses it:

- **[plan.md](plan.md)** — Phase 2 bias: `detectedTask`, per-section `retrievalMode`, `riskLevel`, sub-query seeds, `acceptanceCriteria` seeds. No writer prose.
- **[write.md](write.md)** — Phase 3 discipline: component decomposition, requirement-to-component traceability, approved-technology-only, design decisions with rationale, citation strictness. Shapes the body (HOW), never the structure (WHAT).

## When this skill applies
The user (chat mode) or the resolved task asks for a high-level/basic design that
bridges the SRS and the detail design.

## Mode rules (read first)
- **Chat generative mode** — no agent instruction exists; this skill is the primary
  source of HLD discipline. Both `plan.md` and `write.md` apply.
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
