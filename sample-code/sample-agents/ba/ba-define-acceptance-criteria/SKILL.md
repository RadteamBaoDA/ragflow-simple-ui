---
name: ba-define-acceptance-criteria
description: Use when an outsourcing SDLC work item explicitly requires 'Define Acceptance Criteria' during business analysis and requirements discovery.
---

# Define Acceptance Criteria

## Purpose

Produce observable acceptance criteria tied to requirements and risk.

## Task responsibility

Own business analysis, requirement quality, and traceability. Do not make unapproved scope, architecture, implementation, test-pass, or commercial decisions.

## Reference routing

Classify the subtype before detailed work. Read only the matching reference; combine references only when the request spans multiple observable subtypes.

- Read [Scenario-based criteria](references/scenario-based.md) when behavior has meaningful workflows or branches.
- Read [Rule-based criteria](references/rule-based.md) when deterministic business rules dominate behavior.
- Read [Non-functional criteria](references/non-functional.md) when quality attributes determine acceptance.

## Core method

1. Derive **Acceptance Scenarios** from explicit criteria; state conditions, dissent, and decision authority.
2. Specify **Business Rule Coverage** as measurable, traceable, unambiguous statements with accountable ownership.
3. Resolve **Negative Conditions** using task evidence, applicable constraints, alternatives, and explicit acceptance criteria.
4. Model **Data Conditions** with responsibilities, dependencies, constraints, failure behavior, and compatibility impacts.
5. Resolve **Non-functional Conditions** using task evidence, applicable constraints, alternatives, and explicit acceptance criteria.
6. Establish **Evidence Method** with reproducible cases, observed results, and uncovered paths.
7. Reconcile contradictions and state unresolved evidence, decision, and ownership gaps.

## Quality checks

- Tie each conclusion to a named stakeholder, source artifact, business rule, or labeled assumption.
- Keep business need, proposed scope, approved baseline, and technical design distinct.
- Confirm proposed changes are separated from approved baseline content.
- Confirm acceptance, approval, test, release, and customer decisions are claimed only with evidence.
