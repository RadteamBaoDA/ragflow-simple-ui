# Security configuration review

## Use when

Use this variant when security depends on flags, headers, policies, or environment values.

## Task guidance

For **Review Code and Dependencies**, verify safe defaults, schema validation, environment separation, least privilege, drift detection, audit, and rollback.

## Decision checks

- Confirm asset, boundary, attack precondition, evidence, control, and residual risk owner.
- Stop active testing when authorization or rules of engagement are incomplete.
- If multiple references apply, reconcile their constraints explicitly instead of merging incompatible advice.
