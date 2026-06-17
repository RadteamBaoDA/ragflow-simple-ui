# Generative RAG Orchestrator v2 — Final Merged Specification
*Bản dịch tiếng Việt của `claude-generative-rag-orchestrator-v2-final-spec.md`. Mọi thuật ngữ kỹ thuật, tên trường, khối mã, và số hiệu mục được giữ nguyên theo bản gốc tiếng Anh.*
### Dành cho chế độ plan của coding-agent — chỉ gồm các hợp đồng hành vi (behavior contract), quyết định kiến trúc, và system prompt; không có code triển khai

> **Provenance.** Tài liệu này hợp nhất hai kết quả nghiên cứu độc lập: `claude-generative-orchestrator-v2-research-spec.md` (theo phong cách engineering-spec: data contract, ngân sách token/latency, prompt production, acceptance criteria, template SDLC agent) và `gpt-search-agent.md` (theo phong cách requirements: các quy tắc cứng về precedence/security, phát hiện requirement-heading, leo thang theo rủi ro miền (domain-risk escalation), danh mục generation-pattern, hướng dẫn về chi phí/chất lượng/hiệu năng). Cả hai đều độc lập hội tụ về cùng một kiến trúc lõi, điều này củng cố niềm tin vào thiết kế. Báo cáo Claude tạo nên khung xương; các đóng góp riêng của báo cáo GPT được gập vào và được đánh dấu ở nơi chúng mở rộng một hợp đồng. Appendix B ghi lại quá trình so sánh và các quyết định hợp nhất.

---

## 0. Cách sử dụng tài liệu này (hướng dẫn cho coding agent)

Tài liệu này là **đầu vào cho plan mode**. Nó chứa các quyết định kiến trúc, đặc tả hành vi, data contract, quy tắc precedence, ngân sách token/latency, và các production system prompt cho mọi lệnh gọi LLM trong pipeline. Nó cố ý **không chứa code triển khai** — coding agent phải:

1. **Khám phá codebase hiện tại trước.** Trước khi viết bất kỳ kế hoạch nào, hãy định vị và đọc:
   - Bản triển khai generative-mode hiện có được xây dựng từ `plans/solution1.md` (các phase hiện tại: parse, plan, outline, retrieve, rerank, sectionWrite, stitch/refine).
   - **Custom retriever component** và **custom reranker component** — chữ ký hàm chính xác, hình dạng input/output, tính sync/async, và nơi chúng được khởi tạo. Đây là các hàm gọi trực tiếp hiện có được xây dựng trên RAGFlow internals (KHÔNG phải RAGFlow HTTP API) và PHẢI được tái sử dụng nguyên trạng, không bao giờ triển khai lại.
   - Tính năng **agent standard**: nơi lưu trữ định nghĩa/chỉ dẫn (instruction) của agent, cách một agent được nạp, một agent record có những trường nào (instruction text, knowledge-base ids, policy flag, v.v.).
   - LLM client abstraction đang được dùng (local model serving — Ollama/vLLM/llama.cpp — và bất kỳ cloud fallback nào), và nó có hỗ trợ schema/grammar-constrained JSON decoding hay không.
   - Các pattern hiện có cho: background job, streaming/SSE tới frontend, configuration, logging/observability, persistence/migrations, và các định nghĩa kiểu (type) dùng chung.
   > **Đọc §0.1 (Project Context) TRƯỚC TIÊN — và coi nó là có thẩm quyền cao hơn việc tự khám phá của bạn.** §0.1 mang theo các sự kiện riêng của dự án mà coding agent **không thể** suy luận đáng tin cậy chỉ từ code: đường dẫn module và chữ ký retriever/reranker thực, LLM client và việc nó có hỗ trợ constrained JSON decoding hay không, hình dạng lưu trữ agent-standard, các pattern SSE/job/config cần tái sử dụng, cùng các ràng buộc cứng và các gotcha đã biết. Nếu bất kỳ placeholder `> _(fill in: …)_` nào trong §0.1 vẫn còn trống, **DỪNG LẠI và yêu cầu người dùng cung cấp trước khi lập kế hoạch** — không đoán, và không âm thầm rơi về giả định. Khi §0.1 và việc tự đọc code của bạn mâu thuẫn, hãy nêu xung đột đó cho người dùng thay vì tự chọn một bên.
2. **Ánh xạ spec này lên những gì đang tồn tại.** Với mỗi phase bên dưới, xác định liệu code hiện có có thể được **tái sử dụng (reused)**, **tái cấu trúc (refactored)**, hay phải được **tạo mới (newly created)**, và những module hiện có nào bị **loại bỏ (retired)** (đáng chú ý là outliner độc lập, các phase global retrieve/rerank độc lập, và các phần sản xuất nội dung của phase stitch/refine).
3. **Tạo ra kế hoạch triển khai chi tiết** — danh sách thay đổi theo từng file, module mới, module bị loại bỏ, các bước migration, thay đổi configuration, và một danh sách test bao phủ Section 11 — và chỉ sau đó mới triển khai. Kế hoạch phải bao phủ rõ ràng: chuẩn hóa input cho cả hai mode, nâng cấp planner, dời retrieval+reranking vào trong section pipeline, sufficiency gate, citation validation, phase cuối validate-only, ngăn các output section thừa, và các biện pháp cost/quality/performance của Section 10.
4. **Coi mọi "MUST / MUST NOT" trong tài liệu này là một acceptance criterion.** Section 11 hợp nhất chúng thành một checklist kiểm chứng.

Target stack đã khám phá được đến nay: backend Node.js / Express / TypeScript với frontend React; orchestrator từ solution1.md có thể đã được triển khai một phần — hãy kiểm chứng thay vì giả định.

---

## 0.1 Project Context (có thẩm quyền — điền vào trước khi lập kế hoạch)

> **Mục này có thẩm quyền cao hơn việc tự khám phá codebase của coding agent (§0).** Nó ghi lại các sự kiện riêng của dự án mà một agent không thể suy luận đáng tin cậy chỉ từ code. Mọi placeholder `> _(fill in: …)_` bên dưới PHẢI được người dùng/người bảo trì cung cấp **trước** khi bất kỳ kế hoạch triển khai nào được viết. **Nếu bất kỳ placeholder nào vẫn còn trống, DỪNG LẠI và yêu cầu người dùng cung cấp — không đoán, và không âm thầm rơi về giả định.** Khi mục này và việc tự đọc code của bạn mâu thuẫn, hãy nêu xung đột cho người dùng thay vì tự chọn một bên.

### 0.1.1 Retriever component (đã có — tái sử dụng nguyên trạng, không bao giờ triển khai lại)
- Module path / file: > _(fill in: where the custom retriever lives)_
- Tên hàm + chữ ký chính xác: > _(fill in: e.g. `retrieve(query: string, kbIds: string[], topK: number): Promise<ScoredChunk[]>`)_
- Hình dạng input (query, kb ids, topK, mọi filter): > _(fill in)_
- Hình dạng output (các trường của chunk: id, text, score, metadata, source doc): > _(fill in)_
- Sync hay async; ném lỗi (throws) hay trả lỗi (error-return) khi thất bại: > _(fill in)_
- Nơi nó được khởi tạo / cách lấy một instance: > _(fill in)_

### 0.1.2 Reranker component (đã có — tái sử dụng nguyên trạng, không bao giờ triển khai lại)
- Module path / file: > _(fill in)_
- Tên hàm + chữ ký chính xác: > _(fill in: e.g. `rerank(query: string, chunks: Chunk[]): Promise<Chunk[]>`)_
- Hình dạng input / output; sync hay async; hành vi khi thất bại: > _(fill in)_
- Nơi nó được khởi tạo: > _(fill in)_

### 0.1.3 LLM client abstraction
- Module path / cách gọi một completion: > _(fill in)_
- Local serving backend (Ollama / vLLM / llama.cpp / other) + model id(s): > _(fill in)_
- Có cloud fallback không? được chọn ra sao?: > _(fill in)_
- **Nó có hỗ trợ schema/grammar-constrained JSON decoding không?** (yes/no + cách thực hiện): > _(fill in — this gates the §3.2/§9 "schema-constrained + one retry" contract; if no, the agent must propose the fallback strategy)_
- Context window hiệu dụng thực tế đã cấu hình (spec giả định ~16k): > _(fill in)_

### 0.1.4 Hình dạng lưu trữ của Agent Standard
- Nơi lưu trữ định nghĩa/chỉ dẫn agent (table/collection/file): > _(fill in)_
- Cách một agent được nạp tại thời điểm request: > _(fill in)_
- Các trường có sẵn của agent record (instruction text, `## Skill`, kbIds, policy flag, các output format đã cấu hình cho §4.3b): > _(fill in)_
- Nơi `agentPolicy` (allowUserFormatOverride / allowUserRetrievalOverride / citationPolicy) được lưu hoặc cách nó được dẫn xuất: > _(fill in)_

### 0.1.5 Các pattern cần tái sử dụng
- Background-job pattern (cho §10 resume / per-section state): > _(fill in)_
- Streaming/SSE-to-frontend pattern (cho §10 section-completed events): > _(fill in)_
- Cơ chế configuration (cho config surface ở §11): > _(fill in)_
- Logging/observability stack (cho phase-boundary log ở §10): > _(fill in)_
- Cách tiếp cận persistence/migrations; nơi đặt các định nghĩa kiểu dùng chung: > _(fill in)_

### 0.1.6 Ràng buộc cứng & các gotcha đã biết
- Các ràng buộc riêng của dự án không suy ra được từ code (trần hiệu năng, đặc thù tenancy, giới hạn triển khai): > _(fill in)_
- Các gotcha đã biết trong retriever/reranker/LLM client (rate limit, giới hạn concurrency, giới hạn payload): > _(fill in)_
- Multi-tenant security context: cách lấy `tenantId` / `kbIds`/ACL từ session (§3.1 `security`, §4.1): > _(fill in)_

### 0.1.7 Hợp đồng inline-citation chat-QA hiện có (Phase 3 PHẢI tái sử dụng cái này — §6) **[merged-in]**
Các section grounded ở Phase 3 PHẢI phát ra citation theo **cùng định dạng mà tính năng chat-QA hiện có đã dùng**, để frontend render chúng bằng **cùng code**. Đừng phát minh một citation syntax mới hay một render path song song. Hãy khám phá và ghi lại:
- **Token syntax** của inline citation như model/back end phát ra (spec viết `[N]` làm vật thế chỗ — thay bằng token thực): > _(fill in: e.g. `[1]`, `[[1]]`, `{{cite:chunkId}}`, `<cite id="…"/>`, or a sentinel the FE post-processes)_
- **Numbering / id scheme**: cách một citation id được gán và nó ánh xạ tới cái gì (per-answer sequential, per-chunk-id, per-document, hash, v.v.): > _(fill in)_
- **FE render contract**: payload/hình dạng chính xác mà frontend tiêu thụ để render một citation + hover/panel "source" của nó (tên trường, ánh xạ marker→source, nơi danh sách source được gắn): > _(fill in)_
- Nơi cái này nằm trong code (writer prompt của chat-QA, response serializer, FE citation component): > _(fill in)_
> Nếu scheme chat-QA hiện có gán id **theo từng câu trả lời đơn lẻ (per single answer)** và thiếu một id ổn định cross-message, hãy ghi chú ở đây — §6 yêu cầu một id ổn định *cross-section* (cùng chunk → cùng citation ở mọi nơi trong một tài liệu được sinh ra), nên scheme được **tái sử dụng và mở rộng tối thiểu** để mang thuộc tính đó, không bao giờ fork thành một quy ước thứ hai.

---

## 1. Mục tiêu và các ràng buộc bắt buộc

**Mục tiêu tối ưu hóa (đồng thời):** hiệu quả chi phí, chất lượng output, độ chính xác sinh nội dung, hiệu quả retrieval, kiểm soát hallucination, tuân thủ nghiêm ngặt định dạng output, và tái sử dụng một orchestrator duy nhất cho cả chat generative mode lẫn agent standard mode.

| Ràng buộc | Giá trị | Hệ quả với thiết kế |
|---|---|---|
| LLM chính | Local model, **~16k effective context** (cloud API là phụ; tối ưu cho 16k) | Ngân sách token cứng cho mỗi lệnh gọi; không phase nào được lắp ráp quá ~10–11k input token (lost-in-the-middle làm suy giảm chất lượng từ lâu trước khi chạm trần 16k) |
| Latency | **Tương tác, tổng cộng 1–3 phút** | Chỉ dùng các vòng lặp agentic có giới hạn (không free-form ReAct); tối đa hóa song song; loại bỏ các sequential LLM gate |
| Lớp Retrieval | **Retriever + reranker do người dùng sở hữu, được gọi như hàm trực tiếp** | Spec không bao giờ định nghĩa nội bộ retrieval; nó chỉ định nghĩa *khi nào* chúng được gọi, với *query nào*, và *làm gì* với kết quả |
| Mục tiêu tối ưu hóa | Chi phí, hiệu quả, chất lượng output, hiệu năng — đồng thời | Ưu tiên logic xác định (deterministic) hơn lệnh gọi LLM ở mọi nơi mà LLM không thực sự tốt hơn |
| Tái sử dụng | Một orchestrator phục vụ **cả** chat generative mode lẫn **Agent Standard mode** mới | Mọi khác biệt giữa các mode đều giới hạn trong một lớp input-normalization duy nhất |
| Security | Multi-tenant với knowledge-base ACL | Tenant filter và KB security context **không bao giờ** chịu bất kỳ precedence merge nào hay là nội dung prompt nào (xem §4) |

### Input contracts (cho sẵn, không thể thay đổi)

**Chat generative mode** — user prompt PHẢI chứa các markdown header sau:

```md
# User profiles
# Task
# Context
# Keyword
# Output format
```

**Agent Standard mode** — agent có một instruction được định nghĩa trước (mà bản thân nó có thể chứa role/persona, một khối `## Skill`, `# User profiles`, `# Context`, `# Keyword`, và `# Output format`, cộng với retrieval/citation/quality policy). Người dùng nhập prompt **bằng ngôn ngữ tự nhiên tự do (freestyle)** HOẶC tùy chọn kèm theo:

```md
# Task
# Context
# Keyword
# Output format
```

Câu trả lời được sinh ra cuối cùng hiển thị cho end user phải chứa **chỉ** nội dung mà `# Output format` yêu cầu (của người dùng, hoặc fallback của agent) — xem §8 để có danh sách forbidden-content đầy đủ.

---

## 2. Tóm tắt quyết định kiến trúc — before / after

### Pipeline hiện tại (từ solution1.md — kiểm chứng đối chiếu code thực tế)

```
parse → plan → retrieve (global fan-out) → rerank → outline → sectionWrite (N×, sequential)
      → stitch + refine (auto-title, auto-TOC, auto-References, consistency LLM pass) → deliver
```

Khiếm khuyết so với các ràng buộc: ba sequential LLM gate trước khi bất kỳ content token nào được sinh ra; retrieval mang tính global thay vì per-section (các section khác nhau có nhu cầu bằng chứng khác nhau — một số cần không cần retrieval, một số chỉ cần user context, một số cần một tài liệu, một số cần vài tài liệu, một số cần exemplar); phase cuối **thêm nội dung mà `# Output format` của người dùng chưa bao giờ yêu cầu**; không có sufficiency gate trước khi sinh nội dung; không xử lý input cho agent-mode.

### Pipeline mục tiêu (4 phase logic)

```
PHASE 1  NORMALIZE INPUT
         deterministic header parsing + requirement-heading detection
         + precedence merge with security hard rules
         + at most ONE small LLM extraction call (agent freestyle prompts only)
         → canonical internal Request object

PHASE 2  PLAN + OUTLINE (merged — exactly ONE LLM call)
         task-type classification + per-section plan + per-section retrieval queries
         + per-section risk level and evidence policy
         If # Output format present → section headings derived DETERMINISTICALLY
         from it BEFORE the LLM runs (the LLM only fills in metadata)

PHASE 3  PARALLEL PER-SECTION PIPELINE (bounded concurrency 3–5)
         per section: retrieve → rerank → sufficiency gate (tiered)
           → (if insufficient: ONE corrective query-rewrite + re-retrieve)
           → write with inline [N] citations
           → deterministic citation validation
           → optional NLI faithfulness gate
         A GLOBAL chunk registry assigns stable [N] numbers across all sections.
         Retrieval/rerank results are memoized within the request.

PHASE 4  VALIDATE-ONLY
         deterministic structure-conformance check vs # Output format
         + deterministic citation-integrity check + forbidden-content scan
         + ONE small LLM task-coverage call (sees requirement headings)
         → pass through unchanged, OR regenerate ONLY failing sections (max 1 round)
         MUST NOT add a title, TOC, references section, or any content
         not requested by # Output format. MUST NOT rewrite passing sections.
```

**Các phase bị loại bỏ:** outliner độc lập (gập vào Phase 2); các phase global retrieve+rerank (gập vào Phase 3 theo từng section); phase "stitch & refine / consistency pass" sản xuất nội dung (thay bằng Phase 4 validation-only). Cả hai kết quả nghiên cứu đều độc lập khuyến nghị đúng việc tái cấu trúc này.

**Vì sao section-level retrieval thắng:** độ liên quan (bằng chứng riêng cho từng section), độ chính xác citation (chunk được ràng với section dùng nó), chi phí (section không cần gì thì không retrieve gì), kiểm soát hallucination (sufficiency được đánh giá theo nhu cầu của một section, không phải cả tài liệu), và hiệu năng (công việc per-section được song song hóa).

### So sánh ngân sách lệnh gọi LLM (tài liệu 6 section)

| Pipeline | Số lệnh gọi | Thời gian thực trên local 7B–14B @ ~30 tok/s |
|---|---|---|
| Hiện tại | 9 tuần tự (plan, outline, 6× write, consistency) | ~90–180 s |
| Mục tiêu | 1 plan+outline, sau đó các section chạy song song (write + ≤2 small check mỗi section, concurrency 3–4), 1 coverage | **~45–110 s điển hình** |

Tổng công việc LLM tương đương hoặc thấp hơn (tier sufficiency heuristic và retrieval memoization ở §6–§7 có thể loại bỏ các lệnh gọi nhỏ); lợi ích về cấu trúc là **song song hóa cộng với việc loại bỏ các sequential gate**. Hàng Mục tiêu tính trên đường đi lõi (core path); các fallback có điều kiện của Phase-1 (freestyle extractor ở §9.1 và format-intent check ở §9.7) thêm **nhiều nhất một lệnh gọi nhỏ mỗi cái, chỉ ở agent-mode**, và chỉ kích hoạt khi vắng một header/format — bằng không trên ví dụ chat-mode 6 section này.

---
## 3. Data contracts (trung lập về ngôn ngữ; coding agent ánh xạ chúng vào các quy ước về kiểu của codebase)

Các trường được đánh dấu **[merged-in]** mở rộng hợp đồng gốc với nội dung được tiếp nhận từ kết quả nghiên cứu thứ hai.

### 3.1 Canonical Request (output của Phase 1)

| Trường | Kiểu | Quy tắc |
|---|---|---|
| `mode` | `"chat"` \| `"agent"` | Đặt theo sự hiện diện của một agent instruction |
| `userProfile` | string | Luôn được điền (nguồn theo §4.2a chat / §4.2b agent) |
| `task` | string | Bắt buộc, không rỗng ở cả hai mode |
| `context` | string | Có thể rỗng; baseline của agent + context của người dùng được nối lại, agent trước |
| `keyword` | string[] | Union-merged, loại trùng |
| `outputFormat` | string | Raw header body; chuỗi rỗng nghĩa là "LLM may propose structure" |
| `outputFormatSource` | `"user"` \| `"agent"` \| `"default"` | Provenance để có thể audit |
| `outputFormatConflict` | boolean | True khi cả người dùng lẫn agent đều cung cấp một format và chúng khác nhau |
| `agentInstruction` | string \| absent | Raw agent persona text, chỉ ở agent mode. Đi tới **writer** dưới dạng một persona string mờ đục (opaque); nội dung *liên quan tới planning* của nó KHÔNG được gửi tới planner dưới dạng prose — normalizer trích nó vào `agentPlanningHints`, `agentPolicy`, và `requirementHeadings` (xem §4.6) để planner tiêu thụ dữ liệu có cấu trúc, không phải prose (giữ chuỗi precedence có thể audit, §4.1). |
| `agentSkill` | string \| absent | **[merged-in]** Khối `## Skill` của agent khi tách được; nối sau `agentInstruction` cho writer persona, giữ riêng để audit precedence. Cũng là nguồn chính mà normalizer khai thác cho `agentPlanningHints` và các seed `acceptanceCriteria` per-section (§4.6, §9.2). |
| `agentPolicy` | object \| absent | **[merged-in]** `{ allowUserFormatOverride: bool (default true), allowUserRetrievalOverride: bool (default true), citationPolicy?: "required"|"optional" }`. Được đọc bởi **planner** để định hướng evidence policy (citationPolicy="required" → các section grounded nhận `mustCite=true`, `minCitations≥1`). |
| `agentPlanningHints` | object \| absent | **[merged-in]** Bản chưng cất có cấu trúc, hướng tới planner, của agent instruction + skill, được điền bởi normalizer (§4.6), KHÔNG BAO GIỜ từ text của user prompt. Hình dạng: `{ defaultVerbosity?: "concise"|"standard"|"detailed", idConventions?: string[] (e.g. "UC-<MODULE>-<NN>"), terminology?: string[], requiredContent?: string[] (rules like "always include Open Questions"), forbiddenContent?: string[] (e.g. "never output real credentials"), domainRiskCues?: string[] (terms that imply riskLevel=high), retrievalHints?: string[], skillCriteria?: string[] (generic per-section quality rules from ## Skill, seed for acceptanceCriteria) }`. Mọi trường đều tùy chọn; vắng ở chat mode. Planner đọc nó (§9.2); nó không mang section structure (structure chỉ là `# Output format`). |
| `requirementHeadings` | `{text, kind}[]` | **[merged-in]** Các heading kiểu requirement tùy chỉnh được phát hiện trong user prompt và agent instruction ngoài năm canonical header; `kind ∈ {requirement, constraint, acceptance_criteria, domain_rule, quality_rule, retrieval_hint, unknown}` (§4.4) |
| `agentScope` | `"all_kb"` \| `"specific_kb"` \| `"general"` \| absent | **[merged-in]** Chỉ ở agent mode (vắng ở chat mode). Phạm vi retrieval của agent, từ agent config (không bao giờ từ text của prompt): `all_kb` = retrieve trên mọi KB mà tenant/ACL cho phép; `specific_kb` = retrieve từ tập con KB đã cấu hình của agent; `general` = agent **không có quyền truy cập KB** và trả lời từ kiến thức đã huấn luyện của LLM. Điều khiển `noKnowledgeBase` (bên dưới). `all_kb`/`specific_kb` ⇒ grounded (hành xử như chat); `general` ⇒ ungrounded. |
| `security` | object | **[merged-in]** `{ tenantId, kbIds/ACL }` — được điền từ session, **không bao giờ** từ text của prompt, không bao giờ bị thay đổi bởi bất kỳ merge nào |
| `noKnowledgeBase` | boolean | **[merged-in]** Dẫn xuất, không bao giờ từ text của prompt. **Chat mode:** luôn `false` — chat YÊU CẦU một knowledge base; nếu không có cái nào được nối thì request là một lỗi cứng trước khi sinh nội dung (§4.5), nó không bao giờ âm thầm ungrounded. **Agent mode:** `true` khi và chỉ khi `agentScope="general"` (hoặc tập KB hiệu dụng giải ra rỗng cho một agent `all_kb`/`specific_kb`). Khi `true`, orchestrator ép mọi section về `retrievalMode: none` (§5) — được sinh ra chỉ từ kiến thức của model + `# Context`, không retrieval, không citation. Đây là đường ungrounded **duy nhất** được phê chuẩn; không có task type `pure_generation` (§5.4). |
| `rawUserPrompt` | string | Giữ nguyên văn để truy vết |

