# Bộ đặc tả nền tảng AI Agent có quản trị context và RAG

## Mục đích

Bộ tài liệu này là blueprint độc lập để xây dựng một ứng dụng AI agent khác. Nó mô tả yêu cầu sản phẩm, kiến trúc, contract, dữ liệu, thuật toán, bảo mật, kiểm thử và thứ tự triển khai. Không yêu cầu phụ thuộc vào Hermes.

## Phạm vi

Hệ thống đích cung cấp bốn nhóm năng lực:

1. **Context engineering**: chọn, cấu trúc và đưa đúng thông tin vào mỗi model request.
2. **Context management**: lưu, đo, nén, tìm lại và quản lý vòng đời context.
3. **Harness engineering**: vận hành agent loop, tools, approvals, subagents, scheduler và provider transports.
4. **Document RAG**: ingest tài liệu, lập chỉ mục hybrid, truy xuất, rerank và tạo citation.

## Cách đọc

| File | Nội dung | Phụ thuộc |
|---|---|---|
| [00-system-architecture.md](00-system-architecture.md) | Kiến trúc tổng thể và data flow | Không |
| [01-context-engineering-spec.md](01-context-engineering-spec.md) | Prompt, context blocks, budget và assembly | 00 |
| [02-context-management-spec.md](02-context-management-spec.md) | Session, transcript, compression, cache, memory | 00, 01 |
| [03-harness-engineering-spec.md](03-harness-engineering-spec.md) | Agent runtime, tools, approvals, subagents, jobs | 00–02 |
| [04-rag-document-rag-spec.md](04-rag-document-rag-spec.md) | Document ingestion và hybrid retrieval | 00, 01, 05 |
| [05-cross-cutting-contracts.md](05-cross-cutting-contracts.md) | Auth, errors, events, idempotency, observability | Tất cả |
| [06-implementation-roadmap.md](06-implementation-roadmap.md) | Trình tự triển khai và quality gates | Tất cả |

## Quy ước yêu cầu

- **MUST**: bắt buộc để tương thích và an toàn.
- **SHOULD**: mặc định phải làm; chỉ bỏ khi có lý do được ghi nhận.
- **MAY**: tùy chọn.
- ID dạng `CE-FR-001`, `CM-NFR-002`, `HR-AC-003`, `RAG-SEC-004` dùng để liên kết code, test và ticket.

## Reference stack

Contract không phụ thuộc ngôn ngữ. Một triển khai tham chiếu có thể dùng:

- HTTP service: FastAPI, NestJS, Go hoặc tương đương.
- Database: PostgreSQL với full-text search và pgvector.
- Object storage: S3-compatible cho tài liệu gốc và artifact.
- Queue: PostgreSQL job table cho MVP; Redis/queue broker khi chạy nhiều worker.
- Cache/lock: PostgreSQL advisory locks cho MVP; Redis khi throughput yêu cầu.
- Model providers: adapter trung lập vendor.

## Nguyên tắc bất biến

1. System prompt của một session MUST byte-stable; chỉ context compression được phép tạo generation mới.
2. Transcript bền vững MUST tách khỏi request context tạm thời.
3. Không được có hai message cùng role liên tiếp sau bước chuẩn hóa, trừ chuỗi tool-call hợp lệ.
4. Tool schema chỉ xuất hiện khi tool khả dụng và được phép.
5. Mọi mutation nguy hiểm MUST đi qua authorization/approval trước khi thực thi.
6. Retrieval MUST áp dụng tenant/document ACL trước khi xếp hạng và trả citation.
7. Compression, retrieval và tool execution MUST fail-soft: lỗi phụ trợ không được làm mất transcript.
8. Mọi request thay đổi trạng thái MUST hỗ trợ idempotency.

## Definition of done toàn hệ thống

- Contract API và event có schema validation.
- Database migration có forward/rollback strategy.
- Unit, integration, E2E, load và failure-injection tests đạt quality gate.
- Có audit log cho mutation, approval, retrieval và administrative action.
- Có metric về latency, token, cache hit, retrieval quality và tool outcome.
- Không có secret hoặc dữ liệu tenant khác trong prompt, log hay citation.
