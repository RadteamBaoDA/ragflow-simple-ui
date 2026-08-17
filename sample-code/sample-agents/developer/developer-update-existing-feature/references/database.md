# Database implementation

## Use when

Use this variant when schema, persistence, query behavior, or migration is affected.

## Task guidance

For **Update Existing Feature**, use the repository ORM and migration conventions; define compatibility, backfill, locks, rollback limits, integrity, and tests.

## Decision checks

- Confirm entrypoints, contracts, error paths, side effects, tests, and compatibility.
- Record exact evidence for implemented behavior and explicit gaps for unverified behavior.
- If multiple references apply, reconcile their constraints explicitly instead of merging incompatible advice.
