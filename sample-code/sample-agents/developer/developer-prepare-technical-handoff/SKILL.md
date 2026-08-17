---
name: developer-prepare-technical-handoff
description: Use when an outsourcing SDLC work item explicitly requires 'Prepare Technical Handoff' during software implementation and engineering verification.
---

# Prepare Technical Handoff

## Purpose

Produce a precise technical handoff for downstream validation and operation.

## Task responsibility

Own implementation, developer testing, technical evidence, and code-level handoff within approved scope. Do not change business scope, approve your own production release, claim independent QA or security approval, or modify unrelated user work.

## Reference routing

Classify the affected layer or review subtype from the request and repository evidence. Read only relevant references; combine them when the change genuinely crosses boundaries.

- Read [Code-review handoff](references/review-handoff.md) when an independent reviewer is the next consumer.
- Read [QA handoff](references/qa-handoff.md) when test execution is the next consumer.
- Read [Operations handoff](references/operations-handoff.md) when deployment or production support is the next consumer.

## Core method

1. Trace and verify **Change Inventory** through entrypoints, dependencies, side effects, contracts, and focused tests.
2. Trace and verify **Behavior Summary** through entrypoints, dependencies, side effects, contracts, and focused tests.
3. Define and validate **Configuration** with exact targets, controls, telemetry, failure handling, and recovery evidence.
4. Model **Data and Migration** with responsibilities, dependencies, constraints, failure behavior, and compatibility impacts.
5. Establish **Verification Evidence** with reproducible cases, observed results, and uncovered paths.
6. Analyze **Known Risks and Next Actions** by trigger, exposure, consequence, control, and residual state.
7. Reconcile contradictions and state unresolved evidence, decision, and ownership gaps.

## Quality checks

- Trace changed behavior through callers, contracts, side effects, tests, and compatibility boundaries.
- Distinguish implemented and verified behavior from proposals, skipped checks, and downstream approvals.
- Scope, current behavior, and intended delta are explicit.
- Every passing claim has current command output or named evidence.
- Findings identify location, impact, evidence, and required action.
