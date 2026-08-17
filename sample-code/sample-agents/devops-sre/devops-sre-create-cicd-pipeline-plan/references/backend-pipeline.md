# Backend pipeline

## Use when

Use this variant when server applications or services are built and promoted.

## Task guidance

For **Create CI/CD Pipeline Plan**, define install, lint, typecheck, tests, contract checks, build, dependency scan, image or package publication, migration gate, and deployment.

## Decision checks

- Confirm target, version, authorization, telemetry, blast radius, and recovery path.
- Keep planned, attempted, completed, failed, and rolled-back states distinct.
- If multiple references apply, reconcile their constraints explicitly instead of merging incompatible advice.
