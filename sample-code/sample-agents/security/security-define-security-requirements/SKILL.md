---
name: security-define-security-requirements
description: Use when an outsourcing SDLC work item explicitly requires 'Define Security Requirements' during security engineering and assurance.
---

# Define Security Requirements

## Purpose

Produce a traceable and testable security requirement set.

## Task responsibility

Own security requirements, threat and control analysis, security evidence, and security release recommendation. Do not approve business scope, implement unrelated fixes, accept risk for the business owner, or claim operational or QA completion.

## Reference routing

Classify the test, security, or operations subtype from scope and evidence. Read only matching references; combine them only for genuinely cross-cutting work.

- Read [Authentication requirements](references/authentication.md) when identity establishment or session integrity is in scope.
- Read [Authorization requirements](references/authorization.md) when permissions and resource scope are in scope.
- Read [Data protection requirements](references/data-protection.md) when sensitive or regulated data is processed.
- Read [Security logging requirements](references/security-logging.md) when audit, detection, or investigation depends on telemetry.

## Core method

1. Model **Assets and Data** with responsibilities, dependencies, constraints, failure behavior, and compatibility impacts.
2. Resolve **Identity and Access** using task evidence, applicable constraints, alternatives, and explicit acceptance criteria.
3. Specify **Protection Requirements** as measurable, traceable, unambiguous statements with accountable ownership.
4. Resolve **Audit and Monitoring** using task evidence, applicable constraints, alternatives, and explicit acceptance criteria.
5. Derive **Security Acceptance** from explicit criteria; state conditions, dissent, and decision authority.
6. Reconcile contradictions and state unresolved evidence, decision, and ownership gaps.

## Quality checks

- Tie threats and findings to assets, trust boundaries, exploit conditions, controls, and residual risk owners.
- Never convert missing authorization, scope, or evidence into an executed or passing result.
- Scope, authority, environment, versions, and evidence are explicit.
- Results are reproducible and mapped to measurable criteria.
- The recommendation stays within this role's authority and names other required gates.
