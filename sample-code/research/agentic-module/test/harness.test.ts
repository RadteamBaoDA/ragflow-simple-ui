import test from "node:test";
import assert from "node:assert/strict";
import {
  AgenticError,
  ActionDriver,
  InMemoryHarnessStore,
  ToolRegistry,
  createAgentHarness,
  reduceHarnessEvents,
  type HarnessEventInput,
  type TelemetrySpan,
} from "../src/index.ts";

const owner = { principalId: "u1", workspaceId: "w1" };

test("manual driver queues parallel actions in deterministic admission order", async () => {
  const driver = new ActionDriver("manual");
  const completed: string[] = [];
  const first = driver.run("parallel", "tool", async () => { completed.push("first"); return 1; });
  const second = driver.run("parallel", "tool", async () => { completed.push("second"); return 2; });
  assert.equal(driver.peekAction()?.id, 1);
  await driver.executeAction();
  assert.equal(driver.peekAction()?.id, 2);
  await driver.executeAction();
  assert.deepEqual(await Promise.all([first, second]), [1, 2]);
  assert.deepEqual(completed, ["first", "second"]);
});

test("manual driver gates the complete streaming provider effect", async () => {
  const driver = new ActionDriver("manual");
  let invoked = false;
  const values: number[] = [];
  const consuming = (async () => {
    for await (const value of driver.runStream("stream", "provider", async function* () {
      invoked = true;
      yield 1;
      yield 2;
    })) values.push(value);
  })();
  await Promise.resolve();
  assert.equal(invoked, false);
  assert.equal(driver.peekAction()?.kind, "provider");
  await driver.executeAction();
  await consuming;
  assert.deepEqual(values, [1, 2]);
});

test("harness store enforces ownership, atomic claim, lease, and terminal close", async () => {
  const store = new InMemoryHarnessStore(() => 1_000);
  await store.create({ runId: "r1", input: "hello", context: owner });
  assert.equal(await store.claim("r1", { principalId: "u2", workspaceId: "w1" }, "worker-a", 100), false);
  assert.equal(await store.claim("r1", owner, "worker-a", 100), true);
  assert.equal(await store.claim("r1", owner, "worker-b", 100), false);
  await store.close("r1", "completed");
  assert.equal(await store.claim("r1", owner, "worker-b", 100), false);
});

test("harness store appends atomically and deduplicates idempotency keys", async () => {
  const store = new InMemoryHarnessStore();
  await store.create({ runId: "r2", input: "hello", context: owner });
  const event: HarnessEventInput = {
    type: "turn_started",
    data: { input: "hello" },
    idempotencyKey: "turn-1",
  };
  assert.equal((await store.append("r2", 0, [event])).version, 1);
  assert.equal((await store.append("r2", 1, [event])).version, 1);
  await assert.rejects(
    () => store.append("r2", 0, [{ type: "run_aborted", data: {} }]),
    (error) => error instanceof AgenticError && error.code === "VERSION_CONFLICT"
  );
});

test("harness store rejects an invalid effect batch without partial commit", async () => {
  const store = new InMemoryHarnessStore();
  await store.create({ runId: "invalid-effect", input: "hello", context: owner });
  await assert.rejects(() => store.append("invalid-effect", 0, [
    { type: "turn_started", data: {} },
    { type: "tool_started", data: { effectId: "missing", callId: "call", toolName: "read" } },
  ]), (error) => error instanceof AgenticError && error.code === "STORAGE_CORRUPTION");
  assert.equal((await store.load("invalid-effect"))?.events.length, 0);
  await assert.rejects(() => store.append("invalid-effect", 0, [
    { type: "provider_started", data: { stepId: "missing", attempt: 1, responseId: "response" } },
  ]), (error) => error instanceof AgenticError && error.code === "STORAGE_CORRUPTION");
  await assert.rejects(() => store.append("invalid-effect", 0, [
    { type: "compaction_started", data: { stepId: "missing" } },
  ]), (error) => error instanceof AgenticError && error.code === "STORAGE_CORRUPTION");
  await assert.rejects(() => store.append("invalid-effect", 0, [
    { type: "usage_recorded", data: { usageId: "bad", stepId: "missing", attempt: 1, usage: { cost: -1 } } },
  ]), (error) => error instanceof AgenticError && error.code === "STORAGE_CORRUPTION");
  assert.equal((await store.load("invalid-effect"))?.events.length, 0);
});

test("harness store atomically appends terminal events and releases the lease", async () => {
  const store = new InMemoryHarnessStore();
  await store.create({ runId: "settle", input: "hello", context: owner });
  assert.equal(await store.claim("settle", owner, "worker", 100), true);
  await store.settle("settle", 0, [{ type: "run_failed", data: { code: "FAILED" } }], "failed");
  const loaded = await store.load("settle");
  assert.equal(loaded?.record.status, "failed");
  assert.equal(loaded?.record.lease, undefined);
  assert.equal(loaded?.record.version, 1);
  assert.equal(loaded?.events[0].type, "run_failed");
  await assert.rejects(() => store.append("settle", 1, [{ type: "checkpoint_saved", data: {} }]));
  await assert.rejects(() => store.settle("settle", 0, [{ type: "run_closed", data: {} }], "closed"));
  assert.equal((await store.load("settle"))?.events.length, 1);
});

test("expired lease can be reclaimed and event replay restores state", async () => {
  let now = 1_000;
  const store = new InMemoryHarnessStore(() => now);
  await store.create({ runId: "r3", input: "hello", context: owner });
  assert.equal(await store.claim("r3", owner, "worker-a", 100), true);
  now = 1_101;
  assert.equal(await store.claim("r3", owner, "worker-b", 100), true);
  await store.append("r3", 0, [
    { type: "turn_started", data: { input: "hello" } },
    { type: "approval_requested", data: { requestId: "a1", toolName: "write" } },
  ]);
  const loaded = await store.load("r3");
  const state = reduceHarnessEvents(loaded!.record, loaded!.events);
  assert.equal(state.status, "needs_input");
  assert.equal(state.pending?.kind, "approval");
  assert.equal(state.turns, 1);
});

