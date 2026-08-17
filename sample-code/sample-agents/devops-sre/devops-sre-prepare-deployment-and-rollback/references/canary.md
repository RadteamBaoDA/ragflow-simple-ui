# Canary deployment

## Use when

Use this variant when a small traffic segment validates change before expansion.

## Task guidance

For **Prepare Deployment and Rollback**, define cohort, percentage stages, metrics, comparison baseline, automatic stop, rollback, duration, and exclusion risk.

## Decision checks

- Confirm target, version, authorization, telemetry, blast radius, and recovery path.
- Keep planned, attempted, completed, failed, and rolled-back states distinct.
- If multiple references apply, reconcile their constraints explicitly instead of merging incompatible advice.
