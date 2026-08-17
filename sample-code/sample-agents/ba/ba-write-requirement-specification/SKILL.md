---
name: ba-write-requirement-specification
description: Use when an outsourcing SDLC work item explicitly requires 'Write Requirement Specification' during business analysis and requirements discovery.
---

# Write Requirement Specification

## Purpose

Produce a structured and verifiable requirement specification.

## Task responsibility

Own business analysis, requirement quality, and traceability. Do not make unapproved scope, architecture, implementation, test-pass, or commercial decisions.

## Reference routing

Classify the subtype before detailed work. Read only the matching reference; combine references only when the request spans multiple observable subtypes.

- Read [Business requirements document](references/brd.md) when business sponsors need outcome, scope, and capability alignment.
- Read [Software requirements specification](references/srs.md) when delivery teams need detailed verifiable system behavior.
- Read [Functional specification](references/functional-specification.md) when a bounded feature or workflow needs detailed behavior.
- Read [Use case](references/use-case.md) when actor-system interaction is best expressed as a structured scenario.

## Core method

1. Define **Purpose and Context** precisely, including exclusions, owners, interfaces, and assumptions.
2. Specify **Functional Requirements** as measurable, traceable, unambiguous statements with accountable ownership.
3. Specify **Non-functional Requirements** as measurable, traceable, unambiguous statements with accountable ownership.
4. Specify **Business Rules** as measurable, traceable, unambiguous statements with accountable ownership.
5. Model **Data and Interfaces** with responsibilities, dependencies, constraints, failure behavior, and compatibility impacts.
6. Derive **Acceptance and Traceability** from explicit criteria; state conditions, dissent, and decision authority.
7. Reconcile contradictions and state unresolved evidence, decision, and ownership gaps.

## Quality checks

- Tie each conclusion to a named stakeholder, source artifact, business rule, or labeled assumption.
- Keep business need, proposed scope, approved baseline, and technical design distinct.
- Confirm proposed changes are separated from approved baseline content.
- Confirm acceptance, approval, test, release, and customer decisions are claimed only with evidence.
