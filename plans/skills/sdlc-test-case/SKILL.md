---
name: sdlc-test-case
description: Generative RAG orchestrator artifact skill for Test Cases (test case, test step/expected result, boundary value, equivalence partition, negative test, requirements-to-test derivation). Entry point for both the Phase-2 plan bias and the Phase-3 writer discipline. Structurally inert — never adds/renames/reorders sections, never overrides the resolved # Output format. Loads in chat generative mode; in agent mode it is a FALLBACK behind the agent instruction.
---

# Test Case — Artifact Skill

Artifact-specific guidance for generating **test cases** in the generative RAG
orchestrator. This `SKILL.md` is the entry point; the phase-specific guidance lives
in two referenced files, each loaded only by the phase that consumes it:

- **[plan.md](plan.md)** — Phase 2 (plan + outline) bias: `detectedTask`, per-section `retrievalMode`, `riskLevel`, sub-query seeds, `acceptanceCriteria` seeds. The planner never sees retrieved chunks, so this file carries no writer prose.
- **[write.md](write.md)** — Phase 3 (per-section writing) discipline: tone, citation strictness, no-invented-IDs, abstention. Appended to the writer brief; shapes the body (HOW), never the structure (WHAT).

## When this skill applies
The user (chat mode) or the resolved task asks for test cases / test scenarios
derived from requirements, use cases, or a detail design.

## Mode rules (read first)
- **Chat generative mode** — there is no agent instruction, so this skill is the
  primary source of test-case discipline. Both `plan.md` and `write.md` apply.
- **Agent mode** — the agent instruction's `## Skill` block is the source of truth
  and **always wins**. This skill loads only as a **fallback**: it fills artifact
  discipline the agent instruction did not state, and is dropped wherever it would
  conflict with the instruction, the resolved `# Output format`, or security rules.

## Invariants (both phases)
- Structure comes solely from the resolved `# Output format` (§4). This skill
  supplies **no outline** and may never add, rename, reorder, or emit a title, TOC,
  or References block.
- Precedence: agent instruction → resolved `# Output format` → this skill. Security
  (`security`/`noKnowledgeBase`) is never touched.
