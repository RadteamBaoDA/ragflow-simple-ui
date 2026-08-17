# Asynchronous unit tests

## Use when

Use this variant when ordering, retries, cancellation, queues, or concurrent effects are under test.

## Task guidance

For **Write Unit Tests**, use deterministic signals instead of timing sleeps; assert settlement, cancellation, retry limits, and duplicate protection.

## Decision checks

- Confirm entrypoints, contracts, error paths, side effects, tests, and compatibility.
- Record exact evidence for implemented behavior and explicit gaps for unverified behavior.
- If multiple references apply, reconcile their constraints explicitly instead of merging incompatible advice.
