# Environment-specific verification

## Use when

Use this variant when the defect or fix depends on configuration, platform, region, or integration.

## Task guidance

For **Verify Defect Fix**, record exact environment delta, reproduce in affected and control environments, and avoid generalizing unsupported results.

## Decision checks

- Confirm build, environment, data, preconditions, expected result, and observed result.
- Keep passed, failed, blocked, skipped, and not-tested outcomes distinct.
- If multiple references apply, reconcile their constraints explicitly instead of merging incompatible advice.