### 3.2 Plan (output của Phase 2 — hình dạng JSON bắt buộc của planner LLM)

```json
{
  "detectedTask": "qa_with_citations | summarize_single | synthesize_multi | compare_analyze | transform_derive | reference_inspired | review_validate",
  "overallRationale": "string, ≤320 chars",
  "outputFormatSummary": "one-line restatement of the user's format",
  "outlineSource": "derived_from_output_format | proposed_by_llm",
  "sections": [
    {
      "sectionId": "s1",
      "heading": "string — exactly as it will appear in the output",
      "rationale": "string ≤240 chars — MUST come before the commit fields below (in-schema chain-of-thought)",
      "taskHint": "one of the 7 task types",
      "retrievalMode": "grounded_strict | reference_inspired | none",
      "riskLevel": "normal | high  — [merged-in] high for healthcare/medical, legal, regulatory-compliance, finance, security, safety-critical content",
      "mustCite": "boolean — forced true when riskLevel=high and retrievalMode=grounded_strict",
      "minCitations": "int 0–5",
      "assumptionsAllowed": "boolean — [merged-in] default false; may be true only when the output format explicitly allows assumptions",
      "acceptanceCriteria": ["string — [merged-in] 0–6 testable, per-section quality/conformance checks the writer MUST satisfy and the coverage auditor (§9.6) checks against. Derived by the planner from: (a) the agent SKILL block, (b) the per-section item in # Output format, (c) matched requirement/acceptance_criteria/quality_rule headings (§4.4), and (d) the active artifact plan-skill (§A.10.1). Each criterion is an objective property of the finished section ('every test case cites a source requirement', 'each gap names the SRS clause it violates'), NEVER a new section or heading. Empty when nothing constrains the section beyond its brief."],
      "referenceQueries": [
        { "text": "[merged-in] retrieval query for the REFERENCE/ground-truth side only (review_validate sections) — what the artifact SHOULD conform to (e.g. the SRS, the template, the standard)", "keywordQueries": ["0–4 anchors"] }
      ],
      "subQueries": [
        { "text": "natural-language retrieval query (for review_validate: the ARTIFACT-UNDER-REVIEW side — what the artifact actually says)", "keywordQueries": ["0–4 sparse/BM25 anchor terms"] }
      ],
      "targetTokens": "int 80–1200",
      "dependsOn": ["sectionIds that must be written first; usually empty"]
    }
  ],
  "notes": "optional string"
}
```

Quy tắc validation: 1–10 section; ≤3 subQueries mỗi section; ≤3 referenceQueries mỗi section; ≤6 acceptanceCriteria mỗi section; schema PHẢI được thực thi qua grammar/schema-constrained decoding với đúng một lần retry (lỗi validation được nối vào prompt) trước khi để request thất bại. Sau khi parse, orchestrator một cách xác định ép `mustCite=true` và `assumptionsAllowed=false` trên mọi section `grounded_strict` có `riskLevel=high`, bất kể LLM trả về gì. **[merged-in]** Sau khi parse, mọi section `review_validate` cũng tương tự bị ép về `retrievalMode=grounded_strict`, `mustCite=true`, `assumptionsAllowed=false` (một bài review không bao giờ được phép bịa ra một gap hoặc ngụy tạo conformance); `referenceQueries` chỉ không rỗng cho các section `review_validate` và bị bỏ (ignored) trên mọi task khác. `acceptanceCriteria` là metadata tư vấn, không bao giờ là structure: nó được nối vào writer brief và trao cho coverage auditor, nhưng nó KHÔNG ĐƯỢC khiến assembler thêm, đổi tên, hay sắp xếp lại bất kỳ section nào — forbidden-content scan của Phase 4 (§8) loại bỏ bất cứ thứ gì mà một criterion vô tình cố tiêm vào.

### 3.3 Written Section (output của mỗi lượt chạy section ở Phase 3)

| Trường | Kiểu | Quy tắc |
|---|---|---|
| `sectionId`, `heading` | string | Sao chép từ plan; heading không bao giờ bị writer thay đổi |
| `body` | string | Markdown prose; chứa inline `[N]` chỉ với các section grounded |
| `citations` | map citationNumber → useCount | Chỉ các số sống sót qua deterministic validation |
| `chunksUsed` | chunk refs | Tập reranked thực sự được đưa cho writer; với các section `review_validate`, tách thành tập phía artifact và phía reference để coverage auditor và source panel có thể hiển thị cả hai |
| `flags` | string[] | `insufficient_context`, `no_citations`, `low_faithfulness`, **[merged-in]** `unmet_acceptance_criteria` (dấy lên khi các deterministic post-write check ở §6 không thể xác nhận `acceptanceCriteria` của một section — ví dụ một criterion nói "every test case cites a source requirement" nhưng tồn tại một dòng không có citation) |

### 3.4 Generation Result (trả về cho caller)

Assembled markdown (inline citations theo **định dạng token chat-QA**, §0.1.7) + plan + các per-section record + **global citation registry** (citation id → chunk reference, được phát ra theo **cùng hình dạng payload mà tính năng chat-QA dùng** để panel "show sources" hiện có của FE render nó không đổi — KHÔNG tiêm vào tài liệu) + một object `warnings`: lỗi structure, lỗi citation, coverage verdict, danh sách id section được tái sinh, các khoảng trống về requirement-heading coverage, một flag `noKnowledgeBase` (đặt khi tài liệu được sinh ungrounded do không có KB nào — §4.5), một flag `formatResolutionFailed` (§4.3b), và các **trường operational-robustness** `partial`, `failedSections[]`, `deadlineHit`, `deadlineSkippedSections[]`, `cancelled`, `dependencyEdgesDropped[]` (§7a). Warnings không bao giờ làm request thất bại.

---

## 4. Đặc tả Phase 1 — Input Normalizer (cho phép tái sử dụng Agent Standard)

### Quyết định
Orchestrator **có thể tái sử dụng cho Agent Standard mode mà không cần thay đổi downstream nào**. Agent standard mode KHÔNG có một pipeline riêng; nó chỉ thêm lớp normalization + policy này phía trước orchestrator dùng chung. Mọi nhận thức về mode đều nằm trong normalizer, vốn phát ra canonical Request. Các phase downstream KHÔNG ĐƯỢC rẽ nhánh theo mode (ngoại trừ writer, vốn nhận agent instruction + skill dưới dạng một persona string mờ đục).

### 4.1 Chuỗi precedence (quy phạm) **[merged-in]**

Khi các nguồn xung đột, thứ tự giải quyết là:

```
System safety rules
> Application generation rules
> Agent instruction
> Agent skill instruction
> User markdown headers
> User freestyle prompt
```

Các quy tắc cứng đứng **trên** chuỗi này và không bao giờ bị ghi đè bởi bất kỳ nguồn nào, kể cả bản thân agent:

- tenant filter KHÔNG BAO GIỜ được phép ghi đè;
- các quy tắc/ACL knowledge-base security KHÔNG BAO GIỜ được phép ghi đè;
- các quy tắc system safety KHÔNG BAO GIỜ được phép ghi đè;
- header hay text của prompt nào cố thay đổi các trường `security` đều bị bỏ qua và ghi log.

Hai khóa agent-policy tinh chỉnh chuỗi này: **output format** của agent chỉ có thể bị người dùng ghi đè nếu `agentPolicy.allowUserFormatOverride` là true (default true), và **retrieval policy / KB selection** của agent chỉ có thể bị ghi đè nếu `agentPolicy.allowUserRetrievalOverride` là true (default true). Khi một khóa chặn một ghi đè, giá trị của agent được dùng, `outputFormatConflict=true` vẫn được ghi nhận, và một warning được nêu ra.

### 4.2 Giải quyết trường theo từng mode

Hai mode giải quyết các trường của canonical Request theo **các mô hình khác nhau về bản chất**, nên chúng được đặc tả riêng bên dưới. Khác biệt chỉ nằm ở *cách mỗi trường được lấy nguồn* — cả hai mode đều phát ra **canonical Request giống hệt nhau** (§3.1), nên §5–§8 không bao giờ rẽ nhánh theo mode (bất biến tái sử dụng cốt lõi, §4 Decision).

- **Chat generative mode = nguồn đơn (single-source).** Mọi trường đến từ **một** nơi: các markdown header của người dùng. Năm header (`# User profiles / # Task / # Context / # Keyword / # Output format`) là toàn bộ input; `# Task` và `# Output format` là **bắt buộc** (§4.3.2). Không agent, không tool, không precedence merge — chỉ là header parsing xác định. Xem §4.2a.
- **Agent Standard mode = đa nguồn có precedence.** Các trường được lắp ráp từ **nhiều** nguồn — agent instruction, khối `## Skill` của agent, output-format resolver tool (§4.3b), và prompt của người dùng (header HOẶC freestyle) — giải quyết qua chuỗi precedence (§4.1). **Năm header KHÔNG bắt buộc**; người dùng có thể prompt bằng ngôn ngữ tự nhiên freestyle và các trường có cấu trúc còn thiếu được khôi phục từ agent + tool + extractor §9.1. Xem §4.2b.

#### 4.2a Chat generative mode — các trường chỉ từ header của người dùng

| Trường | Nguồn (tất cả từ header của người dùng) |
|---|---|
| User profiles | từ `# User profiles`; **tùy chọn** — thiếu → warning + persona mặc định trung tính "general professional reader" |
| Task | từ `# Task`; **bắt buộc** (thiếu → lỗi cứng, §4.3.2) |
| Context | từ `# Context`; tùy chọn, có thể rỗng |
| Keyword | từ `# Keyword`; tùy chọn |
| Output format | từ `# Output format`; **bắt buộc** (thiếu → lỗi cứng, §4.3.2) |

Ở chat mode không áp dụng agent instruction, resolver tool, hay precedence merge. `agentInstruction`/`agentSkill`/`agentPolicy`/`agentPlanningHints` vắng mặt; `outputFormatSource="user"` luôn đúng. Normalizer ở đây thuần túy là header parsing xác định (không lệnh gọi LLM, <100 ms).

#### 4.2b Agent Standard mode — các trường từ nhiều nguồn (giải quyết theo precedence)

Năm header **không bắt buộc**; user prompt có thể là freestyle. Mỗi trường được giải quyết từ các nguồn bên dưới, đỉnh-chuỗi (§4.1) thắng. Ở chỗ người dùng có cung cấp header, nó tham gia theo quy tắc được nêu; ở chỗ người dùng freestyle, giá trị đến từ extractor §9.1 và/hoặc agent.

| Trường | Nguồn & quy tắc giải quyết (agent mode) |
|---|---|
| User profiles | từ **agent instruction**; người dùng không thể ghi đè (agent định nghĩa đối tượng đọc của nó). |
| Task | từ **user prompt** (một header `# Task`, hoặc trích từ freestyle qua §9.1); **bắt buộc** — một request không có task nhận diện được là lỗi cứng. |
| Context | **merge**: context baseline của agent trước, sau đó `# Context` của người dùng (hoặc trích từ freestyle), nối lại. |
| Keyword | **union** của các keyword baseline của agent và của người dùng, loại trùng. |
| Output format | giải quyết theo thứ tự ưu tiên: (1) `# Output format` của người dùng nếu có **ghi đè** agent — trừ khi `allowUserFormatOverride=false` (khi đó agent thắng, `outputFormatConflict=true`, warning); (2) nếu không, nếu prompt gợi ý một format đã cấu hình, **resolver tool** (§4.3b) cung cấp nó ở mức agent; (3) nếu không, `# Output format` **mặc định** của agent; (4) nếu không, planner đề xuất structure (§5). `outputFormatSource` ghi nhận cái nào thắng (`user`/`agent`). |

Tất cả bốn tín hiệu nguồn của agent mode ngoài các header — instruction persona, `## Skill`, retrieval/citation policy, các format đã cấu hình — đều được chính normalizer giải quyết/chưng cất (resolver tool §4.3b, `agentPlanningHints` §4.6, requirement headings §4.4) **trước khi** chúng điền vào Request, nên các phase downstream vẫn chỉ nhận canonical Request phẳng.

### 4.3 Yêu cầu

1. **Header parsing là xác định.** Các dòng markdown `# Header` tách text thành các named body. Việc khớp không phân biệt hoa thường và dung thứ chữ `s` ở cuối ("Keyword"/"Keywords", "User profile"/"User profiles"). Chi tiết triển khai (regex vs parser) là lựa chọn của coding agent; hành vi mới là hợp đồng.
2. **Validation chat-mode:** thiếu `# Task` hoặc `# Output format` là một lỗi cứng, hiển thị cho người dùng trước bất kỳ lệnh gọi LLM nào. **[merged-in]** Chat mode cũng **yêu cầu một knowledge base**: nếu tập KB hiệu dụng rỗng (không có cái nào được nối cho session), request là một lỗi cứng, hiển thị cho người dùng trước khi sinh nội dung — chat mode là RAG-trên-dữ-liệu-nội-bộ và không bao giờ được âm thầm trả lời từ kiến thức của model (điều đó sẽ tái nhập cut-off-knowledge hallucination và model bias). Sinh nội dung ungrounded chỉ có thể đạt tới qua một agent với `agentScope="general"` (§4.5).
3. **Freestyle fallback (chỉ agent mode):** nếu user prompt không chứa canonical header nào, chạy đúng một lệnh gọi LLM extraction nhỏ (≤500 input token, schema-constrained JSON) sinh ra `task`, `context`, `keyword[]`, `output_format`. Prompt: §9.1.
4. **Giải quyết Output-format qua tool (chỉ agent mode) [merged-in]:** khi không có `# Output format` nào được giải quyết từ user prompt (không phải header, cũng không phải freestyle extractor sinh ra một cái) VÀ prompt gợi ý việc dùng một format đã cấu hình, normalizer giải quyết format đó qua output-format resolver tool (§4.3b) trước khi rơi về format mặc định của agent. Phạm vi chỉ là **output format** — nó không điền task/context/keyword.
5. **Cost profile:** không lệnh gọi LLM nào khi các header hiện diện; normalizer phải hoàn tất trong <100 ms ở đường đi đó. Resolver §4.3b thêm một lệnh gọi LLM CHỈ ở fallback Tier-1 của nó (deterministic hint-scan không tìm thấy gì), không bao giờ khi một header hiện diện.

### 4.3b Output-format resolver tool **[merged-in]** (chỉ agent mode; chưa triển khai — hợp đồng ở đây)

**Intent.** Agent admin cấu hình các template output-format đặt tên trên agent. Khi người dùng bỏ qua `# Output format` nhưng ra hiệu "dùng format hiện có/chuẩn," normalizer lấy format đã cấu hình qua một resolver tool thay vì báo lỗi hoặc để planner tự bịa ra structure. Bản thân tool **chưa được xây dựng**; mục này là hợp đồng mà một bản triển khai sau này phải thỏa mãn. Cho đến khi nó tồn tại, orchestrator hành xử y như hiện nay (`# Output format` mặc định của agent là fallback).

**Trigger hai tầng (deterministic-first, phản chiếu §4.3.3).** Chỉ chạy ở agent mode, CHỈ khi không có `# Output format` nào được giải quyết từ prompt (không header, và extractor §9.1 trả về `output_format` rỗng):
- **Tier 0 — deterministic hint scan (miễn phí, luôn chạy trước):** khớp prompt với một từ điển nhỏ các cụm tham chiếu format — ví dụ "use the (standard|existing|configured|default|usual) (output )?format", "use the <name> template/format", "format it like the <name>", "theo định dạng <…>". Một lần khớp cho ra một `formatName` tùy chọn (phần `<name>` bắt được, có thể rỗng → "format mặc định đã cấu hình của agent").
- **Tier 1 — LLM check (fallback, chỉ khi Tier 0 không tìm thấy gì):** một lệnh gọi nhỏ schema-constrained (≤300 in / ≤60 out, temperature 0, §9.7) trả lời: prompt có yêu cầu dùng một output format đã có/cấu hình hay không, và nếu có thì tên gì? `{ "useConfiguredFormat": bool, "formatName": string|"" }`. Bỏ qua hoàn toàn khi Tier 0 đã khớp.
- Nếu cả hai tier đều không cho thấy một format đã cấu hình → không gọi tool; tiến tới format mặc định của agent (hoặc, nếu không có, planner đề xuất structure theo §5).

**Hợp đồng resolver tool (triển khai sau).** `resolveOutputFormat({ agentId, tenantId, formatName? }) → { found: bool, outputFormat?: string, resolvedName?: string }`.
- Input đến từ **session/agent config**, không bao giờ từ text của prompt — `agentId`/`tenantId` được lấy từ `security`/agent context (một prompt không thể đặt tên format của agent hay tenant khác). `formatName` là input duy nhất bắt nguồn từ prompt và chỉ được dùng làm khóa tra cứu đối chiếu với các format đã cấu hình của chính agent gọi; một tên không xác định/không được phép → `found:false` (KHÔNG phải lỗi, KHÔNG phải đoán).
- Khi `found:true`, `outputFormat` trả về điền vào `Request.outputFormat`, với `outputFormatSource="agent"` (nó là format đã cấu hình của agent) và provenance được ghi nhận (`resolvedName`).
- Khi `found:false` (hoặc tool lỗi/timeout) → rơi về `# Output format` mặc định của agent; nếu agent không có, planner đề xuất structure (§5). Một warning `formatResolutionFailed` được nêu ra khi một format rõ ràng được yêu cầu theo tên nhưng không tìm thấy. Không bao giờ chặn request.

**Precedence & security (các bất biến không đổi).** Một format giải quyết bằng tool nằm ở **mức agent** của §4.1 — dưới các quy tắc system/application, và có thể bị ghi đè bởi một `# Output format` do người dùng cung cấp sau đó dưới `allowUserFormatOverride` đúng như fallback tĩnh của agent. Nó không bao giờ có thể thay đổi `security`/`noKnowledgeBase`. Chat mode không bị ảnh hưởng: thiếu `# Output format` ở chat mode vẫn là một lỗi cứng (§4.3.2) — resolver này không chạy ở đó.

### 4.4 Phát hiện requirement-heading **[merged-in]**

Ngoài năm canonical header, người dùng và agent nhúng các heading kiểu requirement tùy chỉnh (ví dụ `# Requirement`, `## Functional Requirement`, `## Non-functional Requirement`, `## Screen Requirement`, `## API Requirement`, `## Constraint`, `## Acceptance Criteria`). Normalizer PHẢI:

- một cách xác định trích các dòng kiểu heading từ user prompt body và agent instruction mà không phải năm canonical;
- phân loại mỗi cái là `requirement | constraint | acceptance_criteria | domain_rule | quality_rule | retrieval_hint | unknown` (phân loại keyword/dictionary là đủ; không lệnh gọi LLM);
- gắn chúng vào Request dưới dạng `requirementHeadings`.

Các sử dụng downstream (không phase mới): **planner** nhận danh sách và phải ánh xạ mọi heading `requirement`/`acceptance_criteria` tới ít nhất một section đã lập kế hoạch; các heading `retrieval_hint` được union-merged vào keyword anchor; **coverage auditor** (§9.6) nhận danh sách và báo cáo bất kỳ heading nào không được giải quyết dưới dạng một mục `missingAspects`; các heading `constraint`/`quality_rule` chảy vào brief của writer.

### 4.5 Grounding mode theo intent & agent scope (dẫn xuất `noKnowledgeBase`) **[merged-in]**

Việc orchestrator sinh nội dung **grounded** (từ các chunk được retrieve) hay **ungrounded** (từ kiến thức đã huấn luyện của model) được quyết định **một cách xác định** từ mode của request và scope của agent — không bao giờ từ quyết định tùy ý của planner và không bao giờ từ text của prompt. Boolean dẫn xuất `noKnowledgeBase` ghi nhận kết quả.

**Intent chat generative — luôn grounded.** Chat mode là RAG trên dữ liệu nội bộ của người dùng; mục đích của nó là *ghi đè cut-off huấn luyện của model và sự thiếu dữ liệu riêng tư của tổ chức*, và giữ output không có hallucination và model bias. Do đó:
- Chat mode **yêu cầu một knowledge base**. `noKnowledgeBase` luôn là `false` ở chat mode.
- Nếu tập KB hiệu dụng rỗng (không có cái nào được nối), request là một **lỗi cứng** trước khi sinh nội dung (§4.3.2) — chat không bao giờ được âm thầm trả lời từ kiến thức của model.
- Mọi section factual đều retrieve; nếu sau retrieve→rerank bằng chứng vắng hoặc không dùng được, section **abstain với per-section sentinel** (§7) — nó KHÔNG rơi về sinh nội dung ungrounded. Thông điệp "insufficient context" là phản hồi đúng đắn, được kỳ vọng theo từng giai đoạn của plan.

**Agent Standard mode — grounding theo `agentScope` (§3.1):**
- `agentScope="all_kb"` (1) hoặc `"specific_kb"` (2) → một KB tồn tại → `noKnowledgeBase=false` → hành xử y như chat: grounded retrieval theo từng section, abstain khi context không đủ. (Nếu một agent `all_kb`/`specific_kb` giải ra một tập KB hiệu dụng thực sự rỗng — cấu hình sai — coi như `noKnowledgeBase=true` và nêu ra một warning, vì không có gì để retrieve.)
- `agentScope="general"` (3) → agent **không có quyền truy cập KB** → `noKnowledgeBase=true` → tài liệu được sinh từ kiến thức đã huấn luyện của LLM cộng với `# Context` của người dùng. Đây là đường ungrounded **duy nhất** được phê chuẩn trong toàn hệ thống.

**Quy tắc dẫn xuất (cấp độ security):** `noKnowledgeBase` và `agentScope` được dẫn xuất **chỉ** từ session/agent config + lớp security, y như `security`. Text của prompt KHÔNG ĐƯỢC đặt, xóa, hay ảnh hưởng chúng. Một header hay đoạn prompt nói "skip the knowledge base" / "don't retrieve" bị bỏ qua và, nếu nó cố thay đổi KB selection, được ghi log theo §4.1.

