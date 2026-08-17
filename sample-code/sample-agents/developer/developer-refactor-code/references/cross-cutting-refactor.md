# Cross-cutting refactor

## Use when

Use this variant when a shared concern changes across multiple modules.

## Task guidance

For **Refactor Code**, define rollout order, compatibility bridge, shared contract, broad regression, and a reversible transition.

## Decision checks

- Confirm entrypoints, contracts, error paths, side effects, tests, and compatibility.
- Record exact evidence for implemented behavior and explicit gaps for unverified behavior.
- If multiple references apply, reconcile their constraints explicitly instead of merging incompatible advice.
