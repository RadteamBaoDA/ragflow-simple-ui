# Non-template Office tools

Implementation source: `tool-sample/no-template/`  
Detailed coding contract: `tool-sample/NO_TEMPLATE_SPEC.md`

Public exports from `index.ts`:

```ts
createDocxFileTool(dependencies);
createExcelFileTool(dependencies);
createPptxPresentationTool(dependencies);
```

The tools create new files without `template_id`:

- DOCX: Markdown/plain text → `marked` → `jsdom` → `docx`.
- XLSX: CSV → parser/type inference/styling → `exceljs`.
- PPTX: sequential section child runtimes → `submit-section-slides` → `pptxgenjs`.

The host must provide `FileToolDependencies` for mandatory approval, generated-file storage, pending outputs, optional branding, and PPTX child runtime creation. `executeChildRuntime` adapts the host's real child execution API; the portable tool does not invent runtime methods. `fetchRemoteImage`, when enabled, must reject private/reserved destinations and redirect escapes and enforce `maxBytes` while streaming.

Import only the three factories into the existing tool registry. Do not register `submit-section-slides`; it is private to each PPTX child runtime.

Checks:

```powershell
npx tsx tool-sample/no-template/index.ts --self-check
npx tsx tool-sample/no-template/index.ts --binary-self-check
```

Run the checks after placing this module in the host package (or installing `docx`, `marked`, `jsdom`, `exceljs`, `pptxgenjs`, and `jszip` in a containing package), so Node can resolve the renderer and ZIP-validation dependencies.