test("durable harness continues from persisted history after recreation", async () => {
  const store = new InMemoryHarnessStore();
  const seen: string[][] = [];
  const config = {
    store,
    workerId: "worker",
    tools: new ToolRegistry(),
    policy: { authorize: () => true },
    provider: {
      supportsNativeToolCalling: () => true,
      complete: async ({ messages }: { messages: Array<{ content: string }> }) => {
        seen.push(messages.map(({ content }) => content));
        return { type: "text" as const, text: seen.length === 1 ? "first" : "second" };
      },
    },
  };
  const firstHarness = createAgentHarness(config);
  assert.equal((await firstHarness.start({ runId: "durable", input: "one", context: owner })).text, "first");
  const recreatedHarness = createAgentHarness(config);
  assert.equal((await recreatedHarness.continue("durable", "two", owner)).text, "second");
  assert.deepEqual(seen[1], ["one", "first", "two"]);
});

test("durable harness enforces max turns and recovers the last checkpoint", async () => {
  const store = new InMemoryHarnessStore();
  const harness = createAgentHarness({
    store,
    workerId: "worker",
    maxTurns: 1,
    provider: {
      supportsNativeToolCalling: () => true,
      complete: async () => ({ type: "text", text: "done" }),
    },
    policy: { authorize: () => true },
  });
  const completed = await harness.start({ runId: "bounded", input: "one", context: owner });
  assert.equal((await harness.recover("bounded", owner)).text, completed.text);
  const exceeded = await harness.continue("bounded", "two", owner);
  assert.equal(exceeded.error?.code, "BUDGET_EXHAUSTED");
});

test("durable harness retries retryable provider failure without duplicating the turn", async () => {
  const store = new InMemoryHarnessStore();
  let calls = 0;
  const terminalEvents: string[] = [];
  const harness = createAgentHarness({
    store, workerId: "worker", maxAttempts: 2,
    provider: {
      supportsNativeToolCalling: () => true,
      complete: async () => {
        calls += 1;
        if (calls === 1) throw new AgenticError("PROVIDER_FAILED", "temporary", true);
        return { type: "text", text: "recovered" };
      },
    },
    policy: { authorize: () => true },
    emit: (event) => { if (event.type === "run_finished") terminalEvents.push(event.type); },
  });
  const result = await harness.start({ runId: "retry", input: "hello", context: owner });
  assert.equal(result.text, "recovered");
  assert.equal(calls, 2);
  assert.equal(terminalEvents.length, 1);
  const loaded = await store.load("retry");
  assert.equal(loaded?.events.filter(({ type }) => type === "turn_started").length, 1);
  assert.equal(loaded?.events.filter(({ type }) => type === "provider_planned").length, 1);
  assert.deepEqual(loaded?.events.filter(({ type }) => type === "provider_started").map(({ data }) => data.attempt), [1, 2]);
  assert.deepEqual(loaded?.events.filter(({ type }) => type === "provider_settled").map(({ data }) => data.outcome), ["retryable_error", "completed"]);
});

test("provider retry cap settles the final attempt once", async () => {
  const store = new InMemoryHarnessStore();
  let calls = 0;
  const harness = createAgentHarness({
    store, workerId: "worker", maxAttempts: 2,
    provider: {
      supportsNativeToolCalling: () => true,
      complete: async () => { calls += 1; throw new AgenticError("PROVIDER_FAILED", "temporary", true); },
    },
    policy: { authorize: () => true },
  });
  const result = await harness.start({ runId: "retry-cap", input: "hello", context: owner });
  assert.equal(result.status, "failed");
  assert.equal(calls, 2);
  assert.deepEqual((await store.load("retry-cap"))?.events
    .filter(({ type }) => type === "provider_settled").map(({ data }) => data.outcome), ["retryable_error", "failed"]);
});

test("provider plan freezes model, thinking, and active-tool configuration", async () => {
  const store = new InMemoryHarnessStore();
  const modelIdentity = { provider: "fake", model: "model-a" };
  const harness = createAgentHarness({
    store, workerId: "worker", modelIdentity, thinkingLevel: "high",
    tools: new ToolRegistry().register({
      name: "read", description: "read", parameters: {}, risk: "read",
      execute: async () => ({ type: "continue", content: "unused" }),
    }),
    provider: {
      supportsNativeToolCalling: () => true,
      complete: async () => { modelIdentity.model = "model-b"; return { type: "text", text: "done" }; },
    },
    policy: { authorize: () => true },
  });
  await harness.start({ runId: "frozen-config", input: "go", context: owner });
  const planned = (await store.load("frozen-config"))?.events.find(({ type }) => type === "provider_planned");
  assert.deepEqual(planned?.data.configuration, {
    model: { provider: "fake", model: "model-a" }, thinkingLevel: "high", activeToolNames: ["read"],
  });
});

test("provider telemetry carries durable correlation without prompt or output bodies", async () => {
  const spans: TelemetrySpan[] = [];
  const harness = createAgentHarness({
    store: new InMemoryHarnessStore(), workerId: "worker", now: () => 10,
    provider: {
      supportsNativeToolCalling: () => true,
      complete: async () => ({ type: "text", text: "secret body", usage: { inputTokens: 2, outputTokens: 3 } }),
    },
    policy: { authorize: () => true },
    telemetry: (span) => { spans.push(span); },
  });
  await harness.start({ runId: "telemetry", input: "private prompt", context: owner });
  assert.deepEqual(spans, [{
    kind: "provider", runId: "telemetry", operationId: "telemetry", lane: "main",
    stepId: "telemetry:provider:1", attempt: 1, durationMs: 0, outcome: "completed",
    usage: { inputTokens: 2, outputTokens: 3 },
  }]);
  assert.equal(JSON.stringify(spans).includes("private prompt"), false);
  assert.equal(JSON.stringify(spans).includes("secret body"), false);
});

