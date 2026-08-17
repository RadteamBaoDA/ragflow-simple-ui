# Backend code review

## Use when

Use this variant when the diff affects server-side behavior.

## Task guidance

For **Review Code Change**, check input validation, authorization, domain boundaries, idempotency, error mapping, concurrency, telemetry, and tests.

## Decision checks

- Confirm every finding has location, evidence, impact, severity, and required action.
- Review the change as supplied; do not silently remediate it.
- If multiple references apply, reconcile their constraints explicitly instead of merging incompatible advice.
