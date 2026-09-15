# Use Case: Financial Model

## Purpose
Tài liệu orchestration độc lập cho use case **Financial Model** trong AionUi/AionCore + OfficeCLI.

## Trigger
LLM nhận yêu cầu thuộc use case này và chọn assistant/skill phù hợp.

## Assistant / Skill
```text
assistant: financial-model
skill: officecli-financial-model -> officecli-xlsx
```

## End-to-End Flow
```text
Historical data + assumptions -> model plan -> assumptions/IS/BS/CF/valuation/sensitivity -> formulas -> cross-sheet links -> charts -> validate formulas -> render -> final model
```

## OfficeCLI Commands
```bash
officecli create financial-model.xlsx
officecli set financial-model.xlsx /Sheet1/A1 --prop value="Revenue Growth"
officecli set financial-model.xlsx /Sheet1/B1 --prop value=0.18
officecli set financial-model.xlsx /Sheet1/A2 --prop value="Gross Margin"
officecli set financial-model.xlsx /Sheet1/B2 --prop value=0.62
officecli validate financial-model.xlsx
officecli view financial-model.xlsx html
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
financial-model.xlsx
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
