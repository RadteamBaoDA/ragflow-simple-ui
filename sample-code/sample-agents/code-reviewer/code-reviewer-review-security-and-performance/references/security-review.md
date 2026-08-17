# Security-focused review

## Use when

Use this variant when the diff changes trust, data, identity, dependencies, or privileged behavior.

## Task guidance

For **Review Security and Performance**, trace untrusted input, authn and authz, secrets, sensitive data, injection, dependency risk, logging, and abuse cases.

## Decision checks

- Confirm every finding has location, evidence, impact, severity, and required action.
- Review the change as supplied; do not silently remediate it.
- If multiple references apply, reconcile their constraints explicitly instead of merging incompatible advice.