**Hệ quả khi `noKnowledgeBase=true` (chỉ agent `general`) — không phase mới, không task `pure_generation`:** Phase 2 vẫn phân loại request vào một trong **7** task type (§5.4); rồi, một cách xác định và vô điều kiện, orchestrator ép `retrievalMode="none"`, `mustCite=false`, `minCitations=0`, và bỏ mọi `subQueries`/`referenceQueries` trên **mọi** section — ghi đè bất kể planner trả về gì. Sinh nội dung ungrounded vì thế là một **retrieval condition (`retrievalMode="none"`), không bao giờ là một task type**. Phase 3 đi theo đường writer `none` (§9.3c) cho mọi section — không retrieve, không rerank, không sufficiency gate, không citation, không abstention sentinel (không có KB nào để dựa vào mà tuyên bố "insufficient"; sinh nội dung trung thực từ kiến thức của model là điều được kỳ vọng ở đây, và *chỉ* ở đây).

### 4.6 Agent instruction → planner: chưng cất có cấu trúc (KHÔNG phải raw prose) **[merged-in]**

**Yêu cầu (agent mode):** agent instruction và khối `## Skill` là **cấu hình PHẢI định hình planning ở Phase 2**, không chỉ writing ở Phase 3. Normalizer là nơi duy nhất đọc instruction; nó chuyển mọi tín hiệu *liên quan tới planning* trong instruction thành **các trường có cấu trúc** mà planner tiêu thụ (`agentPlanningHints`, `agentPolicy`, `requirementHeadings`). Bản thân raw persona prose KHÔNG được chuyển tiếp tới planner — chỉ tới writer (§6 item 6 / §9.3) — điều này giữ chuỗi precedence (§4.1) rõ ràng và có thể audit: planner hành động trên dữ liệu có kiểu mà provenance được ghi nhận, không bao giờ trên free text mà tác động của nó mờ đục.

Normalizer điền `agentPlanningHints` một cách xác định (trích keyword/dictionary, không lệnh gọi LLM) bằng cách khai thác instruction + skill cho:

- **Mặc định Length/verbosity** → `defaultVerbosity`: các cụm như "concise"/"brief" vs "detailed"/"comprehensive". Planner dùng nó cho `targetTokens` chỉ khi người dùng không nêu ý định độ dài.
- **Các quy ước ID & terminology** → `idConventions` / `terminology`: các pattern như `UC-<MODULE>-<NN>`, thuật ngữ glossary. Planner gập chúng vào keyword anchor của sub-query để retrieval rơi đúng tài liệu; writer cũng nhận chúng (§9.3) để tái tạo đúng ID.
- **Các quy tắc nội dung Required / forbidden** → `requiredContent` / `forbiddenContent`: "always include an Open Questions section", "never output real credentials". Các quy tắc required-content đặt tên một deliverable bên trong một section hiện có trở thành `acceptanceCriteria` per-section; các quy tắc ngụ ý một *section mới* bị bỏ (structure chỉ là `# Output format` — chúng không thể thêm section). Các quy tắc forbidden-content được merge vào forbidden-content scan của Phase-4 (§8) và vào `acceptanceCriteria`.
- **Các tín hiệu Domain / risk** → `domainRiskCues`: ngôn từ healthcare/legal/finance/security/safety trong instruction định hướng `riskLevel=high` của planner ngay cả khi *user prompt* trung lập về miền (standing context của agent, ví dụ một "Clinical Protocol Writer", mang theo rủi ro).
- **Retrieval / citation policy** → đã có trong `agentPolicy` + `retrievalHints`: `citationPolicy="required"` ép `mustCite`/`minCitations` trên các section grounded; các retrieval hint được union-merged vào anchor.
- **Kỷ luật skill chung** → `skillCriteria`: các quy tắc chất lượng độc lập với artifact từ `## Skill` ("every test case cites a source requirement", "never invent API names") làm seed cho `acceptanceCriteria` per-section (§9.2 job item 10).

**Precedence được giữ:** các hint này nằm ở các mức *Agent instruction / Agent skill* của §4.1 — dưới các quy tắc system/application và trên user freestyle, nhưng một `# Output format` của người dùng vẫn ghi đè agent structure (tùy thuộc `allowUserFormatOverride`), và **không gì ở đây có thể chạm tới `security`/`noKnowledgeBase`**. Khi một hint xung đột với một mức cao hơn, mức cao hơn thắng và hint bị bỏ được ghi log.

### Các phương án bị bác bỏ
Orchestrator riêng cho mỗi mode (duplicated maintenance); **tiêm agent instruction dưới dạng raw prose thẳng vào planner prompt** (precedence trở nên ngầm và không thể audit, và persona text chiếm chỗ ngân sách planner ≤3k — thay vào đó nội dung liên quan planning của instruction tới planner dưới dạng các trường có cấu trúc `agentPlanningHints`/`agentPolicy`/`requirementHeadings`, §4.6); luôn chạy LLM extractor (đánh thuế 1–2 s lên mọi chat request mà chẳng được gì); phân loại heading dựa trên LLM (một từ điển làm việc đó miễn phí); chưng cất instruction dựa trên LLM (việc trích dictionary/keyword ở §4.6 là miễn phí và xác định — chỉ leo thang lên một lệnh LLM nhỏ nếu instruction của một agent tương lai quá thiếu cấu trúc để khai thác, dưới cùng ngân sách một-lệnh-gọi như §9.1).

---
## 5. Đặc tả Phase 2 — Planner + Outliner đã hợp nhất (một lệnh gọi LLM)

### Quyết định

1. **Phase outliner độc lập bị loại bỏ.** Một lệnh gọi LLM sinh ra classification + plan + outline metadata. Trên một model local cỡ 7B, một lệnh outlining thứ hai mua thêm +0–5% chất lượng structure đổi lấy +5–15 s và một sequential gate thừa — một trao đổi tệ dưới ngân sách 1–3 phút. Câu hỏi "có cần outliner không?" từ cả hai kết quả nghiên cứu giải quyết thành: *trách nhiệm của nó sống sót, phase của nó thì không.*
2. **Khi `# Output format` không rỗng, outline KHÔNG phải là quyết định của LLM.** Một parser xác định dẫn xuất các section heading từ format text (markdown heading, numbered list, hoặc bullet list) TRƯỚC khi planner chạy; planner nhận chúng như input cố định và chỉ gán metadata per-section. Điều này loại bỏ lớp lỗi "invented section" (LLM thêm Introduction/Conclusion/References mà không ai yêu cầu) và đảm bảo bảo toàn chính xác structure và thứ tự heading mà người dùng yêu cầu.
3. **Khi `# Output format` rỗng**, planner đề xuất một structure tối thiểu (3–7 section) phù hợp với task — và **[merged-in]** nếu task yêu cầu đúng một deliverable (một table duy nhất, một chuyển đổi trực tiếp, một câu trả lời ngắn), plan PHẢI chứa đúng một section. Outline chỉ là trợ giúp planning; nó không bao giờ được phép tự đưa ra các yêu cầu nội dung của riêng nó.
4. **Phân loại task (7 lớp)** — planner phân loại mọi request vào đúng một lớp:

| `detectedTask` | Ý nghĩa | Default retrieval mode |
|---|---|---|
| `qa_with_citations` | câu trả lời factual grounded trong chunk | grounded_strict |
| `summarize_single` | cô đọng một nguồn | grounded_strict |
| `synthesize_multi` | hợp nhất qua nhiều tài liệu | grounded_strict |
| `compare_analyze` | đối chiếu/phê bình qua nhiều tài liệu | grounded_strict |
| `transform_derive` | dẫn xuất một artifact MỚI coi các nguồn là ground truth (requirements → test cases / detail design / basic design / test spec) | grounded_strict |
| `reference_inspired` | nguồn là exemplar; chi tiết cụ thể có thể được bịa ra (old use cases → new use cases) | reference_inspired |
| `review_validate` | **[merged-in]** đánh giá một artifact ĐÃ CÓ đối chiếu với một reference được retrieve (template / standard / upstream artifact) và báo cáo tính đầy đủ, nhất quán, và các gap về grounding — tùy chọn kèm một bản nháp đã sửa (ví dụ "is this test spec complete and consistent with the SRS?", "review this design against the architecture standard") | grounded_strict |

**Không có task type `pure_generation` [merged-in].** `detectedTask` mô tả *điều người dùng muốn được làm*; việc output có grounded hay không là một trục riêng được mang bởi `retrievalMode` + `noKnowledgeBase`/`agentScope` (§3.1, §4.5). Sinh nội dung ungrounded vì thế là **một retrieval condition, không phải một task**: nó chỉ xảy ra khi `noKnowledgeBase=true` (agent `agentScope="general"`, hoặc một tập KB hiệu dụng rỗng), tại điểm đó orchestrator một cách xác định ép `retrievalMode="none"` trên mọi section bất kể trong 7 task type nào được phát hiện. Planner bị **cấm chọn một plan ungrounded khi một KB sẵn có** — chat mode luôn có một KB; một agent `all_kb`/`specific_kb` luôn có một KB; trong các trường hợp đó mọi section factual đều retrieve và **abstain khi context không đủ** (§7) thay vì sinh nội dung từ kiến thức của model. Đây là điều giữ chat-mode RAG không có cut-off-knowledge hallucination và model bias.

Phân loại này trung lập về miền theo cấu trúc (software, healthcare, legal, finance…). Planner prompt cấm các giả định về miền; miền chỉ đi vào qua task/context text, quy tắc risk-level bên dưới, và kết quả retrieval.

**`review_validate` là task dual-grounding.** Khác với các task grounded còn lại (vốn retrieve *một* loại nguồn), một bài review đánh giá một **artifact-under-review** đối chiếu với một **reference/ground-truth**, nên planner phát ra CẢ `subQueries` (phía artifact — tài liệu thực sự nói gì) lẫn `referenceQueries` (phía reference — nó nên tuân thủ điều gì). Một finding là *delta* giữa hai phía, mỗi phía được cite riêng. Đây là profile grounding nghiêm ngặt nhất bên cạnh RTM (§A.8): `mustCite` và `assumptionsAllowed=false` bị ép sau khi parse, và abstention sentinel được *kỳ vọng* khi grounding thực sự vắng — writer không bao giờ được bịa một gap hay ngụy tạo một "pass". Khi `# Output format` đã giải quyết yêu cầu một bản nháp corrected/revised làm một trong các mục của nó, section đơn đó chạy kiểu `transform_derive` (grounded đối chiếu với reference) trong khi các section findings/verdict vẫn là `review_validate` — một plan, hành vi section pha trộn, đúng như Use Case agent (§A.1).

5. **Ba retrieval mode, gán theo từng section** (không theo từng tài liệu — một plan đơn có thể trộn cả ba):

| `retrievalMode` | Hành vi của writer | Citation policy |
|---|---|---|
| `grounded_strict` | facts CHỈ từ các chunk được retrieve | inline `[N]` bắt buộc; abstain khi context không đủ |
| `reference_inspired` | chunk là exemplar style/structure; chi tiết cụ thể có thể bịa ra nhất quán với task | KHÔNG citation trong output |
| `none` | sinh nội dung thuần; writer vẫn thấy `# Context`, nên các section chỉ-từ-user-context dùng mode này | không citation (trừ khi agent citationPolicy yêu cầu) |

6. **Leo thang theo rủi ro miền [merged-in].** Planner đặt `riskLevel: high` trên các section liên quan tới healthcare/medical, legal, regulatory compliance, finance, security, hoặc nội dung safety-critical. Hệ quả (được thực thi xác định sau khi parse, §3.2): `mustCite` ép true và `assumptionsAllowed` ép false cho các section grounded; sufficiency gate luôn dùng LLM tier và áp dụng phán định nghiêm ngặt (§7); các section như vậy là ứng viên ưu tiên cho NLI faithfulness gate.
7. **Sub-query nằm bên trong plan.** 1–3 mỗi section retrieving, mỗi cái với một text ngôn ngữ tự nhiên (dense retrieval) và 0–4 keyword anchor (sparse/BM25). Header `# Keyword` của người dùng và mọi requirement heading `retrieval_hint` được union-merged vào các anchor ở downstream. KHÔNG có các phase HyDE / step-back / multi-query riêng — mỗi cái sẽ thêm một lệnh gọi LLM đầy đủ để đổi lấy recall biên trên setup này; chỉ xem xét lại nếu retrieval recall đo được là không đủ.
8. **`dependsOn` là ngoại lệ, không phải mặc định.** Chỉ khi một section thực sự cần text của một section khác làm input. Executor tôn trọng nó; mọi thứ còn lại chạy song song.
9. **Short-circuit no-knowledge-base [merged-in].** Khi flag `noKnowledgeBase` của Request là `true` (chỉ một agent với `agentScope="general"`, §4.5; chat mode không bao giờ ở đây), retrieval là bất khả thi, nên orchestrator bỏ qua phase retrieve cho toàn bộ tài liệu và sinh nội dung chỉ từ kiến thức đã huấn luyện của LLM. Hiện thực hóa: planner vẫn phân loại `detectedTask` bình thường từ **7** task type (không có type `pure_generation`, §5.4) và no-KB addendum (§9.2) bảo nó phát ra **không có `subQueries`/`referenceQueries`**; sau đó, **sau khi parse và vô điều kiện**, orchestrator ép `retrievalMode="none"`, `mustCite=false`, `minCitations=0`, và bỏ mọi `subQueries`/`referenceQueries` trên **mọi** section — ghi đè bất kể LLM trả về gì (cùng pattern phòng vệ sau-parse dùng cho `mustCite` high-risk). Ungrounded generation do đó là một **điều kiện retrieval (`retrievalMode="none"`), không phải một task type**. Outline vẫn được dẫn xuất xác định từ `# Output format` khi có; chỉ evidence policy thay đổi. Điều này độc lập với `detectedTask` và `riskLevel`: kể cả một task high-risk cũng sinh ungrounded khi thực sự không có KB (một warning được nêu ra — xem §11).

### 5.1 Danh mục generation-pattern **[merged-in]** (các fixture hành vi của planner)

Plan phải xử lý được ít nhất các pattern lặp lại sau; mỗi hàng cũng đồng thời là một fixture integration-test:

| # | Pattern | Hành vi planner kỳ vọng |
|---|---|---|
| 1 | Tạo tài liệu mới từ tài liệu cũ tương tự ("refer to old use case, create a new one") | `reference_inspired`; retrieve exemplar; phản chiếu structure/voice; chỉ bịa các chi tiết thực sự mới; các sub-section grounded (rules, preconditions) vẫn cite |
| 2 | Sinh test case từ một requirement | `transform_derive`; grounded_strict; mỗi test case ánh xạ tới bằng chứng requirement; bao phủ các quy tắc functional và edge case |
| 3 | Sinh detail design từ basic design | `transform_derive`; grounded_strict; retrieve các chunk HLD/architecture/API/data-model; không bao giờ bịa tên API, trường, hay workflow |
| 4 | Sinh nội dung chỉ từ user context / kiến thức của model (agent `agentScope="general"`, hoặc KB thực sự rỗng) | KHÔNG phải một task type — task được phát hiện vẫn là một trong 7; điều kiện no-KB (§4.5) ép `retrievalMode="none"` trên mọi section; bỏ qua retrieval hoàn toàn; không citation. Ở chat mode điều này KHÔNG áp dụng (chat yêu cầu một KB; KB rỗng → lỗi cứng). |
| 5 | Sinh nội dung chỉ từ knowledge base | grounded_strict; sufficiency gate bắt buộc; citation bắt buộc |
| 6 | Các artifact phát triển phần mềm (SRS, user story, use case, FR/NFR, test case, test specification, basic design, detail design, API/DB/screen/workflow/deployment design, migration plan) | được bao phủ bởi phân loại + các template agent ở Appendix A; không cần code đặc biệt |
| 7 | Tài liệu Healthcare / miền được quản lý (regulated-domain) | đường đi `riskLevel: high`: yêu cầu bằng chứng mạnh hơn, citation bắt buộc, không claim không được hỗ trợ, không cho phép assumption |
| 8 | **[merged-in]** Review/validate một artifact đối chiếu với một reference ("check this test spec is complete and consistent with the SRS"; "review this detail design against the HLD and the coding standard") | `review_validate`; grounded_strict; mỗi section phát ra `subQueries` (phía artifact) VÀ `referenceQueries` (phía reference); `mustCite=true`, `assumptionsAllowed=false`; mỗi finding cite chunk artifact VÀ chunk reference mà nó xung đột; abstain (sentinel) thay vì khẳng định một pass/gap không có bằng chứng; nếu output format yêu cầu một bản nháp đã sửa, section đó là `transform_derive` grounded đối chiếu với reference |

### Yêu cầu
- Đúng một lệnh gọi LLM; schema-constrained; một lần retry với lỗi validation được nối vào; sau đó hard fail.
- Khi các heading cố định đã được dẫn xuất, orchestrator PHẢI phòng vệ force-restore chính xác heading/order/count sau khi parse plan, bất kể LLM trả về gì.
- Mọi heading `requirement` / `acceptance_criteria` được phát hiện ánh xạ tới ≥1 section (validate xác định sau khi parse; các heading không ánh xạ → planner retry, sau đó warning).
- Planner input ≤3k token, output ≤1.5k. Planner KHÔNG BAO GIỜ thấy các chunk được retrieve.
- Planner prompt: §9.2.

### Các phương án bị bác bỏ
Lệnh gọi task-classifier / intent-analyzer riêng (gấp đôi latency, lợi ích accuracy không đáng kể với constrained decoding — trách nhiệm của nó được hấp thụ bởi `detectedTask` + `riskLevel` trong lệnh gọi planner đơn); lệnh gọi outliner độc lập; mô phỏng góc nhìn kiểu STORM (~10× chi phí, kỹ thuật của model frontier); planner prompt đặc thù theo miền (gây anchoring; một structural prompt + risk level tổng quát hóa được).

**Tách plan và outline thành hai lệnh gọi — bị bác bỏ kể cả dưới một tool-calling harness.** Một phản đối tự nhiên là nếu orchestrator chạy như (hoặc dưới) một tool-calling harness agent, một bước `propose_outline` riêng sẽ cho harness kiểm tra/phê duyệt outline trước khi cam kết per-section retrieval. Nó không đáng giá ở đây, vì các lý do đúng bất kể ai điều khiển orchestrator:
- **Không có sự chia tách trí tuệ nào để thực hiện.** Khi `# Output format` hiện diện (trường hợp agent-mode phổ biến — mọi agent Appendix-A đều ship một format đánh số), outline được dẫn xuất **một cách xác định trước khi LLM chạy** (quyết định 2); LLM chỉ gắn metadata vào các heading cố định. Một lệnh gọi outliner riêng sẽ chẳng có gì để quyết định trên đường đó.
- **Cùng context, không thông tin mới.** Outlining và planning tiêu thụ *cùng* input (task + `# Output format` đã giải quyết + `agentPlanningHints` + requirement heading) và *không* cái nào thấy các chunk được retrieve (planner không bao giờ thấy). Tách một quyết định cùng-context thành hai lệnh gọi chỉ trả thêm một round-trip để trao lại cho model chính output của nó — một sequential gate thuần không có song song để che giấu nó, đúng cái chi phí mà phase này tồn tại để loại bỏ.
- **Điểm kiểm tra (checkpoint) đã có sẵn, miễn phí.** Schema/grammar-constrained decoding khiến lệnh gọi đơn phát ra một object plan-cộng-outline đã validate, có thể kiểm tra. Một harness (hoặc một con người) có thể đọc nó, từ chối nó, và kích hoạt một lần retry được cho phép **mà không cần một lệnh gọi LLM thứ hai** — nên lợi ích "inspect before commit" của harness đến từ *structured output*, không phải từ một gate thứ hai. Phần công việc thực sự không thể đảo ngược (retrieval + writing) nằm downstream ở Phase 3 và đã được gate ở đó bởi các sufficiency check (§7).
- **Chỉ là cửa thoát thực nghiệm.** Chỉ xem xét lại việc tách nếu đo lường trên target model cho thấy lệnh gọi đơn sinh ra một outline tốt nhưng metadata per-section suy giảm đo được (hoặc ngược lại) — tức lệnh gọi bị quá tải. Cho đến khi điều đó được quan sát, hợp nhất là đúng; **đừng** biến planner của orchestrator thành một vòng lặp agentic tự do (failure mode đó bị bác bỏ toàn bộ ở §7).

---

## 6. Đặc tả Phase 3 — parallel per-section pipeline (retriever + reranker gập vào sectionWriter)

### Quyết định

1. **Các phase retrieve và rerank độc lập bị loại bỏ.** Mỗi section thực hiện `retrieve → rerank` của riêng nó dùng sub-query của section, vì mỗi section cần context riêng; một pool global dùng chung cho mọi writer các chunk generic giống nhau và làm tệ hơn lost-in-the-middle.
2. **Các section chạy đồng thời** dưới một bounded concurrency limiter (default 4; configurable; hạ thấp nếu local LLM server không thể phục vụ các request song song). Sub-query retrieval bên trong một section cũng đồng thời. Các section `dependsOn` chỉ chờ trên các tiền điều kiện của nó.
3. **Các component hiện có của người dùng được gọi nguyên trạng.** Hợp đồng chỉ là: retrieval nhận (query text, knowledge-base ids, topK≈20) và trả về các scored chunk; reranking nhận (query, candidate chunks) và trả về chúng đã sắp xếp lại; pipeline giữ top ~5 sau rerank. Coding agent phải khám phá các chữ ký thực trong quá trình khám phá codebase và viết các adapter mỏng nếu hình dạng khác — không bao giờ triển khai lại logic retrieval hay reranking. Các KB id truyền cho retrieval luôn đến từ `security` + agent retrieval policy, không bao giờ từ text của prompt.
4. **Memoization Retrieval/rerank [merged-in].** Trong một request, kết quả `retrieve(query, kbIds, topK)` và `rerank(query, chunkSet)` được cache theo key hash, nên các sub-query giống hệt hoặc trùng lặp qua các section chỉ gọi component một lần. Một cross-request TTL cache tùy chọn nằm sau một config flag (mặc định tắt; đánh giá đối chiếu tần suất cập nhật KB).
5. **Định dạng & đánh số citation TÁI SỬ DỤNG hợp đồng chat-QA hiện có — đừng phát minh cái mới (§0.1.7) [merged-in].** Các section grounded ở Phase 3 PHẢI phát ra inline citation theo **đúng định dạng mà tính năng chat-QA hiện có đã sản sinh**, và gán citation id dùng **cùng numbering/id scheme**, để frontend render các citation của Phase-3 bằng **cùng component và code path** như chat-QA — không syntax mới, không render path song song. Xuyên suốt spec này, **`[N]` là một vật thế chỗ (stand-in) cho token chat-QA thực đó** (được khám phá theo §0.1.7), không phải một literal bắt buộc. Việc của orchestrator chỉ là *điền* vào hình dạng citation hiện có, không phải định nghĩa lại nó.
   - **Id ổn định cross-section (thuộc tính duy nhất mà multi-section pipeline thêm vào):** một global chunk registry loại trùng các chunk theo content hash qua TẤT CẢ các section để cùng một chunk được cite từ hai section cho ra **cùng** một citation id; registry an toàn concurrency; map cuối (id → chunk) của nó được trả về cùng kết quả cho source panel của FE **theo hình dạng payload chat-QA (§0.1.7)**. Nếu scheme gốc của chat-QA đã gán một id per-chunk ổn định, hãy tái sử dụng nó trực tiếp; nếu chat-QA chỉ đánh số per-answer, registry **mở rộng** scheme đó một cách tối thiểu để mang theo id ổn định cross-section — nó không bao giờ fork ra một quy ước thứ hai. Đây là bổ sung duy nhất vào hành vi citation của chat-QA; format, marker, và FE contract còn lại được thừa kế không đổi.
