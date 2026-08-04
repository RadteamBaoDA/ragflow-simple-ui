# Spec: Harness Engineering

## 1. Mục tiêu

Harness biến model thành một agent có thể hành động: quản lý model loop, tools, approvals, concurrency, retries, interrupts, subagents, scheduled jobs và filesystem checkpoints.

## 2. Run model

```text
Run 1─N Step
Step = model_call | tool_batch | approval_wait | compression | finalization
ToolBatch 1─N ToolCall
Run 1─N ChildRun
```

Run state:

```text
queued → running ↔ waiting_approval → completing → completed
              ├→ interrupted
              ├→ budget_exhausted
              └→ failed
```

## 3. Agent loop

```text
load session and build turn context
while budget remains and not interrupted:
  call provider with timeout/retry policy
  persist assistant response envelope
  if final text and no tool calls: finalize
  validate every tool call against exposed schema
  authorize and partition calls into execution segments
  execute safe independent calls concurrently
  persist one result for every tool_call_id, including cancellation/error
  optionally prune large old tool results
finalize usage, memory sync, audit and stream terminal event
```

### Invariants

- Một assistant tool call MUST có đúng một tool-result message.
- Tool side effect MUST không retry nếu không có idempotency contract.
- Budget consume xảy ra trước model call; refund chỉ cho bước được policy chỉ định.
- Final response chỉ ACK sau khi durable transcript được commit.
- Interrupt phải để transcript ở sequence hợp lệ.

## 4. Functional requirements

- `HR-FR-001`: Adapter hỗ trợ nhiều model provider qua contract chung.
- `HR-FR-002`: Streaming event có sequence và có thể resume từ cursor.
- `HR-FR-003`: Tool registry tự kiểm tra name/schema uniqueness.
- `HR-FR-004`: Tool availability được gate theo config, credential, platform và health.
- `HR-FR-005`: Deferred tool catalog giảm schema gửi theo request.
- `HR-FR-006`: Tool executor hỗ trợ sequential, concurrent và segmented execution.
- `HR-FR-007`: Mutation tool đi qua approval policy.
- `HR-FR-008`: Timeout/cancel sinh normalized result thay vì bỏ trống tool call.
- `HR-FR-009`: Tool output lớn được spill vào object storage và trả preview + URI.
- `HR-FR-010`: Subagent có lifecycle launch/status/wait/cancel/result/reconnect.
- `HR-FR-011`: Child run được cách ly budget, session, capability và environment.
- `HR-FR-012`: Scheduler claim job bằng lease và ngăn double execution.
- `HR-FR-013`: Filesystem checkpoint tạo trước mutation khi policy bật.
- `HR-FR-014`: Run có thể replay ở chế độ không side effect để debug.
- `HR-FR-015`: Provider failover không lặp lại committed tool side effect.

## 5. Provider contract

```text
ModelProvider.capabilities() -> ProviderCapabilities
ModelProvider.stream(ModelRequest, CancellationToken) -> EventStream
ModelProvider.normalize_usage(raw) -> Usage
ModelProvider.classify_error(error) -> retryable|rate_limited|auth|invalid|fatal
ModelProvider.close() -> void
```

Capabilities gồm tools, parallel tools, vision, reasoning, prompt cache, maximum context và supported content types.

Retry mặc định: exponential backoff có jitter, tối đa 3 lần cho network/5xx/rate limit. Auth, validation và content policy lỗi không retry. Failover chỉ trước một uncommitted model step hoặc sau khi chứng minh request idempotent.

## 6. Tool definition

```json
{
  "name": "document_search",
  "version": "1.0.0",
  "description": "Search authorized documents",
  "input_schema": {"type": "object", "properties": {}, "additionalProperties": false},
  "capability": "retrieval.documents",
  "risk": "read_only|reversible_write|destructive|external_side_effect",
  "concurrency": "parallel_safe|path_scoped|exclusive",
  "timeout_seconds": 30,
  "max_result_bytes": 262144,
  "idempotent": true,
  "availability_check": "credential/document-index"
}
```

Handler:

```text
execute(ToolContext, validated_args, CancellationToken) -> ToolResult
```

`ToolResult` luôn có `status`, `content`, `artifacts`, `error`, `metrics` và `redactions`.

## 7. Authorization và approval

Decision ladder:

```text
deny policy → deny
explicit allow policy → allow
read-only and low risk → allow
session/user approval grant → allow
otherwise → request approval
```

Approval request:

```json
{
  "approval_id": "apr_...",
  "run_id": "run_...",
  "tool_call_id": "call_...",
  "risk": "destructive",
  "summary": "Delete 3 files under /workspace/tmp",
  "scope": {"paths": ["/workspace/tmp/a"]},
  "choices": ["once", "session", "always_for_scope", "deny"],
  "expires_at": "..."
}
```

Grant MUST bind tenant, principal, tool, normalized scope và expiration. Approval của run A không được unblock run B nếu scope không khớp.

## 8. Concurrency planner

