# Use Case: Investor / Pitch Deck

## Purpose
Tài liệu orchestration độc lập cho use case **Investor / Pitch Deck** trong AionUi/AionCore + OfficeCLI.

## Trigger
LLM nhận yêu cầu thuộc use case này và chọn assistant/skill phù hợp.

## Assistant / Skill
```text
assistant: pitch-deck
skill: officecli-pitch-deck -> officecli-pptx
```

## End-to-End Flow
```text
Company data -> pitch narrative -> Problem/Solution/Product/Market/Traction/Business Model/Competition/Team/Financials/Ask -> create slides -> charts -> render -> story review -> repair
```

## OfficeCLI Commands
```bash
officecli create pitch-deck.pptx
officecli add pitch-deck.pptx / --type slide --prop title="The Problem"
officecli add pitch-deck.pptx / --type slide --prop title="Our Solution"
officecli add pitch-deck.pptx / --type slide --prop title="Market Opportunity"
officecli validate pitch-deck.pptx
officecli view pitch-deck.pptx html
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
pitch-deck.pptx
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
