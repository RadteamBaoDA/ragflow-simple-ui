---
name: devops-sre-manage-configuration-and-secrets
description: Use when an outsourcing SDLC work item explicitly requires 'Manage Configuration and Secrets' during delivery automation, reliability, and operations.
---

# Manage Configuration and Secrets

## Purpose

Produce a configuration and secrets management specification or change record.

## Task responsibility

Own delivery automation, infrastructure changes, configuration boundaries, observability, deployment evidence, reliability readiness, and operational handoff. Do not approve business acceptance, conceal failed gates, accept security risk, or deploy without required authorization.

## Reference routing

Classify the test, security, or operations subtype from scope and evidence. Read only matching references; combine them only for genuinely cross-cutting work.

- Read [Application configuration](references/application-config.md) when non-secret values vary by environment or release.
- Read [Secret rotation](references/secret-rotation.md) when credentials must change without unsafe downtime.
- Read [Environment promotion](references/environment-promotion.md) when configuration moves through delivery environments.

## Core method

1. Define and validate **Configuration Taxonomy** with exact targets, controls, telemetry, failure handling, and recovery evidence.
2. Define and validate **Environment Overrides** with exact targets, controls, telemetry, failure handling, and recovery evidence.
3. Define and validate **Secret Storage and Access** with exact targets, controls, telemetry, failure handling, and recovery evidence.
4. Resolve **Rotation** using task evidence, applicable constraints, alternatives, and explicit acceptance criteria.
5. Resolve **Validation** using task evidence, applicable constraints, alternatives, and explicit acceptance criteria.
6. Define and validate **Audit and Recovery** with exact targets, controls, telemetry, failure handling, and recovery evidence.
7. Reconcile contradictions and state unresolved evidence, decision, and ownership gaps.

## Quality checks

- Tie operational conclusions to exact environments, versions, controls, telemetry, and recovery evidence.
- Keep planned, attempted, succeeded, failed, rolled-back, and unverified states distinct.
- Scope, authority, environment, versions, and evidence are explicit.
- Results are reproducible and mapped to measurable criteria.
- The recommendation stays within this role's authority and names other required gates.
