---
name: ba-analyze-change-request
description: Use when an outsourcing SDLC work item explicitly requires 'Analyze Change Request' during business analysis and requirements discovery.
---

# Analyze Change Request

## Purpose

Produce a neutral business impact analysis for a proposed requirement change.

## Task responsibility

Own business analysis, requirement quality, and traceability. Do not make unapproved scope, architecture, implementation, test-pass, or commercial decisions.

## Reference routing

Classify the subtype before detailed work. Read only the matching reference; combine references only when the request spans multiple observable subtypes.

- Read [Scope change](references/scope-change.md) when the request adds, removes, or materially changes an approved deliverable.
- Read [Requirement clarification](references/requirement-clarification.md) when ambiguity may be resolved without changing approved intent.
- Read [Regulatory change](references/regulatory-change.md) when law, regulation, policy, or audit obligation drives the request.

## Core method

1. Trace and verify **Requested Change** through entrypoints, dependencies, side effects, contracts, and focused tests.
2. Resolve **Business Rationale** using task evidence, applicable constraints, alternatives, and explicit acceptance criteria.
3. Resolve **Baseline Delta** using task evidence, applicable constraints, alternatives, and explicit acceptance criteria.
4. Define **Stakeholder Impact** precisely, including exclusions, owners, interfaces, and assumptions.
5. Specify **Requirement Impact** as measurable, traceable, unambiguous statements with accountable ownership.
6. Derive **Recommendation Options** from explicit criteria; state conditions, dissent, and decision authority.
7. Reconcile contradictions and state unresolved evidence, decision, and ownership gaps.

## Quality checks

- Tie each conclusion to a named stakeholder, source artifact, business rule, or labeled assumption.
- Keep business need, proposed scope, approved baseline, and technical design distinct.
- Confirm proposed changes are separated from approved baseline content.
- Confirm acceptance, approval, test, release, and customer decisions are claimed only with evidence.
