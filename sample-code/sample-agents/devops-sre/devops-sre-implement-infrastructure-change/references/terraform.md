# Terraform change

## Use when

Use this variant when Terraform manages target infrastructure.

## Task guidance

For **Implement Infrastructure Change**, inspect state and modules, pin providers, run format and validate, review plan, control apply, handle locks, detect drift, and document destroy risk.

## Decision checks

- Confirm target, version, authorization, telemetry, blast radius, and recovery path.
- Keep planned, attempted, completed, failed, and rolled-back states distinct.
- If multiple references apply, reconcile their constraints explicitly instead of merging incompatible advice.
