# Secret exposure review

## Use when

Use this variant when credentials, tokens, keys, or sensitive configuration may be present.

## Task guidance

For **Review Code and Dependencies**, check source, history, build logs, artifacts, client bundles, environment boundaries, rotation, revocation, and scanning.

## Decision checks

- Confirm asset, boundary, attack precondition, evidence, control, and residual risk owner.
- Stop active testing when authorization or rules of engagement are incomplete.
- If multiple references apply, reconcile their constraints explicitly instead of merging incompatible advice.
