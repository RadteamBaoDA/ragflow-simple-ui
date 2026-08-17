# Infrastructure pipeline

## Use when

Use this variant when infrastructure-as-code is planned and applied.

## Task guidance

For **Create CI/CD Pipeline Plan**, define format and validation, security policy, plan artifact, review, environment approval, apply locking, drift detection, and rollback limits.

## Decision checks

- Confirm target, version, authorization, telemetry, blast radius, and recovery path.
- Keep planned, attempted, completed, failed, and rolled-back states distinct.
- If multiple references apply, reconcile their constraints explicitly instead of merging incompatible advice.
