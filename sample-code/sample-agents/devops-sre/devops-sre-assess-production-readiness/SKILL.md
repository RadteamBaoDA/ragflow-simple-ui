---
name: devops-sre-assess-production-readiness
description: Use when an outsourcing SDLC work item explicitly requires 'Assess Production Readiness' during delivery automation, reliability, and operations.
---

# Assess Production Readiness

## Purpose

Produce an evidence-based production readiness review.

## Task responsibility

Own delivery automation, infrastructure changes, configuration boundaries, observability, deployment evidence, reliability readiness, and operational handoff. Do not approve business acceptance, conceal failed gates, accept security risk, or deploy without required authorization.

## Reference routing

Classify the test, security, or operations subtype from scope and evidence. Read only matching references; combine them only for genuinely cross-cutting work.

- Read [Service readiness](references/service-readiness.md) when one service is entering or changing production operation.
- Read [Release readiness](references/release-readiness.md) when a specific release package is entering production.
- Read [Infrastructure readiness](references/infrastructure-readiness.md) when platform capacity or controls must support production.

## Core method

1. Establish **Gate Evidence** with reproducible cases, observed results, and uncovered paths.
2. Resolve **Capacity and Reliability** using task evidence, applicable constraints, alternatives, and explicit acceptance criteria.
3. Define and validate **Operational Controls** with exact targets, controls, telemetry, failure handling, and recovery evidence.
4. Resolve **Support Readiness** using task evidence, applicable constraints, alternatives, and explicit acceptance criteria.
5. Resolve **Exceptions** using task evidence, applicable constraints, alternatives, and explicit acceptance criteria.
6. Derive **Readiness Recommendation** from explicit criteria; state conditions, dissent, and decision authority.
7. Reconcile contradictions and state unresolved evidence, decision, and ownership gaps.

## Quality checks

- Tie operational conclusions to exact environments, versions, controls, telemetry, and recovery evidence.
- Keep planned, attempted, succeeded, failed, rolled-back, and unverified states distinct.
- Scope, authority, environment, versions, and evidence are explicit.
- Results are reproducible and mapped to measurable criteria.
- The recommendation stays within this role's authority and names other required gates.
