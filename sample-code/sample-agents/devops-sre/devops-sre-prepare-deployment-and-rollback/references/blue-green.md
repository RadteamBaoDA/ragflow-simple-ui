# Blue-green deployment

## Use when

Use this variant when parallel old and new environments enable traffic switch.

## Task guidance

For **Prepare Deployment and Rollback**, define environment parity, data compatibility, validation, switch, observation, rollback window, and cleanup.

## Decision checks

- Confirm target, version, authorization, telemetry, blast radius, and recovery path.
- Keep planned, attempted, completed, failed, and rolled-back states distinct.
- If multiple references apply, reconcile their constraints explicitly instead of merging incompatible advice.