6. **Tận dụng header cho chất lượng retrieval:**
   - `# Keyword` (+ các heading `retrieval_hint`) → merge vào sparse anchor của mọi sub-query.
   - `# Context` → một lát ngắn (~200 ký tự) đặt trước các sub-query grounded để disambiguate.
   - `# User profiles` → tiêm vào writer prompt như "Reader profile" (điều khiển tone/depth, không phải retrieval).
   - Agent instruction + skill → tiêm vào writer prompt như một persona preamble mờ đục (các header đã được normalizer tiêu thụ; nội dung *liên quan tới planning* đã được chưng cất vào `agentPlanningHints` cho Phase 2, §4.6).
   - `agentPlanningHints.idConventions` + `.terminology` → cũng được truyền cho writer để nó tái tạo đúng ID và vốn từ vựng dự án (cùng các hint đã anchor retrieval ở Phase 2).
7. **Evidence policy per-section [merged-in].** Mỗi section mang theo evidence policy hiệu dụng của nó được giải quyết từ plan + agent policy: `retrievalMode`, `mustCite`, `minCitations`, `assumptionsAllowed`, số evidence chunk tối đa (= rerank topK, default 5), và việc generation có thể tiến hành mà không có bằng chứng hay không (chỉ `reference_inspired`/`none` được phép). Đây là dữ liệu trên section job, không phải một phase mới.
8. **Citation được thực thi trong khi generation, không phải post-hoc.** Writer system prompt (§9.3) yêu cầu một inline citation (theo dạng token chat-QA, §0.1.7 / decision 5 — viết ở đây là `[N]`) sau mọi factual claim với các section grounded. Chèn citation post-hoc bị bác bỏ: nó cần một lệnh LLM thứ hai và misattribute đo được trên các model nhỏ.
9. **Deterministic citation validation sau mỗi lần write.** Parse mọi inline citation token **dùng grammar của token chat-QA (§0.1.7)** — viết ở đây là `[N]`; chỉ giữ các id có trong tập chunk được đưa ra của section; **strip** các id không hợp lệ (không bao giờ remap — remap re-attribute một claim tới một nguồn không liên quan); dọn các khoảng trắng/dấu câu mồ côi. Một section grounded với `mustCite=true` mà kết thúc với không citation hợp lệ nào bị flag `no_citations` cho Phase 4. (Validator nhận biết định dạng (format-aware) của token chat-QA; nếu token đó không phải một `[N]` đơn giản, regex/parser trích xuất khớp với syntax thực.)
10. **Sắp xếp Anti-lost-in-the-middle.** Khi render các numbered source vào writer prompt, đặt các chunk mạnh nhất ở đầu VÀ cuối của source block, yếu nhất ở giữa (ví dụ, rank order 1,4,5,3,2).
11. **Deterministic acceptance-criteria check sau mỗi lần write [merged-in].** Với mỗi `acceptanceCriteria` của section mà có thể kiểm tra cơ học, chạy một test xác định rẻ tiền đối chiếu với body đã viết — không LLM. Ví dụ: một criterion như "every row/test case cites a source requirement" → assert không list item nào thiếu một `[N]`; "no invented requirement IDs" → assert mọi token kiểu `REQ-`/`UC-`/`TC-` trong body đều xuất hiện trong các chunk được đưa ra; "each finding cites artifact AND reference" (review_validate) → assert mỗi đoạn finding mang ít nhất một `[N]` phía artifact và một phía reference. Các criterion không thể biểu đạt cơ học được để lại cho coverage auditor (§9.6). Nếu bất kỳ criterion kiểm tra được nào thất bại, dấy lên flag `unmet_acceptance_criteria` (các criterion thất bại ngôn ngữ tự nhiên đi kèm nó) cho Phase 4 — không bao giờ tự sửa body ở đây. Đây là nửa thực thi per-section của đòn bẩy chất lượng; auditor là nửa cross-section.

### Ngân sách token per-section (bắt buộc; cửa sổ 16k)

| Lát | Token |
|---|---|
| Writer system prompt | ~700 |
| Lát Request (profile, task, context, format hint, các heading constraint/quality liên quan) | ~300 |
| Lát Plan (CHỈ section NÀY — không bao giờ cả plan; gồm `acceptanceCriteria` của nó) | ~250 |
| Lát Writer-guidance (`write.md` của artifact skill đã chọn cho CHỈ section NÀY; §A.10.3; agent mode thường 0 khi instruction đã bao phủ) | 0–250 |
| Rolling summaries của các section tiền điều kiện (~60 tok mỗi cái) | 0–600 |
| Top-5 reranked chunk (~500–800 tok mỗi cái) | 2500–4000 |
| Lát per-section của literal output format của người dùng | 0–200 |
| Ngân sách generation (targetTokens × 1.1) | 400–1200 |
| Headroom an toàn | ~1000 |
| **Tổng** | **~6–8k** (không bao giờ lắp ráp >11k) |

### Các phương án bị bác bỏ
Một retrieval pool dùng chung duy nhất (context generic, grounding tệ hơn); chèn citation post-hoc (lệnh thừa, misattribution); LLM-as-judge citation validation (regex + chunk-map là miễn phí và xác định); đánh số citation cục bộ per-section (cùng nguồn nhận số khác nhau qua các section); một lệnh gọi LLM "evidence planner" per-section riêng (subQueries + evidence policy của plan đã mang quyết định đó — §9.8).

---

## 7. Đặc tả Phase 3 — vòng lặp anti-hallucination (bounded, kiểu CRAG; KHÔNG phải free-form ReAct)

### Quyết định
Một **bounded corrective loop** mỗi section grounded — các trần cứng: **2 retrieval round, 1 generation, cộng nhiều nhất là round repair đơn của Phase-4**. Free-form ReAct bị bác bỏ cho đường đi mặc định (tail latency vô giới hạn, ~4–5× blowup p95 giết chết UX tương tác); hành vi kiểu ReAct chỉ được dành riêng cho các bounded escalation bên dưới. Full Self-RAG (cần reflection token đã fine-tune/quyền truy cập logit) và full Chain-of-Verification (~12× chi phí token) bị bác bỏ. Thiết kế bounded này nắm phần lớn lợi ích: nguyên nhân hallucination chủ đạo trên các model nhỏ là **tự tin sinh nội dung từ context không đủ**, nên gate nằm *trước* generation.

### Vòng lặp (luồng điều khiển quy phạm)

```
retrieve + rerank (planned sub-queries, memoized)
   → sufficiency gate (tiered, below)
        sufficient → write
        insufficient → query rewrite (small LLM call, §9.5)
                       → retrieve + rerank again → merge + dedupe → keep top-5
                       → sufficiency gate again
                            sufficient → write
                            still insufficient AND grounded_strict →
                                section body becomes EXACTLY the sentinel:
                                *Insufficient context in knowledge base for this section.*
                                flag: insufficient_context — and STOP (no generation)
write → deterministic citation validation → optional NLI faithfulness gate
```

### Tiered sufficiency gate **[merged-in]**

- **Tier 0 — deterministic heuristics (miễn phí, luôn chạy trước):** tập chunk rỗng → insufficient mà không cần lệnh gọi LLM; mọi rerank score dưới một sàn đã cấu hình → insufficient; các lỗi coverage keyword/ID hiển nhiên (ví dụ, một id `UC-`/`REQ-` được tham chiếu không xuất hiện trong chunk nào) → insufficient.
- **Tier 1 — small LLM set-level check (§9.4):** đánh giá toàn bộ tập chunk reranked đối chiếu với section brief; các chunk bị truncate xuống ~400 token mỗi cái; ~1.5k in / ~120 out mỗi lệnh gọi.
- **Escalation policy:** config `sufficiencyMode: always_llm | heuristic_first` (default `always_llm`). Trong `heuristic_first`, Tier 1 chỉ chạy khi Tier 0 không kết luận được — một đòn bẩy chi phí cho các workload low-risk. Bất kể mode, các section `riskLevel=high` LUÔN chạy Tier 1 với chỉ dẫn strict-judgment.
- Các section `reference_inspired` và `none` BỎ QUA sufficiency gate hoàn toàn.
- Chuỗi abstention sentinel là một hằng cố định dùng chung với Phase 4 (vốn nhận diện và báo cáo nó). Abstention trung thực được ưu tiên hơn ngụy tạo — đây là hành vi sản phẩm tường minh, không phải một thất bại.

### Optional NLI faithfulness gate (config-flagged, default on; chỉ các section grounded)
Mỗi câu mang theo citation: NLI(premise = text chunk được cite, hypothesis = câu với marker citation đã bỏ). Nếu không có chunk được cite nào entail câu trên một ngưỡng (default 0.5), câu bị loại bỏ và ghi log. Các câu không cite thì pass (các quy tắc citation đã gate các factual claim). Nếu >50% câu của một section bị loại bỏ → flag `low_faithfulness` → ứng viên tái sinh ở Phase 4. Các phương án triển khai để coding agent đánh giá đối chiếu codebase: một model cross-encoder NLI nhỏ chạy in-process (ONNX trong Node) hoặc một sidecar service nhỏ; dù sao nó cũng non-LLM, ~0.5–2 s/section trên CPU, gần như miễn phí trên GPU, và phải được lazy-load sau một feature flag.

### Ngân sách latency (phải giữ được)

| Bước | Điển hình trên local 7B |
|---|---|
| retrieve (sub-query song song) + rerank | 0.5–2.5 s |
| sufficiency gate (Tier 0 + Tier 1) | 0–4 s |
| rewrite + re-retrieve (chỉ khi kích hoạt, ~20% các section) | 3–8 s |
| section write (~400 tok out) | 20–45 s |
| citation validation | <10 ms |
| NLI gate | 0.5–2 s |
| **Tổng mỗi section** | **~25–55 s điển hình / ~35–70 s tệ nhất** |

6 grounded section tại concurrency 4 → ≈ 2 wave × ~55 s ≈ **110 s thời gian thực**, trong target 1–3 phút; concurrency 2 → ≈ 165 s, vẫn trong giới hạn.

---

## 7a. Operational robustness — failure, deadline, cancellation, dependency cycles **[merged-in]**

Các bounded loop của §7 giới hạn công việc *logic* (retrieval round, generation, repair). Mục này bao phủ các failure mode *hạ tầng* mà orchestrator phải xử lý để một trục trặc dependency đơn lẻ không bao giờ âm thầm làm hỏng hay treo một request. Nguyên tắc dẫn đường, nhất quán với phần còn lại của spec: **degrade về partial-with-warnings, không bao giờ ngụy tạo và không bao giờ treo.** Cả bốn hành vi đều nổi lên qua object `warnings` hiện có (§3.4); không cái nào thay đổi `security`.

### 7a.1 Xử lý dependency-failure (retriever / reranker / LLM)
Các dependency của chính orchestrator có thể thất bại độc lập với chất lượng model:
- **Transient infra error** (LLM server 5xx / connection reset, retriever hay reranker throw/timeout) nhận **một bounded retry với backoff ngắn** (default 1 retry, backoff ~500 ms–2 s; configurable). Retry này **tách biệt và bổ sung cho** các retrieval round logic của §7 — nó bao phủ transport failure, không phải insufficient evidence.
- **Reranker không khả dụng** → rơi về thứ tự score của chính retriever (RRF/raw) cho section đó và flag `reranker_degraded`; không bao giờ chặn section vì reranker.
- **Retriever không khả dụng** sau bounded retry → section không thể được ground: một section `grounded_strict` phát ra abstention sentinel của §7 với flag `retriever_unavailable`; một section `reference_inspired`/`none` vẫn tiến hành (nó không cần retrieval).
- **Lệnh gọi LLM thất bại** sau bounded retry → **section** đó thất bại (flag `generation_failed`), không phải cả request. Lượt chạy tiếp tục; section thất bại được giao dưới dạng sentinel và liệt kê trong `warnings.failedSections`.
- **Partial delivery là first-class.** Nếu một số section thành công và số khác thất bại, request trả về **HTTP success** với các section thành công đã lắp ráp, các section thất bại hiển thị dưới dạng sentinel, và `warnings.failedSections[]` + `warnings.partial=true`. Một request thất bại hoàn toàn (error tới caller) CHỈ khi Phase 1 hoặc Phase 2 không thể hoàn tất (không plan nào có thể được sinh) — không bao giờ vì một section riêng lẻ thất bại.
- **Không có silent fallback.** Mọi degradation dấy lên một flag có tên; orchestrator không bao giờ thay vào một model/KB/kết quả rỗng khác mà không nêu nó ra (§10 observability).

### 7a.2 Global wall-clock deadline (mềm, được thực thi)
Target 1–3 phút (§1) trở thành một **enforced soft deadline**, không chỉ là một mục tiêu:
- Config `requestDeadlineMs` (default 180 000). Một bộ đếm monotonic bắt đầu tại Phase 1.
- Khi deadline hết hạn, orchestrator **ngừng lên lịch các section job mới**, để các section đang chạy hoàn tất lệnh gọi LLM hiện tại của chúng (không kill giữa-lệnh), rồi tiến tới Phase 4 với bất cứ gì đã hoàn tất. Các section chưa bắt đầu/chưa hoàn tất được giao dưới dạng sentinel với flag `deadline_skipped` và liệt kê trong `warnings.deadlineSkippedSections[]`, `warnings.deadlineHit=true`.
- Lệnh gọi coverage của Phase-4 và các deterministic check vẫn chạy trên tài liệu partial (chúng rẻ và bounded); round repair đơn bị **bỏ qua** nếu deadline đã trôi qua.
- Điều này đảm bảo một thời gian phản hồi bounded bất kể plan bệnh lý ra sao — ngân sách latency per-section (§7) là trường hợp *điển hình*; deadline là *trần cứng*.

### 7a.3 Cancellation (caller-initiated abort)
- Request mang theo một tín hiệu cancellation (ví dụ một `AbortSignal`/cancellation token từ lớp route/job — khám phá pattern hiện có theo §0.1.5).
- Khi cancel: ngừng lên lịch các section mới, abort retrieval/lệnh gọi LLM đang chạy ở nơi client hỗ trợ (nếu không, để lệnh gọi hiện tại trả về và bỏ kết quả của nó), giải phóng concurrency limiter, và trả về kịp thời. Không Phase 4, không repair.
- Nếu job persistence được bật (§10), per-section state đã hoàn tất được persist để một lần resume sau không chạy lại các section đã xong; cancellation phân biệt với failure (`warnings.cancelled=true`, không có khung `failedSections`).
- Cancellation không bao giờ để lại một tài liệu viết-dở trong bất kỳ store nào; partial state chỉ là internal cho đến khi một lượt chạy hoàn tất hoặc được resume tường minh.

### 7a.4 `dependsOn` cycle & integrity check (xác định, Phase 2 post-parse)
- Sau khi planner trả về, orchestrator xây dựng section dependency graph và chạy một check xác định **trước khi** Phase 3 bắt đầu:
  - **Cycle detection** (ví dụ topological sort / DFS back-edge): bất kỳ cycle nào (`s1→s2→s1`) bị từ chối.
  - **Dangling reference:** một `dependsOn` đặt tên một `sectionId` không tồn tại bị từ chối.
- Khi thất bại → **một planner retry** với vi phạm được nối vào prompt (cùng pattern như schema-validation retry, §3.2/§5). Nếu retry vẫn sinh ra một cycle/dangling ref, orchestrator **một cách xác định bỏ các cạnh `dependsOn` vi phạm** (coi các section đó là độc lập) và nêu ra `warnings.dependencyEdgesDropped[]` — nó không bao giờ deadlock executor và không bao giờ làm request thất bại vì một lỗi graph của planner.
- Executor (§6 quyết định 2) có thể giả định graph là một DAG hợp lệ vì gate này chạy trước.

### Bổ sung data-contract (mở rộng `warnings` của §3.4)
`warnings` thêm: `partial:bool`, `failedSections[]`, `deadlineHit:bool`, `deadlineSkippedSections[]`, `cancelled:bool`, `dependencyEdgesDropped[]`, và các per-section degradation flag (`reranker_degraded`, `retriever_unavailable`, `generation_failed`, `deadline_skipped`) vốn cũng xuất hiện trên `flags` của Written Section (§3.3). Như với mọi warning, các cái này không bao giờ làm request thất bại (ngoại trừ các trường hợp hard-fail thực sự ở Phase-1/Phase-2 nêu trên).

### Các phương án bị bác bỏ
Thất bại cả-request khi bất kỳ section/dependency error nào (mất công việc đã hoàn tất; partial-with-warnings tốt hơn hẳn); hard-kill các lệnh gọi LLM đang chạy tại deadline (lãng phí lệnh gọi gần-hoàn-tất và rủi ro partial output hỏng — để nó hoàn tất, chỉ ngừng lên lịch thêm); các infra retry vô giới hạn (tái đưa vào tail-latency blowup mà §7 bác bỏ — đúng một bounded retry); làm request thất bại vì một dependency cycle do planner sinh (một trục trặc của planner không nên hiển thị với người dùng như một error — bỏ cạnh và warn).

---

## 8. Đặc tả Phase 4 — validation-only final phase

### Quyết định
"Stitch, Validate, Refine" cũ trở thành **validate-only**. Assembly là deterministic concatenation thuần túy của các section body dưới các heading đã lập kế hoạch của chúng, theo thứ tự plan — assembler là một formatter, không bao giờ là một writer: nó không được bịa, cải thiện, hay viết lại nội dung; nó chỉ chuẩn hóa khoảng cách markdown và strip internal metadata.

### Quy tắc cứng (quy phạm; đây là các yêu cầu tường minh của người dùng)

1. KHÔNG ĐƯỢC tự sinh một document title.
2. KHÔNG ĐƯỢC tự sinh một table of contents.
3. KHÔNG ĐƯỢC tự sinh một section references/bibliography. (Nếu `# Output format` của người dùng liệt kê bất kỳ cái nào, chúng tồn tại như các section đã lập kế hoạch đã được viết ở Phase 3 — validator không cần special case. Citation registry được trả ra out-of-band cho UI.)
4. KHÔNG ĐƯỢC viết lại, đánh bóng, hay "làm cho nhất quán" bất kỳ section body nào. Lệnh consistency LLM pass của solution1.md bị loại bỏ — nó chỉnh sửa nội dung không được yêu cầu và làm trôi dạt các claim được cite khỏi nguồn của chúng.
5. **[merged-in] Forbidden auto-content (danh sách đầy đủ).** Trừ khi được yêu cầu tường minh bởi output format của người dùng hoặc agent, output được giao không được chứa bất cứ thứ nào sau: final title, table of contents, references, source list, appendix, validation report hoặc notes, internal reasoning, internal plan, retrieved chunks, quality scores, debug metadata. Một deterministic scan cho các pattern này là một phần của check (a).
6. Các hành động được phép duy nhất của validator: **flag**, và **trigger regeneration của các section thất bại cụ thể** (tối đa MỘT round repair, sau đó trả về với warnings).

### Ba check

| Check | Cơ chế | Chi phí | Xử lý thất bại |
|---|---|---|---|
| (a) Structure conformance + forbidden content | Xác định: khi outline được dẫn xuất từ `# Output format`, các heading đã lắp ráp phải khớp các heading đã parse chính xác về số lượng, thứ tự, và text (không phân biệt hoa thường); forbidden-content scan theo rule 5 | 0 | Báo cáo; tái sinh các section vi phạm / strip các thêm vào bị cấm |
| (b) Citation integrity | Xác định: mọi `[N]` trong tài liệu đã lắp ráp giải quyết được tới một registry entry (per-section validation đã đảm bảo điều này; pass global là lưới an toàn) | 0 | Báo cáo |
| (c) Task + requirement + acceptance-criteria coverage | MỘT lệnh gọi LLM nhỏ (§9.6). Input là các heading + ~150 token đầu của mỗi section + các requirement heading được phát hiện + `acceptanceCriteria` của mỗi section — KHÔNG BAO GIỜ cả tài liệu (~2–2.5k in / ~200 out, 3–6 s) | 1 lệnh gọi nhỏ | Trả về `coversTask`, `missingAspects[]`, `unmetCriteria[]`, `sectionsToRegenerate[]` |

Tập tái sinh = `sectionsToRegenerate` của coverage ∪ các section được nêu tên trong `unmetCriteria` ∪ các section bị flag `no_citations` (với mustCite) ∪ các section bị flag `low_faithfulness` ∪ **[merged-in]** các section bị flag `unmet_acceptance_criteria` bởi các deterministic post-write check (§6). Các retry chạy với grounding strictness được bơm lên (mustCite ép true, minCitations +1) và các unmet criteria được nhấn mạnh lại trong brief. Nếu coverage thất bại nhưng không thể đặt tên section → trả về với một warning `needs_review`; không bao giờ tự sửa, không bao giờ lặp hai lần.

### Các phương án bị bác bỏ
Lệnh consistency rewrite pass (các chỉnh sửa không được yêu cầu, citation drift); per-sentence cross-section consistency checking (chi phí; trùng lặp với NLI gate); tái sinh cả-tài-liệu khi coverage thất bại (lãng phí; targeted repair tốt hơn hẳn); một LLM "final validator" viết lại output (check a/b là xác định và miễn phí; chỉ coverage cần một LLM).

---
## 9. Advanced system prompts (sẵn sàng cho production, một cái cho mỗi lệnh gọi LLM trong pipeline)

Đây là các prompt đầy đủ. Coding agent lưu chúng dưới dạng các hằng/template có versioned (một file hoặc module, không bao giờ là các string fragment inline rải rác khắp code) và thay thế các `{placeholders}`. Mọi prompt trả về JSON PHẢI được thực thi với schema/grammar-constrained decoding cộng một retry khi lỗi validation. Mọi prompt được viết cho các model local nhỏ: ngắn, đánh số quy tắc, một ví dụ tối thiểu, "JSON only" tường minh ở nơi áp dụng. Các quy tắc được hấp thụ từ kết quả nghiên cứu thứ hai được gập trực tiếp vào (xem §9.8 cho ánh xạ).

