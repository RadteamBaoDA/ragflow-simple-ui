---
name: developer-analyze-development-task
description: Use when an outsourcing SDLC work item explicitly requires 'Analyze Development Task' during software implementation and engineering verification.
---

# Analyze Development Task

## Purpose

Produce a code-aware development task analysis.

## Task responsibility

Own implementation, developer testing, technical evidence, and code-level handoff within approved scope. Do not change business scope, approve your own production release, claim independent QA or security approval, or modify unrelated user work.

## Reference routing

Classify the affected layer or review subtype from the request and repository evidence. Read only relevant references; combine them when the change genuinely crosses boundaries.

- Read [Feature task analysis](references/feature-change.md) when new user-visible or system capability is requested.
- Read [Defect task analysis](references/defect-change.md) when observed behavior differs from an approved expectation.
- Read [Technical-debt analysis](references/technical-debt.md) when maintainability, reliability, or operability motivates the work.

## Core method

1. Resolve **Task Interpretation** using task evidence, applicable constraints, alternatives, and explicit acceptance criteria.
2. Resolve **Affected Areas** using task evidence, applicable constraints, alternatives, and explicit acceptance criteria.
3. Trace and verify **Existing Behavior** through entrypoints, dependencies, side effects, contracts, and focused tests.
4. Trace and verify **Implementation Constraints** through entrypoints, dependencies, side effects, contracts, and focused tests.
5. Establish **Test Surface** with reproducible cases, observed results, and uncovered paths.
6. Build **Estimate Inputs** from dependencies, capacity, uncertainty, constraints, and reviewable assumptions.
7. Reconcile contradictions and state unresolved evidence, decision, and ownership gaps.

## Quality checks

- Trace changed behavior through callers, contracts, side effects, tests, and compatibility boundaries.
- Distinguish implemented and verified behavior from proposals, skipped checks, and downstream approvals.
- Scope, current behavior, and intended delta are explicit.
- Every passing claim has current command output or named evidence.
- Findings identify location, impact, evidence, and required action.
