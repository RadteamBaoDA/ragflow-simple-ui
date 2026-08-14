# Agentic Module HFS 100 implementation plan

Goal: reach an evidence-backed HFS 100 without coupling the portable package to the current application database, retrieval stack, web framework, or UI framework.

1. Add failing behavioral tests for event cursor replay, SSE/WebSocket envelope parity, UI reduction, full loop streaming, and final-output rejection.
2. Implement the minimum transport-neutral event journal, serializers, UI reducer, provider chunks, runtime events, and final validator hook.
3. Specify host retrieval, event persistence, authenticated SSE/WebSocket routes, reconnect, approval/question endpoints, and accessible UI states.
4. Add durable session tree/lane/queue/effect/deferred/compaction contracts and implementations with a fake clock.
5. Run a crash-prefix test at every persistence/effect boundary and compare automatic versus manually stepped logs.
6. Produce the AnythingLLM comparison and score only from captured test evidence.

Exit gate: all package tests, typecheck, build, external import fixture, package dry-run, crash-prefix matrix, privacy scan, and HFS evidence table pass. Any missing row keeps the score below 100.