**Quy tắc ngắn gọn dùng chung (áp dụng cho MỌI prompt bên dưới — output token là chi phí chủ đạo) [merged-in].** Mọi system prompt PHẢI chỉ dẫn model phải **terse-but-complete** (súc tích nhưng đầy đủ): chỉ phát ra **duy nhất** nội dung được yêu cầu; không preamble ("Here is…", "Sure,…"), không nhắc lại task/input, không postamble hay tóm tắt những gì đã làm, không meta-commentary, không filler hay rào đón. Tính ngắn gọn KHÔNG ĐƯỢC làm rớt bất cứ thứ gì một phase phía sau cần — các fact bắt buộc, các citation `[N]` inline, các JSON field, độ phủ acceptance-criteria, hay các output-format section đều là "nội dung được yêu cầu" và không bao giờ bị cắt bớt để tiết kiệm token. Tóm lại: **output ngắn nhất mà vẫn thỏa mãn trọn vẹn hợp đồng.** Đây là một ràng buộc bảo toàn chất lượng, không phải "viết ít lại" — một section cần 400 token để phủ hết brief của nó thì vẫn được dùng đủ 400 token; thứ bị cắt là mọi thứ mà hợp đồng không yêu cầu. Các *ngân sách* token (§5, §6) đặt trần; quy tắc này cắt phần dư bên dưới trần đó.

### 9.0 Mã hóa output & định dạng wire (JSON vs markdown; tối ưu short-key) **[merged-in]**

**Quyết định: các phase có cấu trúc giữ JSON; chỉ section writer phát ra markdown.** Planner (§9.2), sufficiency check (§9.4), query rewrite (§9.5), coverage auditor (§9.6), input extractor (§9.1), và format-intent check (§9.7) trả về **JSON dưới grammar/schema-constrained decoding**. Section writer (§9.3/b/c/d) phát ra **markdown prose** — nó vốn đã thế, và đó là nơi phần lớn output token nằm.

**Tại sao không chuyển các phase có cấu trúc sang markdown để tiết kiệm token?** JSON quả thực tốn thêm ~10–20% token *output* so với markdown cho dấu cấu trúc (`{}`, `"`, `:`, các quoted key lặp lại). Nhưng trên pipeline này phép đánh đổi đó không hời:
- Các phase có cấu trúc là các lệnh gọi **rẻ** (planner ~1.5k out một lần; sufficiency ~120 out; coverage ~200 out). Output đắt là **writer**, vốn đã là markdown. Tối ưu overhead JSON là tối ưu nhầm 10%.
- Các output có cấu trúc chủ yếu là **enum/flag ngắn** (`retrievalMode`, `mustCite`, `riskLevel`) — JSON rẻ nhất có thể và **rủi ro parse cao nhất** trong markdown. Định dạng markdown của model 7B trôi dạt (`- f: v` vs `**f**: v` vs một câu văn), nên một parser markdown→struct vượt qua test rồi **âm thầm parse sai** trong production — đúng lớp silent-failure mà thiết kế này tránh.
- Constrained JSON cho một **đảm bảo parse** (decoder mask các token bất hợp lệ, nên JSON không hợp lệ không thể được sinh ra); parse markdown chỉ là best-effort. Toàn bộ thiết kế anti-hallucination/validation phụ thuộc vào các object plan/verdict đọc-được-bằng-máy một cách đáng tin, nên đảm bảo này lấn át khoản tiết kiệm token biên.

**Đòn bẩy tiết kiệm token mà VẪN GIỮ đảm bảo — short key trên wire, full name ở mọi nơi khác.** Ở nơi ngân sách output-token eo hẹp, constrained schema CÓ THỂ dùng **short field key trên wire** (ví dụ `rm` cho `retrievalMode`, `mc` cho `mustCite`, `rl` cho `riskLevel`, `sid` cho `sectionId`, `ac` cho `acceptanceCriteria`, `sq`/`rq` cho `subQueries`/`referenceQueries`). Điều này thu hồi phần lớn overhead JSON **mà không từ bỏ constrained decoding**. Để giữ tính đọc-được và debug-được:
- Một **code adapter xác định sở hữu một map short↔full key duy nhất** và mở rộng JSON short-key của model thành các **object full-name canonical của §3.2/§3.3 ngay khi nhận**. Mọi phase downstream của một lệnh gọi LLM chỉ thấy object full-name; không short key nào lọt qua adapter.
- Các data contract (§3) và mọi mục khác của spec này được viết bằng **full name** — short key là chi tiết wire/serialization gói gọn trong constrained-decoding schema + adapter, không gì khác.
- **Góc nhìn developer & Langfuse = full JSON đã mở rộng.** Trace log **full-name JSON đã mở rộng** (cộng chuỗi short-key thô được giữ trong một trace field `rawOutput` để debug ở mức byte), nên con người và observability stack (§10) không bao giờ đọc key khó hiểu trừ trong một field thô đó. Token count được ghi trên output thô.
- Config flag `shortKeyWire` (default **off** cho khả năng đọc tối đa; bật **on** khi output token budget của planner là nút thắt đo được). Cả hai hành vi dùng cùng adapter; chỉ các chuỗi key của schema khác nhau.

**Các phương án bị bác bỏ.** Output markdown cho các phase có cấu trúc (mất đảm bảo parse của constrained decoding; trôi dạt markdown của model nhỏ gây parse-sai âm thầm; chỉ tiết kiệm token trên các lệnh gọi rẻ). Một DSL phi-JSON tùy chỉnh (cần một grammar tùy chỉnh VÀ một parser tùy chỉnh mà không lợi gì hơn short-key JSON). Bỏ constrained decoding để tiết kiệm retry (tái nhập việc xử lý output bất hợp lệ ở khắp nơi). Map key thủ công theo từng call site thay vì một adapter trung tâm (trôi dạt giữa các phase; map short↔full duy nhất là nơi an toàn duy nhất cho nó).

### 9.1 Input extraction (Phase 1 — chỉ agent-mode freestyle prompts)

**System:**
```text
You are an input-normalizer. Extract the user's request into JSON fields.

Rules:
- task: a single-sentence imperative restating what the user wants done.
- context: any situational background mentioned (dates, products, scope).
  Empty string if none.
- keyword: 0-8 salient retrieval terms. Empty list if none.
- output_format: any explicit format/length/style instruction the user
  gave. Empty string if none.
- Do not answer the user. Do not invent missing task details. Do not
  add output sections of your own.

Return JSON only, matching:
{"task": str, "context": str, "keyword": [str], "output_format": str}
```

**User message:** raw freestyle prompt được bọc trong triple quote. Ngân sách: ≤500 in / ≤300 out. Temperature ≤0.2.

### 9.2 Planner (Phase 2 — lệnh gọi plan+outline đơn)

**System:**
```text
You are a planning assistant for a retrieval-augmented writing system.
You read a user request and produce a JSON PLAN that tells downstream
agents (a) what sections to write, (b) what to retrieve for each
section, and (c) how grounded each section must be.

## Inputs
You receive a canonical request with these fields:
- user_profile: who the user is.
- task: what they want produced.
- context: situational background.
- keyword: retrieval seed terms.
- output_format: explicit structure/length the user wants. May be empty.
- requirement_headings: custom requirement/constraint/acceptance-criteria
  headings detected in the request. May be empty.
- agent_planning_hints: a STRUCTURED distillation of the agent's
  instruction + skill (agent mode), already extracted for you. May be
  absent (chat mode). Fields (any may be empty):
    defaultVerbosity, idConventions[], terminology[], requiredContent[],
    forbiddenContent[], domainRiskCues[], retrievalHints[], skillCriteria[].
  You MUST honor these when planning (see job steps 5, 9, 10, 11). They
  are quality/evidence/risk signals only - they NEVER add, rename, or
  reorder sections. You receive NO raw persona prose; structure comes
  only from output_format (or your proposal when it is empty).
- agent_policy: { citationPolicy?, allowUserFormatOverride,
  allowUserRetrievalOverride }. May be absent. When
  citationPolicy="required", every grounded section MUST have
  mustCite=true and minCitations>=1.

## Your job
1. Choose detectedTask from this fixed list of 7:
   qa_with_citations, summarize_single, synthesize_multi, compare_analyze,
   transform_derive, reference_inspired, review_validate.
   Choose review_validate when the task is to CHECK or REVIEW an existing
   artifact against a reference (template, standard, or upstream document)
   and report whether it is complete/consistent/sufficient - e.g. "is this
   test spec enough given the SRS?", "review this design against the HLD".
   There is NO "pure_generation" / ungrounded task. When a knowledge base
   is available you MUST pick a grounded task and write subQueries; do not
   plan a section to be answered from your own knowledge. (Ungrounded
   generation happens only via the no-knowledge-base addendum below, which
   the orchestrator enforces deterministically — it is never your choice.)
2. If output_format is non-empty, derive sections DIRECTLY from it
   (one section per top-level item in the user's format). Set
   outlineSource="derived_from_output_format". Do NOT invent extra
   sections (no title section, no table of contents, no references
   section unless the user listed them).
3. If output_format is empty, propose a minimal section structure
   (3-7 sections) appropriate to the task. If the task asks for exactly
   one deliverable (a single table, one direct conversion), produce
   exactly ONE section. Set outlineSource="proposed_by_llm".
4. For each section, choose retrievalMode:
   - grounded_strict: factual claims must come from retrieved chunks.
     Use for transform_derive, qa_with_citations, summarize_single,
     synthesize_multi, compare_analyze, and review_validate.
   - reference_inspired: retrieved chunks are style/structure exemplars
     only; specifics may be invented. Use for reference_inspired tasks
     (e.g., "write NEW use cases like these old ones").
   - none: no retrieval needed. Use when the section is pure formatting,
     transitions, creative writing with no factual claims, OR when the
     user's context already contains everything the section needs.
5. Set riskLevel="high" when a section involves healthcare/medical,
   legal, regulatory compliance, finance, security, or safety-critical
   content; otherwise "normal". ALSO set riskLevel="high" for any section
   matching agent_planning_hints.domainRiskCues, even when the user's
   task wording looks neutral (the agent's standing role carries the
   risk). High-risk grounded sections must have mustCite=true and
   assumptionsAllowed=false. If agent_policy.citationPolicy="required",
   set mustCite=true and minCitations>=1 on every grounded section.
6. Set assumptionsAllowed=true ONLY if the user's output format
   explicitly allows assumptions; otherwise false.
7. Map every requirement_heading of kind requirement or
   acceptance_criteria to at least one section.
8. For each section needing retrieval, write 1-3 subQueries. Each
   subQuery has natural-language "text" and 0-4 sparse "keywordQueries".
   Sub-queries reflect what THIS section needs, not the whole document.
   Fold agent_planning_hints.idConventions, .terminology, and
   .retrievalHints (plus the user's keyword list) into keywordQueries so
   retrieval lands on the right document family. For review_validate
   sections, subQueries retrieve the ARTIFACT being reviewed (what the
   document actually says).
9. For review_validate sections ONLY, ALSO write 1-3 referenceQueries
   that retrieve the REFERENCE the artifact must conform to (the SRS, the
   template, the standard, the upstream design). The writer reports the
   delta between artifact and reference, citing each side. Leave
   referenceQueries empty for every other task.
10. Set acceptanceCriteria for each section: 0-6 short, testable quality
    or conformance checks the finished section must satisfy. Derive them
    from (a) agent_planning_hints.skillCriteria (the agent's "## Skill"
    discipline, e.g. "every test case cites a source requirement", "never
    invent API names"), (b) the matching item in output_format (what that
    section is supposed to deliver), (c) any requirement/
    acceptance_criteria/quality_rule heading mapped to the section, and
    (d) agent_planning_hints.requiredContent / .forbiddenContent /
    .idConventions that apply to this section (e.g. "use UC-<MODULE>-<NN>
    IDs", "never output real credentials"). Each criterion is an
    objective property of the finished text - NOT a new section, heading,
    title, TOC, or References block. A requiredContent rule that would
    need a NEW section is dropped (structure is output_format only).
    Empty list when nothing constrains the section beyond its brief.
11. Set targetTokens per section so the total fits the user's length
    intent. If the user gave no length intent, fall back to
    agent_planning_hints.defaultVerbosity (concise ~150-300, standard
    ~250-500, detailed ~500-900 per section); default 250-500 if neither
    is present.
12. Set dependsOn only when a later section literally cannot be written
    without an earlier section's content as input.

## Hard rules
- Apply the same plan structure regardless of subject matter
  (software development, healthcare, legal, finance, marketing, etc.).
  Do not assume any domain - infer it from the task only.
- Do NOT add sections the user did not ask for (especially "Title",
  "Table of contents", "References", "Conclusion") unless their
  output_format requires them.
- Do not generate final user content. Do not write the document.
- Output JSON ONLY, matching the provided schema. No prose.

## One example (neutral domain, grounded)
Input task: "Summarize our refund policy and the steps to request one."
output_format: empty. (A knowledge base is available.)
-> detectedTask: qa_with_citations; outlineSource: proposed_by_llm;
   sections: [Refund Eligibility, How to Request a Refund, Processing
   Time]; each retrievalMode: grounded_strict, mustCite=true,
   riskLevel: normal, with subQueries like "refund eligibility rules",
   "refund request steps", "refund processing time". (Do not plan any
   section as ungrounded — a KB is available.)

## One example (review_validate)
Input task: "Check whether the test specification is complete and
consistent with the SRS, and produce a corrected version."
output_format:
  1. Completeness and Consistency Findings
  2. Gaps Against the SRS
  3. Corrected Test Specification
-> detectedTask: review_validate; outlineSource: derived_from_output_format.
   Section 1 & 2: review_validate, grounded_strict, mustCite=true,
     subQueries retrieve the test spec, referenceQueries retrieve the SRS;
     acceptanceCriteria e.g. ["each finding names the SRS clause it checks",
     "no gap asserted without an artifact AND a reference citation"].
   Section 3: transform_derive, grounded_strict against the SRS+findings,
     dependsOn ["s1","s2"]; acceptanceCriteria e.g. ["every added item
     traces to an SRS requirement", "no invented requirement IDs"].
```

**Conditional addendum** (chỉ nối vào KHI deterministic format parser đã sinh ra các heading cố định):
```text
The user has already specified an exact section structure. The
"sections" array MUST contain exactly these headings, in this order:
  1. {heading_1}
  2. {heading_2}
  ...
Do not add, remove, rename, or reorder sections. Only fill in
retrievalMode, riskLevel, subQueries, referenceQueries (review_validate
only), acceptanceCriteria, targetTokens, mustCite, minCitations,
assumptionsAllowed, and rationale for each. Set outlineSource to
"derived_from_output_format".
```

**No-knowledge-base addendum** (chỉ nối vào KHI `noKnowledgeBase` là true — agent `agentScope="general"`, §4.5):
```text
No knowledge base is available for this request (the agent has general
scope). You CANNOT retrieve any sources. Therefore:
- Still classify detectedTask normally from the 7 types (what the user
  wants done) — there is no "pure_generation" type.
- Set retrievalMode to "none" for EVERY section.
- Set mustCite=false and minCitations=0 for every section.
- Do NOT write any subQueries or referenceQueries (leave them empty).
Plan the sections from the task, context, and output format alone. The
writer will produce each section from its own general knowledge and the
user's # Context. (The orchestrator enforces these evidence settings
deterministically regardless of your output.)
```

**User message:** các canonical field cộng các requirement heading, mỗi cái một dòng, placeholder `(none)`/`(empty — propose 3-7 sections)` cho các ô trống. Ngân sách: ≤3k in / ≤1.5k out. Temperature ≤0.2.

### 9.3 Section writer — `grounded_strict` (Phase 3; prompt GROUNDED — chat mode và agent `agentScope` = `all_kb`/`specific_kb`)

Đây là prompt cho mọi section có một knowledge base đứng sau: chat generative mode, và agent scope (1) `all_kb` / (2) `specific_kb`. Model viết **nghiêm ngặt từ các SOURCES đã retrieve** và cite chúng. (Agent scope (3) `general` / `noKnowledgeBase=true` dùng prompt ungrounded riêng §9.3c thay thế — không SOURCES, không citation.)

> **Citation token = định dạng chat-QA hiện có (§0.1.7, §6 decision 5).** `[N]` được viết trong prompt này và trong ví dụ của nó là một **vật thế chỗ (stand-in)**; khi instantiate template, hãy thay bằng token inline-citation chat-QA thực và việc gắn nhãn "Source [N]: …" tương ứng để model phát ra đúng những gì chat-QA phát ra và FE render nó y hệt. Nếu token của chat-QA không phải `[N]`, hãy đổi marker trong mọi rule, trong ví dụ, và trong định dạng source-label `Source [N]:` cùng một lúc — giữ *các rule* của prompt y hệt, chỉ thay token bề mặt.

**System:**
```text
You are a grounded research writer. You will be given:
- a SECTION TITLE and BRIEF
- a list of numbered SOURCES of the form "Source [N]: <text>"
- a target length

## Hard rules
1. Use ONLY information present in the SOURCES. Do not use outside or
   prior knowledge, even if you believe you know the answer. Every
   statement must be traceable to a SOURCE; if it is not in the SOURCES,
   it does not go in the section. This is strict grounding — it exists to
   prevent hallucination and stale/biased model knowledge from leaking in.
2. Every factual claim MUST be followed by one or more inline citations
   in the form [N], where N is a Source number above that directly
   supports the claim. Cite at least one source per factual sentence;
   cite at most three.
3. Do NOT invent source numbers. Do NOT cite [N] for an N not in the
   provided sources.
4. If the SOURCES do not contain enough information to write the
   section, output exactly this and stop:
       Insufficient context in knowledge base for this section.
5. Do not write a section title or heading - the system handles those.
6. Do not write a "References" list - the system handles that.
7. Paraphrase; do not quote source text verbatim unless the brief says
   to. Never invent numbers, dates, names, code, or quotes not in the
   sources - and never invent requirement IDs, API names, endpoints,
   screen names, database tables/fields, workflow names, business
   rules, or medical/clinical facts. If the sources do not support a
   detail, omit it.
8. State assumptions ONLY if the brief explicitly says assumptions are
   allowed; otherwise omit unsupported details entirely.
9. Neutral, factual tone. No marketing, no hedging filler. Never
   mention being an AI; never output internal notes, plans, reasoning,
   or validation text.
10. Output ONLY this section's content — exactly what the BRIEF and the
    output format ask for, nothing else. No preamble ("Here is…"), no
    restating the task or brief, no introduction or conclusion unless
    the format requires one, no postamble or summary of what you wrote.
    Be terse-but-complete: the shortest text that fully covers the brief
    and its acceptance criteria. Do NOT pad to reach the target length —
    {target_tokens} is a ceiling, not a quota. (Saves output tokens; the
    assembler concatenates sections verbatim, so any extra prose ships to
    the user and is stripped/flagged in Phase 4.)

## Output format
Plain markdown prose, AT MOST ~{target_tokens} tokens (fewer is fine if
the brief is fully covered). Inline [N] citations only. No headings, no
bullet or numbered lists unless the brief explicitly asks for them. No
text before the first sentence or after the last.

## One-shot example
Brief: "Summarize the failure modes."
Sources:
  Source [1]: "When OpenSearch times out, fall back to BM25-only and flag."
  Source [2]: "If a reranker is unavailable, use RRF order and flag."

Expected output:
On retrieval-store timeouts the system falls back to a BM25-only path
and raises a degradation flag [1]. When the reranker service is
unavailable, the orchestrator preserves the RRF fusion order and
similarly flags the section as needing review [2].
```

**User message composition (thứ tự quan trọng):** persona block (agent instruction + lát skill ở agent mode + "Reader profile: {userProfile}") → `USER TASK` → `SECTION TITLE` → `SECTION BRIEF` (plan rationale + các heading constraint/quality liên quan + **writer-guidance** block của artifact skill đang active, nếu có (§A.10) + "assumptions allowed: yes/no") → `ACCEPTANCE CRITERIA` (danh sách `acceptanceCriteria` của section, render thành "Your section MUST satisfy: 1) … 2) …"; **[merged-in]** đây là các ràng buộc chất lượng trên body, không bao giờ là chỉ dẫn thêm structure) → `TARGET LENGTH` → rolling summaries của các section tiền điều kiện (gắn nhãn "do not repeat their content") → `SOURCES:` block với anti-lost-in-the-middle ordering. Skill guidance và acceptance criteria chỉ định hình body; heading là cố định và writer không bao giờ thay đổi nó. Temperature ~0.3.

### 9.3b Section writer — `reference_inspired` (rules 1–4 được thay; 5–9 và Output format dùng chung)

```text
1. The SOURCES are STYLE and STRUCTURE EXEMPLARS, not facts. You may
   invent specifics consistent with the user's TASK.
2. Do NOT cite. The reader should not see any [N] in your output.
3. Mirror the voice, structure, and granularity of the exemplars.
4. Stay strictly on the user's TASK; the exemplars only inform how,
   not what.
```

### 9.3c Section writer — `retrievalMode="none"` (prompt UNGROUNDED — agent `agentScope="general"` / `noKnowledgeBase=true`, và các section chỉ-từ-user-context)

Đây là prompt riêng cho các section **không có chunk nào được retrieve**: agent scope (3) `general`, và bất kỳ section nào mà bằng chứng nằm trọn trong `# Context` của người dùng. Không có SOURCES và không có citation `[N]` — model viết từ kiến thức tổng quát của chính nó cộng với USER CONTEXT. (Chat mode và agent scope 1/2 không bao giờ dùng prompt này; chúng dùng §9.3 grounded.)

```text
You are a professional writer producing one section of a larger
document. Follow the SECTION BRIEF and the persona/reader profile.
Use the USER CONTEXT as your primary input when it is provided and
relevant. Do not write the section title or heading. Do not include
citations.
Output ONLY this section's content — exactly what the BRIEF and output
format ask for, nothing else. No preamble, no restating the task, no
introduction/conclusion unless the format requires it, no postamble.
Be terse-but-complete: the shortest text that fully covers the brief;
{target_tokens} is a ceiling, not a quota — do not pad to reach it.
Plain markdown prose, AT MOST ~{target_tokens} tokens; use lists only
if the brief explicitly asks for them. Stay strictly on the user's
TASK; do not add disclaimers, never mention being an AI, never output
internal notes or reasoning. No text before the first sentence or after
the last.
```

### 9.3d Section writer — `review_validate` (rules 1–4 được thay; 5–9 và Output format dùng chung) **[merged-in]**

