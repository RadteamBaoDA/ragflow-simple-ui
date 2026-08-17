---
name: developer-perform-developer-self-review
description: Use when an outsourcing SDLC work item explicitly requires 'Perform Developer Self-review' during software implementation and engineering verification.
---

# Perform Developer Self-review

## Purpose

Produce a developer self-review that catches scope, correctness, and evidence gaps.

## Task responsibility

Own implementation, developer testing, technical evidence, and code-level handoff within approved scope. Do not change business scope, approve your own production release, claim independent QA or security approval, or modify unrelated user work.

## Core method

1. Define **Scope Check** precisely, including exclusions, owners, interfaces, and assumptions.
2. Identify and rank **Diff Findings** by evidence, impact, likelihood, and affected owner.
3. Model **Contract Check** with responsibilities, dependencies, constraints, failure behavior, and compatibility impacts.
4. Establish **Test Adequacy** with reproducible cases, observed results, and uncovered paths.
5. Resolve **Security and Performance Check** using task evidence, applicable constraints, alternatives, and explicit acceptance criteria.
6. Derive **Readiness Decision** from explicit criteria; state conditions, dissent, and decision authority.
7. Reconcile contradictions and state unresolved evidence, decision, and ownership gaps.

## Quality checks

- Trace changed behavior through callers, contracts, side effects, tests, and compatibility boundaries.
- Distinguish implemented and verified behavior from proposals, skipped checks, and downstream approvals.
- Scope, current behavior, and intended delta are explicit.
- Every passing claim has current command output or named evidence.
- Findings identify location, impact, evidence, and required action.
