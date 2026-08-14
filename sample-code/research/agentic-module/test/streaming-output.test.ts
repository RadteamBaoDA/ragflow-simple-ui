import test from "node:test";
import assert from "node:assert/strict";
import {
  AgentEventJournal,
  AgenticError,
  createAgenticModule,
  reduceAgentUiEvent,
  serializeSseEvent,
  serializeWebSocketEvent,
  redactTelemetry,
  type AgentEvent,
} from "../src/index.ts";

test("journal replays events strictly after a reconnect cursor", () => {
  const journal = new AgentEventJournal();
  journal.publish({ type: "run_started", runId: "r1" });
  journal.publish({ type: "thinking_summary_delta", runId: "r1", text: "Checking sources" });
  journal.publish({ type: "output_delta", runId: "r1", text: "Done" });

  assert.deepEqual(journal.replay("r1", 1).map(({ sequence, type }) => [sequence, type]), [
    [2, "thinking_summary_delta"],
    [3, "output_delta"],
  ]);
});

test("SSE and WebSocket serialize the same event envelope", () => {
  const event = new AgentEventJournal(() => 123).publish({
    type: "tool_call_ready", runId: "r1", callId: "c1", toolName: "search", arguments: { q: "x" },
  });
  assert.equal(serializeSseEvent(event), `id: 1\nevent: tool_call_ready\ndata: ${JSON.stringify(event)}\n\n`);
  assert.equal(serializeWebSocketEvent(event), JSON.stringify(event));
});

test("UI reducer renders thinking summary, tool output, approval and final state", () => {
  const journal = new AgentEventJournal(() => 1);
  const events = [
    journal.publish({ type: "thinking_summary_delta", runId: "r1", text: "Plan" }),
    journal.publish({ type: "tool_call_ready", runId: "r1", callId: "c1", toolName: "search", arguments: {} }),
    journal.publish({ type: "tool_output_delta", runId: "r1", callId: "c1", toolName: "search", text: "result" }),
    journal.publish({ type: "approval_requested", runId: "r1", requestId: "a1", toolName: "write", displayPayload: {} }),
    journal.publish({ type: "approval_responded", runId: "r1", requestId: "a1", approved: true }),
    journal.publish({ type: "final_output_validated", runId: "r1", text: "answer" }),
  ];
  const state = events.reduce(reduceAgentUiEvent, undefined);
  assert.equal(state.thinking, "Plan");
  assert.equal(state.tools.c1.output, "result");
  assert.equal(state.pending, undefined);
  assert.equal(state.finalText, "answer");
  assert.equal(state.lastSequence, 6);
});

test("runtime streams safe thinking summaries, tool payload/output, usage and validated final output", async () => {
  const events: AgentEvent[] = [];
  let calls = 0;
  const module = createAgenticModule({
    tools: new (await import("../src/tool-registry.ts")).ToolRegistry().register({
      name: "lookup", description: "lookup", parameters: {}, risk: "read",
      execute: async () => ({ type: "continue", content: "tool-result" }),
    }),
    provider: {
      supportsNativeToolCalling: () => true,
      complete: async () => ({ type: "text", text: "unused" }),
      async *stream() {
        calls += 1;
        if (calls === 1) {
          yield { type: "thinking_summary_delta", text: "Checking" } as const;
          yield { type: "tool_call", callId: "c1", name: "lookup", arguments: { id: 1 } } as const;
          return;
        }
        yield { type: "usage", usage: { inputTokens: 3, outputTokens: 2 } } as const;
        yield { type: "text_delta", text: "answer" } as const;
      },
    },
    policy: { authorize: () => true },
    validateFinalOutput: ({ text }) => text === "answer" ? { ok: true } : { ok: false, errors: ["wrong"] },
    emit: (event) => { events.push(event); },
  });
  const result = await module.start({ runId: "r1", input: "go", context: {} });
  assert.equal(result.status, "completed");
  assert.deepEqual(events.map(({ type }) => type), [
    "run_started", "thinking_summary_delta", "tool_call_ready", "tool_started",
    "tool_output_delta", "tool_finished", "usage", "output_delta",
    "final_output_candidate", "final_output_validated", "run_finished",
  ]);
});

test("invalid final output fails before persistence and terminal success", async () => {
  let persisted = false;
  const module = createAgenticModule({
    provider: {
      supportsNativeToolCalling: () => true,
      complete: async () => ({ type: "text", text: "invalid" }),
    },
    policy: { authorize: () => true },
    validateFinalOutput: () => ({ ok: false, errors: ["schema mismatch"] }),
    saveResult: () => { persisted = true; },
  });
  const result = await module.start({ runId: "invalid", input: "go", context: {} });
  assert.equal(result.error?.code, "FINAL_OUTPUT_INVALID");
  assert.equal(persisted, false);
});

