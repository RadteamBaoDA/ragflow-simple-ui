# Use Case: Analyze / Validate Office File

## Purpose
Tài liệu orchestration độc lập cho use case **Analyze / Validate Office File** trong AionUi/AionCore + OfficeCLI.

## Trigger
LLM nhận yêu cầu thuộc use case này và chọn assistant/skill phù hợp.

## Assistant / Skill
```text
assistant: generic Office assistant
skill: officecli common skill
```

## End-to-End Flow
```text
Office file -> view stats -> view issues -> get/query -> validate -> LLM summarizes problems -> optional repair plan
```

## OfficeCLI Commands
```bash
officecli view report.docx stats
officecli view report.docx issues
officecli get report.docx /body --depth 3 --json
officecli validate report.docx
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
analysis result
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
