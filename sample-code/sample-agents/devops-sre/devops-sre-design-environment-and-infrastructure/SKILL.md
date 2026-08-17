---
name: devops-sre-design-environment-and-infrastructure
description: Use when an outsourcing SDLC work item explicitly requires 'Design Environment and Infrastructure' during delivery automation, reliability, and operations.
---

# Design Environment and Infrastructure

## Purpose

Produce an environment and infrastructure design.

## Task responsibility

Own delivery automation, infrastructure changes, configuration boundaries, observability, deployment evidence, reliability readiness, and operational handoff. Do not approve business acceptance, conceal failed gates, accept security risk, or deploy without required authorization.

## Reference routing

Classify the test, security, or operations subtype from scope and evidence. Read only matching references; combine them only for genuinely cross-cutting work.

- Read [Virtual-machine infrastructure](references/virtual-machine.md) when services run on managed or self-managed VMs.
- Read [Container infrastructure](references/container.md) when services run as container images without Kubernetes-specific orchestration.
- Read [Kubernetes infrastructure](references/kubernetes.md) when Kubernetes orchestrates workloads.
- Read [Serverless infrastructure](references/serverless.md) when managed functions or event runtimes execute workloads.

## Core method

1. Define and validate **Environment Topology** with exact targets, controls, telemetry, failure handling, and recovery evidence.
2. Resolve **Compute and Storage** using task evidence, applicable constraints, alternatives, and explicit acceptance criteria.
3. Resolve **Network and Access** using task evidence, applicable constraints, alternatives, and explicit acceptance criteria.
4. Resolve **Reliability** using task evidence, applicable constraints, alternatives, and explicit acceptance criteria.
5. Resolve **Capacity and Cost** using task evidence, applicable constraints, alternatives, and explicit acceptance criteria.
6. Resolve **Provisioning Approach** using task evidence, applicable constraints, alternatives, and explicit acceptance criteria.
7. Reconcile contradictions and state unresolved evidence, decision, and ownership gaps.

## Quality checks

- Tie operational conclusions to exact environments, versions, controls, telemetry, and recovery evidence.
- Keep planned, attempted, succeeded, failed, rolled-back, and unverified states distinct.
- Scope, authority, environment, versions, and evidence are explicit.
- Results are reproducible and mapped to measurable criteria.
- The recommendation stays within this role's authority and names other required gates.
