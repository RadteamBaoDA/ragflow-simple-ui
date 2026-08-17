# Database integration

## Use when

Use this variant when multiple components coordinate through persistence.

## Task guidance

For **Implement Integration**, preserve ownership, transactions, constraints, isolation, migration compatibility, and observable failure handling.

## Decision checks

- Confirm entrypoints, contracts, error paths, side effects, tests, and compatibility.
- Record exact evidence for implemented behavior and explicit gaps for unverified behavior.
- If multiple references apply, reconcile their constraints explicitly instead of merging incompatible advice.
