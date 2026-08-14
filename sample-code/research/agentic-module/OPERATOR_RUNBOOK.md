# Agentic Module operator runbook

## Release prerequisites

1. Pin the built package version and deploy the database migration before application workers.
2. Run all module gates listed in `HFS_STATUS.md`.
3. Run the three exported conformance suites against the production database adapter in an isolated test namespace.
4. Verify provider, tool, retrieval, artifact, approval, final-validation, SSE/WebSocket, and authentication adapters with production-equivalent policy.
5. Archive the CI output, failure-injection trace, security review, and operator sign-off with the release.

## Required runtime controls

- A kill switch must reject new runs and call `close` or `abort` for owned active runs.
- Every worker has a stable `workerId`; lease duration must exceed the normal durable action latency and remain bounded.
- Provider retry count, tool-call budget, input window, output character limit, approval timeout, and transport payload limit must be finite.
- Telemetry receives only `TelemetrySpan`; prompts, outputs, credentials, raw file content, and sensitive tool arguments are forbidden.
- Retrieval and tool authorization derive tenant/workspace/principal from the authenticated server context, never from client payloads.

## Health and alerts

Alert on lease conflicts, version conflicts above the normal retry rate, `EFFECT_UNCERTAIN`, corrupt-log failures, approval expiry, provider retry exhaustion, compaction failure, transport replay gaps, and final-output validation failure. Track provider/tool duration and token/cost metadata from sanitized correlation spans.

## Recovery procedure

1. Stop new admission for the affected tenant or deployment.
2. Preserve the append-only log and database snapshot; do not edit or auto-repair it.
3. Reopen the run and call `recover` under the original authenticated ownership context.
4. Safe-replay tools may resume only when protected arguments can be restored. Never-replay tools that crossed the start boundary must settle `EFFECT_UNCERTAIN` and require operator reconciliation.
5. Deferred handles are polled only through one explicit `resumeDeferred` call per scheduler attempt.
6. Re-enable admission only after the failing conformance/crash-prefix case passes and the incident evidence is attached.

## Transport and UI checks

Use `UI_STREAMING_SPEC.md`. Reconnect from every stored sequence; verify SSE and WebSocket decode to the same envelope; verify duplicate events do not duplicate text; verify approval/question focus, labels, ARIA errors, expiry, ownership, and duplicate-response rejection. Never display raw chain-of-thought—only `thinking_summary_delta`.

## Rollback

Disable admission, drain or abort accepted work, roll application workers back to the previous compatible package, and retain new append-only records for forward recovery. Do not downgrade a database schema until both package versions have stopped writing it.
