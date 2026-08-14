import test from "node:test";
import assert from "node:assert/strict";
import {
  AgenticError,
  DurableInteractionManager,
  InMemoryHarnessStore,
  ToolRegistry,
  createAgentHarness,
  createDurableClarificationTool,
  type AgentEvent,
} from "../src/index.ts";

const context = { principalId: "u1", workspaceId: "w1" };

test("approval request and response survive manager recreation", async () => {
  const store = new InMemoryHarnessStore();
  await store.create({ runId: "approval", input: "write", context });
  const first = new DurableInteractionManager({ store, id: () => "a1" });
  const request = await first.beginApproval("approval", context, {
    toolName: "write-file",
    timeoutMs: 10_000,
    displayPayload: { path: "report.txt" },
  });
  assert.equal(request.requestId, "a1");

  const recreated = new DurableInteractionManager({ store, id: () => "unused" });
  assert.equal((await recreated.pending("approval", context))?.requestId, "a1");
  await recreated.respondApproval("approval", context, { requestId: "a1", approved: true, alwaysAllow: true });
  assert.equal((await recreated.approvalResponse("approval", context, "a1"))?.approved, true);
  assert.equal(await recreated.pending("approval", context), undefined);
});

test("clarification supports answers and rejects wrong owner or duplicate response", async () => {
  const store = new InMemoryHarnessStore();
  await store.create({ runId: "question", input: "ask", context });
  const manager = new DurableInteractionManager({ store, id: () => "q1" });
  await manager.beginClarification("question", context, {
    questions: [{ kind: "choice", question: "Choose", choices: ["A", "B"] }],
    allowSkip: true,
    timeoutMs: 10_000,
  });
  await assert.rejects(
    () => manager.respondClarification("question", { principalId: "u2", workspaceId: "w1" }, {
      requestId: "q1", skipped: false, timedOut: false, answers: [{ skipped: false, answer: "A" }],
    }),
    (error) => error instanceof AgenticError && error.code === "TOOL_DENIED"
  );
  const response = { requestId: "q1", skipped: false, timedOut: false, answers: [{ skipped: false, answer: "A" }] };
  await manager.respondClarification("question", context, response);
  await assert.rejects(() => manager.respondClarification("question", context, response));
});

test("expired interactions settle fail closed", async () => {
  let now = 100;
  const store = new InMemoryHarnessStore(() => now);
  await store.create({ runId: "timeout", input: "write", context });
  const manager = new DurableInteractionManager({ store, id: () => "a2", now: () => now });
  await manager.beginApproval("timeout", context, { toolName: "delete", timeoutMs: 5 });
  now = 106;
  const response = await manager.expire("timeout", context);
  assert.deepEqual(response, { requestId: "a2", approved: false });
  assert.equal(await manager.pending("timeout", context), undefined);
});

test("harness suspends a risky tool and resumes it once after durable approval", async () => {
  const store = new InMemoryHarnessStore();
  const interactions = new DurableInteractionManager({ store, id: () => "approval-1" });
  let providerCalls = 0;
  let writes = 0;
  const config = {
    store,
    interactions,
    workerId: "worker",
    tools: new ToolRegistry().register({
      name: "write", description: "write", parameters: { type: "object" }, risk: "write" as const,
      execute: async () => { writes += 1; return { type: "continue" as const, content: "written" }; },
    }),
    provider: {
      supportsNativeToolCalling: () => true,
      complete: async () => ++providerCalls === 1
        ? { type: "tool_call" as const, callId: "call-1", name: "write", arguments: {} }
        : { type: "text" as const, text: "done" },
    },
    policy: { authorize: () => true },
  };
  const first = await createAgentHarness(config).start({ runId: "durable-approval", input: "write", context });
  assert.equal(first.status, "needs_input");
  assert.equal(first.pending?.requestId, "approval-1");
  assert.equal(writes, 0);
  assert.equal((await store.load("durable-approval"))?.events.filter(({ type }) => type === "tool_planned").length, 1);
  assert.equal((await store.load("durable-approval"))?.events.filter(({ type }) => type === "tool_started").length, 0);

  const resumed = await createAgentHarness(config).respondApproval("durable-approval", context, {
    requestId: "approval-1", approved: true,
  });
  assert.equal(resumed.text, "done");
  assert.equal(writes, 1);
  assert.equal(providerCalls, 2);
  const toolEvents = (await store.load("durable-approval"))!.events.filter(({ type }) => type.startsWith("tool_"));
  assert.deepEqual(toolEvents.map(({ type }) => type), ["tool_planned", "tool_started", "tool_settled"]);
});

test("durable approval payload redacts credential-shaped tool arguments", async () => {
  const store = new InMemoryHarnessStore();
  const interactions = new DurableInteractionManager({ store, id: () => "private-approval" });
  const harness = createAgentHarness({
    store, interactions, workerId: "worker",
    tools: new ToolRegistry().register({
      name: "write", description: "write", parameters: {}, risk: "write",
      execute: async () => ({ type: "continue", content: "unused" }),
    }),
    provider: {
      supportsNativeToolCalling: () => true,
      complete: async () => ({ type: "tool_call", callId: "private-call", name: "write", arguments: { token: "do-not-display" } }),
    },
    policy: { authorize: () => true },
  });
  const result = await harness.start({ runId: "private-approval-run", input: "write", context });
  assert.equal(result.status, "needs_input");
  assert.deepEqual("displayPayload" in result.pending! ? result.pending.displayPayload : undefined, { token: "[REDACTED]" });
  assert.equal(JSON.stringify((await store.load("private-approval-run"))?.events).includes("do-not-display"), false);
});

