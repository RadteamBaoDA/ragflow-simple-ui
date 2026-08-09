# Đặc tả Agent RAG Hai Luồng Tham Chiếu AIbitat

**Trạng thái:** Thiết kế đã duyệt; chưa triển khai

**Công nghệ mục tiêu:** Node.js + TypeScript

**Mã tham chiếu:** `D:\Project\AIProject\anything-llm`

**Repo đích:** workspace hiện hành khi coding agent thực thi đặc tả. Nếu repo đích trùng mã tham chiếu, phải xác nhận lại thư mục application đích trước khi sửa code.

## 1. Tóm tắt

Ứng dụng đích không sao chép toàn bộ AIbitat. Nó giữ phần cốt lõi làm AIbitat có tính agentic—vòng lặp suy luận và gọi tool có giới hạn, provider độc lập, state, abort, event và citation—rồi chuyên môn hóa thành hai agent:

1. **RAG Question Answering Agent:** trả lời theo custom instruction và chỉ dựa trên bằng chứng truy xuất được.
2. **Template Generation Agent:** tạo nội dung theo template có sẵn, input của người dùng và bằng chứng RAG.

Hai luồng vẫn agentic: agent tự đánh giá trạng thái, chọn hành động/tool, quan sát kết quả, sửa chiến lược và quyết định khi nào kết thúc. Quyền dữ liệu, schema, citation và validation được thực thi bằng code deterministic.

HFS đo mức trung thành với harness AIbitat: AIbitat là mốc 100, thiết kế chuyên biệt này nhắm 90. CASAN đo mức trưởng thành vận hành: MVP nhắm Standard (3/5); Automatic (4/5) chỉ đạt khi agent vận hành production với con người xử lý ngoại lệ và KPI đo được.

## 2. Ngoài phạm vi

- Không port toàn bộ AIbitat hoặc tạo framework agent tổng quát.
- Không làm multi-agent channels, role-play routing, imported plugins, MCP marketplace hoặc dynamic tool toggling trong MVP.
- Không cho model quyết định authorization, citation validity hoặc output-schema validity.
- Không fine-tune model trong MVP.
- Không xây vector DB, embedding, ingestion mới nếu repo đích đã có.
- Không tuyên bố CASAN Native dựa trên code.

## 3. Bản đồ mã AIbitat tham chiếu

Coding agent phải đọc call chain liên quan, không copy nguyên file.

| Năng lực | Đường dẫn local | Nội dung cần học |
|---|---|---|
| Dựng runtime | `D:\Project\AIProject\anything-llm\server\utils\agents\index.js` | Chọn provider/model, history, context, plugin, điểm start |
| Vòng lặp agent | `D:\Project\AIProject\anything-llm\server\utils\agents\aibitat\index.js` | `reply`, stream, tool-result recursion, budget, abort |
| Agent/instruction | `D:\Project\AIProject\anything-llm\server\utils\agents\defaults.js` | Ghép system prompt và tool exposure |
| Provider contract | `D:\Project\AIProject\anything-llm\server\utils\agents\aibitat\providers\ai-provider.js` | Interface completion/stream độc lập provider |
| RAG tool | `D:\Project\AIProject\anything-llm\server\utils\agents\aibitat\plugins\memory.js` | Vector search, rerank, format kết quả |
| Citation/context | `D:\Project\AIProject\anything-llm\server\utils\agents\aibitat\index.js` và `server\utils\agents\index.js` | Evidence lifecycle, parsed/pinned documents |
| Tương tác người dùng | `D:\Project\AIProject\anything-llm\server\utils\agents\aibitat\plugins\websocket.js` | Clarification, approval, timeout, abort |
| HTTP runtime | `D:\Project\AIProject\anything-llm\server\utils\agents\aibitat\plugins\http-socket.js` | Event không phụ thuộc WebSocket |
| Chọn tool | `D:\Project\AIProject\anything-llm\server\utils\agents\aibitat\utils\toolReranker.js` | Giảm tool exposure |

