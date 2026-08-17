---
name: devops-sre-prepare-deployment-and-rollback
description: Use when an outsourcing SDLC work item explicitly requires 'Prepare Deployment and Rollback' during delivery automation, reliability, and operations.
---

# Prepare Deployment and Rollback

## Purpose

Produce an executable deployment and rollback plan.

## Task responsibility

Own delivery automation, infrastructure changes, configuration boundaries, observability, deployment evidence, reliability readiness, and operational handoff. Do not approve business acceptance, conceal failed gates, accept security risk, or deploy without required authorization.

## Reference routing

Classify the test, security, or operations subtype from scope and evidence. Read only matching references; combine them only for genuinely cross-cutting work.

- Read [Rolling deployment](references/rolling.md) when instances update incrementally in place.
- Read [Blue-green deployment](references/blue-green.md) when parallel old and new environments enable traffic switch.
- Read [Canary deployment](references/canary.md) when a small traffic segment validates change before expansion.
- Read [Database migration deployment](references/database-migration.md) when schema or data changes coordinate with application rollout.

## Core method

1. Model **Pre-deployment Checks** with responsibilities, dependencies, constraints, failure behavior, and compatibility impacts.
2. Model **Deployment Sequence** with responsibilities, dependencies, constraints, failure behavior, and compatibility impacts.
3. Resolve **Validation** using task evidence, applicable constraints, alternatives, and explicit acceptance criteria.
4. Define and validate **Rollback Triggers** with exact targets, controls, telemetry, failure handling, and recovery evidence.
5. Define and validate **Rollback Procedure** with exact targets, controls, telemetry, failure handling, and recovery evidence.
6. Resolve **Communication** using task evidence, applicable constraints, alternatives, and explicit acceptance criteria.
7. Reconcile contradictions and state unresolved evidence, decision, and ownership gaps.

## Quality checks

- Tie operational conclusions to exact environments, versions, controls, telemetry, and recovery evidence.
- Keep planned, attempted, succeeded, failed, rolled-back, and unverified states distinct.
- Scope, authority, environment, versions, and evidence are explicit.
- Results are reproducible and mapped to measurable criteria.
- The recommendation stays within this role's authority and names other required gates.
