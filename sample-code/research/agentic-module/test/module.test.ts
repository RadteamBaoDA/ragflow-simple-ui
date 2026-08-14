import test from "node:test";
import assert from "node:assert/strict";
import {
  InMemoryInvocationStore,
  ProvenanceLedger,
  ToolRegistry,
  AgenticError,
  assertImportedExecutionPolicy,
  assertSafeRelativeReference,
  createAgenticModule,
  createClarificationTool,
  createRetrievalTool,
  executeFlow,
  mcpToolsToDefinitions,
  resolveToolIdentifiers,
  shouldUseAgent,
  validateImportedSkillManifest,
  type ProviderAdapter,
} from "../src/index.ts";

const textProvider = (text = "ok"): ProviderAdapter => ({
  supportsNativeToolCalling: () => true,
  complete: async () => ({ type: "text", text }),
});

test("claims an invocation once and enforces principal ownership", async () => {
  const store = new InMemoryInvocationStore();
  await store.create({ runId: "run-1", input: "hi", context: { principalId: "u1" } });
  assert.equal(await store.claim("run-1", { principalId: "u2" }), false);
  assert.equal(await store.claim("run-1", { principalId: "u1" }), true);
  assert.equal(await store.claim("run-1", { principalId: "u1" }), false);
});

test("uses explicit activation or automatic native tool capability", async () => {
  const provider = textProvider();
  assert.equal(await shouldUseAgent({ input: "@agent hi", mode: "manual", provider }), true);
  assert.equal(await shouldUseAgent({ input: "hi", mode: "automatic", provider }), true);
});

test("resolves all portable tool identifier forms", async () => {
  const make = (name: string) => ({
    name,
    description: name,
    parameters: {},
    risk: "read" as const,
    execute: async () => ({ type: "continue" as const, content: name }),
  });
  const tools = await resolveToolIdentifiers(
    ["plain", "parent#child", "@@flow_f1", "@@skill-1", "@@mcp_demo"],
    {
      builtIn: async (name) => make(name),
      child: async (_parent, child) => make(child),
      flow: async (id) => make(`flow-${id}`),
      imported: async (id) => make(id),
      mcp: async (server) => [make(`${server}-one`), make(`${server}-two`)],
    }
  );
  assert.deepEqual(tools.map(({ name }) => name), [
    "plain",
    "child",
    "flow-f1",
    "skill-1",
    "demo-one",
    "demo-two",
  ]);
});

test("runs provider-tool-provider and preserves session continuation", async () => {
  let calls = 0;
  const seen: string[][] = [];
  const seenMessages: Array<Array<{ role: string; toolCalls?: unknown; toolCallId?: string }>> = [];
  const provider: ProviderAdapter = {
    supportsNativeToolCalling: () => true,
    complete: async ({ messages }) => {
      calls += 1;
      seen.push(messages.map(({ content }) => content));
      seenMessages.push(structuredClone(messages));
      if (calls === 1) return { type: "tool_call", callId: "c1", name: "sum", arguments: { a: 2, b: 3 } };
      return { type: "text", text: calls === 2 ? "5" : "follow-up" };
    },
  };
  const tools = new ToolRegistry().register({
    name: "sum",
    description: "sum",
    parameters: { type: "object" },
    risk: "read",
    execute: async (value) => {
      const { a, b } = value as { a: number; b: number };
      return { type: "continue", content: String(a + b) };
    },
  });
  const module = createAgenticModule({ provider, tools, policy: { authorize: () => true } });
  const first = await module.start({ runId: "run-tool", input: "2+3", context: {} });
  const second = await module.continue("run-tool", "again");
  assert.equal(first.text, "5");
  assert.equal(second.text, "follow-up");
  assert.deepEqual(seenMessages[1].map(({ role }) => role), ["user", "assistant", "tool"]);
  assert.deepEqual(seenMessages[1][1].toolCalls, [{ callId: "c1", name: "sum", arguments: { a: 2, b: 3 } }]);
  assert.equal(seenMessages[1][2].toolCallId, "c1");
  assert.deepEqual(seen[1].at(-1), "5");
  assert.deepEqual(seen[2], ["2+3", "", "5", "5", "again"]);
});

