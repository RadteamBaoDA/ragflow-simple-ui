# Use Case: Edit Existing Office File

## Purpose
Tài liệu orchestration độc lập cho use case **Edit Existing Office File** trong AionUi/AionCore + OfficeCLI.

## Trigger
LLM nhận yêu cầu thuộc use case này và chọn assistant/skill phù hợp.

## Assistant / Skill
```text
assistant: generic Office assistant
skill: officecli-docx/xlsx/pptx
```

## End-to-End Flow
```text
Existing file -> get/query -> understand structure -> identify stable IDs/paths -> set/add/remove/move -> validate -> render -> compare before/after
```

## OfficeCLI Commands
```bash
officecli get existing.docx /body --depth 3 --json
officecli query existing.docx 'paragraph[style=Heading1]'
officecli set existing.docx / --find "2025" --replace "2026"
officecli validate existing.docx

officecli get existing.pptx '/slide[3]' --depth 2 --json
officecli set existing.pptx '/slide[3]/shape[@name=Title]' --prop text="Updated Architecture"
officecli validate existing.pptx
```

## Validate / Render / Repair Loop
```text
officecli get/query
   -> inspect current structure
   -> officecli add/set/remove/move
   -> officecli validate
   -> officecli view <file> html
   -> LLM/human reviews output
   -> if issue: repeat edit + validate + render
   -> final delivery
```

## Output
```text
updated Office file
```

## Enterprise Execution Pattern
```text
LLM planner
   -> structured OfficeCLI operation
   -> command allowlist
   -> workspace/path validation
   -> sandboxed runner
   -> OfficeCLI
   -> audit log
   -> validate/render
   -> output storage
```

## Security Notes
- Không cho LLM unrestricted shell.
- Chỉ allowlist OfficeCLI verbs cần thiết.
- Canonicalize path và chặn file ngoài workspace.
- Tách workspace theo user/job/tenant.
- Log prompt, tool calls và file versions.
- Có thể yêu cầu human approval trước khi phát hành file.
