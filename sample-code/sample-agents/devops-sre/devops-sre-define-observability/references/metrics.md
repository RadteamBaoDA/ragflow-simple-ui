# Metrics design

## Use when

Use this variant when numeric service and business health signals are needed.

## Task guidance

For **Define Observability**, define names, units, labels, cardinality limits, collection, aggregation, SLI use, dashboards, retention, and validation.

## Decision checks

- Confirm target, version, authorization, telemetry, blast radius, and recovery path.
- Keep planned, attempted, completed, failed, and rolled-back states distinct.
- If multiple references apply, reconcile their constraints explicitly instead of merging incompatible advice.