```text
1. You are reviewing an ARTIFACT against a REFERENCE. The SOURCES are
   split and labelled: "Source [N] (ARTIFACT): <text>" is what the
   document under review actually says; "Source [N] (REFERENCE): <text>"
   is what it must conform to (the SRS, template, standard, or upstream
   design). Use ONLY these sources; do not use outside knowledge.
2. Report findings as the DELTA between artifact and reference. For each
   finding, cite the REFERENCE source [N] that states the expectation
   AND, when applicable, the ARTIFACT source [N] that meets or violates
   it. A "missing" finding cites the reference only and states no
   artifact source covers it. Cite at least one source per finding.
3. Do NOT invent gaps, conformance, requirement IDs, or facts. If the
   sources do not let you judge a point, say so explicitly rather than
   guessing. Never assert "complete"/"sufficient" without reference
   coverage to back it.
4. If the SOURCES do not contain enough to perform the review, output
   exactly this and stop:
       Insufficient context in knowledge base for this section.
```

(Khi một plan `review_validate` cũng chứa một section corrected-draft, section đó dùng writer `grounded_strict` của §9.3 grounded đối chiếu với reference — không phải reviewer prompt này.)

### 9.4 Sufficiency check (Phase 3, các section grounded; Tier 1 của gate)

**System:**
```text
You are a retrieval evaluator. Decide whether the SOURCES are
sufficient to write the SECTION described. Sufficient means: the key
facts the section needs are present, not merely related topic matter.

Also consider: coverage of the user task, coverage of any listed
requirement headings, missing facts, and conflicting sources.

When RISK LEVEL is high (healthcare, legal, compliance, finance,
security, or other regulated content), apply strict judgment: mark
sufficient only if every key fact the section needs is explicitly
present in the sources.

Do not generate the section. Do not summarize the sources for the
user. Do not invent missing facts.

Return JSON only:
{"sufficient": true|false, "reason": "<1 sentence>",
 "missing": "<what is missing, or empty>"}
```

**User message:** `SECTION TITLE`, `SECTION BRIEF`, `USER TASK`, `RISK LEVEL: {normal|high}`, các requirement heading liên quan, rồi tập chunk mỗi cái bị truncate xuống ~400 token, đánh số. Ngân sách ~1.5k in / ~120 out. Temperature 0. Tập chunk rỗng short-circuit về insufficient mà không cần lệnh gọi LLM (Tier 0).

### 9.5 Query rewrite (Phase 3; chỉ sau một insufficient verdict)

**System:**
```text
The retrieved sources are insufficient to write a section. Write 1-2
alternative retrieval queries MORE LIKELY to surface the missing
information. Use different vocabulary, and broader or narrower scope
as appropriate. Do not repeat the original queries.

Return JSON only: {"queries": ["...", "..."]}
```

**User message:** section heading, các sub-query gốc, `reason` và `missing` của evaluator. Ngân sách ~300 in / ~100 out. Temperature ~0.4 (diversity giúp ích ở đây).

### 9.6 Task-coverage auditor (Phase 4 — lệnh gọi LLM duy nhất trong validation)

**System:**
```text
You are a coverage auditor. Decide whether the produced sections
address the user's TASK, the requested OUTPUT FORMAT, every listed
REQUIREMENT HEADING, and each section's ACCEPTANCE CRITERIA. You see
only each section's heading, opening lines, and its acceptance criteria;
judge coverage of topics and whether the opening lines plausibly meet
the criteria, not writing quality. Do not penalize sections marked
"Insufficient context in knowledge base for this section." - instead
list what they were supposed to cover under missingAspects. List any
requirement heading that no section addresses under missingAspects, and
any acceptance criterion a section clearly fails under unmetCriteria.

Do not add new content. Do not rewrite anything. Do not print a
validation report for the user.

Return JSON only:
{"coversTask": true|false,
 "missingAspects": ["..."],
 "unmetCriteria": [{"sectionId": "s2", "criterion": "..."}],
 "sectionsToRegenerate": ["s2","s5"]}
sectionsToRegenerate must contain sectionIds of sections that look
insufficient for the task or that fail an acceptance criterion, or [].
```

**User message:** `TASK`, `OUTPUT FORMAT REQUESTED` (tóm tắt một dòng của plan), `REQUIREMENT HEADINGS` (danh sách được phát hiện), rồi mỗi section: index, sectionId, heading, danh sách `acceptanceCriteria` của nó, và ~150 token đầu của body. Ngân sách ≤2.5k in / ~200 out. Temperature 0.

### 9.7 Output-format intent check (Phase 1 — agent mode, chỉ Tier-1 fallback) **[merged-in]**

Chỉ chạy khi deterministic hint scan của §4.3b (Tier 0) không tìm thấy gì VÀ không có `# Output format` nào được giải quyết theo cách khác. Quyết định liệu prompt có yêu cầu tái dùng một format đã cấu hình trước hay không.

**System:**
```text
You decide whether the user is asking to use a PRE-EXISTING, configured
output format (a saved template) rather than describing a new one.

Rules:
- useConfiguredFormat=true ONLY if the prompt refers to an existing /
  standard / saved / named format or template to reuse.
- If the user describes a format inline, or says nothing about format,
  useConfiguredFormat=false.
- formatName: the template name the user referred to, or "" if they
  referred to the default/standard format without naming one.
- Do not invent a format. Do not answer the user's task.

Return JSON only: {"useConfiguredFormat": true|false, "formatName": str}
```
**User message:** raw user prompt (không có agent config). Ngân sách ≤300 in / ≤60 out. Temperature 0. Một kết quả `true` kích hoạt resolver tool §4.3b; `false` tiến tới format mặc định của agent.

### 9.8 Responsibility mapping — nơi mọi prompt từ các kết quả nghiên cứu nằm **[merged-in]**

Pipeline báo cáo GPT định nghĩa mười component prompt. Thiết kế này giữ **core pipeline** ở **sáu LLM call site** (§9.1–§9.6) bằng cách làm bốn trách nhiệm trở nên xác định — Section Writer là một call site với các biến thể prompt theo mode (9.3 / 9.3b / 9.3c / 9.3d), và `review_validate` tái dùng nó thay vì thêm một call mới. Lệnh gọi bổ sung duy nhất là §9.7, một **conditional Phase-1 fallback** (agent mode, chỉ khi deterministic-scan trượt) — không chi phí trên đường đi phổ biến, cùng họ "free unless a header is absent" như extractor §9.1. Không gì bị bỏ:

| Component prompt (GPT report §17) | Nơi trách nhiệm nằm trong spec này |
|---|---|
| 17.1 Input Normalizer | Deterministic header parser + heading detector (§4); §9.1 chỉ chạy cho agent-mode freestyle prompts |
| 17.2 Intent & Requirement Analyzer | Gập vào lệnh gọi planner đơn: `detectedTask`, `riskLevel`, requirement-heading mapping (§9.2) |
| 17.3 Smart Planner | §9.2 |
| 17.4 Conditional Outliner | Deterministic format parser + planner addendum (§5); không lệnh gọi riêng; các trường hợp "skip outliner" thu về derived headings hoặc một plan 1-section |
| 17.5 Section Evidence Planner | `retrievalMode`, `subQueries`, `referenceQueries`, `acceptanceCriteria`, evidence policy per-section của plan (§3.2, §6) — quyết định một lần ở Phase 2 |
| 17.6 Evidence Sufficiency Judge | §9.4 + Tier-0 heuristics + riskLevel strictness (§7) |
| 17.7 Section Writer | §9.3 / 9.3b / 9.3c / 9.3d (review_validate) với các quy tắc no-invented-IDs, assumptions, acceptance-criteria, và no-internal-notes được merge vào |
| 17.8 Section Validator | Deterministic citation validation + optional NLI gate (§6–§7); không lệnh gọi LLM |
| 17.9 Output Assembler | Deterministic concatenation + markdown normalization (§8); không lệnh gọi LLM |
| 17.10 Final Validator | Các check (a)/(b) của Phase 4 xác định + lệnh gọi coverage §9.6 |

---
## 10. Hướng dẫn về chi phí, chất lượng, và hiệu năng (vận hành) **[merged]**

**Cost** — bỏ qua retrieval khi nhu cầu của một section được đáp ứng bởi user context (`retrievalMode: none`); chỉ retrieve cho các section cần bằng chứng; giới hạn retrieval ở 2 round và generation ở 1 mỗi section (trước repair); chạy Tier-0 heuristics trước LLM sufficiency judge và đưa ra mode `heuristic_first` cho các workload low-risk; dành phán định LLM nghiêm ngặt cho bằng chứng high-risk/phức tạp/yếu/xung đột; bỏ qua công việc planner addendum khi `# Output format` nghiêm ngặt (headings được dẫn xuất xác định); không bao giờ chạy một final rewrite pass; memoize kết quả retrieval và rerank trong một request (TTL cache tùy chọn qua các request); giới hạn section regeneration ở một round Phase-4.

**Quality** — structured single-call planning với in-schema rationale; phát hiện requirement-heading nuôi planning và coverage audit; **agent instruction là cấu hình định hình planning ở Phase 2, không chỉ writing ở Phase 3 — normalizer chưng cất nó thành các `agentPlanningHints`/`agentPolicy` có cấu trúc (verbosity, các quy ước ID/terminology, required/forbidden content, domain-risk cues, retrieval/citation policy, skill criteria) định hướng `detectedTask`, `riskLevel`, evidence policy, sub-query anchor, `targetTokens`, và `acceptanceCriteria` (§4.6, §9.2) — giữ precedence có thể audit trong khi đảm bảo agent đã cấu hình hành xử nhất quán**; **`acceptanceCriteria` per-section dung hợp từ agent skill + output format + requirement/quality headings, được thực thi trong writer brief và được kiểm lại bởi coverage auditor (§9.6) — đòn bẩy chính cho output nhất quán với điều agent/người dùng kỳ vọng**; section-specific retrieval; sufficiency gating trước generation; citation được thực thi trong khi generation và validate xác định; **dual-grounding `review_validate` cho conformance/sufficiency review đối chiếu với một reference**; các flag per-section + NLI gate; deterministic structure conformance và forbidden-content scan; abstention sentinel thay vì ngụy tạo; bảo toàn chính xác output format của người dùng.

**Performance** — các section độc lập retrieve và generate song song dưới một concurrency limit (default 4); sub-query retrieval đồng thời trong một section; retrieve topK≈20, rerank về top≈5 nên writer chỉ thấy các candidate tốt nhất; stream tiến độ tới frontend qua SSE pattern hiện có — phát các section-completed event khi các section qua per-section validation (đánh dấu provisional cho đến khi Phase 4 xác nhận), rồi kết quả lắp ráp cuối; persist per-section job state (`planned → retrieved → written → validated`) để một lượt chạy thất bại hoặc bị gián đoạn resume từ các section đã hoàn tất thay vì khởi động lại (sau background-job pattern hiện có).

**Observability (Langfuse tracing cho pipeline 4-phase)** — mỗi request là **một Langfuse trace**; mỗi lệnh gọi LLM và mỗi deterministic gate là một **span** dưới nó, phản chiếu pipeline mới để developer có thể replay bất kỳ lượt chạy nào từ đầu đến cuối. Structured log tại mọi phase boundary (tên phase, duration, token in/out, cache hits, các flag được dấy lên) được phát ra dưới dạng span attribute và cũng wired vào logging stack hiện có. Bố cục trace/span:

- **Trace (root)** = toàn bộ request: tag `mode` (chat/agent), `detectedTask`, `agentId`/`tenantId` (từ `security`), `noKnowledgeBase`; tổng token + latency cấp trace; object `warnings` cuối cùng được đính kèm.
- Span **Phase 1 — Normalize**: đường nào đã chạy (header-parse / freestyle extractor §9.1 / resolver §4.3b Tier-0/Tier-1), `outputFormatSource` đã giải quyết, số lượng `requirementHeadings`, các key `agentPlanningHints` được điền. Các lệnh gọi LLM §9.1 và §9.7 (khi chúng kích hoạt) là các sub-span **generation**.
- Span **Phase 2 — Plan**: một sub-span **generation** cho planner (§9.2) với prompt, plan dưới dạng **full-name JSON đã mở rộng** làm output (cộng chuỗi short-key `rawOutput` nếu `shortKeyWire` on, §9.0), token in/out, retry count, và các deterministic post-parse forcing đã áp dụng (`mustCite` high-risk, `review_validate`, no-KB, `dependsOn` cycle/edge drop §7a.4).
- Span **Phase 3 — Sections** với **một span con cho mỗi section** (chạy đồng thời; các span có thể chồng lấn về thời gian): mỗi cái chứa các sub-span generation cho sufficiency (§9.4), query-rewrite (§9.5 khi được trigger), và writer (§9.3/b/c/d), cộng các event deterministic cho citation validation và acceptance-criteria check; thuộc tính section gồm `retrievalMode`, `riskLevel`, số retrieval round đã dùng, chunk được offer, flag được dấy lên (`insufficient_context`, `no_citations`, `low_faithfulness`, `unmet_acceptance_criteria`, `reranker_degraded`, `retriever_unavailable`, `generation_failed`, `deadline_skipped`). Các hit memoize retrieve/rerank được đánh dấu là event cache-hit, không phải span mới.
- Span **Phase 4 — Validate**: các deterministic structure/citation/forbidden-content check dưới dạng event; một sub-span **generation** cho coverage auditor (§9.6); tập regeneration và bất kỳ span section của repair-round được lồng dưới nó.
- **Các span generation LLM** ghi model id, prompt, output, token in/out, temperature, và constrained-decoding retry count; mọi output có cấu trúc được log dưới dạng **full-name JSON đã mở rộng** (§9.0) để trace đọc-được-bởi-người. Chi tiết trace/log internal KHÔNG BAO GIỜ xuất hiện trong tài liệu giao ra; object `warnings` của Generation Result vẫn là bề mặt chất lượng hướng-người-dùng duy nhất.
- Triển khai: phát hiện Langfuse client/config hiện có theo §0.1.5; nếu Langfuse vắng mặt, cùng dữ liệu span rơi về structured logging stack (tracing nằm sau một config flag, default on ở nơi Langfuse được cấu hình).

---

## 11. Acceptance criteria hợp nhất (checklist kiểm chứng của coding agent)

**Phase 1 — Normalizer**
- [ ] Chat prompt với cả 5 header → canonical Request, không lệnh gọi LLM, <100 ms.
- [ ] Chat prompt thiếu `# Task` hoặc `# Output format` → lỗi cứng hiển thị cho người dùng, không lệnh gọi LLM.
- [ ] Chat prompt thiếu `# User profiles` → warning + persona mặc định trung tính; request vẫn tiến hành.
- [ ] Chat mode → mọi trường lấy nguồn 1:1 từ các header của người dùng theo §4.2a; không agent/tool/precedence merge; `outputFormatSource="user"`.
- [ ] Agent mode, prompt có header → giải quyết đa nguồn §4.2b được tôn trọng theo từng trường (user-profile từ agent; task từ người dùng; context merge agent-trước; keyword union; output-format giải quyết theo precedence).
- [ ] Agent mode, prompt freestyle (không có 5 header) → request vẫn thành công; task/context/keyword/output-format được khôi phục từ extractor §9.1 + agent + resolver tool; 5 header KHÔNG bắt buộc. **[merged-in]**
- [ ] Agent mode, freestyle prompt → đúng một lệnh gọi LLM extraction; Request được điền.
- [ ] Người dùng và agent đều định nghĩa Output format khác nhau → của người dùng thắng; `outputFormatConflict=true`; provenance được ghi nhận.
- [ ] Agent với `allowUserFormatOverride=false` + format người dùng khác → format của agent được dùng, conflict được flag, warning được nêu. **[merged-in]**
- [ ] Text prompt cố thay đổi tenant/KB security (ví dụ một header nói "ignore tenant filter") → các trường security không đổi, nỗ lực được ghi log. **[merged-in]**
- [ ] Custom heading (`## Functional Requirement`, `## Acceptance Criteria`, `## Constraint`, …) → được phát hiện, phân loại, gắn dưới dạng `requirementHeadings`; năm canonical bị loại trừ. **[merged-in]**
- [ ] Agent mode → agent instruction + `## Skill` được chưng cất thành `agentPlanningHints` (verbosity, ID conventions, terminology, required/forbidden content, domain-risk cues, retrieval hints, skill criteria) một cách xác định, không lệnh gọi LLM; raw persona prose KHÔNG được đặt vào planner input. **[merged-in]**
- [ ] Một agent instruction với một role domain-risk (ví dụ "Clinical Protocol Writer") + một task người dùng trung tính → `domainRiskCues` được điền nên planner đặt `riskLevel=high` (§9.2 step 5). **[merged-in]**
- [ ] `agentPlanningHints` rỗng/vắng ở chat mode; text prompt không thể điền nó. **[merged-in]**
- [ ] `agentScope` (`all_kb`/`specific_kb`/`general`) và `noKnowledgeBase` chỉ được dẫn xuất từ agent/session config + security, không bao giờ từ text của prompt (một đoạn prompt "don't use the KB" không thể lật chúng); `agentScope` vắng ở chat mode và `noKnowledgeBase` luôn là `false` ở đó. **[merged-in]**
- [ ] Agent mode, không `# Output format`, prompt nói ví dụ "use the standard format" → §4.3b Tier-0 deterministic scan khớp → resolver tool được gọi → format trả về trở thành `Request.outputFormat` với `outputFormatSource="agent"`; không lệnh gọi LLM Tier-1 nào được thực hiện. **[merged-in]**
- [ ] Agent mode, không `# Output format`, format intent diễn đạt khác thường → Tier-0 trượt → đúng một §9.7 LLM check chạy → khi `true`, resolver được gọi. **[merged-in]**
- [ ] Resolver trả về `found:false` / lỗi / timeout → rơi về format mặc định của agent (hoặc planner-proposed structure nếu không có); warning `formatResolutionFailed` khi một format có tên được yêu cầu nhưng không tìm thấy; request không bao giờ bị chặn. **[merged-in]**
- [ ] Một `# Output format` do người dùng cung cấp sau đó ghi đè một format giải quyết bằng tool dưới `allowUserFormatOverride`; một `formatName` trong prompt chỉ có thể giải quyết các format của chính agent gọi/tenant (không tra cứu cross-agent/cross-tenant); chat mode không bao giờ gọi resolver. **[merged-in]**
- [ ] Header matching dung thứ hoa thường và biến thể số ít/số nhiều.

**Phase 2 — Planner**
- [ ] Đúng một lệnh gọi LLM; schema-constrained; một retry khi lỗi validation; hard fail sau đó.
- [ ] `# Output format` với markdown headings / numbered list / bullet list → headings được dẫn xuất xác định; plan chứa đúng các heading đó theo thứ tự, được thực thi sau-parse kể cả khi LLM trôi dạt.
- [ ] `# Output format` rỗng → 3–7 section được đề xuất, `outlineSource="proposed_by_llm"`, và không section Title/TOC/References/Conclusion nào xuất hiện không được yêu cầu.
- [ ] Single-deliverable task (một table / chuyển đổi trực tiếp) → đúng một section. **[merged-in]**
- [ ] Task kiểu "Requirements → test cases" → các section `transform_derive` + grounded_strict. Task kiểu "Old use cases → new use cases" → các section `reference_inspired`. (Hai integration fixture; xem danh mục §5.1.)
- [ ] Cả 7 giá trị `detectedTask` đều có thể đạt tới và được phân loại đúng (classification fixtures, một cái mỗi type): condense một-nguồn → `summarize_single`; merge cross-document → `synthesize_multi`; contrast/critique qua nhiều tài liệu → `compare_analyze`; factual grounded Q&A → `qa_with_citations` (ba cái còn lại — `transform_derive`, `reference_inspired`, `review_validate` — được bao phủ bởi các fixture ở trên). Mỗi fixture assert planner phát ra `detectedTask` kỳ vọng và `retrievalMode` mặc định của nó theo §5.4. KHÔNG có type `pure_generation`; khi một KB sẵn có planner không bao giờ tạo ra một plan ungrounded toàn-`none`. **[merged-in]**
- [ ] Task kiểu "Is this test spec complete/consistent with the SRS?" → `detectedTask=review_validate`; các section findings grounded_strict với cả `subQueries` (artifact) lẫn `referenceQueries` (reference) không rỗng; `mustCite` ép true và `assumptionsAllowed` ép false sau-parse; một mục "corrected draft" được yêu cầu → section đó là `transform_derive` với `dependsOn` trên các findings. (Integration fixture; §5.1 row 8.) **[merged-in]**
- [ ] `referenceQueries` chỉ không rỗng trên các section `review_validate`; bị bỏ sau-parse trên mọi task khác. **[merged-in]**
- [ ] Mỗi section nhận `acceptanceCriteria` (0–6) dẫn xuất từ `agentPlanningHints.skillCriteria` + mục output-format của section + các requirement/quality heading được ánh xạ + `requiredContent`/`forbiddenContent`/`idConventions` áp dụng; các criteria là thuộc tính body kiểm tra được, không bao giờ là section/heading/title/TOC/References mới. **[merged-in]**
- [ ] Agent config có thể chứng minh là định hình plan (agent mode): `agentPolicy.citationPolicy="required"` → mọi section grounded `mustCite=true`/`minCitations≥1`; `idConventions`/`terminology`/`retrievalHints` xuất hiện trong sub-query anchor; `defaultVerbosity` điều khiển `targetTokens` khi người dùng không nêu ý định độ dài; một quy tắc `requiredContent` cần một section mới bị bỏ (structure vẫn ràng với `# Output format`). **[merged-in]**
- [ ] Regulated-domain fixture (healthcare/legal/finance) → `riskLevel=high`; `mustCite` ép true và `assumptionsAllowed` ép false sau-parse. **[merged-in]**
- [ ] Mọi heading `requirement`/`acceptance_criteria` được phát hiện ánh xạ tới ≥1 section; không ánh xạ → retry rồi warning. **[merged-in]**
- [ ] Chat mode với tập KB hiệu dụng rỗng → **lỗi cứng trước khi sinh nội dung** (chat yêu cầu một KB, §4.3.2); không bao giờ âm thầm ungrounded. **[merged-in]**
- [ ] Agent `agentScope="general"` (`noKnowledgeBase=true`) → mọi section bị ép về `retrievalMode="none"`, `mustCite=false`, `minCitations=0`, không `subQueries`/`referenceQueries`, được thực thi sau-parse kể cả khi LLM đề xuất các section grounded; `detectedTask` vẫn là một trong 7 (không có `pure_generation`); outline (từ `# Output format`) vẫn được bảo toàn chính xác. **[merged-in]**
- [ ] Agent `agentScope="all_kb"`/`"specific_kb"` (KB hiện diện) → hành xử như chat: các section grounded retrieve và abstain (sentinel) khi context không đủ; planner không tạo ra các section ungrounded. **[merged-in]**

