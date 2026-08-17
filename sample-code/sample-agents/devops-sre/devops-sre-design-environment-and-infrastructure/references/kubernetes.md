# Kubernetes infrastructure

## Use when

Use this variant when Kubernetes orchestrates workloads.

## Task guidance

For **Design Environment and Infrastructure**, define cluster ownership, namespaces, workload resources, networking, identity, secrets, policy, probes, scaling, disruption, and observability.

## Decision checks

- Confirm target, version, authorization, telemetry, blast radius, and recovery path.
- Keep planned, attempted, completed, failed, and rolled-back states distinct.
- If multiple references apply, reconcile their constraints explicitly instead of merging incompatible advice.
