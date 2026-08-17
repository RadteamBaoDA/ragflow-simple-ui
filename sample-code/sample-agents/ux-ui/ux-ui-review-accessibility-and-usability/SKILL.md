---
name: ux-ui-review-accessibility-and-usability
description: Use when an outsourcing SDLC work item explicitly requires 'Review Accessibility and Usability' during product discovery and experience design.
---

# Review Accessibility and Usability

## Purpose

Produce an evidence-based accessibility and usability review.

## Task responsibility

Own user experience, interaction, content, accessibility design evidence, and design handoff. Do not approve business scope, technical feasibility, implementation quality, test completion, or customer acceptance for other roles.

## Reference routing

Classify the variant from observable requirements or artifacts. Read only the relevant reference; combine references only when the work genuinely spans multiple variants.

- Read [WCAG review](references/wcag-review.md) when conformance to an accessibility standard is required.
- Read [Keyboard interaction review](references/keyboard-review.md) when users must complete the flow without a pointing device.
- Read [Screen reader review](references/screen-reader-review.md) when semantic structure and announcements are material.

## Core method

1. Define **Review Scope** precisely, including exclusions, owners, interfaces, and assumptions.
2. Identify and rank **Accessibility Findings** by evidence, impact, likelihood, and affected owner.
3. Identify and rank **Usability Findings** by evidence, impact, likelihood, and affected owner.
4. Establish **Severity and Evidence** with reproducible cases, observed results, and uncovered paths.
5. Resolve **Remediation Guidance** using task evidence, applicable constraints, alternatives, and explicit acceptance criteria.
6. Derive **Verdict** from explicit criteria; state conditions, dissent, and decision authority.
7. Reconcile contradictions and state unresolved evidence, decision, and ownership gaps.

## Quality checks

- Tie design decisions to user evidence, task goals, content states, accessibility, and validation results.
- Cover empty, loading, error, permission, destructive, responsive, and localization states when applicable.
- Tie decisions and findings to explicit drivers and evidence.
- Separate proposed design from approved baseline and implemented behavior.
- Do not claim feasibility, conformance, accessibility, approval, testing, or readiness without accountable evidence.
