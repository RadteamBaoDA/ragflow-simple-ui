# Third-party SDK integration

## Use when

Use this variant when a vendor SDK encapsulates an external service.

## Task guidance

For **Implement Integration**, pin supported versions, wrap SDK types behind a local adapter, map errors, enforce timeouts, test sandbox behavior, and document exit strategy.

## Decision checks

- Confirm entrypoints, contracts, error paths, side effects, tests, and compatibility.
- Record exact evidence for implemented behavior and explicit gaps for unverified behavior.
- If multiple references apply, reconcile their constraints explicitly instead of merging incompatible advice.