test("provider usage is durably recorded in the same settled step", async () => {
  const store = new InMemoryHarnessStore();
  const harness = createAgentHarness({
    store, workerId: "worker",
    provider: {
      supportsNativeToolCalling: () => true,
      complete: async () => ({ type: "text", text: "done", usage: { inputTokens: 2, outputTokens: 3, cost: 0.01 } }),
    },
    policy: { authorize: () => true },
  });
  await harness.start({ runId: "durable-usage", input: "go", context: owner });
  const usage = (await store.load("durable-usage"))?.events.find(({ type }) => type === "usage_recorded");
  assert.deepEqual(usage?.data, {
    usageId: "durable-usage:provider:1:attempt:1:usage", stepId: "durable-usage:provider:1", attempt: 1,
    usage: { inputTokens: 2, outputTokens: 3, cost: 0.01 },
  });
});

test("tool telemetry correlates the durable effect without arguments or output", async () => {
  const spans: TelemetrySpan[] = [];
  let calls = 0;
  const tools = new ToolRegistry().register({
    name: "read", description: "read", parameters: {}, risk: "read",
    execute: async () => ({ type: "continue", content: "classified output" }),
  });
  const harness = createAgentHarness({
    store: new InMemoryHarnessStore(), workerId: "worker", tools, now: () => 10,
    provider: {
      supportsNativeToolCalling: () => true,
      complete: async () => ++calls === 1
        ? { type: "tool_call", callId: "call-1", name: "read", arguments: { secret: "hidden" } }
        : { type: "text", text: "done" },
    },
    policy: { authorize: () => true },
    telemetry: (span) => { spans.push(span); },
  });
  await harness.start({ runId: "tool-telemetry", input: "go", context: owner });
  const span = spans.find(({ kind }) => kind === "tool");
  assert.deepEqual(span, {
    kind: "tool", runId: "tool-telemetry", operationId: "tool-telemetry", lane: "main",
    stepId: "tool-telemetry:turn:1:tool:call-1", attempt: 1, durationMs: 0, outcome: "completed",
  });
  assert.equal(JSON.stringify(span).includes("hidden"), false);
  assert.equal(JSON.stringify(span).includes("classified output"), false);
});

test("closing an active run aborts provider work and is idempotent", async () => {
  const store = new InMemoryHarnessStore();
  let started!: () => void;
  const ready = new Promise<void>((resolve) => { started = resolve; });
  const harness = createAgentHarness({
    store, workerId: "worker",
    provider: {
      supportsNativeToolCalling: () => true,
      complete: ({ signal }) => new Promise((resolve, reject) => {
        started();
        signal.addEventListener("abort", () => reject(new AgenticError("ABORTED", "aborted")), { once: true });
      }),
    },
    policy: { authorize: () => true },
  });
  const running = harness.start({ runId: "close", input: "wait", context: owner });
  await ready;
  await harness.close("close");
  await harness.close("close");
  assert.equal((await running).status, "aborted");
  const closed = await store.load("close");
  assert.equal(closed?.record.status, "closed");
  assert.equal(closed?.events.at(-1)?.type, "run_closed");
});

test("deferred provider handle survives recreation and each resume polls once", async () => {
  const store = new InMemoryHarnessStore();
  let polls = 0;
  const spans: TelemetrySpan[] = [];
  const config = {
    store, workerId: "worker",
    provider: {
      supportsNativeToolCalling: () => true,
      complete: async () => ({
        type: "deferred" as const,
        handle: { provider: "fake", id: "remote-1", pollAfterMs: 10 },
      }),
      fetchDeferred: async (handle: { id: string }) => {
        polls += 1;
        assert.equal(handle.id, "remote-1");
        return polls === 1
          ? { type: "deferred" as const, handle: { provider: "fake", id: "remote-1", pollAfterMs: 20 } }
          : { type: "text" as const, text: "ready" };
      },
    },
    policy: { authorize: () => true },
    telemetry: (span: TelemetrySpan) => { spans.push(span); },
  };
  const first = await createAgentHarness(config).start({ runId: "deferred", input: "slow", context: owner });
  assert.equal(first.status, "suspended");
  assert.equal(first.deferred?.pollAfterMs, 10);

  const second = await createAgentHarness(config).resumeDeferred("deferred", owner);
  assert.equal(second.status, "suspended");
  assert.equal(second.deferred?.pollAfterMs, 20);
  assert.equal(polls, 1);

  const done = await createAgentHarness(config).resumeDeferred("deferred", owner);
  assert.equal(done.text, "ready");
  assert.equal(polls, 2);
  assert.equal((await store.load("deferred"))?.events.filter(({ type }) => type === "provider_planned").length, 3);
  assert.deepEqual(spans.map(({ outcome }) => outcome), ["suspended", "suspended", "completed"]);
});

test("deferred terminal error is persisted and closes the run", async () => {
  const store = new InMemoryHarnessStore();
  const config = {
    store, workerId: "worker",
    provider: {
      supportsNativeToolCalling: () => true,
      complete: async () => ({ type: "deferred" as const, handle: { provider: "fake", id: "bad", pollAfterMs: 1 } }),
      fetchDeferred: async () => { throw new AgenticError("PROVIDER_FAILED", "terminal"); },
    },
    policy: { authorize: () => true },
  };
  await createAgentHarness(config).start({ runId: "deferred-error", input: "slow", context: owner });
  const result = await createAgentHarness(config).resumeDeferred("deferred-error", owner);
  assert.equal(result.error?.code, "PROVIDER_FAILED");
  assert.equal((await store.load("deferred-error"))?.record.status, "failed");
});

test("abort cancels a suspended deferred run without polling", async () => {
  const store = new InMemoryHarnessStore();
  let polls = 0;
  const config = {
    store, workerId: "worker",
    provider: {
      supportsNativeToolCalling: () => true,
      complete: async () => ({ type: "deferred" as const, handle: { provider: "fake", id: "cancel", pollAfterMs: 1 } }),
      fetchDeferred: async () => { polls += 1; return { type: "text" as const, text: "late" }; },
    },
    policy: { authorize: () => true },
  };
  const harness = createAgentHarness(config);
  await harness.start({ runId: "deferred-abort", input: "slow", context: owner });
  await harness.abort("deferred-abort");
  const result = await createAgentHarness(config).resumeDeferred("deferred-abort", owner);
  assert.equal(result.status, "failed");
  assert.equal(polls, 0);
  assert.equal((await store.load("deferred-abort"))?.record.status, "aborted");
});

