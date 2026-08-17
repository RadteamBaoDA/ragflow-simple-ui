# Rolling deployment

## Use when

Use this variant when instances update incrementally in place.

## Task guidance

For **Prepare Deployment and Rollback**, define batch size, health gates, compatibility, traffic behavior, pause conditions, rollback revision, and capacity during rollout.

## Decision checks

- Confirm target, version, authorization, telemetry, blast radius, and recovery path.
- Keep planned, attempted, completed, failed, and rolled-back states distinct.
- If multiple references apply, reconcile their constraints explicitly instead of merging incompatible advice.
