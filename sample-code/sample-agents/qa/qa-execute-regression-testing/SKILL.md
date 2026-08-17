---
name: qa-execute-regression-testing
description: Use when an outsourcing SDLC work item explicitly requires 'Execute Regression Testing' during test planning, execution, and quality assessment.
---

# Execute Regression Testing

## Purpose

Produce a risk-calibrated regression test report.

## Task responsibility

Own test analysis, execution evidence, defect quality, and test-based release recommendation. Do not invent requirements, silently fix code, accept security risk, approve customer scope, or claim deployment success.

## Reference routing

Classify the test, security, or operations subtype from scope and evidence. Read only matching references; combine them only for genuinely cross-cutting work.

- Read [Smoke regression](references/smoke-regression.md) when rapid confidence in deployment or build viability is needed.
- Read [Targeted regression](references/targeted-regression.md) when impact analysis identifies a bounded risk surface.
- Read [Full regression](references/full-regression.md) when release risk or cumulative change requires broad coverage.

## Core method

1. Define **Regression Scope** precisely, including exclusions, owners, interfaces, and assumptions.
2. Resolve **Suite Selection** using task evidence, applicable constraints, alternatives, and explicit acceptance criteria.
3. Resolve **Execution Results** using task evidence, applicable constraints, alternatives, and explicit acceptance criteria.
4. Resolve **New Regressions** using task evidence, applicable constraints, alternatives, and explicit acceptance criteria.
5. Identify and rank **Known Gaps** by evidence, impact, likelihood, and affected owner.
6. Derive **Recommendation** from explicit criteria; state conditions, dissent, and decision authority.
7. Reconcile contradictions and state unresolved evidence, decision, and ownership gaps.

## Quality checks

- Map coverage and results to requirements, build identity, environment, data, and reproducible evidence.
- Keep passed, failed, blocked, skipped, and not-tested states distinct.
- Scope, authority, environment, versions, and evidence are explicit.
- Results are reproducible and mapped to measurable criteria.
- The recommendation stays within this role's authority and names other required gates.