test("automatic compaction is checkpointed before the provider effect starts", async () => {
  const store = new InMemoryHarnessStore();
  let providerStarted!: () => void;
  const started = new Promise<void>((resolve) => { providerStarted = resolve; });
  const harness = createAgentHarness({
    store, workerId: "worker",
    provider: {
      supportsNativeToolCalling: () => true,
      complete: ({ signal }) => new Promise((resolve, reject) => {
        providerStarted();
        signal.addEventListener("abort", () => reject(new AgenticError("ABORTED", "aborted")), { once: true });
      }),
    },
    policy: { authorize: () => true },
    contextWindow: {
      maxInputTokens: 2,
      estimateTokens: (messages) => messages.reduce((sum, { content }) => sum + content.split(/\s+/).length, 0),
      compact: async ({ messages }) => [{ ...messages.at(-1)!, content: "summary" }],
    },
  });
  const running = harness.start({
    runId: "durable-compact", input: "new question", context: owner,
    history: [{ role: "user", content: "old context words" }],
  });
  await started;
  const loaded = await store.load("durable-compact");
  const compacted = loaded?.events.find(({ type }) => type === "context_compacted");
  assert.deepEqual((compacted?.data.checkpoint as { history: Array<{ content: string }> }).history.map(({ content }) => content), ["summary"]);
  await harness.abort("durable-compact");
  assert.equal((await running).status, "aborted");
});

test("automatic compaction plan and start commit before the summarizer effect", async () => {
  const store = new InMemoryHarnessStore();
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  let entered!: () => void;
  const started = new Promise<void>((resolve) => { entered = resolve; });
  const harness = createAgentHarness({
    store, workerId: "worker",
    provider: { supportsNativeToolCalling: () => true, complete: async () => ({ type: "text", text: "done" }) },
    policy: { authorize: () => true },
    contextWindow: {
      maxInputTokens: 1,
      estimateTokens: (messages) => messages.length,
      compact: async () => { entered(); await gate; return [{ role: "user", content: "summary" }]; },
    },
  });
  const running = harness.start({
    runId: "compact-effect", input: "new", context: owner,
    history: [{ role: "user", content: "old" }],
  });
  await started;
  const prefix = await store.load("compact-effect");
  assert.deepEqual(prefix?.events
    .filter(({ type }) => type.startsWith("compaction_"))
    .map(({ type }) => type), ["compaction_planned", "compaction_started"]);
  assert.deepEqual((prefix?.events.find(({ type }) => type === "checkpoint_saved")?.data.checkpoint as { history: Array<{ content: string }> }).history
    .map(({ content }) => content), ["old", "new"]);
  release();
  assert.equal((await running).text, "done");
  assert.equal((await store.load("compact-effect"))?.events.some(({ type }) => type === "compaction_settled"), true);
});

test("recovery safely retries a started compaction from its durable checkpoint", async () => {
  const store = new InMemoryHarnessStore();
  await store.create({ runId: "recover-compaction", input: "new", context: owner });
  await store.append("recover-compaction", 0, [
    { type: "turn_started", data: { input: "new" } },
    { type: "checkpoint_saved", data: { checkpoint: { history: [{ role: "user", content: "old" }, { role: "user", content: "new" }], turns: 1, toolCalls: 0 } } },
    { type: "compaction_planned", data: { stepId: "recover-compaction:compaction:1", beforeTokens: 2 }, idempotencyKey: "recover-compaction:compaction:1:planned" },
    { type: "compaction_started", data: { stepId: "recover-compaction:compaction:1" }, idempotencyKey: "recover-compaction:compaction:1:started" },
  ]);
  let compactions = 0;
  const harness = createAgentHarness({
    store, workerId: "recovery",
    provider: { supportsNativeToolCalling: () => true, complete: async () => ({ type: "text", text: "done" }) },
    policy: { authorize: () => true },
    contextWindow: {
      maxInputTokens: 1,
      estimateTokens: (messages) => messages.length,
      compact: async () => { compactions += 1; return [{ role: "user", content: "summary" }]; },
    },
  });
  const result = await harness.recover("recover-compaction", owner);
  assert.equal(result.text, "done");
  assert.equal(compactions, 1);
  assert.equal((await store.load("recover-compaction"))?.events.filter(({ type }) => type === "context_compacted").length, 1);
});

test("streaming provider boundaries are durably planned and settled", async () => {
  const store = new InMemoryHarnessStore();
  const harness = createAgentHarness({
    store, workerId: "worker",
    provider: {
      supportsNativeToolCalling: () => true,
      complete: async () => ({ type: "text", text: "unused" }),
      async *stream() { yield { type: "text_delta", text: "done" } as const; },
    },
    policy: { authorize: () => true },
  });
  assert.equal((await harness.start({ runId: "stream-effects", input: "go", context: owner })).text, "done");
  const events = (await store.load("stream-effects"))!.events;
  assert.deepEqual(events.filter(({ type }) => type.startsWith("provider_")).map(({ type }) => type), [
    "provider_planned", "provider_started", "provider_settled",
  ]);
});