test("fails closed when a risky tool has no approval", async () => {
  let executed = false;
  const tools = new ToolRegistry().register({
    name: "write",
    description: "write",
    parameters: {},
    risk: "write",
    execute: async () => {
      executed = true;
      return { type: "continue", content: "written" };
    },
  });
  const provider: ProviderAdapter = {
    supportsNativeToolCalling: () => true,
    complete: async () => ({ type: "tool_call", callId: "w1", name: "write", arguments: {} }),
  };
  const module = createAgenticModule({ provider, tools, policy: { authorize: () => true }, maxToolCalls: 1 });
  const result = await module.start({ runId: "run-deny", input: "write", context: {} });
  assert.equal(executed, false);
  assert.equal(result.error?.code, "TOOL_DENIED");
});

test("clarification and retrieval tools use host adapters", async () => {
  const clarification = createClarificationTool({
    maxQuestions: 2,
    ask: async ({ questions }) => ({ skipped: false, answers: questions.map(() => "yes") }),
  });
  const retrieval = createRetrievalTool({
    search: async () => [{ content: "policy text", citation: { id: "e1", title: "Policy", sourceRef: "doc-1" } }],
  });
  const citations: string[] = [];
  const context = {
    runId: "r",
    execution: {},
    signal: new AbortController().signal,
    addCitation: (citation: { id: string }) => citations.push(citation.id),
    addArtifact: () => undefined,
  };
  const clarified = await clarification.execute({ questions: [{ kind: "input", question: "A?" }] }, context);
  const found = await retrieval.execute({ query: "policy" }, context);
  assert.match(clarified.content, /yes/);
  assert.equal(found.content, "policy text");
  assert.deepEqual(citations, ["e1"]);
});

test("executes the four supported flow blocks sequentially", async () => {
  const seen: string[] = [];
  const result = await executeFlow({
    id: "f1",
    name: "flow",
    steps: [
      { type: "start", config: { variables: [{ name: "user", value: "Ada" }] } },
      { type: "apiCall", config: { url: "/${user}", responseVariable: "profile" } },
      { type: "llmInstruction", config: { instruction: "Hi ${profile.name}", directOutput: true } },
    ],
  }, {
    signal: new AbortController().signal,
    executors: {
      apiCall: async (config) => { seen.push(String(config.url)); return { name: "Lovelace" }; },
      llmInstruction: async (config) => { seen.push(String(config.instruction)); return config.instruction; },
    },
  });
  assert.deepEqual(seen, ["/Ada", "Hi Lovelace"]);
  assert.equal(result.directOutput, "Hi Lovelace");
});

test("validates imported manifests and normalizes MCP tools", async () => {
  assert.equal(validateImportedSkillManifest({ name: "bad" }).ok, false);
  assert.equal(validateImportedSkillManifest({
    id: "skill-1",
    name: "Skill",
    version: "1.0.0",
    description: "A skill",
    active: true,
    entrypoint: { parameters: { type: "object" } },
  }).ok, true);

  const tools = await mcpToolsToDefinitions("demo", {
    listTools: async () => [{ name: "read", description: "read", inputSchema: { type: "object", $defs: { value: { type: "string" } }, properties: { value: { $ref: "#/$defs/value" } } } }],
    callTool: async () => ({ count: 1n }),
  });
  assert.equal(tools[0].name, "demo-read");
  assert.deepEqual((tools[0].parameters.properties as Record<string, unknown>).value, { type: "string" });
  const output = await tools[0].execute({}, {
    runId: "r",
    execution: {},
    signal: new AbortController().signal,
    addCitation: () => undefined,
    addArtifact: () => undefined,
  });
  assert.equal(output.content, '{"count":"1"}');
});

test("streams text and emits the same final text", async () => {
  const deltas: string[] = [];
  const module = createAgenticModule({
    provider: {
      supportsNativeToolCalling: () => true,
      complete: async () => ({ type: "text", text: "unused" }),
      async *stream() {
        yield { type: "text_delta", text: "hel" } as const;
        yield { type: "text_delta", text: "lo" } as const;
      },
    },
    policy: { authorize: () => true },
    emit: (event) => { if (event.type === "output_delta") deltas.push(event.text); },
  });
  const result = await module.start({ runId: "stream", input: "hi", context: {} });
  assert.equal(result.text, "hello");
  assert.deepEqual(deltas, ["hel", "lo"]);
});

