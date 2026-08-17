# Monorepo pipeline

## Use when

Use this variant when multiple packages share one repository.

## Task guidance

For **Create CI/CD Pipeline Plan**, define change detection, dependency graph, cache keys, affected tests, shared gates, versioning, artifact boundaries, and coordinated release.

## Decision checks

- Confirm target, version, authorization, telemetry, blast radius, and recovery path.
- Keep planned, attempted, completed, failed, and rolled-back states distinct.
- If multiple references apply, reconcile their constraints explicitly instead of merging incompatible advice.