test("recovery marks a started never-replay tool uncertain without executing it", async () => {
  const store = new InMemoryHarnessStore();
  await store.create({ runId: "uncertain-tool", input: "write", context: owner });
  await store.append("uncertain-tool", 0, [
    { type: "turn_started", data: { input: "write" } },
    { type: "checkpoint_saved", data: { checkpoint: { history: [{ role: "user", content: "write" }], turns: 1, toolCalls: 0 } } },
    { type: "tool_planned", data: { effectId: "effect-1", callId: "call-1", toolName: "write", replay: "never", plannedResultId: "result-1" } },
    { type: "tool_started", data: { effectId: "effect-1", callId: "call-1", toolName: "write" } },
  ]);
  let executed = false;
  const harness = createAgentHarness({
    store, workerId: "recovery",
    tools: new ToolRegistry().register({
      name: "write", description: "write", parameters: {}, risk: "write", replay: "never",
      execute: async () => { executed = true; return { type: "continue", content: "bad" }; },
    }),
    provider: { supportsNativeToolCalling: () => true, complete: async () => ({ type: "text", text: "bad" }) },
    policy: { authorize: () => true },
  });
  const result = await harness.recover("uncertain-tool", owner);
  assert.equal(result.error?.code, "EFFECT_UNCERTAIN");
  assert.equal(executed, false);
  assert.equal((await store.load("uncertain-tool"))?.events.some(({ type }) => type === "tool_uncertain"), true);
});

test("recovery safely replays a started safe tool from protected arguments", async () => {
  const store = new InMemoryHarnessStore();
  await store.create({ runId: "safe-tool", input: "read", context: owner });
  const effectId = "safe-tool:turn:1:tool:call-1";
  await store.append("safe-tool", 0, [
    { type: "turn_started", data: { input: "read" } },
    { type: "checkpoint_saved", data: { checkpoint: { history: [{ role: "user", content: "read" }], turns: 1, toolCalls: 0 } } },
    { type: "tool_planned", data: { effectId, callId: "call-1", toolName: "read", replay: "safe", plannedResultId: `${effectId}:result`, protectedArguments: "encrypted:7" } },
    { type: "tool_started", data: { effectId, callId: "call-1", toolName: "read" } },
  ]);
  let executions = 0;
  const harness = createAgentHarness({
    store, workerId: "recovery",
    tools: new ToolRegistry().register({
      name: "read", description: "read", parameters: {}, risk: "read", replay: "safe",
      execute: async (input) => { executions += 1; return { type: "continue", content: String((input as { id: number }).id) }; },
    }),
    provider: { supportsNativeToolCalling: () => true, complete: async () => ({ type: "text", text: "recovered" }) },
    policy: { authorize: () => true },
    protectToolArguments: (value) => value,
    restoreToolArguments: (value) => ({ id: Number(String(value).split(":")[1]) }),
  });
  const result = await harness.recover("safe-tool", owner);
  assert.equal(result.text, "recovered");
  assert.equal(executions, 1);
  assert.equal((await store.load("safe-tool"))?.events.filter(({ type }) => type === "tool_settled").length, 1);
});

test("tool plan and recovery checkpoint commit before tool execution", async () => {
  const store = new InMemoryHarnessStore();
  let toolStarted!: () => void;
  const started = new Promise<void>((resolve) => { toolStarted = resolve; });
  const harness = createAgentHarness({
    store, workerId: "worker",
    tools: new ToolRegistry().register({
      name: "read", description: "read", parameters: {}, risk: "read", replay: "safe",
      execute: (_input, { signal }) => new Promise((resolve, reject) => {
        toolStarted();
        signal.addEventListener("abort", () => reject(new AgenticError("ABORTED", "aborted")), { once: true });
      }),
    }),
    provider: {
      supportsNativeToolCalling: () => true,
      complete: async () => ({ type: "tool_call", callId: "call", name: "read", arguments: { id: 1 } }),
    },
    policy: { authorize: () => true },
    protectToolArguments: (value) => value,
    restoreToolArguments: (value) => value,
  });
  const running = harness.start({ runId: "tool-checkpoint", input: "read", context: owner });
  await started;
  const events = (await store.load("tool-checkpoint"))!.events;
  const planIndex = events.findIndex(({ type }) => type === "tool_planned");
  const checkpointIndex = events.findIndex(({ type, data }) => type === "checkpoint_saved" && (data.checkpoint as { history?: unknown[] }).history?.length === 2);
  const startIndex = events.findIndex(({ type }) => type === "tool_started");
  assert.equal(planIndex >= 0 && checkpointIndex >= 0 && checkpointIndex < startIndex, true);
  await harness.abort("tool-checkpoint");
  assert.equal((await running).status, "aborted");
});

test("durable checkpoints never persist raw tool arguments", async () => {
  const store = new InMemoryHarnessStore();
  let calls = 0;
  const harness = createAgentHarness({
    store, workerId: "worker",
    tools: new ToolRegistry().register({
      name: "read", description: "read", parameters: {}, risk: "read",
      execute: async () => ({ type: "continue", content: "ok" }),
    }),
    provider: {
      supportsNativeToolCalling: () => true,
      complete: async () => ++calls === 1
        ? { type: "tool_call", callId: "secret-call", name: "read", arguments: { token: "do-not-store" } }
        : { type: "text", text: "done" },
    },
    policy: { authorize: () => true },
  });
  await harness.start({ runId: "private-tool", input: "go", context: owner });
  assert.equal(JSON.stringify((await store.load("private-tool"))?.events).includes("do-not-store"), false);
});

test("tool settlement checkpoints its output before the next provider effect", async () => {
  const store = new InMemoryHarnessStore();
  let calls = 0;
  let secondProviderStarted!: () => void;
  const started = new Promise<void>((resolve) => { secondProviderStarted = resolve; });
  const harness = createAgentHarness({
    store, workerId: "worker",
    tools: new ToolRegistry().register({
      name: "read", description: "read", parameters: {}, risk: "read", replay: "safe",
      execute: async () => ({ type: "continue", content: "tool-output" }),
    }),
    provider: {
      supportsNativeToolCalling: () => true,
      complete: ({ signal }) => {
        calls += 1;
        if (calls === 1) return Promise.resolve({ type: "tool_call", callId: "call", name: "read", arguments: {} });
        return new Promise((resolve, reject) => {
          secondProviderStarted();
          signal.addEventListener("abort", () => reject(new AgenticError("ABORTED", "aborted")), { once: true });
        });
      },
    },
    policy: { authorize: () => true },
    protectToolArguments: (value) => value,
    restoreToolArguments: (value) => value,
  });
  const running = harness.start({ runId: "tool-settlement", input: "read", context: owner });
  await started;
  const checkpoints = (await store.load("tool-settlement"))!.events
    .filter(({ type }) => type === "checkpoint_saved")
    .map(({ data }) => data.checkpoint as { history: Array<{ content: string }> });
  assert.equal(checkpoints.at(-1)?.history.at(-1)?.content, "tool-output");
  await harness.abort("tool-settlement");
  assert.equal((await running).status, "aborted");
});

