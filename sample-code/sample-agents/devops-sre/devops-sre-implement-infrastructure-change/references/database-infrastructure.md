# Database infrastructure change

## Use when

Use this variant when database service, topology, capacity, backup, or failover changes.

## Task guidance

For **Implement Infrastructure Change**, review clients, maintenance, replication, backup and restore, capacity, connection limits, observability, failover, and rollback limits.

## Decision checks

- Confirm target, version, authorization, telemetry, blast radius, and recovery path.
- Keep planned, attempted, completed, failed, and rolled-back states distinct.
- If multiple references apply, reconcile their constraints explicitly instead of merging incompatible advice.
