# Use Case: Excel Dashboard

## Purpose
Tài liệu orchestration độc lập cho use case **Excel Dashboard** trong AionUi/AionCore + OfficeCLI.

## Trigger
LLM nhận yêu cầu thuộc use case này và chọn assistant/skill phù hợp.

## Assistant / Skill
```text
assistant: data-dashboard
skill: officecli-data-dashboard -> officecli-xlsx
```

## End-to-End Flow
```text
Input data -> inspect schema -> create workbook -> RawData/Metrics/Dashboard sheets -> formulas/pivots/charts -> conditional formatting -> validate -> render -> repair
```

## OfficeCLI Commands
```bash
officecli create dashboard.xlsx
officecli set dashboard.xlsx /Sheet1/A1 --prop value="Month" --prop bold=true
officecli set dashboard.xlsx /Sheet1/B1 --prop value="Revenue" --prop bold=true
officecli set dashboard.xlsx /Sheet1/A2 --prop value="Jan"
officecli set dashboard.xlsx /Sheet1/B2 --prop value=125000
officecli add dashboard.xlsx /Sheet1 --type chart --prop type=column --prop range="A1:B13"
officecli validate dashboard.xlsx
officecli view dashboard.xlsx html
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
dashboard.xlsx
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
