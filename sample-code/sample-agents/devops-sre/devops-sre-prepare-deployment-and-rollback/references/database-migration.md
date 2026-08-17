# Database migration deployment

## Use when

Use this variant when schema or data changes coordinate with application rollout.

## Task guidance

For **Prepare Deployment and Rollback**, define expand-contract order, compatibility window, backup, locks, backfill, validation, rollback limits, and ownership.

## Decision checks

- Confirm target, version, authorization, telemetry, blast radius, and recovery path.
- Keep planned, attempted, completed, failed, and rolled-back states distinct.
- If multiple references apply, reconcile their constraints explicitly instead of merging incompatible advice.
