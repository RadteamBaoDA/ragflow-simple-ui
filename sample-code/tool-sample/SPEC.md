# Office Template Function Tools

## Mục tiêu

`tool-sample/` cung cấp đúng ba function tool:

- `create-docx-from-template`
- `create-xlsx-from-template`
- `create-pptx-from-template`

Các tool chỉ render file khi agent gọi đã chuẩn bị đầy đủ nội dung. Tool không gọi LLM, không tạo sub-agent, không nghiên cứu, không bổ sung nội dung và không tự sửa dữ liệu.

Sample không tạo registry mới; spec chỉ hướng dẫn import tool vào registry hiện có. Ngoài phạm vi triển khai gồm bootstrap, Admin upload, template storage, database migration và download route. Codebase tích hợp cung cấp các phần này qua `DocumentToolDependencies`.

## Function-tool contract

Mỗi factory trả về plugin theo đúng pattern hiện tại:

```ts
{
  name: "create-xlsx-from-template",
  plugin: () => ({
    name: "create-xlsx-from-template",
    setup(runtime) {
      runtime.function({
        super: runtime,
        name,
        description,
        examples,
        parameters,
        handler,
      });
    },
  }),
}
```

`index.ts` chỉ export ba factory và supporting types. Nó không đăng ký tool vào registry.

## Import vào tool registry hiện có

Không tạo registry mới. Coding agent phải import ba factory vào registry hiện tại tại:

```text
<existing-create-files-registry>/index.js
```

Registry hiện tại dùng CommonJS và mảng `plugin`. Sau khi copy/transpile các file TypeScript vào thư mục plugin đích, import `index.js` đã build và dependency adapter của codebase:

```js
const {
  createDocxFromTemplateTool,
  createXlsxFromTemplateTool,
  createPptxFromTemplateTool,
} = require("./template-tools/index.js");
const { documentTemplateToolDependencies } = require("./template-tools/dependencies.js");
```

Khởi tạo tool đúng một lần và thêm vào mảng `plugin` hiện có:

```js
const CreateDocxFromTemplate = createDocxFromTemplateTool(
  documentTemplateToolDependencies
);
const CreateXlsxFromTemplate = createXlsxFromTemplateTool(
  documentTemplateToolDependencies
);
const CreatePptxFromTemplate = createPptxFromTemplateTool(
  documentTemplateToolDependencies
);

const createFilesAgent = {
  name: "create-files-agent",
  startupConfig: { params: {} },
  plugin: [
    CreatePptxPresentation,
    CreateTextFile,
    CreatePdfFile,
    CreateExcelFile,
    CreateDocxFile,
    CreateDocxFromTemplate,
    CreateXlsxFromTemplate,
    CreatePptxFromTemplate,
  ],
};
```

`documentTemplateToolDependencies` là adapter của codebase hiện tại cho `DocumentToolDependencies`; nó không thuộc registry và không được chứa logic tool registration. Nếu target codebase chạy TypeScript trực tiếp, dùng `import` tương đương thay cho `require`; shape factory và mảng `plugin` không đổi.

Không import trực tiếp các renderer vào registry. Registry chỉ biết ba public tool factory từ `index.ts`.

## Public input

Cả ba tool dùng cùng contract:

```json
{
  "template_id": "sales-monthly",
  "data_json": "{\"rows\":[{\"product\":\"A\",\"revenue\":1200}],\"total\":1200}",
  "filename": "sales-july.xlsx"
}
```

| Field | Ý nghĩa |
|---|---|
| `template_id` | ID template active đã được chọn trước. |
| `data_json` | JSON object string đã hoàn chỉnh và phải khớp schema của template. |
| `filename` | Tên file hiển thị hoặc `null` để sinh từ tên template. Không chấp nhận path. |

Agent gọi tool chịu trách nhiệm tạo nội dung trước. Nếu nội dung chưa đủ, agent không được gọi tool. Tool vẫn validate lại tại trust boundary và trả `INPUT_SCHEMA_INVALID` nếu thiếu hoặc sai.

## Host dependencies

Codebase tích hợp implement `DocumentToolDependencies`:

| Dependency | Trách nhiệm |
|---|---|
| `templates.load(templateId, context)` | Load template metadata và bytes sau khi kiểm tra quyền user/workspace. |
| `validateTemplateData(templateId, data, context)` | Validate toàn bộ dữ liệu bằng immutable schema gắn với template version. |
| `requestApproval(...)` | Gọi HITL approval hiện có trước khi render/save. |
| `saveGeneratedFile(...)` | Lưu bytes bằng generated-file store hiện có. |
| `registerOutput(...)` | Ghi pending output đúng loại download card. |

Template record:

