---
name: ux-ui-design-user-flow
description: Use when an outsourcing SDLC work item explicitly requires 'Design User Flow' during product discovery and experience design.
---

# Design User Flow

## Purpose

Produce a complete user flow specification.

## Task responsibility

Own user experience, interaction, content, accessibility design evidence, and design handoff. Do not approve business scope, technical feasibility, implementation quality, test completion, or customer acceptance for other roles.

## Reference routing

Classify the variant from observable requirements or artifacts. Read only the relevant reference; combine references only when the work genuinely spans multiple variants.

- Read [Happy path](references/happy-path.md) when the primary successful route needs definition.
- Read [Exception and recovery path](references/exception-path.md) when validation, system, permission, or business failures materially affect experience.
- Read [Multi-role flow](references/multi-role-flow.md) when work passes between actors with different permissions.

## Core method

1. Define **Actors and Entry Points** precisely, including exclusions, owners, interfaces, and assumptions.
2. Resolve **Happy Path** using task evidence, applicable constraints, alternatives, and explicit acceptance criteria.
3. Resolve **Alternative Paths** using task evidence, applicable constraints, alternatives, and explicit acceptance criteria.
4. Define and validate **Error and Recovery** with exact targets, controls, telemetry, failure handling, and recovery evidence.
5. Resolve **State Transitions** using task evidence, applicable constraints, alternatives, and explicit acceptance criteria.
6. Resolve **Success Measures** using task evidence, applicable constraints, alternatives, and explicit acceptance criteria.
7. Reconcile contradictions and state unresolved evidence, decision, and ownership gaps.

## Quality checks

- Tie design decisions to user evidence, task goals, content states, accessibility, and validation results.
- Cover empty, loading, error, permission, destructive, responsive, and localization states when applicable.
- Tie decisions and findings to explicit drivers and evidence.
- Separate proposed design from approved baseline and implemented behavior.
- Do not claim feasibility, conformance, accessibility, approval, testing, or readiness without accountable evidence.
