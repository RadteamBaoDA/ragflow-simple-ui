# Frontend code review

## Use when

Use this variant when the diff affects browser UI or client logic.

## Task guidance

For **Review Code Change**, check user-visible behavior, state ownership, accessibility, localization, theme and responsive states, public imports, errors, and tests.

## Decision checks

- Confirm every finding has location, evidence, impact, severity, and required action.
- Review the change as supplied; do not silently remediate it.
- If multiple references apply, reconcile their constraints explicitly instead of merging incompatible advice.
