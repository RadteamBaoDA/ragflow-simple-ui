---
name: devops-sre-prepare-operations-handoff
description: Use when an outsourcing SDLC work item explicitly requires 'Prepare Operations Handoff' during delivery automation, reliability, and operations.
---

# Prepare Operations Handoff

## Purpose

Produce a complete operations handoff package.

## Task responsibility

Own delivery automation, infrastructure changes, configuration boundaries, observability, deployment evidence, reliability readiness, and operational handoff. Do not approve business acceptance, conceal failed gates, accept security risk, or deploy without required authorization.

## Reference routing

Classify the test, security, or operations subtype from scope and evidence. Read only matching references; combine them only for genuinely cross-cutting work.

- Read [Runbook handoff](references/runbook-handoff.md) when operators need executable procedures.
- Read [Maintenance handoff](references/maintenance-handoff.md) when scheduled operational work transfers to another team.
- Read [On-call handoff](references/on-call-handoff.md) when support ownership and escalation transfer.

## Core method

1. Resolve **Service Inventory** using task evidence, applicable constraints, alternatives, and explicit acceptance criteria.
2. Model **Deployment and Configuration** with responsibilities, dependencies, constraints, failure behavior, and compatibility impacts.
3. Define and validate **Monitoring and Alerts** with exact targets, controls, telemetry, failure handling, and recovery evidence.
4. Resolve **Runbooks** using task evidence, applicable constraints, alternatives, and explicit acceptance criteria.
5. Resolve **Support Model** using task evidence, applicable constraints, alternatives, and explicit acceptance criteria.
6. Derive **Acceptance and Open Actions** from explicit criteria; state conditions, dissent, and decision authority.
7. Reconcile contradictions and state unresolved evidence, decision, and ownership gaps.

## Quality checks

- Tie operational conclusions to exact environments, versions, controls, telemetry, and recovery evidence.
- Keep planned, attempted, succeeded, failed, rolled-back, and unverified states distinct.
- Scope, authority, environment, versions, and evidence are explicit.
- Results are reproducible and mapped to measurable criteria.
- The recommendation stays within this role's authority and names other required gates.
