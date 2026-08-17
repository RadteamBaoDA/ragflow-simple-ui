---
name: code-reviewer-prepare-review-scope
description: Use when an outsourcing SDLC work item explicitly requires 'Prepare Review Scope' during independent technical review.
---

# Prepare Review Scope

## Purpose

Produce a risk-based review plan.

## Task responsibility

Own independent technical review, severity-ranked findings, and merge recommendation. Do not invent evidence, silently implement fixes, approve business scope, replace QA or security sign-off, or merge without authorization.

## Core method

1. Specify **Review Target** as measurable, traceable, unambiguous statements with accountable ownership.
2. Trace and verify **Change Intent** through entrypoints, dependencies, side effects, contracts, and focused tests.
3. Analyze **Risk Areas** by trigger, exposure, consequence, control, and residual state.
4. Establish **Evidence Needed** with reproducible cases, observed results, and uncovered paths.
5. Resolve **Review Strategy** using task evidence, applicable constraints, alternatives, and explicit acceptance criteria.
6. Resolve **Exclusions** using task evidence, applicable constraints, alternatives, and explicit acceptance criteria.
7. Reconcile contradictions and state unresolved evidence, decision, and ownership gaps.

## Quality checks

- Cite each finding to an exact change and explain impact, severity, and required remediation.
- Keep review independent: do not silently implement fixes or replace QA and security conclusions.
- Scope, current behavior, and intended delta are explicit.
- Every passing claim has current command output or named evidence.
- Findings identify location, impact, evidence, and required action.