```ts
{
  id: string;
  name: string;
  format: "docx" | "xlsx" | "pptx";
  status: "active" | "archived";
  buffer: Buffer;
  schema?: Record<string, unknown>;
}
```

Có `template_id` không đồng nghĩa có quyền truy cập. `templates.load()` phải fail closed theo user/workspace hiện tại.

## Deterministic flow riêng cho từng tool

Mỗi file `create-*-from-template.ts` tự sở hữu lifecycle của format đó:

```text
validate arguments
→ parse data_json thành object
→ kiểm tra abort
→ load và authorize template_id
→ require active status
→ require đúng format
→ validate data với template schema
→ normalize filename
→ request approval
→ render từ bản copy template bytes
→ reject output rỗng/quá lớn
→ save generated file
→ gửi fileDownloadCard
→ register pending output
```

Không có shared workflow runtime. `tool-helpers.ts` chỉ chứa helper thuần: parse JSON, filename validation, abort check, context extraction và safe error formatting.

## DOCX

Renderer: `docxtemplater-renderer.ts` với `docxtemplater` và `pizzip`.

Hỗ trợ scalar, condition và loop tags của Docxtemplater. Template giữ nguyên styles, tables, headers, footers và static media. Dynamic image/chart replacement không thuộc sample.

Output đăng ký loại `DocxFileDownload`.

## XLSX

Renderer: `xlsx-renderer.ts` với `exceljs`.

Hỗ trợ scalar cell:

```text
{customer.name}
```

Và loop đúng một prototype row:

```text
Row N:     {#items}
Row N + 1: {name} | {quantity} | {price}
Row N + 2: {/items}
```

Renderer giữ cell styles, formulas và number formats được hỗ trợ; unresolved markers hoặc loop sai cấu trúc làm render fail. Output đăng ký loại `ExcelFileDownload`.

## PPTX

Renderer: `docxtemplater-renderer.ts` với `docxtemplater` và `pizzip`.

Tool thay placeholder trong package PPTX có sẵn và giữ theme, master, layout cùng static media. Arbitrary slide cloning, dynamic charts và shape targeting không thuộc sample.

Output đăng ký loại `PptxFileDownload`.

## Error contract

Handler trả JSON string để runtime đưa lại cho calling agent:

```json
{
  "ok": false,
  "error": {
    "code": "INPUT_SCHEMA_INVALID",
    "message": "XLSX data is incomplete or does not match the template schema.",
    "details": ["total is required"]
  }
}
```

Stable codes:

- `INVALID_ARGUMENTS`
- `INVALID_FILENAME`
- `TEMPLATE_NOT_FOUND`
- `TEMPLATE_NOT_ACTIVE`
- `TEMPLATE_FORMAT_MISMATCH`
- `INPUT_SCHEMA_INVALID`
- `APPROVAL_DENIED`
- `ABORTED`
- `RENDER_FAILED`
- `OUTPUT_TOO_LARGE`
- `INTERNAL_ERROR`

Tool không trả stack trace, filesystem path, credentials, template bytes hoặc renderer internals.

## Integration checklist

1. Copy/transpile `tool-sample/` vào thư mục `template-tools/` cạnh registry `create-files` hiện có.
2. Map `DocumentToolDependencies` vào template service, HITL, generated-file store và pending-output hiện có.
3. Export adapter đó dưới tên `documentTemplateToolDependencies` tại composition layer của template tools.
4. Import ba factory từ `template-tools/index.js` vào `create-files/index.js`.
5. Khởi tạo ba tool bằng cùng dependency adapter và append chúng vào mảng `createFilesAgent.plugin`; không tạo registry mới.
6. Đảm bảo mỗi template version lưu đúng `format`, `status`, bytes và JSON schema.
7. Cài package còn thiếu: AnythingLLM đã có ExcelJS; DOCX/PPTX template rendering cần `docxtemplater` và `pizzip`.
8. Chạy `npx tsx tool-sample/index.ts --self-check`, TypeScript check và binary fixture tests.

## Acceptance criteria

- Ba tool có `description`, `examples`, `parameters` và `handler` đầy đủ.
- Registry `create-files` hiện có import ba factory từ một public `index.js` và chứa ba tool instance trong mảng `plugin`.
- Không tạo registry, agent cluster hoặc bootstrap thứ hai.
- Public schema chỉ nhận `template_id`, `data_json`, `filename`.
- Không tồn tại child agent, internal submit tool hoặc agent flow trong `tool-sample/`.
- Invalid JSON, incomplete schema, unknown/archived/unauthorized/wrong-format template, denied approval và abort không lưu output.
- Schema validation hoàn tất trước approval và render.
- Success lưu đúng một file và register đúng một output type.
- Original template bytes không bị thay đổi.
- Generated DOCX/XLSX/PPTX mở lại được bằng parser tương ứng và Microsoft Office hoặc LibreOffice.
