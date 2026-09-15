# Use Case: Morph PowerPoint

## Purpose
Tài liệu orchestration độc lập cho use case **Morph PowerPoint** trong AionUi/AionCore + OfficeCLI.

## Trigger
LLM nhận yêu cầu thuộc use case này và chọn assistant/skill phù hợp.

## Assistant / Skill
```text
assistant: morph-ppt
skill: Morph rules + officecli-pptx
```

## End-to-End Flow
```text
Topic -> motion storyboard -> base slide -> reuse corresponding objects -> change position/size -> apply Morph -> preview -> check continuity -> repair object identity/layout
```

## OfficeCLI Commands
```bash
officecli create morph-deck.pptx
officecli add morph-deck.pptx / --type slide --prop title="Overview"
officecli add morph-deck.pptx '/slide[1]' --type shape --prop name="!!hero" --prop text="AI Platform"
officecli add morph-deck.pptx / --type slide --prop title="Architecture"
officecli validate morph-deck.pptx
officecli view morph-deck.pptx html
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
morph-deck.pptx
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
