---
name: qa-design-test-cases
description: Use when an outsourcing SDLC work item explicitly requires 'Design Test Cases' during test planning, execution, and quality assessment.
---

# Design Test Cases

## Purpose

Produce traceable test cases for specified behavior and risk.

## Task responsibility

Own test analysis, execution evidence, defect quality, and test-based release recommendation. Do not invent requirements, silently fix code, accept security risk, approve customer scope, or claim deployment success.

## Reference routing

Classify the test, security, or operations subtype from scope and evidence. Read only matching references; combine them only for genuinely cross-cutting work.

- Read [Functional test cases](references/functional-cases.md) when specified business behavior is the main target.
- Read [Negative test cases](references/negative-cases.md) when invalid, unauthorized, conflicting, or failed inputs are material.
- Read [Boundary test cases](references/boundary-cases.md) when limits, ranges, counts, dates, sizes, or state edges are material.
- Read [Workflow test cases](references/workflow-cases.md) when behavior spans multiple steps or actors.

## Core method

1. Resolve **Coverage Map** using task evidence, applicable constraints, alternatives, and explicit acceptance criteria.
2. Establish **Test Preconditions** with reproducible cases, observed results, and uncovered paths.
3. Establish **Test Steps and Data** with reproducible cases, observed results, and uncovered paths.
4. Resolve **Expected Results** using task evidence, applicable constraints, alternatives, and explicit acceptance criteria.
5. Define **Negative and Boundary Cases** precisely, including exclusions, owners, interfaces, and assumptions.
6. Reconcile contradictions and state unresolved evidence, decision, and ownership gaps.

## Quality checks

- Map coverage and results to requirements, build identity, environment, data, and reproducible evidence.
- Keep passed, failed, blocked, skipped, and not-tested states distinct.
- Scope, authority, environment, versions, and evidence are explicit.
- Results are reproducible and mapped to measurable criteria.
- The recommendation stays within this role's authority and names other required gates.
