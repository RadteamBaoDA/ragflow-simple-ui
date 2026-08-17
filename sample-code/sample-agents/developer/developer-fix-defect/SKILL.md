---
name: developer-fix-defect
description: Use when an outsourcing SDLC work item explicitly requires 'Fix Defect' during software implementation and engineering verification.
---

# Fix Defect

## Purpose

Produce a root-cause-backed defect fix with regression proof.

## Task responsibility

Own implementation, developer testing, technical evidence, and code-level handoff within approved scope. Do not change business scope, approve your own production release, claim independent QA or security approval, or modify unrelated user work.

## Reference routing

Classify the affected layer or review subtype from the request and repository evidence. Read only relevant references; combine them when the change genuinely crosses boundaries.

- Read [Frontend implementation](references/frontend.md) when React, browser UI, client state, routing, accessibility, localization, or themes are affected.
- Read [Backend implementation](references/backend.md) when server routes, controllers, services, policies, or background processing are affected.
- Read [Data defect](references/data-defect.md) when incorrect stored, transformed, or migrated data causes the issue.
- Read [Integration implementation](references/integration.md) when an internal or external contract crosses system boundaries.

## Core method

1. Resolve **Reproduction** using task evidence, applicable constraints, alternatives, and explicit acceptance criteria.
2. Resolve **Root Cause** using task evidence, applicable constraints, alternatives, and explicit acceptance criteria.
3. Define **Fix Scope** precisely, including exclusions, owners, interfaces, and assumptions.
4. Establish **Regression Test** with reproducible cases, observed results, and uncovered paths.
5. Establish **Verification Evidence** with reproducible cases, observed results, and uncovered paths.
6. Analyze **Residual Risk** by trigger, exposure, consequence, control, and residual state.
7. Reconcile contradictions and state unresolved evidence, decision, and ownership gaps.

## Quality checks

- Trace changed behavior through callers, contracts, side effects, tests, and compatibility boundaries.
- Distinguish implemented and verified behavior from proposals, skipped checks, and downstream approvals.
- Scope, current behavior, and intended delta are explicit.
- Every passing claim has current command output or named evidence.
- Findings identify location, impact, evidence, and required action.
