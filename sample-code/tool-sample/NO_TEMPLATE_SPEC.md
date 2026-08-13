# Non-template Office File Tools Specification

## 1. Goal

Implement one export module containing three public function tools copied from the current `create-files` behavior:

- `create-docx-file`
- `create-excel-file`
- `create-pptx-presentation`

These tools create new DOCX, XLSX, and PPTX files without uploaded templates or `template_id`.

DOCX and XLSX render the content supplied in the public tool call. PPTX keeps the existing section sub-agent behavior: each requested section is expanded by a focused child agent, then the parent tool assembles all submitted slides into one presentation.

This specification is for later implementation. It does not modify the registry, bootstrap, template tools, Admin flow, or persistence code now.

## 2. Canonical source behavior

The coding agent must inspect and preserve behavior from these existing `create-files` modules before implementing:

```text
docx/create-docx-file.js
docx/utils.js
xlsx/create-excel-file.js
xlsx/utils.js
pptx/create-presentation.js
pptx/section-agent.js
pptx/themes.js
pptx/utils.js
lib.js
```

Do not import from these source modules in the finished portable tools. Copy the required generation logic into TypeScript and replace application singletons with the dependency contract in section 5.

## 3. Target file structure

Create under `tool-sample/no-template/`:

```text
index.ts
types.ts
dependencies.ts              # contract only; host owns implementation
file-helpers.ts
create-docx-file.ts
docx-renderer.ts
docx-utils.ts
create-excel-file.ts
xlsx-renderer.ts
xlsx-utils.ts
create-pptx-presentation.ts
pptx-section-agent.ts
pptx-renderer.ts
pptx-themes.ts
pptx-utils.ts
SPEC.md                       # copy of this specification
```

`index.ts` exports only the three public tool factories and public types. Renderer and section-agent modules are internal.

Do not combine the three public tools into one function with a `format` switch. Separate descriptions and schemas allow the model to select the correct tool and preserve the current behavior.

## 4. Function-tool shape

All factories use the neutral runtime contract already defined by `tool-sample/types.ts`:

```ts
export interface FunctionTool {
  name: string;
  plugin(): {
    name: string;
    setup(runtime: AgentRuntime): void;
  };
}
```

Registration inside `setup`:

```ts
setup(runtime) {
  runtime.function({
    super: runtime,
    name: this.name,
    description,
    examples,
    parameters,
    handler,
  });
}
```

Every public tool must provide a specific description, at least two examples, a closed JSON Schema with `additionalProperties: false`, and a handler returning a string.

## 5. Host dependency contract

Define this interface in `no-template/types.ts`:

```ts
export interface FileToolDependencies {
  requestApproval(input: {
    toolName: string;
    payload: Record<string, unknown>;
    description: string;
  }): Promise<{ approved: boolean; message: string }>;

  saveGeneratedFile(input: {
    fileType: "docx" | "xlsx" | "pptx";
    extension: "docx" | "xlsx" | "pptx";
    buffer: Buffer;
    displayFilename: string;
  }): Promise<{
    filename: string;
    displayFilename: string;
    fileSize: number;
  }>;

  registerOutput(
    runtime: AgentRuntime,
    type: "DocxFileDownload" | "ExcelFileDownload" | "PptxFileDownload",
    payload: {
      filename: string;
      storageFilename: string;
      fileSize: number;
    }
  ): void;

  getLogo(input: {
    forDarkBackground: boolean;
    format: "buffer" | "dataUri";
  }): Buffer | string | null;

  getDeploymentVersion(): string;

  createChildRuntime(input: {
    parent: AgentRuntime;
    maxToolCalls: number;
    suppressChatOutput: boolean;
  }): AgentRuntime;

  attachResearchTools?(child: AgentRuntime): void;

  executeChildRuntime?(input: {
    child: AgentRuntime;
    messages: Array<{ role: string; content: string }>;
    functions: RegisteredFunction[];
    agentName: string;
  }): Promise<{ citations?: unknown[] } | void>;

  getChildCitations?(child: AgentRuntime): unknown[];

  fetchRemoteImage?(input: {
    url: string;
    maxBytes: number;
    timeoutMs: number;
    signal?: AbortSignal;
  }): Promise<Buffer | null>;
}
```

The host adapter maps these operations to its existing approval, generated-file storage, pending-output, logo, version, child-runtime, web-search, and web-scraping services. Approval is mandatory and fails closed when the adapter is missing. `executeChildRuntime` maps the host's real child execution/provider API; do not add invented execution methods to the neutral runtime. `fetchRemoteImage`, when provided, must reject private/reserved addresses and redirect escapes and stream with the supplied byte limit. Do not create a second artifact store or registry.

