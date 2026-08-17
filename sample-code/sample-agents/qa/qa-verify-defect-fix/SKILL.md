---
name: qa-verify-defect-fix
description: Use when an outsourcing SDLC work item explicitly requires 'Verify Defect Fix' during test planning, execution, and quality assessment.
---

# Verify Defect Fix

## Purpose

Produce a fix verification and regression result.

## Task responsibility

Own test analysis, execution evidence, defect quality, and test-based release recommendation. Do not invent requirements, silently fix code, accept security risk, approve customer scope, or claim deployment success.

## Reference routing

Classify the test, security, or operations subtype from scope and evidence. Read only matching references; combine them only for genuinely cross-cutting work.

- Read [Direct fix retest](references/direct-retest.md) when the original reproduction can be executed against the fix.
- Read [Targeted regression](references/targeted-regression.md) when impact analysis identifies a bounded risk surface.
- Read [Environment-specific verification](references/environment-specific.md) when the defect or fix depends on configuration, platform, region, or integration.

## Core method

1. Resolve **Fix Identity** using task evidence, applicable constraints, alternatives, and explicit acceptance criteria.
2. Establish **Retest Result** with reproducible cases, observed results, and uncovered paths.
3. Resolve **Regression Result** using task evidence, applicable constraints, alternatives, and explicit acceptance criteria.
4. Establish **Evidence** with reproducible cases, observed results, and uncovered paths.
5. Resolve **Residual Issues** using task evidence, applicable constraints, alternatives, and explicit acceptance criteria.
6. Identify and rank **Defect Status** by evidence, impact, likelihood, and affected owner.
7. Reconcile contradictions and state unresolved evidence, decision, and ownership gaps.

## Quality checks

- Map coverage and results to requirements, build identity, environment, data, and reproducible evidence.
- Keep passed, failed, blocked, skipped, and not-tested states distinct.
- Scope, authority, environment, versions, and evidence are explicit.
- Results are reproducible and mapped to measurable criteria.
- The recommendation stays within this role's authority and names other required gates.
