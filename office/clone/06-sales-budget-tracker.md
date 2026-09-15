# Use Case: Sales / Budget Tracker

## Purpose
Tài liệu orchestration độc lập cho use case **Sales / Budget Tracker** trong AionUi/AionCore + OfficeCLI.

## Trigger
LLM nhận yêu cầu thuộc use case này và chọn assistant/skill phù hợp.

## Assistant / Skill
```text
assistant: excel-creator
skill: officecli-xlsx
```

## End-to-End Flow
```text
Business columns -> create workbook -> table -> data validation -> calculated fields -> conditional formatting -> charts/scorecards -> validate -> render
```

## OfficeCLI Commands
```bash
officecli create sales-pipeline.xlsx
officecli set sales-pipeline.xlsx /Sheet1/A1 --prop value="Deal" --prop bold=true
officecli set sales-pipeline.xlsx /Sheet1/B1 --prop value="Account" --prop bold=true
officecli set sales-pipeline.xlsx /Sheet1/C1 --prop value="Stage" --prop bold=true
officecli set sales-pipeline.xlsx /Sheet1/D1 --prop value="Amount" --prop bold=true
officecli validate sales-pipeline.xlsx
officecli view sales-pipeline.xlsx html
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
sales-pipeline.xlsx
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
