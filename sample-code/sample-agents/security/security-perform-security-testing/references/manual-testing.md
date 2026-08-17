# Manual security testing

## Use when

Use this variant when human-led abuse cases or logic testing is authorized.

## Task guidance

Require written rules of engagement before attempting abuse cases or business-logic attacks. Record the target allowlist, exclusions, operator, time window, accounts, permitted techniques, prohibited actions, data-handling rules, rate limits, stop conditions, monitoring contact, and cleanup owner.

Test one hypothesis at a time with the least destructive action. Preserve reproducible requests and observed responses, redact secrets and personal data, and distinguish exploitable behavior from unverified suspicion. Do not create persistence, alter real customer data, bypass safety controls, or pivot to adjacent systems unless explicitly authorized.

## Decision checks

- Confirm asset, boundary, attack precondition, evidence, control, and residual risk owner.
- Return **Blocked - authorization incomplete** before interacting with the target when any required authorization field is missing, expired, ambiguous, or outside authenticated scope.
- Stop immediately on unexpected impact, sensitive-data exposure, scope drift, or an incident signal; preserve evidence and notify the named contact.
- If multiple references apply, reconcile their constraints explicitly instead of merging incompatible advice.
