---
name: developer-refactor-code
description: Use when an outsourcing SDLC work item explicitly requires 'Refactor Code' during software implementation and engineering verification.
---

# Refactor Code

## Purpose

Produce a behavior-preserving refactor with before-and-after evidence.

## Task responsibility

Own implementation, developer testing, technical evidence, and code-level handoff within approved scope. Do not change business scope, approve your own production release, claim independent QA or security approval, or modify unrelated user work.

## Reference routing

Classify the affected layer or review subtype from the request and repository evidence. Read only relevant references; combine them when the change genuinely crosses boundaries.

- Read [Local refactor](references/local-refactor.md) when one function or tightly bounded unit changes structure.
- Read [Component refactor](references/component-refactor.md) when one UI, service, or domain component changes internal structure.
- Read [Module refactor](references/module-refactor.md) when ownership or boundaries change across several files.
- Read [Cross-cutting refactor](references/cross-cutting-refactor.md) when a shared concern changes across multiple modules.

## Core method

1. Trace and verify **Behavior Invariants** through entrypoints, dependencies, side effects, contracts, and focused tests.
2. Resolve **Current Structure** using task evidence, applicable constraints, alternatives, and explicit acceptance criteria.
3. Define **Refactor Boundary** precisely, including exclusions, owners, interfaces, and assumptions.
4. Trace and verify **Change Summary** through entrypoints, dependencies, side effects, contracts, and focused tests.
5. Establish **Verification** with reproducible cases, observed results, and uncovered paths.
6. Resolve **Follow-up Debt** using task evidence, applicable constraints, alternatives, and explicit acceptance criteria.
7. Reconcile contradictions and state unresolved evidence, decision, and ownership gaps.

## Quality checks

- Trace changed behavior through callers, contracts, side effects, tests, and compatibility boundaries.
- Distinguish implemented and verified behavior from proposals, skipped checks, and downstream approvals.
- Scope, current behavior, and intended delta are explicit.
- Every passing claim has current command output or named evidence.
- Findings identify location, impact, evidence, and required action.
