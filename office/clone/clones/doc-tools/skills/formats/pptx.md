---
name: officecli-pptx
description: Create, inspect, edit, validate, and render PowerPoint presentations with OfficeCLI.
---

# PPTX Skill

Use `office_document` for every presentation operation. Never request a shell command.

1. Plan the storyline and slide sequence before creating slides.
2. Use stable slide and shape paths when editing an existing deck.
3. Keep layout, typography, and visual hierarchy consistent.
4. Use `validate` before delivery.
5. Use `view` with `html` after layout changes, then repair through structured tool calls.

Typical arguments follow OfficeCLI syntax, for example `['/slide[1]', '--type', 'shape', '--prop', 'text=Architecture Overview']`.
