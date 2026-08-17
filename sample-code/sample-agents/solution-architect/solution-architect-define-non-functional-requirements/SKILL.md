---
name: solution-architect-define-non-functional-requirements
description: Use when an outsourcing SDLC work item explicitly requires 'Define Non-functional Requirements' during solution analysis and architecture design.
---

# Define Non-functional Requirements

## Purpose

Produce a measurable non-functional requirement catalog.

## Task responsibility

Own solution structure, technical trade-offs, cross-system contracts, and architecture evidence. Do not approve business scope, customer acceptance, code quality, test completion, security risk acceptance, or production release on behalf of accountable roles.

## Reference routing

Classify the variant from observable requirements or artifacts. Read only the relevant reference; combine references only when the work genuinely spans multiple variants.

- Read [Performance requirements](references/performance.md) when response time, throughput, concurrency, or resource efficiency is material.
- Read [Availability and resilience requirements](references/availability.md) when continuity, recovery, or failure tolerance is material.
- Read [Scalability requirements](references/scalability.md) when load or data volume is expected to grow materially.
- Read [Security quality requirements](references/security-quality.md) when confidentiality, integrity, authentication, authorization, or auditability is material.
- Read [Maintainability and operability requirements](references/maintainability-operability.md) when supportability, diagnosability, change safety, or operational toil is material.
- Read [Usability and accessibility requirements](references/usability-accessibility.md) when task success, inclusive access, localization, or interaction quality is material.
- Read [Compatibility and portability requirements](references/compatibility-portability.md) when clients, platforms, protocols, vendors, or deployment targets vary.
- Read [Data quality and governance requirements](references/data-quality-governance.md) when correctness, lineage, retention, residency, privacy, or lifecycle controls are material.

## Core method

1. Resolve **Quality Attributes** using task evidence, applicable constraints, alternatives, and explicit acceptance criteria.
2. Specify **Measurable Targets** as measurable, traceable, unambiguous statements with accountable ownership.
3. Define and validate **Workload and Environment** with exact targets, controls, telemetry, failure handling, and recovery evidence.
4. Resolve **Measurement Method** using task evidence, applicable constraints, alternatives, and explicit acceptance criteria.
5. Resolve **Trade-offs** using task evidence, applicable constraints, alternatives, and explicit acceptance criteria.
6. Derive **Acceptance Ownership** from explicit criteria; state conditions, dissent, and decision authority.
7. Reconcile contradictions and state unresolved evidence, decision, and ownership gaps.

## Quality checks

- Tie every design choice to drivers, constraints, alternatives, and measurable consequences.
- Keep proposed architecture distinct from approved, implemented, and verified states.
- Tie decisions and findings to explicit drivers and evidence.
- Separate proposed design from approved baseline and implemented behavior.
- Do not claim feasibility, conformance, accessibility, approval, testing, or readiness without accountable evidence.
