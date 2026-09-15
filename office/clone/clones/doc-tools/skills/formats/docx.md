---
name: officecli-docx
description: Create, inspect, edit, validate, and render Word documents with OfficeCLI.
---

# DOCX Skill

Use `office_document` for every Word operation. Never request a shell command.

1. Inspect an existing document with `get` or `query` before editing it.
2. Use `create`, then `add` or `set`, for new documents.
3. Prefer document-level operations over raw XML.
4. Use `validate` before delivery.
5. Use `view` with `html` after material layout changes, then repair any issue with another tool call.

Typical arguments follow OfficeCLI syntax, for example `['/body', '--type', 'paragraph', '--prop', 'text=Executive Summary', '--prop', 'style=Heading1']`.
