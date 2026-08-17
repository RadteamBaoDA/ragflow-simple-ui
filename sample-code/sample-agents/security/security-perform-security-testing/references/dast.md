# Dynamic application security testing

## Use when

Use this variant when a running authorized environment is tested.

## Task guidance

Before sending any test traffic, require written rules of engagement containing:

- target allowlist and explicit exclusions;
- authorized environment, test window, source addresses, and operator identity;
- permitted accounts, data classification, rate limits, and prohibited techniques;
- monitoring contact, incident escalation path, stop conditions, and cleanup owner.

Record tool and rule versions, requests, timestamps, responses, evidence location, cleanup, and environment limitations. Use the least disruptive probe that can establish the condition. Never infer permission from target accessibility.

## Decision checks

- Confirm asset, boundary, attack precondition, evidence, control, and residual risk owner.
- Return **Blocked - authorization incomplete** without sending traffic when any required rules-of-engagement field is missing, expired, ambiguous, or outside the authenticated scope.
- Stop immediately on unexpected production impact, sensitive-data exposure, scope drift, or an incident signal; preserve evidence and notify the named contact.
- If multiple references apply, reconcile their constraints explicitly instead of merging incompatible advice.
