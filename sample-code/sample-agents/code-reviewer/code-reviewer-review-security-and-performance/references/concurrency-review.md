# Concurrency-focused review

## Use when

Use this variant when shared state, ordering, cancellation, or parallel effects are involved.

## Task guidance

For **Review Security and Performance**, check atomicity, races, deadlocks, ordering, idempotency, cancellation, retry, and deterministic tests.

## Decision checks

- Confirm every finding has location, evidence, impact, severity, and required action.
- Review the change as supplied; do not silently remediate it.
- If multiple references apply, reconcile their constraints explicitly instead of merging incompatible advice.
