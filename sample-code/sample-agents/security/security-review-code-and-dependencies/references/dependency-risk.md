# Dependency security review

## Use when

Use this variant when packages, images, SDKs, or transitive versions changed.

## Task guidance

For **Review Code and Dependencies**, verify provenance, lockfile, advisories, maintenance, license, install scripts, runtime exposure, update policy, and replacement.

## Decision checks

- Confirm asset, boundary, attack precondition, evidence, control, and residual risk owner.
- Stop active testing when authorization or rules of engagement are incomplete.
- If multiple references apply, reconcile their constraints explicitly instead of merging incompatible advice.
