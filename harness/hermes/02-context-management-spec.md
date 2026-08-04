# Spec: Context Management

## 1. Mục tiêu

Quản lý vòng đời hội thoại mà không mất lịch sử: persistence, resume, branch, rewind, token accounting, compression, prompt caching và long-term memory.

## 2. Domain model

```text
Session 1─N SessionGeneration 1─N Message
Session 1─N Branch
SessionGeneration 1─N ContextSnapshot
Session 1─N TokenUsage
Session 1─N MemoryRecord
```

`SessionGeneration` tăng khi `/new`, reset, branch hoặc compression rotation tạo một active context mới. Original messages không bị xóa; trạng thái `active|archived|rewound` quyết định chúng có vào context hay không.

## 3. Functional requirements

- `CM-FR-001`: Append message atomically và idempotently.
- `CM-FR-002`: Resume session từ active generation cuối.
- `CM-FR-003`: Branch từ một message boundary mà không copy binary artifacts.
- `CM-FR-004`: Rewind dùng soft state; có thể restore.
- `CM-FR-005`: Search transcript theo tenant, workspace, session và time range.
- `CM-FR-006`: Theo dõi prompt/output/cache/reasoning token cho mỗi provider call.
- `CM-FR-007`: Preflight compression trước model call nếu estimate vượt threshold.
- `CM-FR-008`: Post-turn compression/pruning khi usage thực vượt threshold.
- `CM-FR-009`: Giữ verbatim head/tail và tạo structured summary ở giữa.
- `CM-FR-010`: Compression phải chứng minh giảm token; nếu không, tăng ineffective counter và cooldown.
- `CM-FR-011`: Tool output cũ có thể prune deterministic mà không gọi LLM.
- `CM-FR-012`: Prompt cache decoration chỉ tồn tại trong request copy.
- `CM-FR-013`: Memory prefetch trước turn và sync sau turn không block final response.
- `CM-FR-014`: Retention/prune không được xóa lineage đang được tham chiếu.
- `CM-FR-015`: Session write và compression dùng lock/fence chống concurrent commit.

## 4. Database schema tối thiểu

```sql
CREATE TABLE sessions (
  id text PRIMARY KEY,
  tenant_id text NOT NULL,
  workspace_id text,
  title text,
  status text NOT NULL CHECK (status IN ('active','ended','archived')),
  active_generation integer NOT NULL DEFAULT 1,
  parent_session_id text REFERENCES sessions(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  version bigint NOT NULL DEFAULT 0
);

CREATE TABLE messages (
  id text PRIMARY KEY,
  tenant_id text NOT NULL,
  session_id text NOT NULL REFERENCES sessions(id),
  generation integer NOT NULL,
  sequence bigint NOT NULL,
  role text NOT NULL CHECK (role IN ('system','user','assistant','tool')),
  content jsonb,
  tool_call_id text,
  state text NOT NULL DEFAULT 'active',
  content_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (session_id, generation, sequence),
  UNIQUE (session_id, content_hash, sequence)
);

CREATE TABLE context_snapshots (
  id text PRIMARY KEY,
  tenant_id text NOT NULL,
  session_id text NOT NULL REFERENCES sessions(id),
  source_generation integer NOT NULL,
  target_generation integer NOT NULL,
  summary jsonb NOT NULL,
  source_token_count integer NOT NULL,
  target_token_count integer NOT NULL,
  status text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE token_usage (
  id bigserial PRIMARY KEY,
  tenant_id text NOT NULL,
  session_id text NOT NULL,
  run_id text NOT NULL,
  provider text NOT NULL,
  model text NOT NULL,
  input_tokens integer NOT NULL DEFAULT 0,
  output_tokens integer NOT NULL DEFAULT 0,
  cache_read_tokens integer NOT NULL DEFAULT 0,
  cache_write_tokens integer NOT NULL DEFAULT 0,
  reasoning_tokens integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (run_id, provider, model)
);
```

Mọi index MUST bắt đầu bằng `tenant_id` với truy vấn multi-tenant. Có thể dùng PostgreSQL row-level security như lớp phòng thủ thứ hai.

## 5. Compression state machine

```text
idle → estimating → lock_acquired → summarizing → validating → committing → completed
                     └────────────→ skipped_locked
summarizing/validating/committing → failed → cooldown → idle
validating → ineffective → cooldown
```

Default policy:

