---
name: officecli-xlsx
description: Create, inspect, edit, validate, and render Excel workbooks with OfficeCLI.
---

# XLSX Skill

Use `office_document` for every workbook operation. Never request a shell command.

1. Inspect source data and the existing workbook before editing.
2. Keep raw data, calculations, and presentation on separate sheets when the task needs them.
3. Use formulas and cross-sheet references instead of hardcoded calculated results.
4. Use `validate` before delivery.
5. Use `view` with `html` to inspect tables and charts, then repair through structured tool calls.

Typical arguments follow OfficeCLI syntax, for example `['/Sheet1/A1', '--prop', 'value=Revenue', '--prop', 'bold=true']`.
