# Component refactor

## Use when

Use this variant when one UI, service, or domain component changes internal structure.

## Task guidance

For **Refactor Code**, preserve public API and state behavior, map consumers, isolate responsibilities, and run component plus consumer tests.

## Decision checks

- Confirm entrypoints, contracts, error paths, side effects, tests, and compatibility.
- Record exact evidence for implemented behavior and explicit gaps for unverified behavior.
- If multiple references apply, reconcile their constraints explicitly instead of merging incompatible advice.