```yaml
compression:
  enabled: true
  threshold_percent: 75
  target_percent: 45
  protect_first_messages: 3
  protect_last_messages: 8
  max_attempts_per_turn: 2
  lock_ttl_seconds: 300
  failure_cooldown_seconds: 120
  minimum_token_reduction_percent: 15
  tool_result_prune_after_tokens: 32000
```

## 6. Structured summary contract

```json
{
  "version": 1,
  "user_goal": "...",
  "constraints": ["..."],
  "decisions": [{"decision": "...", "reason": "..."}],
  "completed_work": ["..."],
  "open_work": ["..."],
  "artifacts": [{"type": "file", "uri": "...", "state": "modified"}],
  "tool_state": [{"tool": "...", "fact": "..."}],
  "errors_and_attempts": ["..."],
  "important_quotes": ["..."],
  "continuation_instruction": "Respond to the next user message, not this summary."
}
```

Summary MUST không chứa fabricated completion. Validator kiểm tra JSON schema, role alternation, preserved user turn và token reduction trước commit.

## 7. Commit algorithm

```text
begin transaction
lock session row and verify version/generation
verify compression lease holder
insert snapshot with status=committing
mark compacted source messages archived (never delete)
insert protected head + summary + protected tail into target generation
validate monotonic sequence and tool-call pairing
switch session.active_generation
increment session.version
mark snapshot completed
commit
```

Nếu commit thất bại, source generation vẫn active và đọc được.

## 8. Prompt caching

- Cache key SHOULD là hash của provider, model, tool schema version và stable/session prompt prefix.
- Provider cache markers được gắn trên deep/shallow safe copy tùy content ownership.
- Failover MUST strip marker cũ rồi decorate theo provider mới.
- Dynamic timestamp, retrieved passages và turn input không nằm trong stable key.
- Cache metrics phải tách read/write tokens và monetary saving nếu pricing có sẵn.

## 9. Memory lifecycle

```text
turn start → query rewrite → prefetch cached/retrieved memory → context assembly
turn complete → enqueue sync/extraction → queue prefetch for next turn
pre-compress → extract critical facts → compress
session end → final extraction/flush
```

Chỉ một external memory backend SHOULD active cho một session. Built-in memory có thể làm fallback. Greeting, acknowledgement và command không semantic SHOULD bỏ qua retrieval.

## 10. APIs

```text
POST /v1/sessions
GET  /v1/sessions/{id}
GET  /v1/sessions/{id}/messages?cursor=&limit=
POST /v1/sessions/{id}/branches
POST /v1/sessions/{id}/rewind
POST /v1/sessions/{id}/rewind/restore
POST /v1/sessions/{id}/compress
GET  /v1/sessions/{id}/context-usage
GET  /v1/sessions/search?q=&workspace_id=
```

Mutation dùng `Idempotency-Key` và `If-Match: <session-version>`.

## 11. Retention

- Active transcript không tự động hard-delete.
- Archived sessions MAY chuyển sang cold storage theo tenant policy.
- Hard delete phải cascade documents/memory chỉ khi ownership cho phép và ghi audit tombstone.
- Legal hold chặn prune/delete.
- Search index phải phản ánh soft-delete trong cùng transaction hoặc qua outbox có reconciliation.

## 12. Observability

- `session_message_append_duration_ms`
- `session_version_conflict_total`
- `compression_attempt_total{outcome}`
- `compression_token_reduction_ratio`
- `compression_lock_wait_ms`
- `memory_prefetch_duration_ms{provider}`
- `prompt_cache_hit_tokens_total{provider}`
- `session_search_duration_ms`

## 13. Tests và acceptance

- `CM-AC-001`: Crash ở mọi điểm compression commit vẫn resume được source hoặc target hợp lệ, không trạng thái nửa vời.
- `CM-AC-002`: Hai compressor đồng thời chỉ một bên commit.
- `CM-AC-003`: Branch/rewind không thay đổi parent transcript.
- `CM-AC-004`: Provider failover không để cache marker vào database.
- `CM-AC-005`: Search không trả message archived vì tenant policy loại bỏ.
- `CM-AC-006`: Compression summary giữ constraint, artifact và open work trong test corpus chuẩn.
- `CM-AC-007`: Tool call/result pairing hợp lệ sau prune và compression.
- `CM-AC-008`: Idempotent retry không tạo message hoặc token usage trùng.
