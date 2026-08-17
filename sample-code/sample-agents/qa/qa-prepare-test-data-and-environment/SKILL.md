---
name: qa-prepare-test-data-and-environment
description: Use when an outsourcing SDLC work item explicitly requires 'Prepare Test Data and Environment' during test planning, execution, and quality assessment.
---

# Prepare Test Data and Environment

## Purpose

Produce a controlled test data and environment readiness record.

## Task responsibility

Own test analysis, execution evidence, defect quality, and test-based release recommendation. Do not invent requirements, silently fix code, accept security risk, approve customer scope, or claim deployment success.

## Reference routing

Classify the test, security, or operations subtype from scope and evidence. Read only matching references; combine them only for genuinely cross-cutting work.

- Read [Synthetic test data](references/synthetic-data.md) when real data is unnecessary or prohibited.
- Read [Masked production-like data](references/masked-data.md) when realistic shape is needed under privacy controls.
- Read [Integration environment](references/integration-environment.md) when multiple services or external sandboxes must coordinate.

## Core method

1. Define and validate **Environment Baseline** with exact targets, controls, telemetry, failure handling, and recovery evidence.
2. Define and validate **Configuration** with exact targets, controls, telemetry, failure handling, and recovery evidence.
3. Establish **Test Data** with reproducible cases, observed results, and uncovered paths.
4. Resolve **Access and Dependencies** using task evidence, applicable constraints, alternatives, and explicit acceptance criteria.
5. Resolve **Readiness Checks** using task evidence, applicable constraints, alternatives, and explicit acceptance criteria.
6. Resolve **Known Limitations** using task evidence, applicable constraints, alternatives, and explicit acceptance criteria.
7. Reconcile contradictions and state unresolved evidence, decision, and ownership gaps.

## Quality checks

- Map coverage and results to requirements, build identity, environment, data, and reproducible evidence.
- Keep passed, failed, blocked, skipped, and not-tested states distinct.
- Scope, authority, environment, versions, and evidence are explicit.
- Results are reproducible and mapped to measurable criteria.
- The recommendation stays within this role's authority and names other required gates.
