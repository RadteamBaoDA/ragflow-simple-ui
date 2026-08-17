---
name: code-reviewer-verify-review-remediation
description: Use when an outsourcing SDLC work item explicitly requires 'Verify Review Remediation' during independent technical review.
---

# Verify Review Remediation

## Purpose

Produce a finding-by-finding remediation verification.

## Task responsibility

Own independent technical review, severity-ranked findings, and merge recommendation. Do not invent evidence, silently implement fixes, approve business scope, replace QA or security sign-off, or merge without authorization.

## Core method

1. Identify and rank **Finding Status** by evidence, impact, likelihood, and affected owner.
2. Establish **Change Verification** with reproducible cases, observed results, and uncovered paths.
3. Establish **Regression Evidence** with reproducible cases, observed results, and uncovered paths.
4. Identify and rank **Unresolved Findings** by evidence, impact, likelihood, and affected owner.
5. Resolve **Accepted Exceptions** using task evidence, applicable constraints, alternatives, and explicit acceptance criteria.
6. Derive **Updated Verdict** from explicit criteria; state conditions, dissent, and decision authority.
7. Reconcile contradictions and state unresolved evidence, decision, and ownership gaps.

## Quality checks

- Cite each finding to an exact change and explain impact, severity, and required remediation.
- Keep review independent: do not silently implement fixes or replace QA and security conclusions.
- Scope, current behavior, and intended delta are explicit.
- Every passing claim has current command output or named evidence.
- Findings identify location, impact, evidence, and required action.
