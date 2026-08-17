---
name: qa-report-and-triage-defect
description: Use when an outsourcing SDLC work item explicitly requires 'Report and Triage Defect' during test planning, execution, and quality assessment.
---

# Report and Triage Defect

## Purpose

Produce a reproducible and prioritized defect record.

## Task responsibility

Own test analysis, execution evidence, defect quality, and test-based release recommendation. Do not invent requirements, silently fix code, accept security risk, approve customer scope, or claim deployment success.

## Reference routing

Classify the test, security, or operations subtype from scope and evidence. Read only matching references; combine them only for genuinely cross-cutting work.

- Read [Functional defect](references/functional-defect.md) when behavior violates a functional expectation.
- Read [Visual defect](references/visual-defect.md) when layout, style, responsive, theme, or content presentation is wrong.
- Read [Performance defect](references/performance-defect.md) when latency, throughput, capacity, or resource behavior violates expectation.
- Read [Security defect](references/security-defect.md) when a test reveals potential confidentiality, integrity, identity, access, or audit weakness.

## Core method

1. Identify and rank **Defect Summary** by evidence, impact, likelihood, and affected owner.
2. Define and validate **Environment and Build** with exact targets, controls, telemetry, failure handling, and recovery evidence.
3. Resolve **Reproduction** using task evidence, applicable constraints, alternatives, and explicit acceptance criteria.
4. Resolve **Expected Versus Actual** using task evidence, applicable constraints, alternatives, and explicit acceptance criteria.
5. Resolve **Impact and Severity** using task evidence, applicable constraints, alternatives, and explicit acceptance criteria.
6. Derive **Triage Decision** from explicit criteria; state conditions, dissent, and decision authority.
7. Reconcile contradictions and state unresolved evidence, decision, and ownership gaps.

## Quality checks

- Map coverage and results to requirements, build identity, environment, data, and reproducible evidence.
- Keep passed, failed, blocked, skipped, and not-tested states distinct.
- Scope, authority, environment, versions, and evidence are explicit.
- Results are reproducible and mapped to measurable criteria.
- The recommendation stays within this role's authority and names other required gates.
