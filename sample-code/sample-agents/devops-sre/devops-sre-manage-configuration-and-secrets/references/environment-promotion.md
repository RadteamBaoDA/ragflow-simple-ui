# Environment promotion

## Use when

Use this variant when configuration moves through delivery environments.

## Task guidance

For **Manage Configuration and Secrets**, define authoritative source, allowed overrides, approval, validation, artifact binding, drift check, audit, and rollback.

## Decision checks

- Confirm target, version, authorization, telemetry, blast radius, and recovery path.
- Keep planned, attempted, completed, failed, and rolled-back states distinct.
- If multiple references apply, reconcile their constraints explicitly instead of merging incompatible advice.
