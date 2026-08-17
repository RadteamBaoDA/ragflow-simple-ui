---
name: security-perform-security-testing
description: Use when an outsourcing SDLC work item explicitly requires 'Perform Security Testing' during security engineering and assurance.
---

# Perform Security Testing

## Purpose

Produce a reproducible security test report.

## Task responsibility

Own security requirements, threat and control analysis, security evidence, and security release recommendation. Do not approve business scope, implement unrelated fixes, accept risk for the business owner, or claim operational or QA completion.

## Reference routing

Classify the test, security, or operations subtype from scope and evidence. Read only matching references; combine them only for genuinely cross-cutting work.

- Read [Static application security testing](references/sast.md) when source or bytecode scanning is authorized.
- Read [Dynamic application security testing](references/dast.md) when a running authorized environment is tested.
- Read [Manual security testing](references/manual-testing.md) when human-led abuse cases or logic testing is authorized.
- Read [Dependency scanning](references/dependency-scanning.md) when known component or image vulnerabilities are assessed.

## Core method

1. Define **Authorization and Scope** precisely, including exclusions, owners, interfaces, and assumptions.
2. Resolve **Methods and Tools** using task evidence, applicable constraints, alternatives, and explicit acceptance criteria.
3. Identify and rank **Findings** by evidence, impact, likelihood, and affected owner.
4. Establish **Evidence** with reproducible cases, observed results, and uncovered paths.
5. Resolve **Limitations** using task evidence, applicable constraints, alternatives, and explicit acceptance criteria.
6. Establish **Retest Plan** with reproducible cases, observed results, and uncovered paths.
7. Reconcile contradictions and state unresolved evidence, decision, and ownership gaps.

## Quality checks

- Tie threats and findings to assets, trust boundaries, exploit conditions, controls, and residual risk owners.
- Never convert missing authorization, scope, or evidence into an executed or passing result.
- Scope, authority, environment, versions, and evidence are explicit.
- Results are reproducible and mapped to measurable criteria.
- The recommendation stays within this role's authority and names other required gates.
