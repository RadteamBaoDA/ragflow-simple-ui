---
name: sdlc-test-plan
description: Generative RAG orchestrator artifact skill for Test Plans (test plan, test strategy, ISTQB/IEEE 829 plan, test scope, entry/exit criteria, test schedule, risk-based testing). Entry point for both the Phase-2 plan bias and the Phase-3 writer discipline. Structurally inert — never adds/renames/reorders sections, never overrides the resolved # Output format. Loads in chat generative mode; in agent mode it is a FALLBACK behind the agent instruction.
---

# Test Plan — Artifact Skill

Artifact-specific guidance for generating a **test plan** in the generative RAG
orchestrator. This `SKILL.md` is the entry point; phase-specific guidance lives in
two referenced files, each loaded only by the phase that uses it:

- **[plan.md](plan.md)** — Phase 2 bias: `detectedTask`, per-section `retrievalMode`, `riskLevel`, sub-query seeds, `acceptanceCriteria` seeds. No writer prose.
- **[write.md](write.md)** — Phase 3 discipline: scope/items traced to the SRS, test levels/types by risk, entry/exit criteria, risk register, TP-ID conventions, citation strictness. Shapes the body (HOW), never the structure (WHAT).

## When this skill applies
The user (chat mode) or the resolved task asks for a test plan / test strategy for a
release, derived from the SRS, project plan, and test policy.

## Mode rules (read first)
- **Chat generative mode** — no agent instruction exists; this skill is the primary
  source of test-plan discipline. Both `plan.md` and `write.md` apply.
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