- Read-only calls chạy song song.
- Writes chỉ chạy song song nếu resource scopes không overlap.
- Destructive/external side-effect calls mặc định sequential.
- Tool call phụ thuộc output call trước phải nằm segment sau.
- Authorization/approval được thực hiện trước khi worker mutation bắt đầu.
- Maximum workers, per-tool semaphore và global deadline đều cấu hình được.

## 9. Subagent contract

```json
{
  "goal": "bounded task",
  "parent_run_id": "run_...",
  "capabilities": ["file.read", "web.search"],
  "max_iterations": 30,
  "deadline_seconds": 900,
  "workspace": {"mode": "shared_read|isolated_copy|worktree"},
  "result_schema": {"type": "object"}
}
```

Parent chịu trách nhiệm merge kết quả; child không tự gửi external message hoặc mở rộng quyền. Cancellation lan từ parent xuống descendants. Registry giữ terminal result đủ lâu để parent reconnect.

## 10. Scheduler

Job fields: schedule/trigger, prompt hoặc handler, tenant, capability allowlist, delivery target, timeout, retry policy, next run và enabled state.

```text
due → claimed(lease) → running → delivering → succeeded
                    └→ retry_wait → claimed
                    └→ failed/dead_letter
```

Scheduler MUST dùng database time, unique execution key `(job_id, scheduled_at)` và heartbeat. Non-interactive job mặc định deny approval-required action trừ khi có pre-authorized scope.

## 11. Checkpoints

- Tạo trước file mutation hoặc command destructive.
- Tối đa một checkpoint cho một workspace mỗi turn nếu state chưa đổi.
- Store content-addressed để deduplicate.
- Restore hỗ trợ toàn workspace hoặc một file và luôn có preview diff.
- Checkpoint failure với risk cao MUST block mutation; với reversible write MAY warn theo policy.

## 12. Database tables

```sql
CREATE TABLE runs (
  id text PRIMARY KEY, tenant_id text NOT NULL, session_id text NOT NULL,
  parent_run_id text REFERENCES runs(id), state text NOT NULL,
  iteration_used integer NOT NULL DEFAULT 0, iteration_limit integer NOT NULL,
  lease_owner text, lease_expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE tool_calls (
  id text PRIMARY KEY, tenant_id text NOT NULL, run_id text NOT NULL REFERENCES runs(id),
  tool_name text NOT NULL, tool_version text NOT NULL, args jsonb NOT NULL,
  args_hash text NOT NULL, risk text NOT NULL, state text NOT NULL,
  result jsonb, artifact_uri text, started_at timestamptz, completed_at timestamptz,
  UNIQUE (run_id, id)
);

CREATE TABLE approvals (
  id text PRIMARY KEY, tenant_id text NOT NULL, run_id text NOT NULL,
  tool_call_id text NOT NULL, scope jsonb NOT NULL, state text NOT NULL,
  decided_by text, expires_at timestamptz, created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE scheduled_executions (
  id text PRIMARY KEY, tenant_id text NOT NULL, job_id text NOT NULL,
  scheduled_at timestamptz NOT NULL, state text NOT NULL,
  lease_owner text, lease_expires_at timestamptz,
  UNIQUE(job_id, scheduled_at)
);
```

## 13. Streaming events

`run.started`, `message.delta`, `message.completed`, `tool.started`, `tool.progress`, `tool.completed`, `approval.requested`, `run.warning`, `run.completed`, `run.failed`. Contract chi tiết ở file 05.

## 14. Security

- Tool args schema MUST `additionalProperties=false` nếu không có lý do rõ ràng.
- Path/URL/command là trust boundary và phải canonicalize trước policy check.
- Environment truyền vào subprocess dùng allowlist, không copy toàn bộ process env.
- Tool output là untrusted content; không được nâng thành system instruction.
- Plugin/tool chạy với least privilege và resource limits.
- Audit mọi approval, external side effect, checkpoint restore và admin override.

## 15. Observability

- `agent_run_duration_ms{outcome}`
- `agent_iterations_total{model}`
- `model_call_duration_ms{provider,model}`
- `tool_call_duration_ms{tool,outcome}`
- `tool_concurrency_active`
- `approval_wait_duration_ms{decision}`
- `subagent_active_total`
- `scheduled_execution_total{outcome}`
- `checkpoint_duration_ms{outcome}`

## 16. Tests và acceptance

- `HR-AC-001`: Mỗi tool call có terminal result dù timeout hoặc interrupt.
- `HR-AC-002`: Idempotency retry không lặp external side effect.
- `HR-AC-003`: Hai write scope overlap không chạy đồng thời.
- `HR-AC-004`: Approval grant không dùng được ngoài normalized scope.
- `HR-AC-005`: Parent cancel chấm dứt child và subprocess trong deadline.
- `HR-AC-006`: Scheduler multi-instance chỉ chạy một execution cho một slot.
- `HR-AC-007`: Provider failover giữ role sequence và transcript đúng.
- `HR-AC-008`: Checkpoint restore khôi phục byte-exact file trong test fixture.
