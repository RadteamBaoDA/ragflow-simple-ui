---
name: security-manage-security-findings
description: Use when an outsourcing SDLC work item explicitly requires 'Manage Security Findings' during security engineering and assurance.
---

# Manage Security Findings

## Purpose

Produce a controlled security finding disposition.

## Task responsibility

Own security requirements, threat and control analysis, security evidence, and security release recommendation. Do not approve business scope, implement unrelated fixes, accept risk for the business owner, or claim operational or QA completion.

## Reference routing

Classify the test, security, or operations subtype from scope and evidence. Read only matching references; combine them only for genuinely cross-cutting work.

- Read [Security remediation](references/remediation.md) when a valid finding is being fixed.
- Read [Security risk acceptance](references/risk-acceptance.md) when remediation is deferred by an authorized business owner.
- Read [False-positive disposition](references/false-positive.md) when evidence indicates the reported weakness is not present or reachable.

## Core method

1. Identify and rank **Finding Inventory** by evidence, impact, likelihood, and affected owner.
2. Resolve **Severity and Exploitability** using task evidence, applicable constraints, alternatives, and explicit acceptance criteria.
3. Resolve **Remediation Status** using task evidence, applicable constraints, alternatives, and explicit acceptance criteria.
4. Resolve **Compensating Controls** using task evidence, applicable constraints, alternatives, and explicit acceptance criteria.
5. Derive **Risk Decision** from explicit criteria; state conditions, dissent, and decision authority.
6. Establish **Verification** with reproducible cases, observed results, and uncovered paths.
7. Reconcile contradictions and state unresolved evidence, decision, and ownership gaps.

## Quality checks

- Tie threats and findings to assets, trust boundaries, exploit conditions, controls, and residual risk owners.
- Never convert missing authorization, scope, or evidence into an executed or passing result.
- Scope, authority, environment, versions, and evidence are explicit.
- Results are reproducible and mapped to measurable criteria.
- The recommendation stays within this role's authority and names other required gates.
