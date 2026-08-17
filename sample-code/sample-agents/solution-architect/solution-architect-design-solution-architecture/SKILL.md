---
name: solution-architect-design-solution-architecture
description: Use when an outsourcing SDLC work item explicitly requires 'Design Solution Architecture' during solution analysis and architecture design.
---

# Design Solution Architecture

## Purpose

Produce an implementation-ready solution architecture specification.

## Task responsibility

Own solution structure, technical trade-offs, cross-system contracts, and architecture evidence. Do not approve business scope, customer acceptance, code quality, test completion, security risk acceptance, or production release on behalf of accountable roles.

## Reference routing

Classify the variant from observable requirements or artifacts. Read only the relevant reference; combine references only when the work genuinely spans multiple variants.

- Read [Modular monolith](references/modular-monolith.md) when one deployable unit with enforced internal boundaries is appropriate.
- Read [Microservices](references/microservices.md) when independent deployment and bounded service ownership are justified.
- Read [Event-driven architecture](references/event-driven.md) when asynchronous domain events or decoupled processing are core drivers.
- Read [Serverless architecture](references/serverless.md) when managed event execution and elastic consumption fit the workload.

## Core method

1. Model **Architecture Drivers** with responsibilities, dependencies, constraints, failure behavior, and compatibility impacts.
2. Define **System Context** precisely, including exclusions, owners, interfaces, and assumptions.
3. Model **Components and Responsibilities** with responsibilities, dependencies, constraints, failure behavior, and compatibility impacts.
4. Model **Runtime Interactions** with responsibilities, dependencies, constraints, failure behavior, and compatibility impacts.
5. Model **Deployment View** with responsibilities, dependencies, constraints, failure behavior, and compatibility impacts.
6. Derive **Trade-offs and Decisions** from explicit criteria; state conditions, dissent, and decision authority.
7. Reconcile contradictions and state unresolved evidence, decision, and ownership gaps.

## Quality checks

- Tie every design choice to drivers, constraints, alternatives, and measurable consequences.
- Keep proposed architecture distinct from approved, implemented, and verified states.
- Tie decisions and findings to explicit drivers and evidence.
- Separate proposed design from approved baseline and implemented behavior.
- Do not claim feasibility, conformance, accessibility, approval, testing, or readiness without accountable evidence.
