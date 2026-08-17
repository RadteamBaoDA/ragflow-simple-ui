---
name: solution-architect-design-data-and-integration-contracts
description: Use when an outsourcing SDLC work item explicitly requires 'Design Data and Integration Contracts' during solution analysis and architecture design.
---

# Design Data and Integration Contracts

## Purpose

Produce versioned data and integration contracts.

## Task responsibility

Own solution structure, technical trade-offs, cross-system contracts, and architecture evidence. Do not approve business scope, customer acceptance, code quality, test completion, security risk acceptance, or production release on behalf of accountable roles.

## Reference routing

Classify the variant from observable requirements or artifacts. Read only the relevant reference; combine references only when the work genuinely spans multiple variants.

- Read [REST API contract](references/rest-api.md) when request-response HTTP integration is selected.
- Read [Event integration contract](references/event-integration.md) when systems integrate through messages or events.
- Read [Database contract](references/database-contract.md) when multiple components depend on persisted schema or data ownership.
- Read [Third-party integration](references/third-party-integration.md) when an external vendor or customer system owns part of the contract.

## Core method

1. Model **Data Ownership** with responsibilities, dependencies, constraints, failure behavior, and compatibility impacts.
2. Resolve **Schemas and Semantics** using task evidence, applicable constraints, alternatives, and explicit acceptance criteria.
3. Model **Interface Contract** with responsibilities, dependencies, constraints, failure behavior, and compatibility impacts.
4. Analyze **Failure and Retry Semantics** by trigger, exposure, consequence, control, and residual state.
5. Trace and verify **Versioning and Compatibility** through entrypoints, dependencies, side effects, contracts, and focused tests.
6. Define and validate **Observability and Security** with exact targets, controls, telemetry, failure handling, and recovery evidence.
7. Reconcile contradictions and state unresolved evidence, decision, and ownership gaps.

## Quality checks

- Tie every design choice to drivers, constraints, alternatives, and measurable consequences.
- Keep proposed architecture distinct from approved, implemented, and verified states.
- Tie decisions and findings to explicit drivers and evidence.
- Separate proposed design from approved baseline and implemented behavior.
- Do not claim feasibility, conformance, accessibility, approval, testing, or readiness without accountable evidence.