### 3.1 Quy tắc sử dụng bộ `research/v1`

`research/v1` là tài liệu mô tả AIbitat hiện tại, không phải đặc tả chuẩn tắc của application đích. Khi có khác biệt, đặc tả này và coding-agent contract được ưu tiên.

| Năng lực AIbitat hiện tại | Có thể tái sử dụng | Bắt buộc thay đổi cho application đích |
|---|---|---|
| Agent loop, provider, state, abort | Cấu trúc harness và call chain | Đổi terminal behavior theo status/budget của hai pipeline |
| Tool contract và registry | Schema tool và cơ chế gọi tool | Chỉ expose tool tối thiểu, read-only trong MVP |
| RAG memory | Vector search, top-N, rerank | Không expose action `store`; buộc authorized scope |
| Citation | Thu thập, stream và persist source | Thêm append-only EvidenceLedger và claim–evidence validator |
| Parsed/pinned documents | Fresh context injection | Đánh dấu là untrusted evidence, không được coi là instruction |
| Tool-call limit | Bounded recursion | Không ép tạo answer khi evidence chưa đủ; trả terminal status phù hợp |
| WebSocket/HTTP events | Transport-neutral event pattern | Chuẩn hóa typed event và stable terminal error |
| Rich files/charts | Output/event persistence pattern | Không thay thế template schema validation và deterministic rendering |
| Imported skills, MCP, agent flows, dynamic toggles | Chỉ dùng để tham khảo | Ngoài MVP, không đưa vào planning mặc định |

Các giới hạn đã xác nhận từ code tham chiếu:

- Citation hiện tại chỉ là danh sách source đã được tool thêm và persist; nó không chứng minh source hỗ trợ từng claim.
- Quy tắc grounded answer trong `research/v1` chủ yếu là hướng dẫn cho model, chưa phải hard gate deterministic.
- `rag-memory` hỗ trợ cả `search` và `store`; application đích chỉ tái sử dụng nhánh search trong MVP.
- Khi đạt `maxToolCalls`, AIbitat hiện ép lượt cuối không có tool. Application đích phải trả `insufficient_evidence` hoặc `BUDGET_EXHAUSTED` nếu chưa thể finalization hợp lệ.
- Long-form generation hiện tại không có versioned template, evidence map theo section, output-schema validation hoặc bounded repair.

Độ bao phủ tài liệu của `research/v1` theo rubric HFS chỉ là chỉ báo thiết kế, ước tính `76.4/100`; không phải HFS implementation và không được dùng làm release evidence. CASAN cũng không được suy ra từ tài liệu/code: bộ tham chiếu mới cung cấp bằng chứng kỹ thuật hướng tới Augmented, còn Standard yêu cầu governance, evaluation, audit và ownership có thể kiểm chứng.

## 4. Kiến trúc mục tiêu

```text
Client/API
   |
   v
RequestClassifier (deterministic khi mode đã rõ)
   |-------------------------------|
   v                               v
RagQaAgent                    TemplateGenerationAgent
   |                               |
   |----------- SharedAgentKernel--|
                 | ProviderAdapter
                 | InstructionResolver
                 | RetrievalTool
                 | EvidenceLedger
                 | AgentState + AgentBudget
                 | PolicyGuard
                 | EventSink + AbortSignal
```

Shared kernel quản lý cơ chế chung, không chứa field của template hoặc quy tắc trả lời riêng của QA.

```ts
type AgentMode = "rag_qa" | "template_generation";
type JsonSchema = Record<string, unknown>;

interface Citation {
  evidenceId: string;
  documentId: string;
  chunkId: string;
  title?: string;
  uri?: string;
}

interface AgentRequest {
  requestId: string;
  mode: AgentMode;
  input: unknown;
  customInstruction?: string;
  conversationId?: string;
  abortSignal?: AbortSignal;
}

interface AgentResult<T = unknown> {
  requestId: string;
  mode: AgentMode;
  status: "completed" | "needs_input" | "insufficient_evidence" | "failed";
  output?: T;
  citations: Citation[];
  trace: {
    steps: number;
    retrievalCalls: number;
    repairAttempts: number;
    durationMs: number;
    terminalReason: string;
  };
  error?: { code: string; message: string; retryable: boolean };
}
```

