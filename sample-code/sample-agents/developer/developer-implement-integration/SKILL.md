---
name: developer-implement-integration
description: Use when an outsourcing SDLC work item explicitly requires 'Implement Integration' during software implementation and engineering verification.
---

# Implement Integration

## Purpose

Produce a resilient integration implementation with contract evidence.

## Task responsibility

Own implementation, developer testing, technical evidence, and code-level handoff within approved scope. Do not change business scope, approve your own production release, claim independent QA or security approval, or modify unrelated user work.

## Reference routing

Classify the affected layer or review subtype from the request and repository evidence. Read only relevant references; combine them when the change genuinely crosses boundaries.

- Read [REST integration](references/rest-integration.md) when HTTP request-response is used.
- Read [Event integration](references/event-integration.md) when messages or events connect components.
- Read [Third-party SDK integration](references/third-party-sdk.md) when a vendor SDK encapsulates an external service.
- Read [Database integration](references/database-integration.md) when multiple components coordinate through persistence.

## Core method

1. Model **Contract Mapping** with responsibilities, dependencies, constraints, failure behavior, and compatibility impacts.
2. Define **Authentication Boundary** precisely, including exclusions, owners, interfaces, and assumptions.
3. Analyze **Failure and Retry** by trigger, exposure, consequence, control, and residual state.
4. Trace and verify **Idempotency and Compatibility** through entrypoints, dependencies, side effects, contracts, and focused tests.
5. Establish **Tests** with reproducible cases, observed results, and uncovered paths.
6. Establish **Operational Evidence** with reproducible cases, observed results, and uncovered paths.
7. Reconcile contradictions and state unresolved evidence, decision, and ownership gaps.

## Quality checks

- Trace changed behavior through callers, contracts, side effects, tests, and compatibility boundaries.
- Distinguish implemented and verified behavior from proposals, skipped checks, and downstream approvals.
- Scope, current behavior, and intended delta are explicit.
- Every passing claim has current command output or named evidence.
- Findings identify location, impact, evidence, and required action.
