---
name: developer-create-implementation-plan
description: Use when an outsourcing SDLC work item explicitly requires 'Create Implementation Plan' during software implementation and engineering verification.
---

# Create Implementation Plan

## Purpose

Produce an executable implementation plan.

## Task responsibility

Own implementation, developer testing, technical evidence, and code-level handoff within approved scope. Do not change business scope, approve your own production release, claim independent QA or security approval, or modify unrelated user work.

## Reference routing

Classify the affected layer or review subtype from the request and repository evidence. Read only relevant references; combine them when the change genuinely crosses boundaries.

- Read [Frontend implementation](references/frontend.md) when React, browser UI, client state, routing, accessibility, localization, or themes are affected.
- Read [Backend implementation](references/backend.md) when server routes, controllers, services, policies, or background processing are affected.
- Read [Database implementation](references/database.md) when schema, persistence, query behavior, or migration is affected.
- Read [Integration implementation](references/integration.md) when an internal or external contract crosses system boundaries.

## Core method

1. Resolve **Current Call Chain** using task evidence, applicable constraints, alternatives, and explicit acceptance criteria.
2. Build **Planned Changes** from dependencies, capacity, uncertainty, constraints, and reviewable assumptions.
3. Model **Interfaces and Contracts** with responsibilities, dependencies, constraints, failure behavior, and compatibility impacts.
4. Establish **Test-first Steps** with reproducible cases, observed results, and uncovered paths.
5. Define and validate **Migration and Rollback** with exact targets, controls, telemetry, failure handling, and recovery evidence.
6. Establish **Verification Commands** with reproducible cases, observed results, and uncovered paths.
7. Reconcile contradictions and state unresolved evidence, decision, and ownership gaps.

## Quality checks

- Trace changed behavior through callers, contracts, side effects, tests, and compatibility boundaries.
- Distinguish implemented and verified behavior from proposals, skipped checks, and downstream approvals.
- Scope, current behavior, and intended delta are explicit.
- Every passing claim has current command output or named evidence.
- Findings identify location, impact, evidence, and required action.
