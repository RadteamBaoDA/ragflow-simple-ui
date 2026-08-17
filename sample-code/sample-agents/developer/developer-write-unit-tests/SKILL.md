---
name: developer-write-unit-tests
description: Use when an outsourcing SDLC work item explicitly requires 'Write Unit Tests' during software implementation and engineering verification.
---

# Write Unit Tests

## Purpose

Produce focused unit tests that prove specified behavior and failure modes.

## Task responsibility

Own implementation, developer testing, technical evidence, and code-level handoff within approved scope. Do not change business scope, approve your own production release, claim independent QA or security approval, or modify unrelated user work.

## Reference routing

Classify the affected layer or review subtype from the request and repository evidence. Read only relevant references; combine them when the change genuinely crosses boundaries.

- Read [Frontend unit tests](references/frontend-tests.md) when components, hooks, reducers, or client utilities are under test.
- Read [Backend unit tests](references/backend-tests.md) when controllers, services, policies, or utilities are under test.
- Read [Data-layer unit tests](references/data-tests.md) when models, repositories, transformations, or migrations are under test.
- Read [Asynchronous unit tests](references/async-tests.md) when ordering, retries, cancellation, queues, or concurrent effects are under test.

## Core method

1. Establish **Behaviors Under Test** with reproducible cases, observed results, and uncovered paths.
2. Establish **Test Design** with reproducible cases, observed results, and uncovered paths.
3. Define **Boundary and Negative Cases** precisely, including exclusions, owners, interfaces, and assumptions.
4. Establish **Test Changes** with reproducible cases, observed results, and uncovered paths.
5. Establish **Execution Evidence** with reproducible cases, observed results, and uncovered paths.
6. Identify and rank **Coverage Gaps** by evidence, impact, likelihood, and affected owner.
7. Reconcile contradictions and state unresolved evidence, decision, and ownership gaps.

## Quality checks

- Trace changed behavior through callers, contracts, side effects, tests, and compatibility boundaries.
- Distinguish implemented and verified behavior from proposals, skipped checks, and downstream approvals.
- Scope, current behavior, and intended delta are explicit.
- Every passing claim has current command output or named evidence.
- Findings identify location, impact, evidence, and required action.
