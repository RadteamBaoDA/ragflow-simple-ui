# Spec: Context Engineering

## 1. Mục tiêu

Context Assembler tạo một model request có đủ thông tin cần thiết, đúng thứ tự, đúng quyền truy cập và nằm trong token budget. Nó không sở hữu transcript hoặc vector index.

## 2. Context block model

```json
{
  "id": "ctx_01J...",
  "kind": "system|policy|workspace|profile|skill|memory|retrieval|conversation|tool_schema|ephemeral",
  "content": "string hoặc provider-neutral content parts",
  "priority": 0,
  "required": true,
  "stable_scope": "global|application|tenant|session|turn",
  "token_estimate": 420,
  "source": {"type": "document_chunk", "id": "chk_...", "version": 3},
  "security": {"classification": "internal", "tenant_id": "ten_..."},
  "expires_at": null
}
```

Priority nhỏ hơn được giữ trước. `required=true` nghĩa là request MUST fail nếu block không vừa budget; không được âm thầm bỏ policy.

## 3. Prompt tiers

Context MUST được nối theo thứ tự:

1. `stable`: identity, global policy, tool-use rules.
2. `session`: tenant policy, workspace instructions, session-stable profile.
3. `volatile`: skill index, recalled memory, retrieval passages.
4. `conversation`: compressed snapshot và recent messages.
5. `turn`: current user input, attachment notes, ephemeral instruction.

Stable và session tiers MUST byte-stable trong một session generation. Timestamp, usage counter và dynamic retrieval không được đặt trước cache boundary.

## 4. Functional requirements

- `CE-FR-001`: Xây context từ typed blocks, không nối chuỗi tùy ý ở call site.
- `CE-FR-002`: Giữ nguyên thứ tự deterministic với cùng input/version.
- `CE-FR-003`: Hỗ trợ text, image reference và tool-result content parts.
- `CE-FR-004`: Áp dụng tenant ACL trước khi nhận memory/retrieval block.
- `CE-FR-005`: Ước lượng token bằng tokenizer của model; fallback heuristic chỉ dùng khi tokenizer không có.
- `CE-FR-006`: Gán budget theo category và tái phân bổ phần dư.
- `CE-FR-007`: Truncate theo head/tail hoặc passage boundary, không cắt giữa structured content/code block nếu parser biết boundary.
- `CE-FR-008`: Chọn skill/tool schema theo capability và query, không gửi toàn catalog.
- `CE-FR-009`: Hỗ trợ ephemeral instruction chỉ tồn tại trong một provider request.
- `CE-FR-010`: Sinh `ContextManifest` để audit block nào đã được dùng/bỏ.
- `CE-FR-011`: Chuẩn hóa message role và tool transaction trước khi gửi provider.
- `CE-FR-012`: Redact secret trước model egress theo tenant policy.
- `CE-FR-013`: Context source failure không được làm mất user message.
- `CE-FR-014`: Mọi retrieval passage phải giữ citation metadata.

## 5. Budget policy

```yaml
context:
  reserve_output_tokens: 4096
  safety_margin_tokens: 1024
  allocations:
    system: {min: 1000, max_percent: 20}
    tools: {min: 0, max_percent: 15}
    retrieval: {min: 0, max_percent: 25}
    memory: {min: 0, max_percent: 10}
    conversation: {min: 1000, max_percent: 55}
  required_overflow: fail
```

Available input budget:

```text
model_context_window - reserve_output_tokens - safety_margin_tokens
```

Thuật toán:

```text
validate required blocks and ACL
tokenize every block
reserve minimum budget for required categories
if required total > available: return CONTEXT_REQUIRED_OVERFLOW
allocate remaining tokens up to each category cap
within category: required first, then priority, then relevance, then stable id
truncate only blocks declaring a truncation strategy
emit manifest and provider-neutral messages
```

## 6. Selection interfaces

```text
ContextSource.collect(ContextRequest) -> list[ContextBlock]
ContextPolicy.authorize(block, principal) -> Decision
ContextSelector.select(blocks, budget) -> SelectionResult
ContextRenderer.render(selection, provider) -> ModelRequest
Tokenizer.count(content, model) -> int
```

```json
{
  "session_id": "ses_...",
  "turn_id": "trn_...",
  "tenant_id": "ten_...",
  "model": {"provider": "...", "name": "...", "context_window": 128000},
  "query": "current user query",
  "enabled_capabilities": ["terminal", "document_search"],
  "budget_tokens": 122880
}
```

## 7. Context manifest

```json
{
  "request_id": "req_...",
  "prompt_hash": "sha256:...",
  "total_tokens": 18420,
  "blocks": [
    {"id": "ctx_...", "included": true, "tokens": 812, "truncated": false},
    {"id": "ctx_...", "included": false, "reason": "category_budget"}
  ],
  "warnings": []
}
```

Manifest MUST lưu metadata, hash và token count; SHOULD NOT lưu lại plaintext nhạy cảm đã có ở source of truth.

## 8. Tool và skill disclosure

- Core schemas nhỏ và luôn cần MAY nằm trong stable tier.
- Tool tùy chọn nằm trong searchable catalog gồm name, short description, capability và auth class.
- Model gọi `tool_search`/router để lấy schema đầy đủ.
- Skill index chỉ chứa name, description và activation conditions; nội dung đầy đủ được tải khi skill được chọn.
- Tool/skill bị ACL hoặc health check từ chối MUST không xuất hiện trong catalog.

## 9. Failure handling

| Lỗi | Hành vi |
|---|---|
| Tokenizer unavailable | Dùng heuristic cấu hình; gắn warning |
| Required block overflow | Dừng trước model call, trả lỗi có action `/compress` hoặc model lớn hơn |
| Retrieval timeout | Tiếp tục không RAG nếu policy cho phép; ghi partial warning |
| Invalid role sequence | Chuẩn hóa nếu không mất nghĩa; nếu không, quarantine request |
| Secret detected | Redact hoặc block theo policy; audit |
| Provider content incompatibility | Adapter chuyển đổi; không sửa durable block |

## 10. Security

- `CE-SEC-001`: Block tenant khác MUST bị từ chối trước ranking/rendering.
- `CE-SEC-002`: Prompt injection từ document được đánh dấu là untrusted evidence, không phải instruction.
- `CE-SEC-003`: Policy/system blocks không được tạo từ user-controlled source.
- `CE-SEC-004`: URL credentials, API keys và secret patterns phải được redact trước egress/log.
- `CE-SEC-005`: Context manifest phải audit được source/version của mỗi block.

## 11. Observability

Metrics:

- `context_tokens_total{kind,model}`
- `context_blocks_included_total{kind}`
- `context_blocks_dropped_total{reason}`
- `context_assembly_duration_ms`
- `context_required_overflow_total`
- `prompt_cache_prefix_tokens`

Trace spans: `context.collect`, `context.authorize`, `context.select`, `context.render`.

## 12. Tests và acceptance

- `CE-AC-001`: Cùng input/version sinh cùng prompt hash.
- `CE-AC-002`: Thay retrieval result không làm đổi stable-prefix hash.
- `CE-AC-003`: Required policy không bao giờ bị drop để nhường chỗ conversation.
- `CE-AC-004`: Passage tenant B không xuất hiện trong manifest tenant A.
- `CE-AC-005`: Request sát giới hạn vẫn chừa đúng output reserve và safety margin.
- `CE-AC-006`: Tool transaction sau chuẩn hóa được provider chấp nhận.
- `CE-AC-007`: Citation metadata sống qua truncate/render.
- `CE-AC-008`: Fuzz test structured content không làm renderer crash hoặc leak secret.