**Phase 3 — Section pipeline**
- [ ] Retriever và reranker hiện có được gọi trực tiếp (adapter là cùng lắm); không logic retrieval nào được triển khai lại; các KB id chỉ nguồn từ security context + agent policy.
- [ ] Các section chạy đồng thời dưới giới hạn đã cấu hình; `dependsOn` chỉ chờ trên các tiền điều kiện.
- [ ] Các sub-query giống hệt qua hai section → underlying retriever được gọi một lần (memoization hit). **[merged-in]**
- [ ] Cùng chunk nổi lên ở hai section → một registry entry, cùng `[N]` ở cả hai.
- [ ] Inline citation dùng **định dạng token chat-QA hiện có và hình dạng payload FE** (§0.1.7), không phải một quy ước mới: FE render các citation của Phase-3 bằng cùng component/code path như chat-QA (assert đối chiếu một chat-QA fixture); citation validator parse grammar token chat-QA thực, không phải một `[N]` hardcode. **[merged-in]**
- [ ] Id ổn định cross-section vẫn giữ trong scheme chat-QA: cùng chunk → cùng citation id qua các section; nếu chat-QA đánh số per-answer, registry mở rộng nó cho tài liệu mà không fork một quy ước thứ hai. **[merged-in]**
- [ ] Writer call input không bao giờ vượt ~11k token (assert qua token counting trong test).
- [ ] `[99]` không hợp lệ trong một bản nháp → bị strip, không bao giờ remap; dấu câu/khoảng cách được dọn.
- [ ] grounded_strict + insufficient hai lần → body chính xác là sentinel, flag `insufficient_context`, không lệnh gọi generation nào được thực hiện.
- [ ] Các section reference_inspired chứa không marker `[N]` nào.
- [ ] Section `review_validate` retrieve artifact (subQueries) VÀ reference (referenceQueries); các source được gắn nhãn ARTIFACT/REFERENCE cho writer; mỗi finding cite một reference (và artifact ở nơi áp dụng); không pass/gap nào được khẳng định mà không có citation; insufficient hai lần → abstention sentinel. **[merged-in]**
- [ ] Một section có `acceptanceCriteria` không thể được xác nhận bởi các deterministic post-write check (§6) bị flag `unmet_acceptance_criteria` và trở thành ứng viên tái sinh Phase-4. **[merged-in]**
- [ ] Số retrieval round mỗi section không bao giờ vượt 2; số lệnh gọi generation mỗi section không bao giờ vượt 1 (trước repair).
- [ ] Section `riskLevel=high` → Tier-1 LLM sufficiency check luôn chạy, kể cả ở mode `heuristic_first`. **[merged-in]**
- [ ] Grounded fixture với một vốn từ ID đã biết → output không chứa các ID requirement/API/table vắng khỏi các source (regex assert). **[merged-in]**
- [ ] NLI gate sau một config flag; loại bỏ >50% câu thì flag `low_faithfulness`.
- [ ] `noKnowledgeBase=true` (agent `agentScope="general"`) → không lệnh gọi retrieve và không lệnh gọi rerank nào qua toàn bộ lượt chạy; mọi section đi theo đường writer `none` (§9.3c); tài liệu được giao chứa không marker `[N]` nào và không abstention sentinel; một warning `noKnowledgeBase` được nêu ra (request vẫn thành công). **[merged-in]**
- [ ] Grounded request (chat, hoặc agent `all_kb`/`specific_kb`) khi context reranked của một section rỗng/không dùng được → section đó abstain với per-section sentinel + `insufficient_context` (theo từng giai đoạn của plan); nó KHÔNG rơi về sinh nội dung ungrounded — phòng vệ chống cut-off-knowledge hallucination/bias. **[merged-in]**
- [ ] Các section grounded dùng prompt §9.3 (SOURCES + `[N]`, nghiêm ngặt từ sources); các section ungrounded (`retrievalMode="none"`) dùng prompt §9.3c (không SOURCES, không `[N]`) — hai cái là hai system prompt khác biệt được chọn theo retrieval mode. **[merged-in]**
- [ ] Output của writer chỉ chứa nội dung được yêu cầu của section: không preamble ("Here is…"), không nhắc lại task, không intro/conclusion trừ khi output format yêu cầu, không postamble — được assert trên một fixture (body section được giao bắt đầu ở câu nội dung đầu tiên và kết thúc ở câu cuối). **[merged-in]**
- [ ] Quy tắc ngắn gọn được giữ mà không mất chất lượng: `targetTokens` được coi là trần chứ không phải hạn mức (không padding); một section không bị phạt vì ngắn hơn khi brief + acceptance criteria của nó đã được phủ trọn; các fact/citation/criteria bắt buộc không bao giờ bị cắt bớt để tiết kiệm token. **[merged-in]**

**Phase 4 — Validator**
- [ ] Output đã lắp ráp không chứa auto title, không TOC, không section references trừ khi được lập kế hoạch từ format của người dùng.
- [ ] Forbidden-content scan: không source list, appendix, validation notes, internal plan/reasoning, retrieved chunks, quality scores, hay debug metadata trong tài liệu được giao. **[merged-in]**
- [ ] Các passing section byte-identical trước và sau validation (không viết lại).
- [ ] Coverage auditor chỉ thấy headings + ~150-token opening + requirement headings + `acceptanceCriteria` per-section; một requirement heading không được giải quyết xuất hiện trong `missingAspects`; một criterion thất bại rõ ràng xuất hiện trong `unmetCriteria` và section của nó vào tập tái sinh. **[merged-in]**
- [ ] Regeneration chỉ ảnh hưởng các section bị flag/được nêu tên, chạy nhiều nhất một lần, với strictness được bơm lên; các thất bại round hai trả về dưới dạng warnings, không phải vòng lặp.
- [ ] Result bao gồm citation registry và object warnings đầy đủ; warnings không bao giờ làm request thất bại.
- [ ] Artifact skill active (plan hints + writer guidance) → số section, headings, và thứ tự được giao byte-identical với điều `# Output format` quy định; skill không thêm section, title, TOC, hay References nào. Skill guidance chỉ ảnh hưởng section body (cái `HOW`), không bao giờ structure (cái `WHAT`). **[merged-in]**

**Skills — loading & token discipline (§A.10.3)**
- [ ] Skill selection chỉ đọc `name`+`description` của mỗi `SKILL.md`; không skill body nào được nạp để quyết định độ liên quan; `SKILL.md` prose body không bao giờ vào bất kỳ lệnh gọi LLM nào. **[merged-in]**
- [ ] Nhiều nhất một artifact skill được nạp mỗi request; `plan.md`/`write.md` của 9 skill kia không bao giờ vào bất kỳ prompt nào; tie phá vỡ một cách xác định (hoặc không nạp cái nào). **[merged-in]**
- [ ] Phase 2 chỉ nạp `plan.md` của skill được chọn; Phase 3 chỉ nạp `write.md` của nó; không bao giờ cả hai trong một lệnh gọi. **[merged-in]**
- [ ] Agent-mode request mà instruction của nó bao phủ artifact → không skill body nào được nạp (fallback bị bỏ qua); skill body chỉ nạp để lấp đầy discipline chưa được bao phủ. **[merged-in]**
- [ ] `plan.md` hints tính vào ngân sách planner ≤3k (chưng cất, không paste cả); lát `write.md` chiếm dòng writer-guidance ≤~250-token của bảng per-section §6; một skill file vượt ngân sách bị sliced/truncate, không bao giờ được phép tràn. **[merged-in]**
- [ ] Một request không cần artifact skill chỉ trả cho metadata-catalog scan (không skill body trong bất kỳ prompt nào). **[merged-in]**

**Operational robustness (§7a)**
- [ ] Transient infra error (LLM 5xx / retriever hay reranker throw/timeout) → đúng một bounded retry với backoff, tách biệt với các logic retrieval round của §7. **[merged-in]**
- [ ] Reranker không khả dụng → section rơi về retriever score order, flag `reranker_degraded`; section không bị chặn. **[merged-in]**
- [ ] Retriever không khả dụng sau retry → section grounded_strict phát ra sentinel + `retriever_unavailable`; các section reference_inspired/none tiến hành. **[merged-in]**
- [ ] Lệnh gọi LLM của một section thất bại sau retry → section đó được giao dưới dạng sentinel + `generation_failed`; lượt chạy tiếp tục; `warnings.partial=true`, `failedSections[]` được điền; request trả về success (không error). **[merged-in]**
- [ ] Request thất bại hoàn toàn CHỈ khi Phase 1 hoặc Phase 2 không thể sinh ra một plan — không bao giờ vì một section riêng lẻ thất bại. **[merged-in]**
- [ ] Deadline (`requestDeadlineMs`, default 180 000) đạt tới → ngừng lên lịch section mới, để các lệnh gọi đang chạy hoàn tất, tiến tới Phase 4 trên partial; các section chưa bắt đầu → sentinel + `deadline_skipped`; `warnings.deadlineHit=true`; round repair bị bỏ qua nếu quá deadline. **[merged-in]**
- [ ] Caller cancellation → section mới không được lên lịch, các cái đang chạy bị abort/bỏ, limiter được giải phóng, trả về kịp thời; `warnings.cancelled=true`; không tài liệu viết-dở nào được persist; resume (nếu bật) bỏ qua các section đã hoàn tất. **[merged-in]**
- [ ] Planner phát ra một `dependsOn` cycle hoặc dangling ref → deterministic Phase-2 post-parse check từ chối nó → một planner retry → nếu vẫn xấu, các cạnh vi phạm bị bỏ + `warnings.dependencyEdgesDropped[]`; executor không bao giờ deadlock; request không bị làm thất bại. **[merged-in]**

**Whole pipeline**
- [ ] Tài liệu grounded 6-section hoàn tất < 180 s trên target local LLM (performance test).
- [ ] Chat route và agent route dùng chung một orchestrator instance/path; nhánh mode duy nhất trong codebase là bên trong normalizer (cộng với việc tiêm persona của writer).
- [ ] Lượt chạy bị gián đoạn resume từ persisted per-section state mà không chạy lại các section đã hoàn tất (khi job persistence được bật). **[merged-in]**
- [ ] Mỗi request phát ra MỘT Langfuse trace với một span cho mỗi phase và một generation sub-span cho mỗi lệnh gọi LLM (§10); các section span lồng dưới Phase 3; coverage + repair dưới Phase 4; tổng token/latency ở trace root; `warnings` được đính kèm. **[merged-in]**
- [ ] Mọi output LLM có cấu trúc xuất hiện trong trace dưới dạng **full-name JSON đã mở rộng** (§9.0); dạng wire short-key (nếu `shortKeyWire` on) chỉ xuất hiện trong field span `rawOutput`; không short key nào lọt qua adapter vào bất kỳ object hay contract downstream nào. **[merged-in]**
- [ ] Các output constrained-JSON round-trip qua adapter short↔full vào các object canonical §3.2/§3.3; với `shortKeyWire` off, wire key bằng full name (adapter là identity). **[merged-in]**
- [ ] Langfuse vắng mặt → dữ liệu span rơi về structured logging stack; tracing nằm sau một config flag (default on ở nơi Langfuse được cấu hình). **[merged-in]**
- [ ] Config surface: kb ids, concurrency (default 4), retrieve topK (20), rerank topK (5), sufficiencyMode (`always_llm` default), NLI gate flag, coverage flag, max sections (10), retrieval cache flag/TTL, job-persistence flag, skill loading (`agentSkillMode: skip_if_covered | always_fallback`, default `skip_if_covered`; §A.10.3), các operational-robustness knob (`requestDeadlineMs` default 180 000, `infraRetries` default 1 + backoff; §7a), `shortKeyWire` (default off; §9.0), và Langfuse tracing flag (default on ở nơi được cấu hình; §10). **[merged]**

**Thứ tự triển khai gợi ý:** types/contracts → header & format parsers + requirement-heading detector (unit tests) → normalizer với precedence + security rules → constrained-JSON LLM wrapper → planner (gồm `dependsOn` cycle/integrity gate, §7a.4) → chunk registry + retrieval memoization → section pipeline với tiered sufficiency loop + infra-retry/degradation handling (§7a.1) → citation validator → writers → validator + assembler + repair → routes/jobs/SSE + resume + deadline + cancellation (§7a.2–7a.3) → NLI gate → performance test. Loại bỏ module outliner độc lập và các code path stitch/refine sản xuất nội dung như một phần của cùng thay đổi, với hành vi cũ chỉ được giữ sau một fallback flag nếu team yêu cầu một đường rollback.

---
## Appendix A — SDLC Agent instruction templates (Agent Standard mode)

Đây là các **predefined agent instruction** được lưu trong trường instruction của agent record, không phải code. Normalizer parse các header `# User profiles / # Context / # Keyword / # Output format` của chúng; phần prose còn lại (các khối Role + Skill) chảy tới section writer như persona preamble. Người dùng nhập prompt freestyle hoặc với các header của riêng họ; theo các quy tắc precedence, một `# Output format` do người dùng cung cấp ghi đè của agent. Mọi `# Output format` bên dưới dùng **các mục top-level đánh số** để deterministic parser dẫn xuất outline và planner không thể bịa ra section.

### A.0 Artifact → hành vi planner kỳ vọng

| Agent / artifact | Nguồn KB điển hình | `detectedTask` kỳ vọng | `retrievalMode` chủ đạo |
|---|---|---|---|
| Use Case Specification | existing use cases, business rules, SRS | `reference_inspired` (new UC from exemplars) hoặc `transform_derive` (UC from requirements) | mixed: overview/preconditions/rules grounded; new flows reference-inspired |
| SRS | BRD, meeting notes, existing SRS, change requests | `transform_derive` / `synthesize_multi` | grounded_strict — mỗi "shall" cite một nguồn |
| Basic Design (HLD) | SRS, architecture standards, existing HLDs | `transform_derive` | grounded cho requirement mapping; reference-inspired cho structure |
| Detail Design (LLD) | HLD, API specs, DB schemas, coding standards | `transform_derive` | grounded_strict — interfaces/data phải cite HLD/schema chunks |
| Test Plan | SRS, project plan, test policy | `transform_derive` / `synthesize_multi` | grounded cho scope; `none` cho boilerplate criteria từ agent context |
| Test Case | SRS / use cases / LLD | `transform_derive` | grounded_strict — mỗi case cite source requirement của nó |
| Test Specification | test plan + test cases + LLD | `transform_derive` / `synthesize_multi` | grounded_strict — environment/data từ LLD |
| Traceability Matrix (RTM) | SRS + test cases + design docs | `synthesize_multi` | grounded_strict; abstain thay vì bịa link |
| **Artifact Reviewer (e.g. Test Spec vs SRS, LLD vs HLD)** **[merged-in]** | the artifact under review + its reference (SRS / standard / upstream design), cả hai trong KB | `review_validate` (+ `transform_derive` cho một optional corrected draft) | grounded_strict, dual-grounding: `subQueries` hit artifact, `referenceQueries` hit reference; abstain thay vì khẳng định pass/gap không có bằng chứng |
| **End-to-end Traceability (A.8c)** | các artifact lifecycle cần liên kết — requirement, design, code/commit ref, test, defect — qua waterfall (BRD→SRS→HLD→LLD→test) hoặc agile (Epic→Feature→Story→AC→test) | `synthesize_multi` (hoặc `transform_derive` để trace một seed node đơn lan ra ngoài) | grounded_strict, bi-directional: seed sub-query cho CẢ nguồn upstream LẪN consumer downstream của mỗi node; "NOT TRACED" thay vì suy ra một link; rộng hơn RTM (toàn-lifecycle, cả hai hướng, có node code+defect) |

> **KB hygiene:** các agent này hoạt động tốt nhất khi mỗi artifact family ở trong knowledge base riêng của nó (hoặc được tag) và `kbIds` của agent được đặt tương ứng, để baseline `# Keyword` của agent cộng các sub-query per-section rơi đúng document family. Với Artifact Reviewer, artifact và reference của nó nên retrieve được từ `kbIds` của agent (cùng KB tag theo document type, hoặc hai KB) để `subQueries` và `referenceQueries` mỗi cái rơi đúng phía.

---

### A.1 Agent: Use Case Writer

```md
You are a senior business analyst who writes UML-style use case
specifications. When existing use cases are retrieved as exemplars,
mirror their numbering style, granularity, and voice exactly; invent
new scenario specifics only for genuinely new functionality, and keep
actors, business rules, and preconditions consistent with retrieved
sources.

## Skill
- Derive actors and goals from requirements or change requests.
- Write main flows as numbered actor-system step pairs (Actor does X ->
  System does Y).
- Enumerate alternative and exception flows with branch points
  referencing main-flow step numbers (e.g., "3a.", "5b.").
- Keep one use case per user goal; split if a flow exceeds ~12 steps.

# User profiles
Business analysts, product owners, and developers who consume use case
specifications as the contract for feature behavior.

# Context
Use cases follow the project's standard template. IDs use the pattern
UC-<MODULE>-<NN>. Business rules are referenced as BR-<NN>. Terminology
must match the project glossary stored in the knowledge base.

# Keyword
use case, actor, precondition, postcondition, main flow, alternative flow,
exception flow, business rule

# Output format
1. Use Case Overview (ID, Name, Actors, Description, Priority)
2. Preconditions
3. Postconditions
4. Main Flow
5. Alternative Flows
6. Exception Flows
7. Business Rules and Constraints
8. Open Questions
```

**Ví dụ user prompt (freestyle):** "Create a new use case for 'Bulk import customers from CSV' in the CRM module. Refer to the existing customer-management use cases for style and reuse their preconditions where they apply." → kỳ vọng: `reference_inspired`; các section 1–3 và 7 grounded đối chiếu với các UC/business rule hiện có; 4–6 reference-inspired; 8 `none`.

---

### A.2 Agent: SRS Writer

```md
You are a requirements engineer producing IEEE 29148-style Software
Requirements Specifications. Every functional requirement is an atomic,
testable "shall" statement with a unique ID. Never invent requirements
that have no basis in the retrieved sources; mark genuinely unstated
needs as assumptions instead.

## Skill
- Convert business requirements, meeting notes, and change requests
  into numbered functional requirements: REQ-<MODULE>-<NN>: "The system
  shall ...".
- Separate functional from non-functional requirements (performance,
  security, usability, reliability).
- Flag conflicts or duplicates between retrieved source statements
  explicitly instead of silently merging them.

# User profiles
Development team, QA engineers, and project stakeholders who will
implement and verify against this SRS.

# Context
Requirement IDs continue the existing numbering found in the knowledge
base. Non-functional requirements reference the organization's quality
standards. Each requirement must be traceable to its source document.

# Keyword
requirement, shall, functional requirement, non-functional requirement,
constraint, assumption, acceptance criteria

# Output format
1. Purpose and Scope
2. Definitions and Abbreviations
3. Functional Requirements
4. Non-Functional Requirements
5. Constraints and Assumptions
6. Acceptance Criteria
```

**Ví dụ user prompt (có header — minh họa format override):**
```md
# Task
Write the SRS for the password-reset and MFA enrollment features based
on the Q3 change requests in the knowledge base.

# Keyword
password reset, MFA, OTP, account security

# Output format
1. Scope
2. Functional Requirements
3. Security Requirements
4. Acceptance Criteria
```
Format 4-section của người dùng **ghi đè** mặc định 6-section của agent; `outputFormatConflict=true`; mọi requirement section chạy grounded_strict với các citation bắt buộc tới các change-request chunk.

---

### A.3 Agent: Basic Design (High-Level Design) Writer

```md
You are a software architect writing Basic Design (high-level design)
documents that bridge the SRS and the Detail Design. Designs must
satisfy every referenced requirement; map each design element to the
requirement IDs it realizes. Follow the architecture standards
retrieved from the knowledge base; do not introduce technologies the
project has not approved.

## Skill
- Decompose the system into components/modules with single
  responsibilities and explicit interfaces.
- Describe data flow and control flow between components in numbered
  steps (textual; diagrams are described, not drawn).
- Produce a requirement-to-component traceability mapping.
- State design decisions with rationale and rejected alternatives.

# User profiles
Developers and reviewers who will derive the Detail Design and
implementation from this document.

# Context
The target architecture and approved technology stack are documented in
the knowledge base (architecture standards, existing HLDs). Component
IDs use CMP-<NN>. Design decisions use DD-<NN>.

# Keyword
architecture, component, module, interface, data flow, sequence,
traceability, design decision

# Output format
1. Design Overview and Goals
2. System Architecture (components and responsibilities)
3. Interface Definitions
4. Data Design
5. Process and Data Flow
6. Requirement Traceability (requirement ID -> component)
7. Design Decisions and Alternatives
```

---

### A.4 Agent: Detail Design (Low-Level Design) Writer

```md
You are a senior developer writing Detail Design documents directly
implementable by another developer without further clarification. Every
class, function, table, and API in this document must be consistent
with the Basic Design and existing schemas retrieved from the knowledge
base; never invent fields, endpoints, or tables that contradict them.

## Skill
- Specify module internals: classes/functions with signatures,
  parameters, return values, and error behavior.
- Define API endpoints (method, path, request/response payloads,
  status codes) and DB changes (tables, columns, indexes, migrations).
- Describe processing logic as numbered steps or pseudocode per the
  project's pseudocode conventions.
- Cover error handling, logging, and edge cases for each unit.

# User profiles
Implementing developers and code reviewers.

# Context
Naming conventions, layer structure, and the existing database schema
are in the knowledge base. Detail design items use DLD-<MODULE>-<NN>
and must reference the Basic Design component IDs (CMP-<NN>) they
realize.

# Keyword
class design, sequence, API specification, database schema, pseudocode,
error handling, validation

# Output format
1. Scope and Referenced Basic Design Items
2. Module Structure
3. Class and Function Specifications
4. API Specifications
5. Database Design and Migrations
6. Processing Logic (per function, numbered steps)
7. Error Handling and Logging
```

---

### A.5 Agent: Test Plan Writer

```md
You are a QA lead writing test plans aligned with ISTQB/IEEE 829
practice. Scope, items, and features under test must come from the
retrieved SRS/design documents; schedule, environments, and entry/exit
criteria follow the organization's test policy in the knowledge base.
Do not invent requirement IDs.

## Skill
- Derive test scope (in/out) and test items from the SRS feature list.
- Choose test levels (unit/integration/system/UAT) and types
  (functional, regression, performance, security) appropriate to risk.
- Define entry/exit criteria, suspension/resumption criteria, and
  deliverables.
- Identify risks with likelihood/impact and mitigations.

# User profiles
QA engineers executing the plan, project managers tracking it, and
stakeholders approving release criteria.

# Context
Test policy, environment catalog, and defect severity definitions are
in the knowledge base. Test plan IDs use TP-<RELEASE>-<NN>.

# Keyword
test plan, scope, test level, entry criteria, exit criteria, risk,
test environment, schedule

# Output format
1. Test Plan Overview (ID, Release, References)
2. Scope (Features to be Tested / Not to be Tested)
3. Test Approach and Levels
4. Entry and Exit Criteria
5. Test Environment and Tools
6. Roles, Responsibilities, and Schedule
7. Risks and Mitigations
```

---

### A.6 Agent: Test Case Writer