test("recovery exposes an unsettled provider attempt as uncertain", async () => {
  const store = new InMemoryHarnessStore();
  await store.create({ runId: "uncertain-provider", input: "go", context: owner });
  await store.append("uncertain-provider", 0, [
    { type: "turn_started", data: { input: "go" } },
    { type: "checkpoint_saved", data: { checkpoint: { history: [{ role: "user", content: "go" }], turns: 1, toolCalls: 0 } } },
    { type: "provider_planned", data: { stepId: "provider-1", messageCount: 1, toolNames: [] } },
    { type: "provider_started", data: { stepId: "provider-1", attempt: 1, responseId: "response-1" } },
  ]);
  const harness = createAgentHarness({
    store, workerId: "recovery",
    provider: { supportsNativeToolCalling: () => true, complete: async () => ({ type: "text", text: "must-not-run" }) },
    policy: { authorize: () => true },
  });
  const result = await harness.recover("uncertain-provider", owner);
  assert.equal(result.error?.code, "EFFECT_UNCERTAIN");
  assert.equal((await store.load("uncertain-provider"))?.events.some(({ type }) => type === "provider_uncertain"), true);
});

test("recovery starts a planned provider step without creating a second logical step", async () => {
  const store = new InMemoryHarnessStore();
  await store.create({ runId: "planned-provider", input: "go", context: owner });
  await store.append("planned-provider", 0, [
    { type: "turn_started", data: {}, idempotencyKey: "turn:1:started" },
    { type: "checkpoint_saved", data: { checkpoint: { history: [{ role: "user", content: "go" }], turns: 1, toolCalls: 0 } }, idempotencyKey: "turn:1:checkpoint" },
    { type: "provider_planned", data: { stepId: "planned-provider:provider:1", configuration: {} }, idempotencyKey: "planned-provider:provider:1:planned" },
  ]);
  let calls = 0;
  const harness = createAgentHarness({
    store, workerId: "recovery",
    provider: { supportsNativeToolCalling: () => true, complete: async () => { calls += 1; return { type: "text", text: "done" }; } },
    policy: { authorize: () => true },
  });
  const result = await harness.recover("planned-provider", owner);
  assert.equal(result.text, "done");
  assert.equal(calls, 1);
  assert.equal((await store.load("planned-provider"))?.events.filter(({ type }) => type === "provider_planned").length, 1);
});

test("recovery classifies a durably settled provider response without calling provider again", async () => {
  const store = new InMemoryHarnessStore();
  await store.create({ runId: "settled-provider", input: "go", context: owner });
  await store.append("settled-provider", 0, [
    { type: "turn_started", data: {}, idempotencyKey: "turn:1:started" },
    { type: "checkpoint_saved", data: { checkpoint: { history: [{ role: "user", content: "go" }], turns: 1, toolCalls: 0 } }, idempotencyKey: "turn:1:checkpoint" },
    { type: "provider_planned", data: { stepId: "settled-provider:provider:1", configuration: {} }, idempotencyKey: "settled-provider:provider:1:planned" },
    { type: "provider_started", data: { stepId: "settled-provider:provider:1", attempt: 1, responseId: "response-1" }, idempotencyKey: "settled-provider:provider:1:attempt:1:started" },
    { type: "provider_settled", data: { stepId: "settled-provider:provider:1", attempt: 1, responseId: "response-1", outcome: "completed", response: { type: "text", text: "recovered" } }, idempotencyKey: "settled-provider:provider:1:attempt:1:settled" },
  ]);
  let calls = 0;
  const harness = createAgentHarness({
    store, workerId: "recovery",
    provider: { supportsNativeToolCalling: () => true, complete: async () => { calls += 1; return { type: "text", text: "duplicate" }; } },
    policy: { authorize: () => true },
  });
  const result = await harness.recover("settled-provider", owner);
  assert.equal(result.text, "recovered");
  assert.equal(calls, 0);
});

test("recovery fails closed when settled provider tool arguments cannot be restored", async () => {
  const store = new InMemoryHarnessStore();
  await store.create({ runId: "settled-tool-provider", input: "go", context: owner });
  await store.append("settled-tool-provider", 0, [
    { type: "turn_started", data: {}, idempotencyKey: "turn:1:started" },
    { type: "checkpoint_saved", data: { checkpoint: { history: [{ role: "user", content: "go" }], turns: 1, toolCalls: 0 } }, idempotencyKey: "turn:1:checkpoint" },
    { type: "provider_planned", data: { stepId: "settled-tool-provider:provider:1" }, idempotencyKey: "provider:planned" },
    { type: "provider_started", data: { stepId: "settled-tool-provider:provider:1", attempt: 1, responseId: "response-1" }, idempotencyKey: "provider:started" },
    { type: "provider_settled", data: { stepId: "settled-tool-provider:provider:1", attempt: 1, responseId: "response-1", outcome: "completed", response: { type: "tool_call", callId: "call-1", name: "write", arguments: "[PROTECTED]" } }, idempotencyKey: "provider:settled" },
  ]);
  const harness = createAgentHarness({
    store, workerId: "recovery",
    provider: { supportsNativeToolCalling: () => true, complete: async () => ({ type: "text", text: "must-not-run" }) },
    policy: { authorize: () => true },
  });
  assert.equal((await harness.recover("settled-tool-provider", owner)).error?.code, "CAPABILITY_UNAVAILABLE");
});

