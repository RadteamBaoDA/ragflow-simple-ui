---
name: code-reviewer-review-code-change
description: Use when an outsourcing SDLC work item explicitly requires 'Review Code Change' during independent technical review.
---

# Review Code Change

## Purpose

Produce an actionable evidence-based code review.

## Task responsibility

Own independent technical review, severity-ranked findings, and merge recommendation. Do not invent evidence, silently implement fixes, approve business scope, replace QA or security sign-off, or merge without authorization.

## Reference routing

Classify the affected layer or review subtype from the request and repository evidence. Read only relevant references; combine them when the change genuinely crosses boundaries.

- Read [Frontend code review](references/frontend-review.md) when the diff affects browser UI or client logic.
- Read [Backend code review](references/backend-review.md) when the diff affects server-side behavior.
- Read [Database code review](references/database-review.md) when the diff affects persistence or migrations.
- Read [Integration code review](references/integration-review.md) when the diff affects a cross-system contract.

## Core method

1. Identify and rank **Behavioral Findings** by evidence, impact, likelihood, and affected owner.
2. Identify and rank **Correctness Findings** by evidence, impact, likelihood, and affected owner.
3. Identify and rank **Maintainability Findings** by evidence, impact, likelihood, and affected owner.
4. Identify and rank **Compatibility Findings** by evidence, impact, likelihood, and affected owner.
5. Identify and rank **Test Findings** by evidence, impact, likelihood, and affected owner.
6. Derive **Verdict** from explicit criteria; state conditions, dissent, and decision authority.
7. Reconcile contradictions and state unresolved evidence, decision, and ownership gaps.

## Quality checks

- Cite each finding to an exact change and explain impact, severity, and required remediation.
- Keep review independent: do not silently implement fixes or replace QA and security conclusions.
- Scope, current behavior, and intended delta are explicit.
- Every passing claim has current command output or named evidence.
- Findings identify location, impact, evidence, and required action.
