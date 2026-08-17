---
name: qa-execute-functional-testing
description: Use when an outsourcing SDLC work item explicitly requires 'Execute Functional Testing' during test planning, execution, and quality assessment.
---

# Execute Functional Testing

## Purpose

Produce a reproducible functional test execution report.

## Task responsibility

Own test analysis, execution evidence, defect quality, and test-based release recommendation. Do not invent requirements, silently fix code, accept security risk, approve customer scope, or claim deployment success.

## Reference routing

Classify the test, security, or operations subtype from scope and evidence. Read only matching references; combine them only for genuinely cross-cutting work.

- Read [UI functional execution](references/ui-execution.md) when browser interactions are tested.
- Read [API functional execution](references/api-execution.md) when service endpoints are tested directly.
- Read [Integration functional execution](references/integration-execution.md) when end-to-end cross-system behavior is tested.

## Core method

1. Resolve **Execution Summary** using task evidence, applicable constraints, alternatives, and explicit acceptance criteria.
2. Establish **Passed Tests** with reproducible cases, observed results, and uncovered paths.
3. Establish **Failed Tests** with reproducible cases, observed results, and uncovered paths.
4. Establish **Blocked Tests** with reproducible cases, observed results, and uncovered paths.
5. Identify and rank **Defects Raised** by evidence, impact, likelihood, and affected owner.
6. Establish **Evidence Links** with reproducible cases, observed results, and uncovered paths.
7. Reconcile contradictions and state unresolved evidence, decision, and ownership gaps.

## Quality checks

- Map coverage and results to requirements, build identity, environment, data, and reproducible evidence.
- Keep passed, failed, blocked, skipped, and not-tested states distinct.
- Scope, authority, environment, versions, and evidence are explicit.
- Results are reproducible and mapped to measurable criteria.
- The recommendation stays within this role's authority and names other required gates.
