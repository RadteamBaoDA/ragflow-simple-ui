# Integration code review

## Use when

Use this variant when the diff affects a cross-system contract.

## Task guidance

For **Review Code Change**, check contract version, auth, validation, timeouts, retries, idempotency, rate limits, error mapping, observability, and tests.

## Decision checks

- Confirm every finding has location, evidence, impact, severity, and required action.
- Review the change as supplied; do not silently remediate it.
- If multiple references apply, reconcile their constraints explicitly instead of merging incompatible advice.
