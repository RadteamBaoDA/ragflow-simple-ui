# Local refactor

## Use when

Use this variant when one function or tightly bounded unit changes structure.

## Task guidance

For **Refactor Code**, state invariants, keep public contracts stable, make the smallest responsible change, and run focused tests.

## Decision checks

- Confirm entrypoints, contracts, error paths, side effects, tests, and compatibility.
- Record exact evidence for implemented behavior and explicit gaps for unverified behavior.
- If multiple references apply, reconcile their constraints explicitly instead of merging incompatible advice.
