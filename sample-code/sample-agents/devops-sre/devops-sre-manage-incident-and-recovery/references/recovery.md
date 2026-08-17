# Incident recovery

## Use when

Use this variant when service must return safely to an acceptable state.

## Task guidance

For **Manage Incident and Recovery**, use runbooks, validate dependencies, restore incrementally, check data integrity, monitor stability, communicate, and define exit criteria.

## Decision checks

- Confirm target, version, authorization, telemetry, blast radius, and recovery path.
- Keep planned, attempted, completed, failed, and rolled-back states distinct.
- If multiple references apply, reconcile their constraints explicitly instead of merging incompatible advice.