All tools must send the existing download card after saving:

```ts
runtime.socket?.send("fileDownloadCard", {
  filename: saved.displayFilename,
  storageFilename: saved.filename,
  fileSize: saved.fileSize,
});
```

## 6. Shared file helpers

`file-helpers.ts` copies only the shared behavior required by all formats:

- Recursively remove XML 1.0 illegal control characters `U+0000–U+0008`, `U+000B`, `U+000C`, and `U+000E–U+001F` from strings, arrays, and objects.
- Add the required extension when absent.
- Derive `displayFilename` from the last path segment.
- Reject empty filenames and filenames containing CR/LF or reserved path characters.
- Check the runtime abort signal before expensive rendering and before persistence.
- Convert unexpected exceptions to a safe tool result without stack traces or absolute paths.

The host storage layer remains responsible for generating a safe storage filename and preventing path traversal.

## 7. DOCX tool

### 7.1 Public contract

Name: `create-docx-file`

Description intent: create a styled Word document from Markdown or plain text, including tables, lists, code blocks, links, images, title page, headers, footers, themes, and margin presets.

Parameters:

```ts
{
  type: "object",
  properties: {
    filename: { type: "string" },
    title: { type: ["string", "null"] },
    subtitle: { type: ["string", "null"] },
    author: { type: ["string", "null"] },
    content: { type: "string" },
    theme: { type: "string", enum: ["neutral", "blue", "warm"] },
    margins: { type: "string", enum: ["normal", "narrow", "wide"] },
    includeTitlePage: { type: "boolean" }
  },
  required: [
    "filename",
    "title",
    "subtitle",
    "author",
    "content",
    "theme",
    "margins",
    "includeTitlePage"
  ],
  additionalProperties: false
}
```

Defaults applied by the handler when a non-strict host omits optional values:

```text
filename=document.docx
title=null
subtitle=null
author=null
content=""
theme=neutral
margins=normal
includeTitlePage=false
```

### 7.2 DOCX generation flow

```text
sanitize content/title/subtitle/author
→ append .docx when missing
→ derive display filename
→ derive document title from explicit title, first H1, or filename
→ request approval
→ parse Markdown with marked using GFM and line breaks
→ parse HTML with JSDOM
→ convert HTML nodes to docx elements
→ build optional cover-page section
→ build content section with selected margins
→ add running header only when title page is enabled
→ add Page X of Y footer and optional logo
→ create Document metadata and numbering config
→ Packer.toBuffer
→ save, send download card, register DocxFileDownload
```

The renderer must port the current `docx/utils.js` behavior for headings, paragraphs, bold/italic/underline/strike text, ordered/unordered lists, nested lists, blockquotes, fenced code, inline code, links, tables, horizontal rules, and supported remote/data images.

Required packages, already present in the current server package set:

```text
docx
marked
jsdom
image-size
```

Do not use `docxtemplater` or `pizzip` for this tool because it creates a new document rather than filling an OOXML template.

## 8. XLSX tool

### 8.1 Public contract

Name: `create-excel-file`

Parameters preserve the current single-sheet and multi-sheet modes:

```ts
{
  type: "object",
  properties: {
    filename: { type: "string" },
    csvData: { type: ["string", "null"] },
    sheets: {
      type: ["array", "null"],
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          csvData: { type: "string" },
          options: {
            type: "object",
            properties: {
              headerStyle: { type: "boolean" },
              autoFit: { type: "boolean" },
              freezeHeader: { type: "boolean" },
              zebraStripes: { type: "boolean" },
              delimiter: {
                type: "string",
                enum: ["comma", "semicolon", "tab", "pipe"]
              }
            },
            additionalProperties: false
          }
        },
        required: ["name", "csvData"],
        additionalProperties: false
      }
    },
    options: {
      type: "object",
      properties: {
        headerStyle: { type: "boolean" },
        autoFit: { type: "boolean" },
        freezeHeader: { type: "boolean" },
        zebraStripes: { type: "boolean" }
      },
      additionalProperties: false
    }
  },
  required: ["filename", "csvData", "sheets", "options"],
  additionalProperties: false
}
```

Exactly one data mode is required:

- `csvData` for one worksheet named `Sheet1`; or
- non-empty `sheets` for multiple named worksheets.