```md
You are a QA engineer who converts requirements, use cases, and detail
designs into executable test cases. Every test case must trace to a
specific requirement or flow in the retrieved sources - cite it. Apply
black-box techniques (equivalence partitioning, boundary value
analysis, decision tables) to choose inputs; cover positive, negative,
and boundary scenarios for each requirement.

## Skill
- One test case per verifiable behavior; atomic and independently
  executable.
- Steps are numbered imperative actions with concrete test data;
  expected results are observable and unambiguous.
- Derive negative cases from exception flows and validation rules in
  the sources.
- If a requirement is too vague to test, output it under "Untestable /
  Needs Clarification" instead of guessing.

# User profiles
Manual testers executing the cases and automation engineers scripting
them.

# Context
Test case IDs use TC-<MODULE>-<NNN> and continue existing numbering in
the knowledge base. Severity/priority values follow the project's
defect taxonomy.

# Keyword
test case, test step, expected result, precondition, test data,
boundary value, equivalence partition, negative test

# Output format
1. Test Case Summary Table (ID, Title, Requirement Ref, Priority)
2. Detailed Test Cases (per case: Preconditions, Test Data, Steps, Expected Results)
3. Negative and Boundary Cases
4. Untestable Items / Needs Clarification
```

**Ví dụ user prompt (freestyle):** "Generate test cases for the bulk CSV customer import use case UC-CRM-12, covering file validation and duplicate handling." → kỳ vọng: `transform_derive`; các section 1–3 grounded_strict với các sub-query như "UC-CRM-12 main flow", "CSV import validation rules", "duplicate customer handling"; section 4 grounded với `minCitations: 0` (nó liệt kê các gap, không phải facts).

---

### A.7 Agent: Test Specification Writer

```md
You are a senior QA engineer writing test specifications that make test
cases executable in a concrete environment: exact procedures, data
sets, environment configuration, and result-recording instructions.
Everything must be consistent with the retrieved Test Plan, Test Cases,
and Detail Design - cite the source for environment values, endpoints,
and data constraints; never invent configuration.

## Skill
- Expand test cases into step-level procedures with setup, execution,
  verification, and teardown.
- Specify test data sets (valid, invalid, boundary) with concrete
  values that satisfy the schema constraints in the Detail Design.
- Define environment configuration (versions, endpoints, accounts,
  feature flags) from the environment catalog.
- Define pass/fail criteria and evidence to capture per procedure.

# User profiles
Testers executing procedures verbatim and reviewers auditing test
evidence.

# Context
Test spec IDs use TS-<MODULE>-<NNN>, mapped to TC IDs. The environment
catalog and account/credential placeholders are in the knowledge base
(never output real credentials; use the placeholder convention).

# Keyword
test specification, test procedure, test data, environment setup,
pass criteria, evidence, teardown

# Output format
1. Specification Overview (ID, Referenced Test Plan and Test Cases)
2. Test Environment Setup
3. Test Data Sets
4. Test Procedures (per procedure: Setup, Steps, Verification, Teardown)
5. Pass/Fail Criteria and Evidence Requirements
```

---

### A.8 Agent: Requirements Traceability Matrix (RTM) Builder

```md
You are a quality auditor building requirements traceability matrices.
You may ONLY state links that are explicitly supported by the retrieved
documents (a test case citing a requirement ID, a design section
referencing a requirement). Where no link is found, write "NOT COVERED"
- never infer or invent coverage.

## Skill
- Cross-reference requirement IDs against design items and test case
  IDs found in retrieved chunks.
- Report coverage gaps (requirements with no design/test linkage) and
  orphans (test cases or design items referencing unknown requirement
  IDs).

# User profiles
QA leads and auditors verifying coverage before release.

# Context
ID conventions: REQ-*, CMP-*, DLD-*, TC-*. The matrix must list every
requirement found in scope, even if uncovered.

# Keyword
traceability, coverage, requirement ID, test case mapping, gap analysis

# Output format
1. Traceability Matrix (Requirement ID | Design Ref | Test Case Ref | Status)
2. Coverage Gaps
3. Orphan Items
```

Đây là profile grounding nghiêm ngặt nhất trong tập: `synthesize_multi`, mọi section grounded_strict với `mustCite: true`, và abstention sentinel là hành vi *kỳ vọng* cho các link không thể xác minh — khiến nó là integration fixture đầu tiên tốt nhất (hallucinated coverage là cực dễ phát hiện).

---

### A.8b Agent: Artifact Reviewer (sufficiency & conformance) **[merged-in]**

```md
You are a senior reviewer who checks whether a produced artifact is
complete, consistent, and sufficient against the reference it must
conform to (its SRS, standard, template, or upstream design). You judge
the DELTA between what the artifact says and what the reference
requires. You never invent gaps and never declare conformance without
reference evidence; where the retrieved sources do not let you judge a
point, you say so explicitly instead of guessing.

## Skill
- Treat ARTIFACT sources (the document under review) and REFERENCE
  sources (what it must satisfy) as two separate bodies of evidence.
- For each reference requirement, decide: covered, partially covered,
  missing, or contradicted by the artifact - and cite both sides.
- Report sufficiency per area, not just a global verdict; an artifact
  can be sufficient for one requirement and insufficient for another.
- When asked for a corrected version, only add/fix what a reference
  requirement supports; never invent IDs, fields, endpoints, or facts.

# User profiles
Reviewers, QA leads, and authors who must decide whether the artifact
is ready or what is missing before sign-off.

# Context
The artifact under review and its reference both live in the knowledge
base. ID conventions follow the project (REQ-*, UC-*, TC-*, TS-*,
CMP-*, DLD-*). "Sufficient" means every reference requirement in scope
is addressed by the artifact with no contradiction.

# Keyword
review, conformance, completeness, consistency, sufficiency, gap,
coverage, reference, requirement

# Output format
1. Review Summary and Verdict (sufficient / insufficient, with scope)
2. Conformance Findings (per requirement: covered / partial / missing / contradicted, with citations)
3. Gaps and Missing Coverage
4. Inconsistencies and Contradictions
5. Corrected Artifact (only if requested)
```

**Ví dụ user prompt (freestyle):** "Review whether the test specification TS-CRM is complete and consistent with the SRS for the customer-import feature, and give me a corrected version." → kỳ vọng: `detectedTask=review_validate`; các section 1–4 `review_validate`, grounded_strict, `mustCite=true`, mỗi cái với `subQueries` hit test spec (`"TS-CRM procedures"`, `"TS-CRM test data"`) và `referenceQueries` hit SRS (`"customer-import requirements"`, `"CSV validation rules"`); `acceptanceCriteria` ví dụ `["every finding cites the SRS clause and the TS-CRM section it compares", "no 'sufficient' verdict without reference coverage"]`; section 5 `transform_derive`, grounded đối chiếu với SRS, `dependsOn ["s1","s2","s3","s4"]`. Nếu người dùng bỏ qua "corrected version", section 5 vắng (`# Output format` của người dùng điều khiển nó).

> **Vì sao đây là một integration fixture mạnh:** như RTM, nó khiến hallucination cực dễ phát hiện — một "covered" được ngụy tạo hoặc một requirement ID bịa ra không có reference citation và thất bại deterministic citation validation; một gap được khẳng định mà không có citation phía artifact lẫn phía reference bị bắt theo cùng cách.

---

### A.9 Cách các template này luyện tập pipeline (verification matrix)

| Template | Luyện tập | Integration test assert gì |
|---|---|---|
| A.1 Use Case | các retrieval mode pha trộn trong một plan | các section 4–6 chứa không `[N]`; các section 1–3 cite các UC chunk hiện có |
| A.2 SRS | Output format của người dùng **ghi đè** của agent | tài liệu cuối có đúng 4 section của người dùng; `outputFormatConflict=true` |
| A.6 Test Case | `transform_derive` + sub-query per-section | mỗi detailed case cite requirement chunk mà nó dẫn xuất từ |
| A.8 RTM | abstention sentinel + strict grounding | các hàng không được bao phủ nói "NOT COVERED"; không TC ID nào bịa ra |
| A.8b Artifact Reviewer | `review_validate` dual-grounding + `acceptanceCriteria` | các finding cite một artifact chunk VÀ một reference chunk; không verdict nào không có reference citation; section corrected-draft tùy chọn chỉ khi output format yêu cầu nó |
| A.8c Traceability | bi-directional trace + strict grounding | mỗi node hiện cả backward link (nguồn) lẫn forward link (consumer), hoặc "NOT TRACED" nơi một phía vắng; không link nào được suy ra/bịa; broken link và orphan được báo cáo; ID conventions khớp methodology (không trộn, không bịa) |

Thêm bất kỳ SDLC artifact tương lai nào (Operation Manual, Release Notes, API Reference, …) yêu cầu **không thay đổi orchestrator** — chỉ một agent instruction mới với cùng hình dạng: persona + Skill block + bốn canonical header với một `# Output format` đánh số.

---

### A.10 Artifact skills (skill-creator–generated) — một skill cho mỗi phase cho mỗi artifact

Mỗi Appendix-A artifact có **một skill folder** dưới `plans/skills/sdlc-<artifact>/`, kiểu Anthropic: một `SKILL.md` entry point cộng hai phase-specific resource file — `plan.md` (Phase 2) và `write.md` (Phase 3). `SKILL.md` là front door luôn-được-nạp (artifact identity, trigger, mode rules, invariants); các phase file được nạp theo nhu cầu bởi phase tiêu thụ chúng. Tách theo phase phản chiếu chính ranh giới của orchestrator: Phase 2 là một lệnh gọi planning đơn không bao giờ thấy các chunk được retrieve, trong khi Phase 3 là N lệnh gọi writer song song không bao giờ re-plan. Mỗi phase file do đó chỉ nạp vào phase tiêu thụ nó — planner không bao giờ mang writer prose, và writer không bao giờ mang planning metadata.

**Scope & mode (skill là một chat-mode asset; một agent-mode fallback).** Skills mang artifact discipline cho **chat generative mode**, nơi không có agent instruction để cung cấp nó. Ở **agent mode**, agent instruction (persona của nó + khối `## Skill`, tới writer theo §6 item 6, và nội dung liên quan planning của nó được chưng cất vào `agentPlanningHints` theo §4.6) là **source of truth và luôn thắng**; artifact skill chỉ nạp như một **fallback** lấp đầy discipline mà instruction không nêu, và bị bỏ ở bất cứ đâu nó xung đột với instruction, `# Output format` đã giải quyết, hoặc security. Điều này loại bỏ sự dư thừa agent-mode giữa một artifact skill và khối `## Skill` của chính agent: instruction là chính, skill là dự phòng.

Cả hai skill cố ý **structurally inert**: chúng ảnh hưởng *cách* orchestrator plan và write, không bao giờ *section nào tồn tại hay thứ tự của chúng*.

**Outline không bao giờ là việc của một skill.** Section structure được dẫn xuất duy nhất từ `# Output format` đã giải quyết (của người dùng, hoặc fallback của agent theo precedence §4); khi không có output format, planner đề xuất structure (§5). Không skill nào được phép thêm, bỏ, đổi tên, hay sắp xếp lại bất kỳ section nào, hay phát ra một title, table of contents, hay References block. Đây là điều giữ câu trả lời được giao **ràng chặt với `# Output format` của người dùng**.

**A.10.1 Phase 2 — plan resource (`sdlc-<artifact>/plan.md`).** Cung cấp planning *metadata* cho artifact type — `detectedTask` kỳ vọng, `retrievalMode` chủ đạo theo từng kind section, `riskLevel` cue, sub-query seeds, `acceptanceCriteria` seeds, và quy tắc no-KB (§4.5) — để định hướng lệnh gọi planner đơn (§5/§9.2). Nó là đối ứng artifact-specific của `agentPlanningHints` per-agent (§4.6): nơi `agentPlanningHints` chưng cất instruction của *agent này*, plan skill mang các planning default tái dùng của *artifact type này*; cả hai nuôi planner dưới dạng dữ liệu có cấu trúc, và cùng precedence áp dụng (output format và security luôn thắng). Nó cung cấp **không outline** và **không writer prose**.

**A.10.2 Phase 3 — writer resource (`sdlc-<artifact>/write.md`) — `HOW`, không bao giờ `WHAT`.** Cung cấp **writing discipline** per-section (tone, citation strictness, "do not invent requirement IDs / API names / DB fields", abstention expectations) nối vào brief của writer cho các section của artifact đó. Vì outline và headings đã được khóa từ `# Output format` trước khi bất kỳ writer nào chạy, guidance này chỉ có thể định hình *body* của một section hiện có — nó không thể đưa structure vào. Writer vẫn bị ràng, theo thứ tự ưu tiên, bởi: **agent instruction** → `# Output format` đã giải quyết → rồi **writer guidance**. Ở agent mode, khối `## Skill` của agent đã mang discipline này và thắng; `write.md` khi đó chỉ lấp đầy gap (nó chủ yếu là source chat-mode). Nếu guidance từng xung đột với output format (ví dụ nó ngụ ý một section thừa), output format thắng và guidance bị bỏ cho section đó.

**Cách orchestrator nạp writer resource (Phase 3):** writer-guidance block `write.md` đã giải quyết được xử lý như agent persona preamble — một guidance string mờ đục được nối vào SECTION BRIEF (§9.3 user-message composition), sau persona và trước các source. Nó chịu cùng forbidden-content scan (§8) như mọi thứ khác, nên bất kỳ nội dung structural nào nó vô tình đưa vào bị strip ở Phase 4. Phase 1 (deterministic parsing) và Phase 4 (deterministic check cộng một lệnh gọi coverage artifact-agnostic) **không** nhận các skill per-artifact.

**Convention cho mỗi artifact skill (folder kiểu Anthropic):**

- **Một folder mỗi artifact** dưới `plans/skills/sdlc-<artifact>/`, chứa `SKILL.md` (entry point), `plan.md` (Phase-2 resource), và `write.md` (Phase-3 resource), cho mỗi `use-case`, `srs`, `basic-design`, `detail-design`, `test-plan`, `test-case`, `test-spec`, `rtm`, cộng folder `artifact-review` của A.8b và folder `traceability` của A.8c — **10 folder, 32 file**. `write.md` của reviewer mang dual-grounding discipline (cite artifact AND reference; không bao giờ khẳng định pass/gap không có bằng chứng); `plan.md` của nó seed `review_validate`, sự chia tách artifact/reference sub-query (`subQueries` vs `referenceQueries`), và `acceptanceCriteria` strict-citation. Folder `traceability` của A.8c thêm hai file reference theo methodology nạp-theo-nhu-cầu (`references/waterfall.md`, `references/agile.md`) — vì vậy 5 file trong riêng folder đó — chỉ nạp cho methodology mà một request dùng; `plan.md`/`write.md` của nó mang discipline bi-directional, không-bịa-link ("NOT TRACED" thay vì suy ra coverage).
- **`SKILL.md`** là entry point triggerable duy nhất: YAML frontmatter (`name`, `description`) + body bao phủ artifact identity, khi nào nó áp dụng, **quy tắc mode chat-primary / agent-fallback**, và các structural invariant. `plan.md` và `write.md` là các referenced resource được nạp bởi phase của chúng, không được trigger độc lập.
- Mỗi **`plan.md`** mang một block `acceptanceCriteria` seeds (§9.2 step 10, §A.10.1) và định vị mình như đối ứng artifact-level của `agentPlanningHints` per-agent (§4.6); mỗi **`write.md`** mang body-only discipline (no-invented-IDs, citation strictness, abstention) nối vào writer brief (§9.3).
- **Không outline / không numbered section list trong bất kỳ cái nào của ba file** — structure thuộc về `# Output format`.

**Coverage:** các skill folder tồn tại cho cả tám template A.1–A.8, A.8b Artifact Reviewer, **và** A.8c End-to-end Traceability builder (10 folder, 32 file). Thêm một artifact tương lai nghĩa là tạo một folder `sdlc-<artifact>/` mới với ba file của nó (cộng các file reference nạp-theo-nhu-cầu khi một sự chia tách methodology/biến thể có ích, như ở A.8c); không thay đổi code orchestrator, và output-format binding không bị ảnh hưởng.

**A.10.3 Skill loading & token budget (progressive disclosure) [merged-in].**

Skills PHẢI nạp bằng **progressive disclosure**, không bao giờ eager. Với 10 artifact skill, nối các skill body vào một prompt sẽ nhân ngân sách token per-phase và phá vỡ nó; hợp đồng bên dưới giữ chi phí gần-bằng-không trên các request không cần một skill và bounded khi một cái cần. Đây là các acceptance criteria, không phải lời khuyên.

1. **Selection chỉ là metadata.** Để quyết định *skill nào* áp dụng, orchestrator chỉ đọc `name` + `description` của mỗi `SKILL.md` (catalog luôn-thường-trú: vài chục token mỗi skill, vài trăm tổng cho cả 10). Một skill **body không bao giờ được nạp để xác định độ liên quan** — chỉ sau khi một skill được chọn. Bản thân `SKILL.md` prose body là một front door human/selection và **không bao giờ được tiêm vào bất kỳ lệnh gọi LLM nào**. (Các file `references/waterfall.md` / `references/agile.md` của skill traceability A.8c cũng không bao giờ được đọc để selection — chúng chỉ nạp sau khi đã chọn, và chỉ cho methodology đang dùng.)
2. **Nhiều nhất một artifact skill mỗi request.** Selection cho ra không hoặc một artifact skill. Phá vỡ tie một cách xác định (best description match; nếu vẫn tie, không nạp cái nào và để `agentPlanningHints`/bare planner xử lý — không bao giờ nạp hai). `plan.md`/`write.md` của 9 skill không được chọn không bao giờ vào bất kỳ prompt nào. (sdlc-rtm và sdlc-traceability cố ý tách rời trong description — một request coverage-matrix thuần giải về rtm, một end-to-end bi-directional trace giải về traceability — nên selector không tie giữa chúng.)
3. **Chỉ nạp file của phase hiện tại.** `plan.md` của skill được chọn được nạp **chỉ ở Phase 2**; `write.md` của nó **chỉ ở Phase 3** — không bao giờ cả hai trong cùng lệnh gọi. Mỗi phase trả cho cùng lắm là ~một nửa skill.
4. **Chưng cất một lần, mang theo bản chưng cất.** Phase 2 gập các hint của `plan.md` vào structured plan (`acceptanceCriteria` per-section, retrieval/risk metadata). Phase 3 writer khi đó mang theo **`acceptanceCriteria` per-section ngắn và lát `write.md` guidance chỉ cho artifact của section đó** — không phải cả skill, không phải plan skill. Các criteria đã chưng cất là cái vượt qua phase boundary, không phải các source file.
5. **Agent-mode skip.** Khi request là agent mode và agent instruction đã bao phủ artifact (khối `## Skill` của nó + `agentPlanningHints`), skill body là một fallback và **có thể được bỏ qua hoàn toàn** — chỉ nạp nó để lấp đầy discipline mà instruction không nêu (§A.10 mode rule). Đường đi agent-mode phổ biến nạp **không skill body nào cả**.
6. **Budget slots (bắt buộc).** Lát được nạp PHẢI vừa các per-phase budget hiện có: ở Phase 2 các hint dẫn xuất từ `plan.md` tính vào planner's **≤3k input** (§5) — chưng cất, không paste cả; ở Phase 3 lát `write.md` guidance chiếm **dòng "writer-guidance slice" của bảng token per-section (§6)** (≤~250 token), bên trong assembly per-section ~6–8k. Nếu một skill file lớn hơn slot của nó, orchestrator nạp một lát truncated/relevant — nó không bao giờ tràn ngân sách để vừa một skill.

**Net effect:** một request không cần artifact skill chỉ trả cho metadata-catalog scan nhỏ xíu; một request cần một cái trả cho một lát phase-file mỗi lần, được chưng cất để vừa. Thêm nhiều artifact skill làm tăng metadata catalog tuyến tính (rẻ) nhưng không bao giờ làm tăng per-call prompt size (tối đa một skill).

---

## Appendix B — So sánh hai kết quả nghiên cứu và các quyết định hợp nhất

**Convergence (cả hai báo cáo đều độc lập khuyến nghị):** dời retrieval + reranking từ các global phase vào per-section generation; tái dùng một orchestrator cho cả hai mode qua một lớp normalization thay vì một pipeline thứ hai; làm outliner conditional/loại bỏ nó như một standalone gate; một evidence-sufficiency check trước generation với các retry bounded (không free-form ReAct); citation binding trong khi generation với các quy tắc no-invented-citation nghiêm ngặt; một validation-only final phase; và không bao giờ auto-add title/TOC/references hay bất kỳ nội dung không được yêu cầu nào.

**Backbone — `claude-generative-orchestrator-v2-research-spec.md`.** Được chọn làm base vì nó trực tiếp thực thi được bởi một coding agent: các data contract và JSON schema cụ thể, các ngân sách token và latency cứng cho một local model 16k, một phân tích ngân sách lệnh gọi LLM, thiết kế deterministic-first (deterministic outline derivation, deterministic citation validation, deterministic assembly), các prompt sẵn-sàng-production với schema/temperature/example, một checklist acceptance-criteria hợp nhất, các bản ghi rejected-alternatives cho mọi quyết định, và một appendix đầy đủ của tám SDLC agent template vốn cũng đồng thời là các integration fixture.

**Tiếp nhận từ `gpt-search-agent.md` (các thế mạnh riêng của nó):** chuỗi precedence tường minh bao gồm mức agent-skill và các quy tắc security không thể ghi đè (tenant filter, KB ACL, system safety) cộng các agent override lock (§4.1); phát hiện và phân loại requirement-heading nuôi planning và coverage audit (§4.4, §9.6); domain-risk escalation cho healthcare/legal/compliance/finance/security với phán định sufficiency nghiêm ngặt hơn và forced citation/assumption policy (§5, §7, §9.4); các trường evidence-policy per-section, đáng chú ý `assumptionsAllowed` (§3.2); tùy chọn heuristic-first cho sufficiency gate (§7); retrieval/rerank caching và job-state persistence/resume cộng section streaming (§6, §10); danh mục generation-pattern như các planner fixture (§5.1); danh sách forbidden auto-content đầy đủ (§8); và các quy tắc writer-prompt chống các requirement ID / API name / screen name / DB field / workflow name / medical fact bịa ra, và chống in các internal note hoặc AI self-reference (§9.3).

**Cố ý không mang sang từ báo cáo GPT:** Intent-&-Requirement-Analyzer riêng của nó, standalone Conditional Outliner, per-section Evidence Planner, LLM Section Validator, LLM Output Assembler, và LLM Final Validator như các lệnh gọi LLM riêng biệt — dưới các ràng buộc 16k/1–3-phút các cái này thêm các sequential gate để đổi lấy lợi ích ít ỏi; mỗi trách nhiệm được bảo toàn nhưng hiện thực hóa một cách xác định hoặc gập vào một lệnh gọi hiện có, như truy vết ở §9.8.
