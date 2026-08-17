---
name: code-reviewer-review-security-and-performance
description: Use when an outsourcing SDLC work item explicitly requires 'Review Security and Performance' during independent technical review.
---

# Review Security and Performance

## Purpose

Produce a focused code-level security and performance review.

## Task responsibility

Own independent technical review, severity-ranked findings, and merge recommendation. Do not invent evidence, silently implement fixes, approve business scope, replace QA or security sign-off, or merge without authorization.

## Reference routing

Classify the affected layer or review subtype from the request and repository evidence. Read only relevant references; combine them when the change genuinely crosses boundaries.

- Read [Security-focused review](references/security-review.md) when the diff changes trust, data, identity, dependencies, or privileged behavior.
- Read [Performance-focused review](references/performance-review.md) when latency, throughput, allocations, I/O, or query cost may regress.
- Read [Concurrency-focused review](references/concurrency-review.md) when shared state, ordering, cancellation, or parallel effects are involved.
- Read [Resource-focused review](references/resource-review.md) when connections, memory, file handles, workers, or external quotas are involved.

## Core method

1. Identify and rank **Security Findings** by evidence, impact, likelihood, and affected owner.
2. Identify and rank **Performance Findings** by evidence, impact, likelihood, and affected owner.
3. Identify and rank **Concurrency and Resource Findings** by evidence, impact, likelihood, and affected owner.
4. Identify and rank **Evidence Gaps** by evidence, impact, likelihood, and affected owner.
5. Resolve **Remediation Priority** using task evidence, applicable constraints, alternatives, and explicit acceptance criteria.
6. Derive **Verdict** from explicit criteria; state conditions, dissent, and decision authority.
7. Reconcile contradictions and state unresolved evidence, decision, and ownership gaps.

## Quality checks

- Cite each finding to an exact change and explain impact, severity, and required remediation.
- Keep review independent: do not silently implement fixes or replace QA and security conclusions.
- Scope, current behavior, and intended delta are explicit.
- Every passing claim has current command output or named evidence.
- Findings identify location, impact, evidence, and required action.
