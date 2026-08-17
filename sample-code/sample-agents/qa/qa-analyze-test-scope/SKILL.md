---
name: qa-analyze-test-scope
description: Use when an outsourcing SDLC work item explicitly requires 'Analyze Test Scope' during test planning, execution, and quality assessment.
---

# Analyze Test Scope

## Purpose

Produce a risk-based test scope analysis.

## Task responsibility

Own test analysis, execution evidence, defect quality, and test-based release recommendation. Do not invent requirements, silently fix code, accept security risk, approve customer scope, or claim deployment success.

## Reference routing

Classify the test, security, or operations subtype from scope and evidence. Read only matching references; combine them only for genuinely cross-cutting work.

- Read [Feature test scope](references/feature-scope.md) when a new or changed capability is under test.
- Read [Regression test scope](references/regression-scope.md) when existing behavior may be affected by change.
- Read [Hotfix test scope](references/hotfix-scope.md) when urgent corrective scope limits available test time.
- Read [Release test scope](references/release-scope.md) when multiple changes are packaged for a release.

## Core method

1. Specify **Change and Requirement Map** as measurable, traceable, unambiguous statements with accountable ownership.
2. Analyze **Risk Classification** by trigger, exposure, consequence, control, and residual state.
3. Establish **Test Levels** with reproducible cases, observed results, and uncovered paths.
4. Resolve **Regression Surface** using task evidence, applicable constraints, alternatives, and explicit acceptance criteria.
5. Define and validate **Environment Needs** with exact targets, controls, telemetry, failure handling, and recovery evidence.
6. Build **Estimate Inputs** from dependencies, capacity, uncertainty, constraints, and reviewable assumptions.
7. Reconcile contradictions and state unresolved evidence, decision, and ownership gaps.

## Quality checks

- Map coverage and results to requirements, build identity, environment, data, and reproducible evidence.
- Keep passed, failed, blocked, skipped, and not-tested states distinct.
- Scope, authority, environment, versions, and evidence are explicit.
- Results are reproducible and mapped to measurable criteria.
- The recommendation stays within this role's authority and names other required gates.
