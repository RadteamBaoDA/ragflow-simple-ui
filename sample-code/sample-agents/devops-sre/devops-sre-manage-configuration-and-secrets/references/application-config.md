# Application configuration

## Use when

Use this variant when non-secret values vary by environment or release.

## Task guidance

For **Manage Configuration and Secrets**, define typed schema, defaults, environment overrides, validation, ownership, promotion, audit, drift, and rollback.

## Decision checks

- Confirm target, version, authorization, telemetry, blast radius, and recovery path.
- Keep planned, attempted, completed, failed, and rolled-back states distinct.
- If multiple references apply, reconcile their constraints explicitly instead of merging incompatible advice.