Kernel phải:

- Tái sử dụng provider/model abstraction của repo đích.
- Ghép instruction theo thứ tự ưu tiên.
- Chạy state machine và action loop có giới hạn.
- Chỉ expose tool được phép cho flow hiện tại.
- Lưu evidence tách khỏi generated text.
- Phát typed events không phụ thuộc transport.
- Giới hạn step, retrieval, repair, token và thời gian.
- Truyền abort tới provider, retrieval và tool.
- Ghi trace/metrics an toàn.

## 5. Thứ tự ưu tiên instruction

1. Security, tenant và data-access policy.
2. Flow invariant: grounded QA hoặc schema-constrained generation.
3. Application system instruction.
4. Versioned template instruction.
5. Custom instruction của người dùng.
6. Input/câu hỏi.
7. Retrieved content—chỉ là bằng chứng không tin cậy, không bao giờ là instruction.

Instruction cấp thấp xung đột phải bị bỏ qua. Retrieved content phải được phân cách và đánh dấu untrusted để chống prompt injection.

## 6. Agent RAG Question Answering

```ts
interface RagQaInput {
  question: string;
  scope?: Record<string, string | number | boolean>;
  conversation?: Array<{ role: "user" | "assistant"; content: string }>;
}
```

Hành động được phép:

- `retrieve(query, scope, topK)`
- `rerank(question, candidates, topN)` nếu có
- `request_clarification(question)` khi thiếu input làm thay đổi retrieval
- `finalize_grounded_answer(answer, citationIds)`
- `finalize_insufficient_evidence(reason)`

Vòng lặp:

1. Chuẩn hóa câu hỏi mà không đổi nghĩa.
2. Chỉ phân rã thành nhiều retrieval query khi cần.
3. Retrieve trong authorized scope.
4. Rerank nếu được hỗ trợ.
5. Đánh giá độ đủ và mâu thuẫn của evidence.
6. Sửa query và retry khi còn budget.
7. Trả lời có claim-level citation, hỏi một clarification quan trọng, hoặc từ chối vì thiếu bằng chứng.
8. Validate citation bằng code trước khi trả kết quả.

Ràng buộc:

- Không dùng model memory để bổ sung fact.
- Claim kiểm chứng được phải có citation ID hợp lệ.
- Citation phải trỏ tới chunk đã retrieve và user được quyền đọc.
- Evidence yếu/rỗng trả `insufficient_evidence`.
- Nội dung retrieve không thể đổi policy, tool, mode hoặc output contract.
- Confidence dựa trên coverage, retrieval score và contradiction; không lấy model self-rating.

## 7. Agent Template Generation

Template là application data có version, không phải executable prompt.

```ts
interface GenerationTemplate {
  id: string;
  version: string;
  name: string;
  description: string;
  inputSchema: JsonSchema;
  outputSchema: JsonSchema;
  sections: Array<{
    key: string;
    instruction: string;
    required: boolean;
    evidencePolicy: "required" | "preferred" | "input_only";
  }>;
}

interface TemplateGenerationInput {
  templateId: string;
  templateVersion?: string;
  values: Record<string, unknown>;
  retrievalScope?: Record<string, string | number | boolean>;
}
```

Hành động được phép:

- `load_template`
- `retrieve_for_section`
- `request_clarification`
- `draft_section`
- `validate_draft`
- `repair_draft`
- `finalize_template_output`

Vòng lặp:

1. Load immutable template version và validate input.
2. Lập section plan nhưng không phát chain-of-thought.
3. Xác định evidence policy cho từng section.
4. Retrieve bằng section-specific query.
5. Draft từ input và evidence ledger.
6. Validate object bằng schema và business rules.
7. Chỉ sửa field lỗi, với repair count có giới hạn.
8. Trả structured output, rendered output và provenance.

