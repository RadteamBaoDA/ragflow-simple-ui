---
name: security-issue-security-release-gate
description: Use when an outsourcing SDLC work item explicitly requires 'Issue Security Release Gate' during security engineering and assurance.
---

# Issue Security Release Gate

## Purpose

Produce a security-specific release gate decision.

## Task responsibility

Own security requirements, threat and control analysis, security evidence, and security release recommendation. Do not approve business scope, implement unrelated fixes, accept risk for the business owner, or claim operational or QA completion.

## Reference routing

Classify the test, security, or operations subtype from scope and evidence. Read only matching references; combine them only for genuinely cross-cutting work.

- Read [Standard security gate](references/standard-release.md) when normal release governance and evidence windows apply.
- Read [Exception security gate](references/exception-release.md) when a release requests a documented deviation.
- Read [Emergency security gate](references/emergency-release.md) when urgent recovery uses expedited authority.

## Core method

1. Establish **Evidence Summary** with reproducible cases, observed results, and uncovered paths.
2. Identify and rank **Open Findings** by evidence, impact, likelihood, and affected owner.
3. Analyze **Accepted Risks** by trigger, exposure, consequence, control, and residual state.
4. Resolve **Required Conditions** using task evidence, applicable constraints, alternatives, and explicit acceptance criteria.
5. Resolve **Monitoring Needs** using task evidence, applicable constraints, alternatives, and explicit acceptance criteria.
6. Derive **Security Recommendation** from explicit criteria; state conditions, dissent, and decision authority.
7. Reconcile contradictions and state unresolved evidence, decision, and ownership gaps.

## Quality checks

- Tie threats and findings to assets, trust boundaries, exploit conditions, controls, and residual risk owners.
- Never convert missing authorization, scope, or evidence into an executed or passing result.
- Scope, authority, environment, versions, and evidence are explicit.
- Results are reproducible and mapped to measurable criteria.
- The recommendation stays within this role's authority and names other required gates.
