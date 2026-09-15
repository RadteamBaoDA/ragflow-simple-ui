# Use Case: Preview + Human Review + Repair

## Purpose
Tài liệu orchestration độc lập cho use case **Preview + Human Review + Repair** trong AionUi/AionCore + OfficeCLI.

## Trigger
LLM nhận yêu cầu thuộc use case này và chọn assistant/skill phù hợp.

## Assistant / Skill
```text
assistant: preview workflow
skill: AionCore office watch/proxy
```

## End-to-End Flow
```text
Frontend -> preview/start API -> OfficecliWatchManager -> officecli watch file --port N -> ProxyService -> Browser -> human feedback -> agent set/add/remove -> preview refresh -> approval
```

## OfficeCLI Commands
```bash
officecli watch deck.pptx --port 26315
officecli get deck.pptx selected --json
officecli set deck.pptx '/slide[2]/shape[@id=123]' --prop size=32
officecli validate deck.pptx
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
approved Office file
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