test("empty final output is rejected even without a host validator", async () => {
  const module = createAgenticModule({
    provider: { supportsNativeToolCalling: () => true, complete: async () => ({ type: "text", text: "   " }) },
    policy: { authorize: () => true },
  });
  const result = await module.start({ runId: "empty", input: "go", context: {} });
  assert.equal(result.error?.code, "FINAL_OUTPUT_INVALID");
});

test("streaming output limit fails before emitting or persisting an oversized final", async () => {
  const events: AgentEvent[] = [];
  const module = createAgenticModule({
    provider: {
      supportsNativeToolCalling: () => true,
      complete: async () => ({ type: "text", text: "unused" }),
      stream: async function* () { yield { type: "text_delta" as const, text: "123" }; yield { type: "text_delta" as const, text: "456" }; },
    },
    policy: { authorize: () => true },
    maxOutputCharacters: 5,
    emit: (event) => { events.push(event); },
  });
  const result = await module.start({ runId: "output-limit", input: "go", context: {} });
  assert.equal(result.status, "failed");
  assert.equal(result.error?.code, "OUTPUT_LIMIT");
  assert.equal(events.some(({ type }) => type === "final_output_validated"), false);
});

test("non-streaming provider usage is emitted", async () => {
  const events: AgentEvent[] = [];
  const module = createAgenticModule({
    provider: {
      supportsNativeToolCalling: () => true,
      complete: async () => ({ type: "text", text: "ok", usage: { inputTokens: 2, outputTokens: 1 } }),
    },
    policy: { authorize: () => true },
    emit: (event) => { events.push(event); },
  });
  await module.start({ runId: "usage", input: "go", context: {} });
  assert.deepEqual(events.find(({ type }) => type === "usage"), {
    type: "usage", runId: "usage", usage: { inputTokens: 2, outputTokens: 1 },
  });
});

test("automatically loaded skills participate in the same secured agent loop", async () => {
  let providerCalls = 0;
  let skillLoads = 0;
  const module = createAgenticModule({
    loadSkills: async ({ input }) => {
      skillLoads += 1;
      return input.includes("weather") ? [{
        name: "weather", description: "weather", parameters: {}, risk: "read" as const,
        execute: async () => ({ type: "continue" as const, content: "sunny" }),
      }] : [];
    },
    provider: {
      supportsNativeToolCalling: () => true,
      complete: async ({ tools }) => {
        providerCalls += 1;
        assert.equal(tools.some(({ name }) => name === "weather"), true);
        return providerCalls === 1
          ? { type: "tool_call", callId: "skill-1", name: "weather", arguments: {} }
          : { type: "text", text: "It is sunny" };
      },
    },
    policy: { authorize: () => true },
  });
  assert.equal((await module.start({ runId: "skills", input: "weather now", context: {} })).text, "It is sunny");
  assert.equal(skillLoads, 1);
});

test("context is automatically compacted before the provider limit is crossed", async () => {
  const events: AgentEvent[] = [];
  let seen: string[] = [];
  const module = createAgenticModule({
    provider: {
      supportsNativeToolCalling: () => true,
      complete: async ({ messages }) => {
        seen = messages.map(({ content }) => content);
        return { type: "text", text: "done" };
      },
    },
    policy: { authorize: () => true },
    contextWindow: {
      maxInputTokens: 5,
      estimateTokens: (messages) => messages.reduce((sum, { content }) => sum + content.split(/\s+/).length, 0),
      compact: async ({ messages }) => [
        { role: "system", content: "summary" },
        messages.at(-1)!,
      ],
    },
    emit: (event) => { events.push(event); },
  });
  const result = await module.start({
    runId: "compact", input: "new question", context: {},
    history: [{ role: "user", content: "one two three four five" }, { role: "assistant", content: "old answer" }],
  });
  assert.equal(result.text, "done");
  assert.deepEqual(seen, ["summary", "new question"]);
  assert.deepEqual(events.find(({ type }) => type === "context_compacted"), {
    type: "context_compacted", runId: "compact", beforeTokens: 9, afterTokens: 3,
  });
});

