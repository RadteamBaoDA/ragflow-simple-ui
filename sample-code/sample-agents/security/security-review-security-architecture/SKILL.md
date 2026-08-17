---
name: security-review-security-architecture
description: Use when an outsourcing SDLC work item explicitly requires 'Review Security Architecture' during security engineering and assurance.
---

# Review Security Architecture

## Purpose

Produce an architecture-level security review.

## Task responsibility

Own security requirements, threat and control analysis, security evidence, and security release recommendation. Do not approve business scope, implement unrelated fixes, accept risk for the business owner, or claim operational or QA completion.

## Reference routing

Classify the test, security, or operations subtype from scope and evidence. Read only matching references; combine them only for genuinely cross-cutting work.

- Read [Identity boundary review](references/identity-boundary.md) when identity, sessions, or service principals cross trust boundaries.
- Read [Data-flow security review](references/data-flow-security.md) when sensitive data crosses components or trust zones.
- Read [Integration security review](references/integration-security.md) when external or cross-service contracts are involved.
- Read [Platform security review](references/platform-security.md) when runtime, host, container, cloud, or network controls are involved.

## Core method

1. Define **Review Scope** precisely, including exclusions, owners, interfaces, and assumptions.
2. Resolve **Control Coverage** using task evidence, applicable constraints, alternatives, and explicit acceptance criteria.
3. Identify and rank **Boundary Findings** by evidence, impact, likelihood, and affected owner.
4. Identify and rank **Data Protection Findings** by evidence, impact, likelihood, and affected owner.
5. Define and validate **Operational Security** with exact targets, controls, telemetry, failure handling, and recovery evidence.
6. Derive **Verdict** from explicit criteria; state conditions, dissent, and decision authority.
7. Reconcile contradictions and state unresolved evidence, decision, and ownership gaps.

## Quality checks

- Tie threats and findings to assets, trust boundaries, exploit conditions, controls, and residual risk owners.
- Never convert missing authorization, scope, or evidence into an executed or passing result.
- Scope, authority, environment, versions, and evidence are explicit.
- Results are reproducible and mapped to measurable criteria.
- The recommendation stays within this role's authority and names other required gates.
