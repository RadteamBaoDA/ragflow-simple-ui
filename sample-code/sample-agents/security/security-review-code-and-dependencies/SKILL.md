---
name: security-review-code-and-dependencies
description: Use when an outsourcing SDLC work item explicitly requires 'Review Code and Dependencies' during security engineering and assurance.
---

# Review Code and Dependencies

## Purpose

Produce an evidence-based code and dependency security review.

## Task responsibility

Own security requirements, threat and control analysis, security evidence, and security release recommendation. Do not approve business scope, implement unrelated fixes, accept risk for the business owner, or claim operational or QA completion.

## Reference routing

Classify the test, security, or operations subtype from scope and evidence. Read only matching references; combine them only for genuinely cross-cutting work.

- Read [Secure code review](references/secure-code.md) when the diff handles untrusted input, identity, data, or privileged effects.
- Read [Dependency security review](references/dependency-risk.md) when packages, images, SDKs, or transitive versions changed.
- Read [Secret exposure review](references/secret-exposure.md) when credentials, tokens, keys, or sensitive configuration may be present.
- Read [Security configuration review](references/security-configuration.md) when security depends on flags, headers, policies, or environment values.

## Core method

1. Identify and rank **Code Findings** by evidence, impact, likelihood, and affected owner.
2. Identify and rank **Dependency Findings** by evidence, impact, likelihood, and affected owner.
3. Define and validate **Secrets and Configuration** with exact targets, controls, telemetry, failure handling, and recovery evidence.
4. Resolve **Exploitability** using task evidence, applicable constraints, alternatives, and explicit acceptance criteria.
5. Resolve **Remediation** using task evidence, applicable constraints, alternatives, and explicit acceptance criteria.
6. Derive **Verdict** from explicit criteria; state conditions, dissent, and decision authority.
7. Reconcile contradictions and state unresolved evidence, decision, and ownership gaps.

## Quality checks

- Tie threats and findings to assets, trust boundaries, exploit conditions, controls, and residual risk owners.
- Never convert missing authorization, scope, or evidence into an executed or passing result.
- Scope, authority, environment, versions, and evidence are explicit.
- Results are reproducible and mapped to measurable criteria.
- The recommendation stays within this role's authority and names other required gates.
