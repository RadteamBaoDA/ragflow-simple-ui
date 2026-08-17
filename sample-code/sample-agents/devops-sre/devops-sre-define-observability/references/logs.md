# Logging design

## Use when

Use this variant when structured event records are needed.

## Task guidance

For **Define Observability**, define events, severity, fields, correlation, sensitive-data redaction, sampling, access, retention, ingestion failure, and validation.

## Decision checks

- Confirm target, version, authorization, telemetry, blast radius, and recovery path.
- Keep planned, attempted, completed, failed, and rolled-back states distinct.
- If multiple references apply, reconcile their constraints explicitly instead of merging incompatible advice.