test("supports authorized live tool toggles", async () => {
  let calls = 0;
  const tools = new ToolRegistry().register({
    name: "echo",
    description: "echo",
    parameters: { type: "object" },
    risk: "read",
    execute: async () => ({ type: "continue", content: "ok" }),
  });
  const module = createAgenticModule({
    tools,
    provider: {
      supportsNativeToolCalling: () => true,
      complete: async () => ++calls === 1
        ? { type: "text", text: "ready" }
        : { type: "tool_call", callId: "bad", name: "echo", arguments: "bad" },
    },
    validateToolInput: (_schema, input) => typeof input === "object",
    policy: { authorize: () => true, canManageTools: () => true },
  });
  await module.start({ runId: "toggle", input: "start", context: {} });
  await module.setToolEnabled("toggle", "echo", false);
  const result = await module.continue("toggle", "use echo");
  assert.equal(result.error?.code, "TOOL_NOT_FOUND");
});

test("validates tool arguments before policy", async () => {
  let authorized = false;
  const tools = new ToolRegistry().register({
    name: "typed",
    description: "typed",
    parameters: { type: "object" },
    risk: "read",
    execute: async () => ({ type: "continue", content: "unexpected" }),
  });
  const module = createAgenticModule({
    tools,
    provider: {
      supportsNativeToolCalling: () => true,
      complete: async () => ({ type: "tool_call", callId: "invalid", name: "typed", arguments: "bad" }),
    },
    validateToolInput: () => false,
    policy: { authorize: () => { authorized = true; return true; } },
  });
  const result = await module.start({ runId: "schema", input: "go", context: {} });
  assert.equal(result.error?.code, "TOOL_ARGUMENTS_INVALID");
  assert.equal(authorized, false);
});

test("fails a completed run when host persistence fails", async () => {
  const module = createAgenticModule({
    provider: textProvider("saved"),
    policy: { authorize: () => true },
    saveResult: async () => { throw new Error("database unavailable"); },
  });
  const result = await module.start({ runId: "persist", input: "hi", context: {} });
  assert.equal(result.error?.code, "PERSISTENCE_FAILED");
  assert.equal(result.text, undefined);
});

test("rejects forged citations, unsafe references, and implicit in-process skills", () => {
  const ledger = new ProvenanceLedger();
  ledger.add({ id: "known", title: "Doc", sourceRef: "doc-1" });
  assert.deepEqual(ledger.requireKnown(["known"]).map(({ id }) => id), ["known"]);
  assert.throws(() => ledger.requireKnown(["forged"]), (error) =>
    error instanceof AgenticError && error.code === "INVALID_CITATION");
  assert.equal(assertSafeRelativeReference("runs/r1/chart.json"), "runs/r1/chart.json");
  assert.throws(() => assertSafeRelativeReference("../secret"));
  assert.throws(() => assertSafeRelativeReference("C:\\secret"));
  assert.throws(() => assertImportedExecutionPolicy("in_process"));
  assert.doesNotThrow(() => assertImportedExecutionPolicy("in_process", true));
});

test("parallel tool batch executes concurrently but appends results in source order", async () => {
  let releaseSlow!: () => void;
  const slowGate = new Promise<void>((resolve) => { releaseSlow = resolve; });
  let fastFinished = false;
  let calls = 0;
  let secondMessages: Array<{ role: string; content: string; toolCallId?: string }> = [];
  const tools = new ToolRegistry()
    .register({
      name: "slow", description: "slow", parameters: {}, risk: "read",
      execute: async () => { await slowGate; return { type: "continue", content: "slow-result" }; },
    })
    .register({
      name: "fast", description: "fast", parameters: {}, risk: "read",
      execute: async () => { fastFinished = true; releaseSlow(); return { type: "continue", content: "fast-result" }; },
    });
  const module = createAgenticModule({
    tools, toolExecution: "parallel",
    provider: {
      supportsNativeToolCalling: () => true,
      complete: async ({ messages }) => {
        calls += 1;
        if (calls === 1) return {
          type: "tool_calls", calls: [
            { callId: "slow-call", name: "slow", arguments: {} },
            { callId: "fast-call", name: "fast", arguments: {} },
          ],
        };
        secondMessages = messages;
        return { type: "text", text: "done" };
      },
    },
    policy: { authorize: () => true },
  });
  assert.equal((await module.start({ runId: "parallel", input: "go", context: {} })).text, "done");
  assert.equal(fastFinished, true);
  assert.deepEqual(secondMessages.filter(({ role }) => role === "tool").map(({ content, toolCallId }) => [content, toolCallId]), [
    ["slow-result", "slow-call"], ["fast-result", "fast-call"],
  ]);
});
