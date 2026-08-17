# Secure code review

## Use when

Use this variant when the diff handles untrusted input, identity, data, or privileged effects.

## Task guidance

For **Review Code and Dependencies**, trace validation, encoding, authn and authz, injection, path safety, deserialization, sensitive errors, logging, and abuse tests.

## Decision checks

- Confirm asset, boundary, attack precondition, evidence, control, and residual risk owner.
- Stop active testing when authorization or rules of engagement are incomplete.
- If multiple references apply, reconcile their constraints explicitly instead of merging incompatible advice.
