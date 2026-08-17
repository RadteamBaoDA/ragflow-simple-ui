# Tracing design

## Use when

Use this variant when cross-component latency and causality are needed.

## Task guidance

For **Define Observability**, define propagation, span boundaries, attributes, sampling, sensitive-data policy, service map, storage, and validation.

## Decision checks

- Confirm target, version, authorization, telemetry, blast radius, and recovery path.
- Keep planned, attempted, completed, failed, and rolled-back states distinct.
- If multiple references apply, reconcile their constraints explicitly instead of merging incompatible advice.
