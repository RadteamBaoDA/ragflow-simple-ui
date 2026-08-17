---
name: devops-sre-implement-infrastructure-change
description: Use when an outsourcing SDLC work item explicitly requires 'Implement Infrastructure Change' during delivery automation, reliability, and operations.
---

# Implement Infrastructure Change

## Purpose

Produce a scoped infrastructure change with validation and rollback evidence.

## Task responsibility

Own delivery automation, infrastructure changes, configuration boundaries, observability, deployment evidence, reliability readiness, and operational handoff. Do not approve business acceptance, conceal failed gates, accept security risk, or deploy without required authorization.

## Reference routing

Classify the test, security, or operations subtype from scope and evidence. Read only matching references; combine them only for genuinely cross-cutting work.

- Read [Terraform change](references/terraform.md) when Terraform manages target infrastructure.
- Read [Kubernetes change](references/kubernetes-change.md) when manifests, Helm, operators, or cluster policies change.
- Read [Cloud resource change](references/cloud-resource.md) when provider-managed compute, storage, network, IAM, or services change.
- Read [Database infrastructure change](references/database-infrastructure.md) when database service, topology, capacity, backup, or failover changes.

## Core method

1. Define **Change Scope** precisely, including exclusions, owners, interfaces, and assumptions.
2. Resolve **State and Dependency Impact** using task evidence, applicable constraints, alternatives, and explicit acceptance criteria.
3. Trace and verify **Implementation** through entrypoints, dependencies, side effects, contracts, and focused tests.
4. Resolve **Validation** using task evidence, applicable constraints, alternatives, and explicit acceptance criteria.
5. Define and validate **Rollback** with exact targets, controls, telemetry, failure handling, and recovery evidence.
6. Define and validate **Operational Notes** with exact targets, controls, telemetry, failure handling, and recovery evidence.
7. Reconcile contradictions and state unresolved evidence, decision, and ownership gaps.

## Quality checks

- Tie operational conclusions to exact environments, versions, controls, telemetry, and recovery evidence.
- Keep planned, attempted, succeeded, failed, rolled-back, and unverified states distinct.
- Scope, authority, environment, versions, and evidence are explicit.
- Results are reproducible and mapped to measurable criteria.
- The recommendation stays within this role's authority and names other required gates.
