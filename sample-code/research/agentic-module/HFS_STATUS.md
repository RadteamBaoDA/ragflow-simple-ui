# HFS acceptance status

The portable module scope is **HFS 100/100** against the executable package gates below. This does not assign a production score to a consuming application: transport, retrieval, UI, and its real database remain host acceptance work by design.

| Module domain | Weight | Evidence | Result |
|---|---:|---|---:|
| Session tree, lanes, atomic persistence | 20 | session/store conformance, atomic batches, reopen prefixes, corruption checks | 20 |
| Run lifecycle, queues, configuration, close | 15 | bounded turns/retries, three queues, cancellation, atomic abort/close | 15 |
| Tool plan, execution, replay, abort | 15 | durable plan/start/settle, safe replay, never-replay uncertainty, sequential/parallel | 15 |
| Retry, provider/deferred recovery | 15 | retry cap, planned-step reuse, settled-response classification, deferred recreation | 15 |
| Compaction and navigation | 10 | automatic/manual compaction lifecycle, protocol preservation, lineage/navigation | 10 |
| Events, telemetry, privacy, security | 10 | cursor replay, serializer parity, redaction, ownership, final validation | 10 |
| Manual drive and deterministic tests | 5 | gated effects/streams and automatic/manual durable-log equivalence | 5 |
| Documentation and package evidence | 10 | API/spec/runbook/comparison, consumer fixture, pack dry-run | 10 |
| **Portable module total** | **100** | `npm test` plus release gates | **100** |

| HFS domain | Executable module evidence | Host release evidence still required |
|---|---|---|
| Session/tree/lanes/persistence | immutable tree, fork, lane isolation, total configuration, facts, usage, atomic batches, torn-tail and corrupt-interior checks | run exported conformance against the real transactional database |
| Run/queue/close | no-tool, provider error/retry cap, output limit, steer/follow-up/next-run, cancellation, abort and close | inject close/restart at every host persistence boundary |
| Tools/replay | schema/policy/approval gates, sequential/parallel order, direct termination, safe replay and explicit never-replay uncertainty | crash-inject the real side-effect tools and archive the trace |
| Deferred/recovery | pending/ready/error, one poll per resume, process recreation, abort without poll | verify provider-specific handle identity and scheduler behavior |
| Compaction/navigation | threshold/overflow-once, durable automatic/manual summary, lineage, common ancestor and atomic label | model-tokenizer and host lineage retention checks |
| Events/privacy | ordered journal, replay/live no-gap, SSE/WS envelope parity, UI reducer, provider/tool correlation spans, recursive telemetry and tool-output redaction | authenticated transport load test and secret fixtures from the host |
| Manual drive | queued parallel actions, gated streaming effect, automatic/manual durable-log equivalence | none for the module contract |
| Documentation | API, host, UI/transport, runbook and comparison documents | attach CI report, security review and operator sign-off |

## Module gates

Run from this directory:

```bash
npm test
npm run typecheck
npm run check:docs
npm run build
npm run test:package
npm pack --dry-run
```

The release pipeline must additionally call `runHarnessStoreConformance`, `runSessionStoreConformance`, and `runSessionRecoveryPrefixConformance` using the consuming application's database adapter. Any critical invariant failure—duplicate uncertain side effect, silent corrupt-log repair, secret leak, or cross-lane operation—blocks release and caps HFS below 60.
