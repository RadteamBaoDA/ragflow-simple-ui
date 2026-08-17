# Database code review

## Use when

Use this variant when the diff affects persistence or migrations.

## Task guidance

For **Review Code Change**, check ORM use, scope filters, constraints, transactionality, migration compatibility, locks, rollback limits, and data tests.

## Decision checks

- Confirm every finding has location, evidence, impact, severity, and required action.
- Review the change as supplied; do not silently remediate it.
- If multiple references apply, reconcile their constraints explicitly instead of merging incompatible advice.
