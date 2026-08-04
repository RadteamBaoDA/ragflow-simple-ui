# Spec: Cross-cutting Contracts

## 1. Identifier và versioning

- ID dùng ULID/UUIDv7, prefix theo entity: `ten_`, `ses_`, `run_`, `trn_`, `msg_`, `call_`, `doc_`, `chk_`.
- Public API dùng opaque ID; client không suy luận tenant/time từ ID.
- API version ở path `/v1`; schema/event có trường `schema_version`.
- Breaking change tạo version mới; additive field không breaking.

## 2. HTTP envelope

Success:

```json
{"data": {}, "meta": {"request_id": "req_...", "next_cursor": null}}
```

Error:

```json
{
  "error": {
    "code": "CONTEXT_REQUIRED_OVERFLOW",
    "message": "Required context exceeds model input budget",
    "retryable": false,
    "details": {"required_tokens": 140000, "available_tokens": 122880}
  },
  "meta": {"request_id": "req_..."}
}
```

Error code ổn định; message có thể thay đổi. Không trả stack trace, secret hoặc provider raw body cho client.

## 3. Idempotency và optimistic concurrency

- Mọi `POST/PATCH/DELETE` có side effect MUST nhận `Idempotency-Key`.
- Server lưu tenant + route + key + normalized request hash + response trong retention window.
- Cùng key khác payload trả `409 IDEMPOTENCY_KEY_REUSED`.
- Resource có `version`; update nhận `If-Match` hoặc body `expected_version`.
- External side effect dùng outbox/inbox và provider idempotency key nếu có.

## 4. Event envelope

```json
{
  "event_id": "evt_...",
  "schema_version": 1,
  "type": "tool.completed",
  "tenant_id": "ten_...",
  "aggregate_type": "run",
  "aggregate_id": "run_...",
  "sequence": 12,
  "occurred_at": "2026-08-04T10:00:00Z",
  "trace_id": "...",
  "data": {}
}
```

Ordering chỉ được đảm bảo trong một aggregate. Consumer MUST idempotent theo `event_id`. Transactional outbox đảm bảo database commit và event publication không lệch.

## 5. Authentication và authorization

- Human/API clients dùng OIDC/JWT hoặc signed service credentials.
- Principal gồm tenant, subject, roles, scopes và authentication strength.
- Authorization là deny-by-default.
- Service-to-service token ngắn hạn, audience-bound.
- Tenant ID lấy từ verified identity, không tin body/header tùy ý.
- Administrative impersonation cần explicit reason, short TTL và audit.

## 6. Tenant isolation

- Mọi durable row có `tenant_id`.
- Repository methods bắt buộc nhận tenant context.
- Database RLS SHOULD bật ở production.
- Object key prefix và encryption context chứa tenant ID.
- Queue message và cache key chứa tenant ID.
- Integration tests chạy cùng ID logic trên hai tenant và chứng minh không cross-read/write.

## 7. Data classification

| Class | Ví dụ | Logging | Model egress |
|---|---|---|---|
| Public | Public web docs | Được phép | Được phép |
| Internal | Workspace docs | Metadata only | Theo tenant policy |
| Confidential | User memory, private files | Redacted | Chỉ approved providers |
| Secret | API keys, tokens | Không bao giờ | Không bao giờ |

Secret store giữ credential; database chỉ giữ reference. Rotation không cần sửa application config records.

## 8. Retry, timeout và circuit breaker

| Operation | Default timeout | Retry |
|---|---:|---:|
| Database statement | 5 s | transaction-level khi serialization/deadlock |
| Retrieval | 2 s | 1 nếu idempotent |
| Embedding batch | 30 s | 3 với jitter |
| Rerank | 5 s | 1 rồi fallback |
| Model request | 120 s idle / configurable total | provider policy |
| Tool | 30 s | chỉ nếu tool khai báo idempotent |

Circuit breaker theo provider/tenant credential pool. Open breaker phải fail fast và thử fallback nếu policy cho phép.

## 9. Pagination

- Dùng opaque cursor, không dùng offset cho transcript/audit lớn.
- Cursor bind tenant, filters, sort và snapshot boundary.
- Default 50, maximum 200 records.
- Instruction/skill content bắt buộc đọc đầy đủ không cung cấp pagination trốn đọc.

## 10. Configuration

Precedence:

```text
hardcoded safe defaults < deployment config < tenant config < session overrides
```

Secrets không nằm trong behavioral config. Config snapshot/version được gắn vào run để replay. Thay đổi ảnh hưởng system prompt chỉ áp dụng session mới hoặc generation mới có explicit transition.

## 11. Audit log

Audit events tối thiểu:

- Session/document hard delete.
- ACL và role changes.
- Approval requested/decided/used.
- Tool external side effect.
- Admin override/impersonation.
- Secret reference change.
- Checkpoint restore.
- Retrieval denial và policy block.

Audit log append-only, có actor, reason, target, before/after hashes và trace ID. Không lưu plaintext secret/document.

## 12. Observability

### Structured logs

Fields: timestamp, level, service, environment, tenant hash, request/run/session IDs, trace/span IDs, event, duration, outcome và safe error code.

### Tracing

W3C trace context đi qua HTTP, queue, model, tool, retrieval và worker. Content/prompt không mặc định ghi vào span.

### Alerting tối thiểu

- Error rate/SLO burn.
- Queue lag và expired leases.
- Compression failure/cooldown spike.
- Retrieval empty-rate drift.
- Ingestion dead letter.
- Provider auth/rate-limit spike.
- Cross-tenant policy violation, mức critical.

## 13. Rate limits và quotas

Limit theo tenant/principal cho requests, concurrent runs, model tokens, document bytes, embedding jobs và tool calls. Response dùng `429`, `Retry-After` và quota metadata. Job đang chạy phải checkpoint/finalize an toàn khi quota hết.

## 14. Backup và disaster recovery

- PostgreSQL PITR và restore drill định kỳ.
- Object storage versioning theo policy.
- Vector index có thể rebuild từ chunks; không phải source of truth duy nhất.
- RPO/RTO được cấu hình theo deployment; mặc định mục tiêu RPO ≤ 5 phút, RTO ≤ 60 phút.
- Restore test phải kiểm tra transcript, active document versions và ACL.

## 15. API compatibility tests

- JSON schema contract tests cho request/response/event.
- Golden tests chỉ cho contract ổn định, không đóng băng dynamic catalogs/counts.
- Consumer-driven tests cho provider/tool/parser adapters.
- Security tests cho auth bypass, IDOR, injection, SSRF, path traversal và tenant isolation.

## 16. Cross-cutting acceptance

- `CC-AC-001`: Duplicate mutation request trả cùng response và chỉ một side effect.
- `CC-AC-002`: Event replay không tạo duplicate state.
- `CC-AC-003`: Secret scanner không tìm thấy credential trong log/trace/prompt fixture.
- `CC-AC-004`: Database, cache, queue và object storage đều từ chối cross-tenant fixture.
- `CC-AC-005`: Restore từ backup tạo hệ thống nhất quán và retrieval hoạt động.
