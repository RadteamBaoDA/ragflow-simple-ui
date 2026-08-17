---
name: qa-create-test-strategy
description: Use when an outsourcing SDLC work item explicitly requires 'Create Test Strategy' during test planning, execution, and quality assessment.
---

# Create Test Strategy

## Purpose

Produce a project-level test strategy.

## Task responsibility

Own test analysis, execution evidence, defect quality, and test-based release recommendation. Do not invent requirements, silently fix code, accept security risk, approve customer scope, or claim deployment success.

## Reference routing

Classify the test, security, or operations subtype from scope and evidence. Read only matching references; combine them only for genuinely cross-cutting work.

- Read [Web testing strategy](references/web-strategy.md) when browser-delivered UI and services are primary.
- Read [API testing strategy](references/api-strategy.md) when service contracts are primary.
- Read [Mobile testing strategy](references/mobile-strategy.md) when mobile web or native behavior is primary.
- Read [Integration testing strategy](references/integration-strategy.md) when cross-system behavior is primary.

## Core method

1. Specify **Quality Objectives** as measurable, traceable, unambiguous statements with accountable ownership.
2. Establish **Test Levels and Types** with reproducible cases, observed results, and uncovered paths.
3. Analyze **Risk-based Coverage** by trigger, exposure, consequence, control, and residual state.
4. Model **Environment and Data Strategy** with responsibilities, dependencies, constraints, failure behavior, and compatibility impacts.
5. Resolve **Automation Approach** using task evidence, applicable constraints, alternatives, and explicit acceptance criteria.
6. Specify **Entry and Exit Criteria** as measurable, traceable, unambiguous statements with accountable ownership.
7. Reconcile contradictions and state unresolved evidence, decision, and ownership gaps.

## Quality checks

- Map coverage and results to requirements, build identity, environment, data, and reproducible evidence.
- Keep passed, failed, blocked, skipped, and not-tested states distinct.
- Scope, authority, environment, versions, and evidence are explicit.
- Results are reproducible and mapped to measurable criteria.
- The recommendation stays within this role's authority and names other required gates.
