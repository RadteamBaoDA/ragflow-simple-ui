# Full regression

## Use when

Use this variant when release risk or cumulative change requires broad coverage.

## Task guidance

For **Execute Regression Testing**, run the governed suite across supported configurations and report skipped, blocked, flaky, and obsolete tests separately.

## Decision checks

- Confirm build, environment, data, preconditions, expected result, and observed result.
- Keep passed, failed, blocked, skipped, and not-tested outcomes distinct.
- If multiple references apply, reconcile their constraints explicitly instead of merging incompatible advice.
