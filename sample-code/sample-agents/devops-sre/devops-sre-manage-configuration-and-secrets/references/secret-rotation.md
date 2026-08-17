# Secret rotation

## Use when

Use this variant when credentials must change without unsafe downtime.

## Task guidance

For **Manage Configuration and Secrets**, define owner, dependents, dual-key window, propagation order, validation, revocation, rollback, audit, and emergency contact.

## Decision checks

- Confirm target, version, authorization, telemetry, blast radius, and recovery path.
- Keep planned, attempted, completed, failed, and rolled-back states distinct.
- If multiple references apply, reconcile their constraints explicitly instead of merging incompatible advice.
