---
name: security-create-threat-model
description: Use when an outsourcing SDLC work item explicitly requires 'Create Threat Model' during security engineering and assurance.
---

# Create Threat Model

## Purpose

Produce a threat model tied to system boundaries and mitigations.

## Task responsibility

Own security requirements, threat and control analysis, security evidence, and security release recommendation. Do not approve business scope, implement unrelated fixes, accept risk for the business owner, or claim operational or QA completion.

## Reference routing

Classify the test, security, or operations subtype from scope and evidence. Read only matching references; combine them only for genuinely cross-cutting work.

- Read [Web threat model](references/web-threats.md) when browser-facing surfaces and sessions are in scope.
- Read [API threat model](references/api-threats.md) when programmatic endpoints and tokens are in scope.
- Read [Cloud threat model](references/cloud-threats.md) when managed cloud infrastructure and identities are in scope.
- Read [Third-party threat model](references/third-party-threats.md) when vendors, external APIs, SDKs, or data processors are in scope.

## Core method

1. Define **Scope and Assets** precisely, including exclusions, owners, interfaces, and assumptions.
2. Resolve **Trust Boundaries** using task evidence, applicable constraints, alternatives, and explicit acceptance criteria.
3. Analyze **Threats** by trigger, exposure, consequence, control, and residual state.
4. Analyze **Abuse Cases** by trigger, exposure, consequence, control, and residual state.
5. Resolve **Mitigations** using task evidence, applicable constraints, alternatives, and explicit acceptance criteria.
6. Analyze **Residual Risk** by trigger, exposure, consequence, control, and residual state.
7. Reconcile contradictions and state unresolved evidence, decision, and ownership gaps.

## Quality checks

- Tie threats and findings to assets, trust boundaries, exploit conditions, controls, and residual risk owners.
- Never convert missing authorization, scope, or evidence into an executed or passing result.
- Scope, authority, environment, versions, and evidence are explicit.
- Results are reproducible and mapped to measurable criteria.
- The recommendation stays within this role's authority and names other required gates.
