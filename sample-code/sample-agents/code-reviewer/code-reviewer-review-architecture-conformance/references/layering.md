# Layering conformance

## Use when

Use this variant when implementation boundaries or dependency direction are in question.

## Task guidance

For **Review Architecture Conformance**, compare imports and calls to approved ownership; flag domain leakage, cycles, bypassed adapters, and hidden coupling.

## Decision checks

- Confirm every finding has location, evidence, impact, severity, and required action.
- Review the change as supplied; do not silently remediate it.
- If multiple references apply, reconcile their constraints explicitly instead of merging incompatible advice.
