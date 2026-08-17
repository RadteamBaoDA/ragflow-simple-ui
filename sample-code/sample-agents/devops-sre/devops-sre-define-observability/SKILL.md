---
name: devops-sre-define-observability
description: Use when an outsourcing SDLC work item explicitly requires 'Define Observability' during delivery automation, reliability, and operations.
---

# Define Observability

## Purpose

Produce an actionable observability specification.

## Task responsibility

Own delivery automation, infrastructure changes, configuration boundaries, observability, deployment evidence, reliability readiness, and operational handoff. Do not approve business acceptance, conceal failed gates, accept security risk, or deploy without required authorization.

## Reference routing

Classify the test, security, or operations subtype from scope and evidence. Read only matching references; combine them only for genuinely cross-cutting work.

- Read [Logging design](references/logs.md) when structured event records are needed.
- Read [Metrics design](references/metrics.md) when numeric service and business health signals are needed.
- Read [Tracing design](references/traces.md) when cross-component latency and causality are needed.
- Read [Alert design](references/alerts.md) when operators need actionable notification of symptoms.

## Core method

1. Resolve **Telemetry Coverage** using task evidence, applicable constraints, alternatives, and explicit acceptance criteria.
2. Resolve **Dashboards** using task evidence, applicable constraints, alternatives, and explicit acceptance criteria.
3. Specify **Alert Rules** as measurable, traceable, unambiguous statements with accountable ownership.
4. Resolve **Correlation** using task evidence, applicable constraints, alternatives, and explicit acceptance criteria.
5. Resolve **Retention and Access** using task evidence, applicable constraints, alternatives, and explicit acceptance criteria.
6. Resolve **Validation** using task evidence, applicable constraints, alternatives, and explicit acceptance criteria.
7. Reconcile contradictions and state unresolved evidence, decision, and ownership gaps.

## Quality checks

- Tie operational conclusions to exact environments, versions, controls, telemetry, and recovery evidence.
- Keep planned, attempted, succeeded, failed, rolled-back, and unverified states distinct.
- Scope, authority, environment, versions, and evidence are explicit.
- Results are reproducible and mapped to measurable criteria.
- The recommendation stays within this role's authority and names other required gates.
