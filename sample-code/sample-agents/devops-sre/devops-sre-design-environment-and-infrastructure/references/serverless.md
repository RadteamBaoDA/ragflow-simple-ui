# Serverless infrastructure

## Use when

Use this variant when managed functions or event runtimes execute workloads.

## Task guidance

For **Design Environment and Infrastructure**, define triggers, identity, limits, concurrency, cold start, state, retries, dead letters, observability, cost, and portability.

## Decision checks

- Confirm target, version, authorization, telemetry, blast radius, and recovery path.
- Keep planned, attempted, completed, failed, and rolled-back states distinct.
- If multiple references apply, reconcile their constraints explicitly instead of merging incompatible advice.
