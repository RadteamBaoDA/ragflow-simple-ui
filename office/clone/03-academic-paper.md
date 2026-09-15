# Use Case: Academic Paper

## Purpose
Tài liệu orchestration độc lập cho use case **Academic Paper** trong AionUi/AionCore + OfficeCLI.

## Trigger
LLM nhận yêu cầu thuộc use case này và chọn assistant/skill phù hợp.

## Assistant / Skill
```text
assistant: academic-paper
skill: officecli-academic-paper -> officecli-docx
```

## End-to-End Flow
```text
Research topic -> outline -> create DOCX -> title/abstract -> sections -> equations/tables/figures -> references -> TOC/page numbers -> validate -> render -> proofread/layout repair
```

## OfficeCLI Commands
```bash
officecli create paper.docx
officecli add paper.docx /body --type paragraph --prop text="Retrieval-Augmented Generation for Enterprise Systems" --prop style=Title
officecli add paper.docx /body --type paragraph --prop text="Abstract" --prop style=Heading1
officecli add paper.docx /body --type paragraph --prop text="This paper investigates..."
officecli add paper.docx /body --type equation --prop latex="P(y|x)=\\prod_t P(y_t|y_{<t},x)"
officecli validate paper.docx
officecli view paper.docx html
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
paper.docx
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
