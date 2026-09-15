# Use Case: PowerPoint Presentation

## Purpose
Tài liệu orchestration độc lập cho use case **PowerPoint Presentation** trong AionUi/AionCore + OfficeCLI.

## Trigger
LLM nhận yêu cầu thuộc use case này và chọn assistant/skill phù hợp.

## Assistant / Skill
```text
assistant: ppt-creator
skill: officecli-pptx
```

## End-to-End Flow
```text
User topic -> storyline -> slide outline -> create PPTX -> layouts -> text/images/tables/charts -> theme -> validate -> render -> visual review -> repair
```

## OfficeCLI Commands
```bash
officecli create deck.pptx
officecli open deck.pptx
officecli add deck.pptx / --type slide --prop title="Enterprise AI Platform"
officecli add deck.pptx '/slide[1]' --type shape --prop text="Architecture Overview" --prop x=2cm --prop y=2cm --prop size=30
officecli validate deck.pptx
officecli view deck.pptx html
officecli close deck.pptx
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
deck.pptx
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
