# Use Case: Word Report / Proposal

## Purpose
Tài liệu orchestration độc lập cho use case **Word Report / Proposal** trong AionUi/AionCore + OfficeCLI.

## Trigger
LLM nhận yêu cầu thuộc use case này và chọn assistant/skill phù hợp.

## Assistant / Skill
```text
assistant: word-creator
skill: officecli-docx
```

## End-to-End Flow
```text
User Request -> Word Creator -> load officecli-docx -> inspect data -> plan sections -> create DOCX -> add headings/tables/charts -> validate -> render -> LLM review -> repair -> final DOCX
```

## OfficeCLI Commands
```bash
officecli create report.docx
officecli open report.docx
officecli add report.docx /body --type paragraph --prop text="Q3 2026 Business Review" --prop style=Title
officecli add report.docx /body --type paragraph --prop text="Executive Summary" --prop style=Heading1
officecli add report.docx /body --type paragraph --prop text="Revenue increased 18% quarter-over-quarter."
officecli validate report.docx
officecli view report.docx html
officecli close report.docx
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
report.docx
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