If both are supplied, `sheets` takes precedence to preserve current behavior.

### 8.2 XLSX generation flow

```text
sanitize CSV strings and sheet names
→ append .xlsx when missing
→ reject missing/empty data
→ normalize sheet definitions
→ request approval with sheet count/names
→ create ExcelJS Workbook
→ for each sheet: sanitize name, choose delimiter, parse CSV, validate limits
→ infer numbers/dates/booleans/percentages for non-header cells
→ apply date and percentage number formats
→ apply auto-fit, header style, optional zebra stripes, frozen header
→ apply workbook branding/metadata
→ workbook.xlsx.writeBuffer
→ save, send download card, register ExcelFileDownload
```

Port these current utility behaviors exactly:

- CSV parser supports quoted fields, escaped quotes, embedded delimiters, and embedded newlines.
- Delimiter detection supports comma, semicolon, tab, and pipe.
- Reject more than 16,384 columns or 1,048,576 rows.
- Warn about inconsistent column counts instead of rejecting them.
- Worksheet names are limited to 31 characters and replace `* ? : \\ / [ ]` with `_`.
- Default `autoFit`, `headerStyle`, and `freezeHeader` are enabled unless explicitly `false`.

Required package: `exceljs`.

## 9. PPTX tool and section sub-agent

### 9.1 Public contract

Name: `create-pptx-presentation`

```ts
{
  type: "object",
  properties: {
    filename: { type: "string" },
    title: { type: "string" },
    author: { type: "string" },
    theme: {
      type: "string",
      enum: ["default", "corporate", "dark", "minimal", "creative"]
    },
    sections: {
      type: "array",
      minItems: 1,
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          keyPoints: { type: "array", items: { type: "string" } },
          instructions: { type: ["string", "null"] }
        },
        required: ["title", "keyPoints", "instructions"],
        additionalProperties: false
      }
    }
  },
  required: ["filename", "title", "author", "theme", "sections"],
  additionalProperties: false
}
```

### 9.2 Parent presentation flow

```text
sanitize title/author
→ append .pptx when missing
→ resolve theme
→ request approval before any child-agent work
→ extract up to 10 recent successful chat messages, max 500 chars each
→ process sections sequentially
→ invoke one focused child runtime for each section
→ accumulate submitted slides and citations
→ attach accumulated citations to parent runtime
→ sanitize all slide content recursively
→ create PptxGenJS presentation
→ add title slide
→ render submitted section/content/blank slides
→ write nodebuffer
→ save, send download card, register PptxFileDownload
```

Sequential section execution is required. Do not parallelize: it preserves ordered progress events and supports local providers that serve one request at a time.

### 9.3 Child runtime creation

For each section call:

```ts
dependencies.createChildRuntime({
  parent: runtime,
  maxToolCalls: 5,
  suppressChatOutput: true,
});
```

The host adapter must reuse the parent provider, model, handler context, introspection callback, abort propagation, and socket. It must suppress only normal chat stream output from the child; progress/tool events still reach the parent UI. The tool invokes that adapter through `executeChildRuntime` and obtains citations from its return value or `getChildCitations`.

Call `attachResearchTools(child)` so the child can use only existing web-search and web-scraping tools. Do not inherit every parent tool.

### 9.4 Child system prompt contract

The child receives one section only and must obey:

- Generate 2–5 slides for that section.
- Do not create the deck title slide.
- Each content slide has 3–6 concise bullets.
- Prefer specific, data-driven content.
- Include speaker notes.
- Use research tools only for current or unavailable facts.
- Finish by calling `submit-section-slides`; never return raw JSON.

The user prompt includes presentation title, section title, key points, optional instructions, and bounded conversation context.

### 9.5 Internal `submit-section-slides` tool

Register only inside the child runtime:

```ts
{
  name: "submit-section-slides",
  description: "Submit the completed slides for this presentation section.",
  parameters: {
    type: "object",
    properties: {
      slides: {
        type: "array",
        minItems: 1,
        items: {
          type: "object",
          properties: {
            layout: {
              type: "string",
              enum: ["section", "content", "blank"]
            },
            title: { type: "string" },
            subtitle: { type: "string" },
            content: { type: "array", items: { type: "string" } },
            notes: { type: "string" },
            table: {
              type: "object",
              properties: {
                headers: { type: "array", items: { type: "string" } },
                rows: {
                  type: "array",
                  items: { type: "array", items: { type: "string" } }
                }
              },
              required: ["headers", "rows"],
              additionalProperties: false
            }
          },
          required: ["layout", "title"],
          additionalProperties: false
        }
      }
    },
    required: ["slides"],
    additionalProperties: false
  }
}
```

