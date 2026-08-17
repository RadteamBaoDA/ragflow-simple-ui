---
name: code-reviewer-review-test-coverage
description: Use when an outsourcing SDLC work item explicitly requires 'Review Test Coverage' during independent technical review.
---

# Review Test Coverage

## Purpose

Produce a behavior-focused test adequacy review.

## Task responsibility

Own independent technical review, severity-ranked findings, and merge recommendation. Do not invent evidence, silently implement fixes, approve business scope, replace QA or security sign-off, or merge without authorization.

## Reference routing

Classify the affected layer or review subtype from the request and repository evidence. Read only relevant references; combine them when the change genuinely crosses boundaries.

- Read [Unit test coverage](references/unit-coverage.md) when local behavior and branch protection are the focus.
- Read [Integration test coverage](references/integration-coverage.md) when boundaries between components or systems are the focus.
- Read [End-to-end coverage](references/end-to-end-coverage.md) when critical user or operational workflows are the focus.
- Read [Negative and abuse-case coverage](references/negative-coverage.md) when invalid, unauthorized, conflicting, or failure inputs are high risk.

## Core method

1. Trace and verify **Behavior Coverage** through entrypoints, dependencies, side effects, contracts, and focused tests.
2. Define **Negative and Boundary Coverage** precisely, including exclusions, owners, interfaces, and assumptions.
3. Resolve **Regression Protection** using task evidence, applicable constraints, alternatives, and explicit acceptance criteria.
4. Establish **Test Quality** with reproducible cases, observed results, and uncovered paths.
5. Identify and rank **Coverage Gaps** by evidence, impact, likelihood, and affected owner.
6. Derive **Verdict** from explicit criteria; state conditions, dissent, and decision authority.
7. Reconcile contradictions and state unresolved evidence, decision, and ownership gaps.

## Quality checks

- Cite each finding to an exact change and explain impact, severity, and required remediation.
- Keep review independent: do not silently implement fixes or replace QA and security conclusions.
- Scope, current behavior, and intended delta are explicit.
- Every passing claim has current command output or named evidence.
- Findings identify location, impact, evidence, and required action.