test("multiple identical compactions in one turn receive distinct durable records", async () => {
  const store = new InMemoryHarnessStore();
  let calls = 0;
  const harness = createAgentHarness({
    store, workerId: "worker", maxToolCalls: 1,
    tools: new ToolRegistry().register({
      name: "large", description: "large", parameters: {}, risk: "read",
      execute: async () => ({ type: "continue", content: "a b c" }),
    }),
    provider: {
      supportsNativeToolCalling: () => true,
      complete: async () => ++calls === 1
        ? { type: "tool_call", callId: "c", name: "large", arguments: {} }
        : { type: "text", text: "done" },
    },
    policy: { authorize: () => true },
    contextWindow: {
      maxInputTokens: 2,
      estimateTokens: (messages) => messages.reduce((sum, { content }) => sum + content.split(/\s+/).length, 0),
      compact: async () => [{ role: "system", content: "summary" }],
    },
  });
  await harness.start({
    runId: "two-compactions", input: "go", context: owner,
    history: [{ role: "user", content: "a b c" }],
  });
  assert.equal((await store.load("two-compactions"))?.events.filter(({ type }) => type === "context_compacted").length, 2);
});

test("next-run queue is captured before the next user prompt and consumed once", async () => {
  const store = new InMemoryHarnessStore();
  const seen: string[][] = [];
  const harness = createAgentHarness({
    store, workerId: "worker", id: () => "queue-1",
    provider: {
      supportsNativeToolCalling: () => true,
      complete: async ({ messages }) => {
        seen.push(messages.map(({ content }) => content));
        return { type: "text", text: seen.length === 1 ? "first-answer" : "second-answer" };
      },
    },
    policy: { authorize: () => true },
  });
  await harness.start({ runId: "queued", input: "first", context: owner });
  assert.equal((await harness.enqueue("queued", owner, "nextRun", "queued-before-second")).ok, true);
  assert.equal((await harness.continue("queued", "second", owner)).text, "second-answer");
  assert.deepEqual(seen[1], ["first", "first-answer", "queued-before-second", "second"]);
  const events = (await store.load("queued"))!.events;
  assert.equal(events.filter(({ type }) => type === "queue_consumed").length, 1);
});

test("abort clears pending steer and follow-up but preserves next-run", async () => {
  const store = new InMemoryHarnessStore();
  let started!: () => void;
  const ready = new Promise<void>((resolve) => { started = resolve; });
  const harness = createAgentHarness({
    store, workerId: "worker",
    id: (() => { let id = 0; return () => `queue-${++id}`; })(),
    provider: {
      supportsNativeToolCalling: () => true,
      complete: ({ signal }) => new Promise((resolve, reject) => {
        started();
        signal.addEventListener("abort", () => reject(new AgenticError("ABORTED", "aborted")), { once: true });
      }),
    },
    policy: { authorize: () => true },
  });
  const running = harness.start({ runId: "abort-queues", input: "wait", context: owner });
  await ready;
  await harness.enqueue("abort-queues", owner, "steer", "steer");
  await harness.enqueue("abort-queues", owner, "followUp", "follow");
  await harness.enqueue("abort-queues", owner, "nextRun", "next");
  await harness.abort("abort-queues");
  await running;
  const aborted = (await store.load("abort-queues"))!;
  const state = reduceHarnessEvents(aborted.record, aborted.events);
  assert.equal(state.queues["queue-1"].status, "cancelled");
  assert.equal(state.queues["queue-2"].status, "cancelled");
  assert.equal(state.queues["queue-3"].status, "enqueued");
  assert.equal(aborted.events.at(-1)?.type, "run_aborted");
});

test("steer is consumed after the current tool result and before the next provider call", async () => {
  const store = new InMemoryHarnessStore();
  let releaseTool!: () => void;
  const toolGate = new Promise<void>((resolve) => { releaseTool = resolve; });
  let toolStarted!: () => void;
  const started = new Promise<void>((resolve) => { toolStarted = resolve; });
  let calls = 0;
  let secondMessages: string[] = [];
  const harness = createAgentHarness({
    store, workerId: "worker", id: () => "steer-1",
    tools: new ToolRegistry().register({
      name: "read", description: "read", parameters: {}, risk: "read",
      execute: async () => { toolStarted(); await toolGate; return { type: "continue", content: "tool-result" }; },
    }),
    provider: {
      supportsNativeToolCalling: () => true,
      complete: async ({ messages }) => {
        calls += 1;
        if (calls === 1) return { type: "tool_call", callId: "c", name: "read", arguments: {} };
        secondMessages = messages.map(({ content }) => content);
        return { type: "text", text: "steered" };
      },
    },
    policy: { authorize: () => true },
  });
  const running = harness.start({ runId: "steer-run", input: "start", context: owner });
  await started;
  await harness.enqueue("steer-run", owner, "steer", "change direction");
  releaseTool();
  assert.equal((await running).text, "steered");
  assert.deepEqual(secondMessages, ["start", "", "tool-result", "change direction"]);
});

test("follow-up starts a new turn after the current run settles", async () => {
  const store = new InMemoryHarnessStore();
  let releaseFirst!: () => void;
  const firstGate = new Promise<void>((resolve) => { releaseFirst = resolve; });
  let firstStarted!: () => void;
  const started = new Promise<void>((resolve) => { firstStarted = resolve; });
  let calls = 0;
  const seen: string[][] = [];
  const harness = createAgentHarness({
    store, workerId: "worker", id: () => "follow-1",
    provider: {
      supportsNativeToolCalling: () => true,
      complete: async ({ messages }) => {
        calls += 1;
        seen.push(messages.map(({ content }) => content));
        if (calls === 1) { firstStarted(); await firstGate; return { type: "text", text: "first" }; }
        return { type: "text", text: "followed" };
      },
    },
    policy: { authorize: () => true },
  });
  const running = harness.start({ runId: "follow-run", input: "start", context: owner });
  await started;
  await harness.enqueue("follow-run", owner, "followUp", "do next");
  releaseFirst();
  assert.equal((await running).text, "followed");
  assert.deepEqual(seen[1], ["start", "first", "do next"]);
});