The handler stores submitted slides on child invocation state and returns a short success string.

### 9.6 Child failure fallback

Preserve the current fallback behavior:

- If child execution throws, return a section divider slide and, when key points exist, one content slide containing those key points.
- If child finishes without submitting slides, use the same fallback.
- Preserve any citations already accumulated before a missing submission.
- A failed section does not abort other sections or the whole presentation.

### 9.7 PPTX rendering

Port all five themes and the existing 16:9 layout helpers. The renderer must support:

- Title slide.
- Section divider slide.
- Content slide with bullets.
- Optional table on content slide.
- Blank slide.
- Speaker notes where supported by `pptxgenjs`.
- Top accent, slide numbering, footer, and logo branding.
- Overflow-safe text sizing and bounded table dimensions.

Required package: `pptxgenjs`.

## 10. Registry integration

The coding agent imports the built public module into the existing `create-files` registry. Do not create a new registry.

```js
const {
  createDocxFileTool,
  createExcelFileTool,
  createPptxPresentationTool,
} = require("./no-template/index.js");
const { fileToolDependencies } = require("./no-template/dependencies.js");

const CreateDocxFile = createDocxFileTool(fileToolDependencies);
const CreateExcelFile = createExcelFileTool(fileToolDependencies);
const CreatePptxPresentation = createPptxPresentationTool(fileToolDependencies);
```

Add these three instances to the existing registry `plugin` array. If replacing the existing implementations, remove the old imports and keep the same public names so duplicates cannot overwrite each other in the runtime function map.

Do not register `submit-section-slides`; it exists only inside each PPTX child runtime.

## 11. Error and safety behavior

- Approval denial returns the host approval message and creates no child runtime or file.
- Abort prevents further rendering/persistence.
- Invalid DOCX content, CSV, section input, theme, or filename returns a safe error string.
- XML-illegal control characters never reach Office XML.
- Tool results never expose stack traces, absolute paths, credentials, raw buffers, or internal child state.
- Generated-file access continues to use the host's existing authorization.
- Limit input sizes at the host boundary. At minimum enforce Excel row/column limits and the runtime's existing request/token limits.

## 12. Tests required before integration

### Contract tests

- `index.ts` exports exactly three public factories.
- Each plugin registers one function with the expected name, description, examples, schema, and handler.
- Registry contains no duplicate public function names.

### DOCX tests

- Markdown headings, lists, table, link, code block, and image generate a DOCX buffer.
- Title-page mode creates cover and content sections.
- Theme/margin enum values affect output configuration.
- Approval denial saves nothing.
- Generated file reopens with the `docx`/OOXML parser.

### XLSX tests

- Quoted CSV, escaped quote, embedded delimiter, and embedded newline parse correctly.
- Single-sheet and multi-sheet calls generate valid workbooks.
- Type inference covers number, date, boolean, and percentage.
- Invalid Excel limits reject before save.
- Header style, auto-fit, zebra stripes, and freeze panes behave as configured.
- Generated workbook reopens with ExcelJS.

### PPTX tests

- Approval occurs before the first child runtime is created.
- One child is created per section with `maxToolCalls: 5`.
- Sections execute sequentially.
- Child exposes `submit-section-slides` plus only authorized research tools.
- Valid submission is rendered; missing/failed submission uses fallback.
- Citations roll up to the parent.
- All five themes generate a presentation.
- Generated presentation reopens as a valid OOXML ZIP and passes a Microsoft Office or LibreOffice smoke test.

### Final verification commands

The coding agent must run the target codebase's focused tests plus:

```text
TypeScript type-check
lint for all new files
self-check for exported tool metadata
binary fixture tests for DOCX/XLSX/PPTX
git diff --check
```

## 13. Acceptance criteria

- Three non-template tools reproduce the current DOCX, XLSX, and PPTX behavior.
- DOCX is generated with `docx`; XLSX with `exceljs`; PPTX with `pptxgenjs`.
- PPTX uses a focused child runtime per section and preserves research, structured submission, fallback, citation, and sequential execution behavior.
- All tools use the existing approval, storage, download-card, output-registration, abort, and registry mechanisms.
- No uploaded template, `template_id`, `docxtemplater`, or `pizzip` is used.
- No framework-specific product name appears in the portable module or its public types.
- The implementation does not modify or remove the existing template-based tools.
