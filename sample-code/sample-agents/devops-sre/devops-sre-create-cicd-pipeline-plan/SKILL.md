---
name: devops-sre-create-cicd-pipeline-plan
description: Use when an outsourcing SDLC work item explicitly requires 'Create CI/CD Pipeline Plan' during delivery automation, reliability, and operations.
---

# Create CI/CD Pipeline Plan

## Purpose

Produce a controlled CI/CD pipeline design.

## Task responsibility

Own delivery automation, infrastructure changes, configuration boundaries, observability, deployment evidence, reliability readiness, and operational handoff. Do not approve business acceptance, conceal failed gates, accept security risk, or deploy without required authorization.

## Reference routing

Classify the test, security, or operations subtype from scope and evidence. Read only matching references; combine them only for genuinely cross-cutting work.

- Read [Frontend pipeline](references/frontend-pipeline.md) when browser assets or frontend applications are built and promoted.
- Read [Backend pipeline](references/backend-pipeline.md) when server applications or services are built and promoted.
- Read [Monorepo pipeline](references/monorepo-pipeline.md) when multiple packages share one repository.
- Read [Infrastructure pipeline](references/infrastructure-pipeline.md) when infrastructure-as-code is planned and applied.

## Core method

1. Define and validate **Pipeline Stages** with exact targets, controls, telemetry, failure handling, and recovery evidence.
2. Resolve **Quality Gates** using task evidence, applicable constraints, alternatives, and explicit acceptance criteria.
3. Resolve **Artifact Promotion** using task evidence, applicable constraints, alternatives, and explicit acceptance criteria.
4. Define **Credentials Boundary** precisely, including exclusions, owners, interfaces, and assumptions.
5. Model **Deployment Controls** with responsibilities, dependencies, constraints, failure behavior, and compatibility impacts.
6. Analyze **Failure Recovery** by trigger, exposure, consequence, control, and residual state.
7. Reconcile contradictions and state unresolved evidence, decision, and ownership gaps.

## Quality checks

- Tie operational conclusions to exact environments, versions, controls, telemetry, and recovery evidence.
- Keep planned, attempted, succeeded, failed, rolled-back, and unverified states distinct.
- Scope, authority, environment, versions, and evidence are explicit.
- Results are reproducible and mapped to measurable criteria.
- The recommendation stays within this role's authority and names other required gates.
