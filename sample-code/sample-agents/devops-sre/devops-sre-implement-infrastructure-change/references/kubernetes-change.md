# Kubernetes change

## Use when

Use this variant when manifests, Helm, operators, or cluster policies change.

## Task guidance

For **Implement Infrastructure Change**, validate rendered resources, ownership, rollout, probes, disruption, policy, secrets, observability, and rollback revision.

## Decision checks

- Confirm target, version, authorization, telemetry, blast radius, and recovery path.
- Keep planned, attempted, completed, failed, and rolled-back states distinct.
- If multiple references apply, reconcile their constraints explicitly instead of merging incompatible advice.
