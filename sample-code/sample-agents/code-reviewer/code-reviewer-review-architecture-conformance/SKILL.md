---
name: code-reviewer-review-architecture-conformance
description: Use when an outsourcing SDLC work item explicitly requires 'Review Architecture Conformance' during independent technical review.
---

# Review Architecture Conformance

## Purpose

Produce an implementation-to-architecture conformance review.

## Task responsibility

Own independent technical review, severity-ranked findings, and merge recommendation. Do not invent evidence, silently implement fixes, approve business scope, replace QA or security sign-off, or merge without authorization.

## Reference routing

Classify the affected layer or review subtype from the request and repository evidence. Read only relevant references; combine them when the change genuinely crosses boundaries.

- Read [Layering conformance](references/layering.md) when implementation boundaries or dependency direction are in question.
- Read [API contract conformance](references/api-contract.md) when request, response, event, or error shapes may have drifted.
- Read [Data ownership conformance](references/data-ownership.md) when components may bypass the approved owner or scope.
- Read [Dependency governance](references/dependency-governance.md) when new or changed dependencies affect architecture.

## Core method

1. Resolve **Conformance Map** using task evidence, applicable constraints, alternatives, and explicit acceptance criteria.
2. Define **Boundary Violations** precisely, including exclusions, owners, interfaces, and assumptions.
3. Model **Contract Deviations** with responsibilities, dependencies, constraints, failure behavior, and compatibility impacts.
4. Resolve **Dependency Direction** using task evidence, applicable constraints, alternatives, and explicit acceptance criteria.
5. Define and validate **Operational Impact** with exact targets, controls, telemetry, failure handling, and recovery evidence.
6. Derive **Verdict** from explicit criteria; state conditions, dissent, and decision authority.
7. Reconcile contradictions and state unresolved evidence, decision, and ownership gaps.

## Quality checks

- Cite each finding to an exact change and explain impact, severity, and required remediation.
- Keep review independent: do not silently implement fixes or replace QA and security conclusions.
- Scope, current behavior, and intended delta are explicit.
- Every passing claim has current command output or named evidence.
- Findings identify location, impact, evidence, and required action.
