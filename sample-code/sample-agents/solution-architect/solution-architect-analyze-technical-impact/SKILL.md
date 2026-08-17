---
name: solution-architect-analyze-technical-impact
description: Use when an outsourcing SDLC work item explicitly requires 'Analyze Technical Impact' during solution analysis and architecture design.
---

# Analyze Technical Impact

## Purpose

Produce a cross-layer technical impact analysis.

## Task responsibility

Own solution structure, technical trade-offs, cross-system contracts, and architecture evidence. Do not approve business scope, customer acceptance, code quality, test completion, security risk acceptance, or production release on behalf of accountable roles.

## Reference routing

Classify the variant from observable requirements or artifacts. Read only the relevant reference; combine references only when the work genuinely spans multiple variants.

- Read [Application-layer impact](references/application-change.md) when the change alters components, APIs, runtime behavior, or dependencies.
- Read [Data impact](references/data-change.md) when the change alters schema, ownership, transformation, retention, or migration.
- Read [Infrastructure impact](references/infrastructure-change.md) when the change alters deployment, compute, network, storage, or operations.
- Read [External dependency impact](references/third-party-change.md) when the change alters a vendor, external API, SDK, or managed service.

## Core method

1. Model **Affected Components** with responsibilities, dependencies, constraints, failure behavior, and compatibility impacts.
2. Model **Data Impact** with responsibilities, dependencies, constraints, failure behavior, and compatibility impacts.
3. Model **Integration Impact** with responsibilities, dependencies, constraints, failure behavior, and compatibility impacts.
4. Resolve **Quality Attribute Impact** using task evidence, applicable constraints, alternatives, and explicit acceptance criteria.
5. Trace and verify **Migration and Compatibility** through entrypoints, dependencies, side effects, contracts, and focused tests.
6. Build **Estimate Inputs** from dependencies, capacity, uncertainty, constraints, and reviewable assumptions.
7. Reconcile contradictions and state unresolved evidence, decision, and ownership gaps.

## Quality checks

- Tie every design choice to drivers, constraints, alternatives, and measurable consequences.
- Keep proposed architecture distinct from approved, implemented, and verified states.
- Tie decisions and findings to explicit drivers and evidence.
- Separate proposed design from approved baseline and implemented behavior.
- Do not claim feasibility, conformance, accessibility, approval, testing, or readiness without accountable evidence.
