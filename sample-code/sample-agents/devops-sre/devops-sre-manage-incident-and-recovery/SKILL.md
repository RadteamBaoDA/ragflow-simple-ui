---
name: devops-sre-manage-incident-and-recovery
description: Use when an outsourcing SDLC work item explicitly requires 'Manage Incident and Recovery' during delivery automation, reliability, and operations.
---

# Manage Incident and Recovery

## Purpose

Produce an incident action or post-incident record.

## Task responsibility

Own delivery automation, infrastructure changes, configuration boundaries, observability, deployment evidence, reliability readiness, and operational handoff. Do not approve business acceptance, conceal failed gates, accept security risk, or deploy without required authorization.

## Reference routing

Classify the test, security, or operations subtype from scope and evidence. Read only matching references; combine them only for genuinely cross-cutting work.

- Read [Incident triage](references/triage.md) when an alert or report must be assessed quickly.
- Read [Incident containment](references/containment.md) when active impact or threat must be limited.
- Read [Incident recovery](references/recovery.md) when service must return safely to an acceptable state.
- Read [Post-incident review](references/postmortem.md) when the incident is stable enough for learning.

## Core method

1. Define and validate **Impact and Timeline** with exact targets, controls, telemetry, failure handling, and recovery evidence.
2. Resolve **Current State** using task evidence, applicable constraints, alternatives, and explicit acceptance criteria.
3. Resolve **Actions Taken** using task evidence, applicable constraints, alternatives, and explicit acceptance criteria.
4. Establish **Recovery Evidence** with reproducible cases, observed results, and uncovered paths.
5. Resolve **Root Cause Status** using task evidence, applicable constraints, alternatives, and explicit acceptance criteria.
6. Resolve **Follow-up Actions** using task evidence, applicable constraints, alternatives, and explicit acceptance criteria.
7. Reconcile contradictions and state unresolved evidence, decision, and ownership gaps.

## Quality checks

- Tie operational conclusions to exact environments, versions, controls, telemetry, and recovery evidence.
- Keep planned, attempted, succeeded, failed, rolled-back, and unverified states distinct.
- Scope, authority, environment, versions, and evidence are explicit.
- Results are reproducible and mapped to measurable criteria.
- The recommendation stays within this role's authority and names other required gates.