test("queue cancellation rejects consumed items without rewriting history", async () => {
  const store = new InMemoryHarnessStore();
  const harness = createAgentHarness({
    store, workerId: "worker", id: () => "next-1",
    provider: { supportsNativeToolCalling: () => true, complete: async () => ({ type: "text", text: "ok" }) },
    policy: { authorize: () => true },
  });
  await harness.start({ runId: "cancel-queue", input: "one", context: owner });
  await harness.enqueue("cancel-queue", owner, "nextRun", "queued");
  assert.equal((await harness.cancelQueue("cancel-queue", owner, "next-1")).ok, true);
  assert.equal((await harness.cancelQueue("cancel-queue", owner, "next-1")).error?.code, "ALREADY_CONSUMED");
});

test("manual drive pauses before actions and produces the automatic durable log", async () => {
  const run = async (driveMode: "automatic" | "manual") => {
    const store = new InMemoryHarnessStore(() => 1);
    const harness = createAgentHarness({
      store, workerId: "worker", driveMode,
      provider: { supportsNativeToolCalling: () => true, complete: async () => ({ type: "text", text: "done" }) },
      policy: { authorize: () => true },
    });
    const pending = harness.start({ runId: "driven", input: "go", context: owner });
    if (driveMode === "manual") {
      await Promise.resolve();
      assert.notEqual(harness.peekAction(), null);
      await harness.runToCompletion("driven");
    }
    assert.equal((await pending).text, "done");
    return (await store.load("driven"))!.events.map(({ type, data, idempotencyKey }) => ({ type, data, idempotencyKey }));
  };
  assert.deepEqual(await run("manual"), await run("automatic"));
});

test("manual drive gates host event and final persistence hooks", async () => {
  const harness = createAgentHarness({
    store: new InMemoryHarnessStore(), workerId: "worker", driveMode: "manual",
    provider: { supportsNativeToolCalling: () => true, complete: async () => ({ type: "text", text: "done" }) },
    policy: { authorize: () => true },
    emit: async () => undefined,
    saveResult: async () => undefined,
  });
  const actions: string[] = [];
  let settled = false;
  const running = harness.start({ runId: "manual-hooks", input: "go", context: owner });
  void running.finally(() => { settled = true; });
  for (let guard = 0; !settled && guard < 100; guard += 1) {
    await Promise.resolve();
    const action = harness.peekAction();
    if (action) {
      actions.push(action.kind);
      await harness.executeAction();
    }
  }
  assert.equal((await running).status, "completed");
  assert.equal(actions.filter((kind) => kind === "hook").length >= 3, true);
});

test("manual close pauses before its durable mutation", async () => {
  const store = new InMemoryHarnessStore();
  const harness = createAgentHarness({
    store, workerId: "worker", driveMode: "manual",
    provider: { supportsNativeToolCalling: () => true, complete: async () => ({ type: "text", text: "done" }) },
    policy: { authorize: () => true },
  });
  const running = harness.start({ runId: "manual-close", input: "go", context: owner });
  await harness.runToCompletion("manual-close");
  await running;
  let closed = false;
  const closing = harness.close("manual-close").then(() => { closed = true; });
  await Promise.resolve();
  assert.equal(closed, false);
  assert.equal(harness.peekAction()?.kind, "durable_write");
  await harness.executeAction();
  await closing;
  assert.equal((await store.load("manual-close"))?.record.status, "closed");
});

test("manual queue and abort operations each pause before durable mutation", async () => {
  const store = new InMemoryHarnessStore();
  const harness = createAgentHarness({
    store, workerId: "worker", driveMode: "manual", id: () => "queued",
    provider: {
      supportsNativeToolCalling: () => true,
      complete: async () => ({ type: "deferred", handle: { provider: "fake", id: "wait", pollAfterMs: 1 } }),
    },
    policy: { authorize: () => true },
  });
  const running = harness.start({ runId: "manual-control", input: "go", context: owner });
  await harness.runToCompletion("manual-control");
  await running;

  const enqueue = harness.enqueue("manual-control", owner, "nextRun", "later");
  await Promise.resolve();
  assert.equal(harness.peekAction()?.kind, "durable_write");
  await harness.executeAction();
  assert.equal((await enqueue).ok, true);

  const aborting = harness.abort("manual-control");
  await Promise.resolve();
  assert.equal(harness.peekAction()?.kind, "durable_write");
  await harness.executeAction();
  await aborting;
  const loaded = await store.load("manual-control");
  assert.equal(loaded?.record.status, "aborted");
  assert.equal(reduceHarnessEvents(loaded!.record, loaded!.events).queues.queued.status, "enqueued");
});

test("parallel tool batch keeps durable start and settlement records in source order", async () => {
  const store = new InMemoryHarnessStore();
  let calls = 0;
  const harness = createAgentHarness({
    store, workerId: "worker", toolExecution: "parallel",
    tools: new ToolRegistry()
      .register({ name: "one", description: "one", parameters: {}, risk: "read", replay: "safe", execute: async () => ({ type: "continue", content: "1" }) })
      .register({ name: "two", description: "two", parameters: {}, risk: "read", replay: "safe", execute: async () => ({ type: "continue", content: "2" }) }),
    provider: {
      supportsNativeToolCalling: () => true,
      complete: async () => ++calls === 1
        ? { type: "tool_calls", calls: [{ callId: "c1", name: "one", arguments: {} }, { callId: "c2", name: "two", arguments: {} }] }
        : { type: "text", text: "done" },
    },
    policy: { authorize: () => true },
    protectToolArguments: (value) => value,
    restoreToolArguments: (value) => value,
  });
  assert.equal((await harness.start({ runId: "parallel-durable", input: "go", context: owner })).text, "done");
  const effects = (await store.load("parallel-durable"))!.events.filter(({ type }) => type === "tool_started" || type === "tool_settled");
  assert.deepEqual(effects.map(({ type, data }) => [type, data.callId]), [
    ["tool_started", "c1"], ["tool_started", "c2"], ["tool_settled", "c1"], ["tool_settled", "c2"],
  ]);
});
