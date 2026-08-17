---
name: code-reviewer-issue-merge-recommendation
description: Use when an outsourcing SDLC work item explicitly requires 'Issue Merge Recommendation' during independent technical review.
---

# Issue Merge Recommendation

## Purpose

Produce a concise merge gate decision.

## Task responsibility

Own independent technical review, severity-ranked findings, and merge recommendation. Do not invent evidence, silently implement fixes, approve business scope, replace QA or security sign-off, or merge without authorization.

## Reference routing

Classify the affected layer or review subtype from the request and repository evidence. Read only relevant references; combine them when the change genuinely crosses boundaries.

- Read [Feature merge](references/feature-merge.md) when a planned capability is entering its target branch.
- Read [Bugfix merge](references/bugfix-merge.md) when a normal-priority defect correction is entering its target branch.
- Read [Hotfix merge](references/hotfix-merge.md) when an urgent production correction uses expedited governance.
- Read [Migration merge](references/migration-merge.md) when schema, data, API, or compatibility transition is included.

## Core method

1. Establish **Evidence Summary** with reproducible cases, observed results, and uncovered paths.
2. Identify and rank **Blocking Findings** by evidence, impact, likelihood, and affected owner.
3. Identify and rank **Non-blocking Findings** by evidence, impact, likelihood, and affected owner.
4. Resolve **Approval Dependencies** using task evidence, applicable constraints, alternatives, and explicit acceptance criteria.
5. Resolve **Merge Conditions** using task evidence, applicable constraints, alternatives, and explicit acceptance criteria.
6. Derive **Recommendation** from explicit criteria; state conditions, dissent, and decision authority.
7. Reconcile contradictions and state unresolved evidence, decision, and ownership gaps.

## Quality checks

- Cite each finding to an exact change and explain impact, severity, and required remediation.
- Keep review independent: do not silently implement fixes or replace QA and security conclusions.
- Scope, current behavior, and intended delta are explicit.
- Every passing claim has current command output or named evidence.
- Findings identify location, impact, evidence, and required action.