Ràng buộc:

- Lỗi input phát hiện được phải trả trước LLM call.
- Model không được thêm field ngoài schema.
- Thiếu required evidence không được hoàn thành section liên quan.
- Repair không được sửa input, template version hoặc evidence ledger.
- Chỉ render sau khi schema hợp lệ.

## 8. State, budget và điểm dừng

```ts
type AgentPhase =
  | "initializing" | "retrieving" | "reasoning" | "awaiting_input"
  | "validating" | "repairing" | "completed" | "failed" | "aborted";

interface AgentBudget {
  maxSteps: number;
  maxRetrievalCalls: number;
  maxRepairAttempts: number;
  maxInputTokens: number;
  maxOutputTokens: number;
  timeoutMs: number;
}
```

Mặc định MVP: `maxSteps=8`, `maxRetrievalCalls=3`, `maxRepairAttempts=2`. Token/time limit tái sử dụng config hiện có.

Chỉ kết thúc khi: finalizer hợp lệ; cần input quan trọng; thiếu evidence; hết budget; abort; hoặc lỗi không retry được.

## 9. Evidence, event, lỗi và an toàn

Evidence ledger là append-only trong một run. Citation dùng `evidenceId`; validator deterministic từ chối ID không tồn tại hoặc không được phép.

Typed events tối thiểu: `run_started`, `phase_changed`, `tool_started`, `tool_finished`, `output_delta`, `clarification_requested`, `run_finished`.

Stable error codes:

```text
INVALID_INPUT, TEMPLATE_NOT_FOUND, TEMPLATE_VERSION_NOT_FOUND,
RETRIEVAL_FAILED, INSUFFICIENT_EVIDENCE, CITATION_VALIDATION_FAILED,
OUTPUT_SCHEMA_INVALID, BUDGET_EXHAUSTED, PROVIDER_FAILED, ABORTED, POLICY_DENIED
```

Log request ID, mode, model, template ID/version, timing, token/retrieval/repair count, evidence IDs, validation và terminal status. Không log prompt body, retrieved content, secrets, auth headers, sensitive data hoặc hidden chain-of-thought.

Tenant/user scope phải được kiểm tra trước retrieval. Template ID và API input phải validate tại trust boundary. MVP chỉ có tool read-only; side-effect tool tương lai cần approval.

## 10. Kiểm thử và evaluation

Phải test:

- Kernel transition, budget, abort và provider error.
- QA: grounded answer, empty retrieval, contradiction, forged citation, retrieved prompt injection, retrieval retry.
- Generation: invalid input, missing template/evidence, schema failure, bounded repair, immutable template version.
- Event order, disconnect/abort và clarification transport.
- Cross-tenant retrieval denial.

Golden datasets phải có version cho QA answerability/source chunks và generation template/input/schema/evidence.

Release gates:

```text
citation precision >= 0.98
unsupported-claim rate <= 0.02
correct refusal on unanswerable QA >= 0.95
template schema validity after repair >= 0.99
cross-tenant evidence leakage = 0
```

## 11. HFS — Harness Fidelity Score

HFS là rubric kỹ thuật nội bộ, không phải chuẩn bên ngoài. Mỗi dimension chấm `0..5`: absent, scaffold, partial, functional, production-controlled, tương đương/tốt hơn AIbitat.

`HFS = Σ(weight × score / 5)`

