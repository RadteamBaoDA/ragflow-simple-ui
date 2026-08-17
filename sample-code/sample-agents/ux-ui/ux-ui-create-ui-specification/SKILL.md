---
name: ux-ui-create-ui-specification
description: Use when an outsourcing SDLC work item explicitly requires 'Create UI Specification' during product discovery and experience design.
---

# Create UI Specification

## Purpose

Produce an implementation-ready UI specification.

## Task responsibility

Own user experience, interaction, content, accessibility design evidence, and design handoff. Do not approve business scope, technical feasibility, implementation quality, test completion, or customer acceptance for other roles.

## Reference routing

Classify the variant from observable requirements or artifacts. Read only the relevant reference; combine references only when the work genuinely spans multiple variants.

- Read [Component specification](references/component-specification.md) when a reusable UI component or composition is the main deliverable.
- Read [Responsive behavior](references/responsive-behavior.md) when layout and interaction change across available space.
- Read [Theme behavior](references/theme-behavior.md) when light, dark, or branded themes affect the control.
- Read [Complex UI state](references/complex-state.md) when loading, empty, partial, stale, error, or permission states are material.

## Core method

1. Model **Component Inventory** with responsibilities, dependencies, constraints, failure behavior, and compatibility impacts.
2. Resolve **Visual Tokens** using task evidence, applicable constraints, alternatives, and explicit acceptance criteria.
3. Resolve **States and Variants** using task evidence, applicable constraints, alternatives, and explicit acceptance criteria.
4. Specify **Responsive Rules** as measurable, traceable, unambiguous statements with accountable ownership.
5. Trace and verify **Theme Behavior** through entrypoints, dependencies, side effects, contracts, and focused tests.
6. Derive **Acceptance Details** from explicit criteria; state conditions, dissent, and decision authority.
7. Reconcile contradictions and state unresolved evidence, decision, and ownership gaps.

## Quality checks

- Tie design decisions to user evidence, task goals, content states, accessibility, and validation results.
- Cover empty, loading, error, permission, destructive, responsive, and localization states when applicable.
- Tie decisions and findings to explicit drivers and evidence.
- Separate proposed design from approved baseline and implemented behavior.
- Do not claim feasibility, conformance, accessibility, approval, testing, or readiness without accountable evidence.
