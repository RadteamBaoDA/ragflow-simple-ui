# API testing strategy

## Use when

Use this variant when service contracts are primary.

## Task guidance

For **Create Test Strategy**, cover schema, authn and authz, business rules, errors, idempotency, pagination, concurrency, compatibility, and performance.

## Decision checks

- Confirm build, environment, data, preconditions, expected result, and observed result.
- Keep passed, failed, blocked, skipped, and not-tested outcomes distinct.
- If multiple references apply, reconcile their constraints explicitly instead of merging incompatible advice.