test("approved tool restores protected arguments before its single execution", async () => {
  const store = new InMemoryHarnessStore();
  const interactions = new DurableInteractionManager({ store, id: () => "sealed-approval" });
  let received: unknown;
  let providerCalls = 0;
  const config = {
    store, interactions, workerId: "worker",
    protectToolArguments: async (value: unknown) => `sealed:${JSON.stringify(value)}`,
    restoreToolArguments: async (value: unknown) => JSON.parse(String(value).slice("sealed:".length)),
    tools: new ToolRegistry().register({
      name: "write", description: "write", parameters: {}, risk: "write" as const,
      execute: async (value: unknown) => { received = value; return { type: "continue" as const, content: "written" }; },
    }),
    provider: {
      supportsNativeToolCalling: () => true,
      complete: async () => ++providerCalls === 1
        ? { type: "tool_call" as const, callId: "sealed-call", name: "write", arguments: { path: "report.txt" } }
        : { type: "text" as const, text: "done" },
    },
    policy: { authorize: () => true },
  };
  const first = await createAgentHarness(config).start({ runId: "sealed-run", input: "write", context });
  const result = await createAgentHarness(config).respondApproval("sealed-run", context, {
    requestId: first.pending!.requestId, approved: true,
  });
  assert.equal(result.text, "done");
  assert.deepEqual(received, { path: "report.txt" });
});

test("harness persists clarification and resumes provider with the answer", async () => {
  const store = new InMemoryHarnessStore();
  const interactions = new DurableInteractionManager({ store, id: () => "question-1" });
  let calls = 0;
  const seen: string[][] = [];
  const harness = createAgentHarness({
    store, interactions, workerId: "worker",
    tools: new ToolRegistry().register(createDurableClarificationTool()),
    provider: {
      supportsNativeToolCalling: () => true,
      complete: async ({ messages }) => {
        calls += 1;
        seen.push(messages.map(({ content }) => content));
        return calls === 1
          ? { type: "tool_call", callId: "q-call", name: "request-user-input", arguments: { questions: [{ kind: "input", question: "Name?" }] } }
          : { type: "text", text: "Hello Ada" };
      },
    },
    policy: { authorize: () => true },
  });
  const pending = await harness.start({ runId: "durable-question", input: "hello", context });
  assert.equal(pending.status, "needs_input");
  const done = await harness.respondClarification("durable-question", context, {
    requestId: "question-1", skipped: false, timedOut: false,
    answers: [{ skipped: false, answer: "Ada" }],
  });
  assert.equal(done.text, "Hello Ada");
  assert.match(seen[1].at(-1) ?? "", /Ada/);
});

test("harness timeout settles pending approval and fails closed", async () => {
  let now = 100;
  const store = new InMemoryHarnessStore(() => now);
  const interactions = new DurableInteractionManager({ store, id: () => "timeout-approval", now: () => now });
  const harness = createAgentHarness({
    store, interactions, workerId: "worker", interactionTimeoutMs: 5,
    tools: new ToolRegistry().register({
      name: "write", description: "write", parameters: {}, risk: "write",
      execute: async () => ({ type: "continue", content: "bad" }),
    }),
    provider: { supportsNativeToolCalling: () => true, complete: async () => ({ type: "tool_call", callId: "w", name: "write", arguments: {} }) },
    policy: { authorize: () => true },
  });
  assert.equal((await harness.start({ runId: "timeout-run", input: "write", context })).status, "needs_input");
  now = 106;
  const result = await harness.expireInteraction("timeout-run", context);
  assert.equal(result.error?.code, "APPROVAL_TIMEOUT");
  assert.equal((await store.load("timeout-run"))?.record.status, "failed");
});

test("durable harness emits approval requests for transport/UI", async () => {
  const store = new InMemoryHarnessStore();
  let id = 0;
  const interactions = new DurableInteractionManager({ store, id: () => `request-${++id}` });
  const events: AgentEvent[] = [];
  let calls = 0;
  const harness = createAgentHarness({
    store, interactions, workerId: "worker",
    tools: new ToolRegistry()
      .register({ name: "write", description: "write", parameters: {}, risk: "write", execute: async () => ({ type: "continue", content: "ok" }) })
      .register(createDurableClarificationTool()),
    provider: {
      supportsNativeToolCalling: () => true,
      complete: async () => ++calls === 1
        ? { type: "tool_call", callId: "w", name: "write", arguments: { path: "x" } }
        : { type: "tool_call", callId: "q", name: "request-user-input", arguments: {} },
    },
    policy: { authorize: () => true },
    emit: (event) => { events.push(event); },
  });
  await harness.start({ runId: "approval-event", input: "write", context });
  assert.deepEqual(events.find(({ type }) => type === "approval_requested"), {
    type: "approval_requested", runId: "approval-event", requestId: "request-1",
    toolName: "write", displayPayload: { path: "x" },
  });
});
