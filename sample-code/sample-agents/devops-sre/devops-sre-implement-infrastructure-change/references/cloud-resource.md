# Cloud resource change

## Use when

Use this variant when provider-managed compute, storage, network, IAM, or services change.

## Task guidance

For **Implement Infrastructure Change**, review IAM, network exposure, encryption, backup, region, quota, cost, tagging, audit, lifecycle, and rollback.

## Decision checks

- Confirm target, version, authorization, telemetry, blast radius, and recovery path.
- Keep planned, attempted, completed, failed, and rolled-back states distinct.
- If multiple references apply, reconcile their constraints explicitly instead of merging incompatible advice.
