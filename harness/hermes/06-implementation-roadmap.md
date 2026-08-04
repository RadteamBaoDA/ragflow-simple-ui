# Implementation Roadmap

## 1. Chiến lược

Triển khai theo vertical slices có thể chạy E2E. Không xây plugin framework, distributed queue hoặc nhiều provider trước khi default implementation hoạt động và có consumer thật.

## 2. Phase 0 — Foundation

### Deliverables

- Project skeleton, config loader và dependency boundaries.
- PostgreSQL migrations, tenant/principal middleware.
- Error envelope, IDs, idempotency store và transactional outbox.
- Structured logging, metrics và tracing.
- CI: lint, typecheck, unit, integration với database thật.

### Exit gate

- Tạo tenant/session qua authenticated API.
- Idempotency và tenant isolation E2E pass.
- Migration chạy từ empty DB và rollback/reapply trong CI.

## 3. Phase 1 — Conversation và một-turn model call

### Deliverables

- Session/message persistence.
- Một model provider adapter.
- Context block model và deterministic assembler.
- Non-streaming turn API, token usage và final response persistence.

### Exit gate

- User message → model → assistant message chạy E2E.
- Retry request không tạo duplicate message.
- Prompt hash deterministic; stable tier không đổi qua turn.

## 4. Phase 2 — Agent harness và tools

### Deliverables

- Agent run/step state machine và streaming events.
- Tool registry, JSON schema validation và một read-only tool.
- Tool result persistence, timeout, cancel và output spill.
- Approval flow và một reversible mutation tool.
- Iteration budget và provider retry/failover boundary.

### Exit gate

- Model gọi tool rồi trả final response.
- Interrupt và timeout vẫn tạo transcript hợp lệ.
- Approval scope/tenant isolation tests pass.

## 5. Phase 3 — Context management

### Deliverables

- Resume, branch, rewind/restore và transcript search.
- Token preflight và context usage endpoint.
- Deterministic tool-result pruning.
- Compression state machine, lock, structured summary, validation và atomic commit.
- Provider request-local prompt caching.

### Exit gate

- Conversation vượt context threshold tiếp tục được sau compression.
- Crash/failure injection ở mọi commit boundary không làm mất history.
- Cache decoration không xuất hiện trong durable transcript.

## 6. Phase 4 — Document RAG MVP

### Deliverables

- Collection/document APIs và object storage.
- Text/Markdown/PDF/DOCX parsers trong sandbox.
- Structure-aware chunker.
- PostgreSQL FTS và một embedding adapter với pgvector.
- BM25/vector retrieval, RRF, citation assembly.
- Retrieval context source nối vào Context Assembler.

### Exit gate

- Upload → ready → ask → grounded answer với citation chạy E2E.
- ACL revocation có hiệu lực tức thời.
- Evaluation baseline và latency report được lưu trong CI artifact.

## 7. Phase 5 — RAG quality và memory

### Deliverables

- Query rewrite/expansion và optional reranker.
- Diversity, dedup, cache và reconciliation.
- Prompt-injection evidence labeling.
- Memory provider interface, one default backend, prefetch/sync lifecycle.
- Offline evaluation runner: Recall@K, MRR/nDCG, citation precision/coverage.

### Exit gate

- Hybrid pipeline tốt hơn hoặc bằng từng retriever đơn trên locked dataset.
- Reranker failure fallback không làm turn fail.
- Memory sync không tăng final-response latency đáng kể.

## 8. Phase 6 — Subagents, scheduler và checkpoints

Chỉ bắt đầu khi có use case thực.

### Deliverables

- Child run lifecycle, capability/budget isolation và cancellation propagation.
- Scheduler lease/heartbeat/dead-letter.
- Filesystem checkpoint + preview/restore.
- Audit và operational dashboards.

### Exit gate

- Parent restart có thể reconnect child.
- Multi-scheduler test không double-run.
- Checkpoint restore byte-exact và có audit trail.

## 9. Phase 7 — Scale và production hardening

### Deliverables

- Queue/cache adapter khi PostgreSQL-only được đo là bottleneck.
- Multi-instance load test, autoscaling và backpressure.
- Backup/PITR restore drill.
- Security review, threat model và penetration tests.
- SLO dashboards, runbooks và cost controls.

### Exit gate

- Đạt SLO trong workload đại diện.
- Không có high/critical security finding mở.
- Recovery drill đạt RPO/RTO.

## 10. Work breakdown theo module

| Module | First implementation | Extension point sau |
|---|---|---|
| Model | Một provider | Adapter registry khi provider thứ hai xuất hiện |
| Tools | Registry + 2 tools | Plugin discovery khi có external tool package |
| Queue | PostgreSQL job table | Redis/broker khi throughput cần |
| Search | PostgreSQL FTS/pgvector | External vector adapter khi scale cần |
| Memory | Một backend | Provider interface khi có backend thứ hai |
| Parser | Text/MD/PDF/DOCX | Parser plugins theo format mới |
| Scheduler | Database lease | Dedicated scheduler khi job volume cần |

## 11. Test matrix bắt buộc

| Layer | Test |
|---|---|
| Unit | Budget allocator, role normalization, chunker, RRF, policy decisions |
| Contract | API/event JSON Schema, provider/tool/parser interfaces |
| Integration | PostgreSQL, pgvector, object storage, model/tool test doubles |
| E2E | Chat, tool approval, compression, upload-to-citation, branch/resume |
| Failure injection | Crash commit, timeout, rate limit, missing vector, expired lease |
| Security | Tenant isolation, prompt injection, SSRF, path traversal, malicious docs |
| Load | Concurrent turns, ingestion burst, retrieval p95, scheduler contention |
| Evaluation | Retrieval relevance, citation grounding, compression preservation |

## 12. Definition of done cho mỗi ticket

- Requirement/acceptance ID được ghi trong ticket và test.
- Code đi qua public interface của module.
- Migration và rollback/reconciliation được mô tả nếu đổi dữ liệu.
- Error/retry/idempotency được xử lý.
- Metric/log/audit cần thiết được thêm.
- Unit hoặc integration check nhỏ nhất chứng minh hành vi.
- Không thêm abstraction nếu chưa có ít nhất một consumer thực.

## 13. Release strategy

- Feature flags chỉ cho rollout rủi ro, không dùng làm kho dead code.
- Database expand → deploy writers/readers tương thích → migrate data → contract.
- Canary theo tenant nội bộ.
- Mỗi phase có rollback plan và dữ liệu rebuildable được đánh dấu rõ.
- Model/prompt version được pin theo run để so sánh trước/sau.

## 14. Checklist bắt đầu ngay

1. Chọn language/framework nhưng giữ nguyên contracts trong bộ spec.
2. Tạo migration cho tenant, session, message, idempotency và outbox.
3. Implement authenticated `POST /v1/sessions` và turn API.
4. Implement một provider adapter và deterministic context assembly.
5. Thêm E2E test một turn trước khi mở rộng tool/RAG.
6. Tiếp tục đúng phase order; không xây scale infrastructure trước số liệu.
