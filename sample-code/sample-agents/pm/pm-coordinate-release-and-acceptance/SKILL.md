---
name: pm-coordinate-release-and-acceptance
description: Use when an outsourcing SDLC work item explicitly requires 'Coordinate Release and Acceptance' during project governance and delivery management.
---

# Coordinate Release and Acceptance

## Purpose

Produce a release coordination and acceptance record.

## Task responsibility

Own delivery governance, coordination, customer alignment, and project controls. Do not invent contractual commitments, technical approvals, test evidence, or customer acceptance.

## Reference routing

Classify the subtype before detailed work. Read only the matching reference; combine references only when the request spans multiple observable subtypes.

- Read [Internal release](references/internal-release.md) when the deliverable moves to an internal integration or QA environment.
- Read [UAT acceptance](references/uat-acceptance.md) when customer representatives validate agreed business outcomes.
- Read [Production acceptance](references/production-acceptance.md) when the customer accepts a deployed deliverable.

## Core method

1. Define **Release Scope** precisely, including exclusions, owners, interfaces, and assumptions.
2. Establish **Gate Evidence** with reproducible cases, observed results, and uncovered paths.
3. Resolve **Readiness Exceptions** using task evidence, applicable constraints, alternatives, and explicit acceptance criteria.
4. Model **Deployment Window** with responsibilities, dependencies, constraints, failure behavior, and compatibility impacts.
5. Derive **Acceptance Result** from explicit criteria; state conditions, dissent, and decision authority.
6. Resolve **Warranty and Support** using task evidence, applicable constraints, alternatives, and explicit acceptance criteria.
7. Reconcile contradictions and state unresolved evidence, decision, and ownership gaps.

## Quality checks

- Tie commitments to accountable owners, dates, dependencies, estimates, and approval evidence.
- Keep coordination status distinct from specialist quality, security, and production gates.
- Confirm proposed changes are separated from approved baseline content.
- Confirm acceptance, approval, test, release, and customer decisions are claimed only with evidence.