test("compaction rejects an orphaned tool result instead of splitting protocol", async () => {
  let providerCalls = 0;
  const module = createAgenticModule({
    provider: {
      supportsNativeToolCalling: () => true,
      complete: async () => { providerCalls += 1; return { type: "text", text: "bad" }; },
    },
    policy: { authorize: () => true },
    contextWindow: {
      maxInputTokens: 1,
      estimateTokens: (messages) => messages.length,
      compact: async ({ messages }) => [messages.find(({ role }) => role === "tool")!],
    },
  });
  const result = await module.start({
    runId: "split-tool-protocol", input: "continue", context: {},
    history: [
      { role: "assistant", content: "", toolCalls: [{ callId: "c1", name: "read", arguments: {} }] },
      { role: "tool", content: "result", toolCallId: "c1" },
    ],
  });
  assert.equal(result.error?.code, "COMPACTION_INVALID");
  assert.equal(providerCalls, 0);
});

test("context is compacted again after tool output grows beyond the limit", async () => {
  let calls = 0;
  let secondMessages: string[] = [];
  const module = createAgenticModule({
    tools: new (await import("../src/tool-registry.ts")).ToolRegistry().register({
      name: "large", description: "large", parameters: {}, risk: "read",
      execute: async () => ({ type: "continue", content: "one two three four" }),
    }),
    provider: {
      supportsNativeToolCalling: () => true,
      complete: async ({ messages }) => {
        calls += 1;
        if (calls === 1) return { type: "tool_call", callId: "c", name: "large", arguments: {} };
        secondMessages = messages.map(({ content }) => content);
        return { type: "text", text: "done" };
      },
    },
    policy: { authorize: () => true },
    maxToolCalls: 1,
    contextWindow: {
      maxInputTokens: 3,
      estimateTokens: (messages) => messages.reduce((sum, { content }) => sum + content.split(/\s+/).length, 0),
      compact: async ({ messages }) => [
        { role: "system", content: "summary" },
        messages.find(({ toolCalls }) => toolCalls?.some(({ callId }) => callId === "c"))!,
        { ...messages.at(-1)!, content: "result" },
      ],
    },
  });
  assert.equal((await module.start({ runId: "compact-tool", input: "go", context: {} })).text, "done");
  assert.deepEqual(secondMessages, ["summary", "", "result"]);
});

test("watcher atomically replays then receives live events without gaps", () => {
  const journal = new AgentEventJournal(() => 1);
  journal.publish({ type: "run_started", runId: "watch" });
  journal.publish({ type: "output_delta", runId: "watch", text: "a" });
  const sequences: number[] = [];
  const stop = journal.watch("watch", 1, (event) => { sequences.push(event.sequence); });
  journal.publish({ type: "output_delta", runId: "watch", text: "b" });
  stop();
  journal.publish({ type: "output_delta", runId: "watch", text: "c" });
  assert.deepEqual(sequences, [2, 3]);
});

test("one failing stream listener does not block passive observers", () => {
  const journal = new AgentEventJournal();
  let observed = 0;
  journal.watch("listeners", 0, () => { throw new Error("listener failed"); });
  journal.watch("listeners", 0, () => { observed += 1; });
  assert.doesNotThrow(() => journal.publish({ type: "run_started", runId: "listeners" }));
  assert.equal(observed, 1);
});

test("telemetry redaction removes bodies, credentials and sensitive nested values", () => {
  assert.deepEqual(redactTelemetry({
    sessionId: "s", durationMs: 12, prompt: "private", output: "private",
    authorization: "Bearer secret", nested: { apiKey: "secret", count: 2 },
  }), {
    sessionId: "s", durationMs: 12, prompt: "[REDACTED]", output: "[REDACTED]",
    authorization: "[REDACTED]", nested: { apiKey: "[REDACTED]", count: 2 },
  });
});

test("provider context overflow triggers at most one compaction retry per call", async () => {
  let providerCalls = 0;
  let compactions = 0;
  const module = createAgenticModule({
    provider: {
      supportsNativeToolCalling: () => true,
      complete: async () => {
        providerCalls += 1;
        throw new AgenticError("CONTEXT_OVERFLOW", "too long");
      },
    },
    policy: { authorize: () => true },
    contextWindow: {
      maxInputTokens: 10,
      estimateTokens: () => 1,
      compact: async ({ messages }) => { compactions += 1; return messages; },
    },
  });
  const result = await module.start({ runId: "overflow", input: "go", context: {} });
  assert.equal(result.error?.code, "CONTEXT_OVERFLOW");
  assert.equal(providerCalls, 2);
  assert.equal(compactions, 1);
});
