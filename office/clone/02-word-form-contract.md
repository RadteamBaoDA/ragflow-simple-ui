# Use Case: Word Form / Contract

## Purpose
Tài liệu orchestration độc lập cho use case **Word Form / Contract** trong AionUi/AionCore + OfficeCLI.

## Trigger
LLM nhận yêu cầu thuộc use case này và chọn assistant/skill phù hợp.

## Assistant / Skill
```text
assistant: word-form
skill: officecli-word-form + officecli-docx
```

## End-to-End Flow
```text
User Request -> load template -> inspect structure -> map business fields -> update form fields/content controls -> insert clauses -> tracked changes if needed -> validate -> render -> final contract
```

## OfficeCLI Commands
```bash
officecli get nda-template.docx /body --depth 3 --json
officecli set nda-template.docx / --find "{{COMPANY_NAME}}" --replace "ACME Corporation"
officecli set nda-template.docx / --find "{{TERM_YEARS}}" --replace "3"
officecli add nda-template.docx /body --type paragraph --prop text="Confidentiality obligations survive termination."
officecli validate nda-template.docx
officecli view nda-template.docx html
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
NDA-ACME.docx
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
