# Module refactor

## Use when

Use this variant when ownership or boundaries change across several files.

## Task guidance

For **Refactor Code**, map exports, imports, callers, dependency direction, migration sequence, and module-level regression.

## Decision checks

- Confirm entrypoints, contracts, error paths, side effects, tests, and compatibility.
- Record exact evidence for implemented behavior and explicit gaps for unverified behavior.
- If multiple references apply, reconcile their constraints explicitly instead of merging incompatible advice.