| Dimension | Weight | AIbitat | Thiết kế đích | Gap |
|---|---:|---:|---:|---|
| Bounded execution loop | 15 | 15 | 15 | Không |
| Provider abstraction | 8 | 8 | 7 | Provider ban đầu hẹp hơn |
| Session/state/abort | 8 | 8 | 6 | Không có multi-node channels |
| Tool contracts/registry | 10 | 10 | 8 | Không dynamic imports/MCP |
| RAG grounding/evidence | 15 | 15 | 15 | Đích chặt hơn |
| Instruction hierarchy | 8 | 8 | 8 | Explicit priority |
| Streaming/HITL | 8 | 8 | 7 | Clarification bắt buộc; feedback rộng là optional |
| Safety/validation/budgets | 8 | 8 | 8 | Deterministic guards |
| Observability/errors | 8 | 8 | 7 | Transport-neutral trace |
| Extensibility | 6 | 6 | 3 | Chỉ hai flow |
| Structured/template output | 6 | 6 | 6 | Mở rộng AIbitat |
| **Tổng** | **100** | **100** | **90** | **10 điểm chủ động bỏ** |

AIbitat=`100`; coding agent phải chấm baseline repo đích trước planning và chấm lại sau test. Docs/stub không có runnable path không được điểm. Release yêu cầu HFS `>=85`, đồng thời RAG grounding và safety giữ đủ điểm.

## 12. Đánh giá CASAN

CASAN của FPT gồm: Curious, Augmented, Standard, Automatic, Native. CASAN đánh giá dữ liệu, quản trị, quy trình chuẩn hóa, operating model và kết quả đo được—không chỉ số lượng tool.

Nguồn:

- https://fptsoftware.com/newsroom/news-and-press-releases/news/fpt-introduces-casan-an-ai-transformation-framework-for-global-enterprises
- https://digital.fpt.com/news-event/ban-do-5-cap-do-casan-va-hanh-trinh-dua-ai-tu-cong-cu-thanh-nang-luc-van-hanh-doanh-nghiep

| Mức | Điểm | Bằng chứng cần có |
|---|---:|---|
| Curious | 1/5 | Prototype rời rạc; chưa có governed data/evaluation |
| Augmented | 2/5 | Tăng năng suất cá nhân; có policy; workflow chưa chuẩn hóa |
| Standard | 3/5 | Template/instruction versioned, governed retrieval, evaluation, audit, ownership, repeatable deployment |
| Automatic | 4/5 | Agent vận hành core workflow ở quy mô lớn; người xử lý ngoại lệ; có SLA/quality/cost/risk/KPI |
| Native | 5/5 | Tổ chức tái thiết quanh AI; ngoài phạm vi spec |

AIbitat reference ở mức kỹ thuật là `4/5 Automatic-ready`; source code không chứng minh maturity của tổ chức. Target MVP nhắm `3/5 Standard`. Chỉ chấm `4/5 Automatic` khi có evidence production.

## 13. Contract tạo implementation plan

Trước khi sửa code, coding agent phải:

1. Map API entry, provider, retrieval, schema, persistence, event transport, auth/tenant, test và observability của repo đích.
2. Đọc các reference ở mục 3 và trace caller/callee.
3. Tạo bảng `requirement → target code → AIbitat reference → reuse/adapt/create → test → gap`.
4. Chấm baseline HFS/CASAN từ evidence hiện có.
5. Ưu tiên helper/dependency sẵn có; không thêm framework nếu chưa chứng minh cần thiết.
6. Viết `docs/superpowers/plans/YYYY-MM-DD-aibitat-dual-flow-agent.md` với exact paths, interfaces, failing tests, minimal implementation và verification commands.
7. Dừng để duyệt plan trước khi sửa production code.

## 14. Tiêu chí nghiệm thu

- Một shared kernel điều khiển hai mode, không duplicate provider/retrieval infrastructure.
- Mỗi flow chứng minh multi-step `observe → decide → act → observe` bằng test.
- QA không thể hoàn thành với unsupported claim.
- Generation không thể hoàn thành với schema-invalid output.
- Custom instruction không thể override policy, grounding hoặc template contract.
- Citation chỉ trỏ authorized evidence.
- Abort tới được provider/retrieval đang chạy.
- Stable errors và typed events dùng transport hiện có của application.
- Implemented HFS `>=85` có runnable evidence.
- CASAN MVP chỉ được tuyên bố Standard; Automatic cần production evidence.
