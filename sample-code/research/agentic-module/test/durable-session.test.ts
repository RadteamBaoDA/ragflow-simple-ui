import test from "node:test";
import assert from "node:assert/strict";
import {
  AgenticError,
  InMemorySessionStore,
  compactSession,
  forkSession,
  navigateSession,
  projectSession,
  setSessionConfiguration,
  type SessionMutationInput,
} from "../src/index.ts";

const seed = {
  model: { provider: "test", model: "fake" },
  thinkingLevel: "off" as const,
  activeToolNames: ["read"],
};

test("session store creates main lane and projects an immutable transcript tree", async () => {
  const store = new InMemorySessionStore(() => 10);
  await store.create({ sessionId: "s1", seedConfiguration: seed });
  await store.append("s1", 0, [
    { type: "entry_added", entry: { id: "e1", parentId: null, kind: "user", data: { text: "hello" } } },
    { type: "lane_moved", lane: "main", leafId: "e1" },
    { type: "entry_added", entry: { id: "e2", parentId: "e1", kind: "assistant", data: { text: "hi" } } },
    { type: "lane_moved", lane: "main", leafId: "e2" },
  ]);
  const loaded = await store.load("s1");
  const state = projectSession(loaded!.record, loaded!.mutations);
  assert.equal(state.lanes.main.leafId, "e2");
  assert.equal(state.entries.e2.parentId, "e1");
  assert.deepEqual(loaded!.mutations.map(({ sequence }) => sequence), [1, 2, 3, 4]);
});

test("atomic append rejects an invalid child without committing its valid sibling", async () => {
  const store = new InMemorySessionStore();
  await store.create({ sessionId: "s2", seedConfiguration: seed });
  const batch: SessionMutationInput[] = [
    { type: "entry_added", entry: { id: "valid", parentId: null, kind: "user", data: {} } },
    { type: "entry_added", entry: { id: "invalid", parentId: "missing", kind: "assistant", data: {} } },
  ];
  await assert.rejects(() => store.append("s2", 0, batch), (error) =>
    error instanceof AgenticError && error.code === "STORAGE_CORRUPTION");
  assert.equal((await store.load("s2"))?.mutations.length, 0);
});

test("a lane admits only one open operation while another lane remains independent", async () => {
  const store = new InMemorySessionStore();
  await store.create({ sessionId: "s3", seedConfiguration: seed });
  await store.append("s3", 0, [
    { type: "lane_created", lane: "review", anchorId: null },
    { type: "operation_started", operationId: "op-main", lane: "main", kind: "run", configuration: seed },
    { type: "operation_started", operationId: "op-review", lane: "review", kind: "run", configuration: seed },
  ]);
  await assert.rejects(() => store.append("s3", 3, [
    { type: "operation_started", operationId: "op-duplicate", lane: "main", kind: "compact", configuration: seed },
  ]), (error) => error instanceof AgenticError && error.code === "LANE_BUSY");
  const state = projectSession((await store.load("s3"))!.record, (await store.load("s3"))!.mutations);
  assert.equal(state.lanes.main.openOperationId, "op-main");
  assert.equal(state.lanes.review.openOperationId, "op-review");
});

test("external effects require a durable plan and preserve explicit uncertain recovery", async () => {
  const store = new InMemorySessionStore();
  await store.create({ sessionId: "s4", seedConfiguration: seed });
  await store.append("s4", 0, [
    { type: "operation_started", operationId: "op", lane: "main", kind: "run", configuration: seed },
    { type: "effect_planned", operationId: "op", stepId: "step", effectId: "effect", effectKind: "tool", replay: "never", plannedOutputId: "result" },
    { type: "effect_started", operationId: "op", stepId: "step", effectId: "effect", attempt: 1 },
    { type: "effect_uncertain", operationId: "op", stepId: "step", effectId: "effect", reason: "crash_after_side_effect" },
  ]);
  const loaded = await store.load("s4");
  assert.equal(projectSession(loaded!.record, loaded!.mutations).effects.effect.status, "uncertain");
  await assert.rejects(() => store.append("s4", 4, [
    { type: "effect_started", operationId: "op", stepId: "other", effectId: "unplanned", attempt: 1 },
  ]), (error) => error instanceof AgenticError && error.code === "STORAGE_CORRUPTION");
});

test("queue admission, consumption and cancellation follow run lifecycle", async () => {
  const store = new InMemorySessionStore();
  await store.create({ sessionId: "queues", seedConfiguration: seed });
  await assert.rejects(() => store.append("queues", 0, [{
    type: "queue_enqueued", queueId: "steer-early", lane: "main", queue: "steer", content: "no",
  }]), (error) => error instanceof AgenticError && error.code === "STORAGE_CORRUPTION");
  await store.append("queues", 0, [
    { type: "queue_enqueued", queueId: "next", lane: "main", queue: "nextRun", content: "later" },
    { type: "operation_started", operationId: "run", lane: "main", kind: "run", configuration: seed },
    { type: "queue_enqueued", queueId: "steer", lane: "main", queue: "steer", content: "change" },
    { type: "queue_enqueued", queueId: "follow", lane: "main", queue: "followUp", content: "then" },
    { type: "queue_consumed", queueId: "steer" },
    { type: "queue_cancelled", queueId: "follow" },
  ]);
  const loaded = await store.load("queues");
  const state = projectSession(loaded!.record, loaded!.mutations);
  assert.equal(state.queues.next.status, "enqueued");
  assert.equal(state.queues.steer.status, "consumed");
  assert.equal(state.queues.follow.status, "cancelled");
  await assert.rejects(() => store.append("queues", 6, [{ type: "queue_cancelled", queueId: "steer" }]),
    (error) => error instanceof AgenticError && error.code === "STORAGE_CORRUPTION");
});

test("configuration, facts, usage and close are durable projections", async () => {
  const store = new InMemorySessionStore();
  await store.create({ sessionId: "metadata", seedConfiguration: seed });
  const changed = { ...seed, thinkingLevel: "high" as const, activeToolNames: ["read", "write"] };
  await store.append("metadata", 0, [
    { type: "entry_added", entry: { id: "e1", parentId: null, kind: "user", data: {} } },
    { type: "configuration_set", lane: "main", configuration: changed },
    { type: "fact_set", name: "session_name", value: "Demo" },
    { type: "fact_set", name: "label", entryId: "e1", value: "root" },
    { type: "usage_recorded", usageId: "usage-1", inputTokens: 3, outputTokens: 2, reasoningTokens: 1, cost: 0.25 },
    { type: "session_closed" },
  ]);
  const loaded = await store.load("metadata");
  const state = projectSession(loaded!.record, loaded!.mutations);
  assert.deepEqual(state.lanes.main.configuration, changed);
  assert.equal(state.facts.session_name.value, "Demo");
  assert.equal(state.usage["usage-1"].cost, 0.25);
  assert.equal(state.closed, true);
  await assert.rejects(() => store.append("metadata", 6, [{
    type: "operation_started", operationId: "late", lane: "main", kind: "run", configuration: seed,
  }]), (error) => error instanceof AgenticError && error.code === "CLOSED");
});

test("navigation finds the common ancestor and atomically moves with branch summary and label", async () => {
  const store = new InMemorySessionStore();
  await store.create({ sessionId: "navigate", seedConfiguration: seed });
  await store.append("navigate", 0, [
    { type: "entry_added", entry: { id: "root", parentId: null, kind: "user", data: {} } },
    { type: "entry_added", entry: { id: "left", parentId: "root", kind: "assistant", data: {} } },
    { type: "entry_added", entry: { id: "right", parentId: "root", kind: "assistant", data: {} } },
    { type: "lane_moved", lane: "main", leafId: "left" },
  ]);
  const result = await navigateSession({
    store, sessionId: "navigate", lane: "main", targetId: "right", label: "reviewed",
    ids: (() => { let id = 0; return () => `nav-${++id}`; })(),
    summarize: async ({ abandonedEntryIds, commonAncestorId }) => {
      assert.deepEqual(abandonedEntryIds, ["left"]);
      assert.equal(commonAncestorId, "root");
      return "left branch summary";
    },
  });
  assert.equal(result.ok, true);
  const loaded = await store.load("navigate");
  const state = projectSession(loaded!.record, loaded!.mutations);
  assert.equal(state.entries[state.lanes.main.leafId!].kind, "branch_summary");
  assert.equal(state.facts[`label:${state.lanes.main.leafId}`].value, "reviewed");
  assert.equal(state.lanes.main.openOperationId, undefined);
});

test("invalid navigation performs no write and no summary effect", async () => {
  const store = new InMemorySessionStore();
  await store.create({ sessionId: "invalid-nav", seedConfiguration: seed });
  let summarized = false;
  const result = await navigateSession({
    store, sessionId: "invalid-nav", lane: "main", targetId: "missing",
    summarize: async () => { summarized = true; return "bad"; },
  });
  assert.equal(result.ok, false);
  assert.equal(summarized, false);
  assert.equal((await store.load("invalid-nav"))?.mutations.length, 0);
});

test("manual compaction persists effect boundaries, summary lineage and retained tail", async () => {
  const store = new InMemorySessionStore();
  await store.create({ sessionId: "compact", seedConfiguration: seed });
  await store.append("compact", 0, [
    { type: "entry_added", entry: { id: "e1", parentId: null, kind: "user", data: {} } },
    { type: "entry_added", entry: { id: "e2", parentId: "e1", kind: "assistant", data: {} } },
    { type: "entry_added", entry: { id: "e3", parentId: "e2", kind: "user", data: {} } },
    { type: "lane_moved", lane: "main", leafId: "e3" },
  ]);
  const result = await compactSession({
    store, sessionId: "compact", lane: "main", retainedTailCount: 1, tokensBefore: 100,
    ids: (() => { let id = 0; return () => `compact-${++id}`; })(),
    summarize: async ({ compactedEntryIds }) => {
      assert.deepEqual(compactedEntryIds, ["e1", "e2"]);
      return "summary";
    },
  });
  assert.equal(result.ok, true);
  const loaded = await store.load("compact");
  const state = projectSession(loaded!.record, loaded!.mutations);
  const entry = state.entries[state.lanes.main.leafId!];
  assert.equal(entry.kind, "compaction");
  assert.deepEqual(entry.data.retainedEntryIds, ["e3"]);
  assert.deepEqual(loaded!.mutations.filter(({ type }) => type.startsWith("effect_")).map(({ type }) => type), [
    "effect_planned", "effect_started", "effect_settled",
  ]);
});

test("manual compaction expands the retained tail to keep tool protocol intact", async () => {
  const store = new InMemorySessionStore();
  await store.create({ sessionId: "compact-protocol", seedConfiguration: seed });
  await store.append("compact-protocol", 0, [
    { type: "entry_added", entry: { id: "user", parentId: null, kind: "user", data: { text: "go" } } },
    { type: "entry_added", entry: { id: "call", parentId: "user", kind: "assistant", data: { toolCalls: [{ callId: "c1", name: "read" }] } } },
    { type: "entry_added", entry: { id: "result", parentId: "call", kind: "tool", data: { toolCallId: "c1", content: "done" } } },
    { type: "lane_moved", lane: "main", leafId: "result" },
  ]);
  let selected: { compactedEntryIds: string[]; retainedEntryIds: string[] } | undefined;
  const result = await compactSession({
    store, sessionId: "compact-protocol", lane: "main", retainedTailCount: 1, tokensBefore: 20,
    summarize: async (input) => { selected = input; return "summary"; },
  });
  assert.equal(result.ok, true);
  assert.deepEqual(selected, { compactedEntryIds: ["user"], retainedEntryIds: ["call", "result"] });
});

test("known compaction summary failure settles the durable operation as failed", async () => {
  const store = new InMemorySessionStore();
  await store.create({ sessionId: "compact-failure", seedConfiguration: seed });
  await store.append("compact-failure", 0, [
    { type: "entry_added", entry: { id: "e1", parentId: null, kind: "user", data: {} } },
    { type: "lane_moved", lane: "main", leafId: "e1" },
  ]);
  const result = await compactSession({
    store, sessionId: "compact-failure", lane: "main", retainedTailCount: 0, tokensBefore: 10,
    summarize: async () => { throw new Error("summary failed"); },
  });
  assert.equal(result.ok, false);
  const loaded = await store.load("compact-failure");
  const state = projectSession(loaded!.record, loaded!.mutations);
  assert.equal(Object.values(state.operations)[0].outcome, "failed");
  assert.equal(Object.values(state.effects)[0].status, "settled");
});

test("fork copies only anchor ancestry into a new session tree", async () => {
  const store = new InMemorySessionStore();
  await store.create({ sessionId: "source", seedConfiguration: seed });
  await store.append("source", 0, [
    { type: "entry_added", entry: { id: "root", parentId: null, kind: "user", data: { text: "root" } } },
    { type: "entry_added", entry: { id: "anchor", parentId: "root", kind: "assistant", data: { text: "anchor" } } },
    { type: "entry_added", entry: { id: "other", parentId: "root", kind: "assistant", data: { text: "other" } } },
  ]);
  const result = await forkSession({ store, sourceSessionId: "source", targetSessionId: "fork", anchorId: "anchor" });
  assert.equal(result.ok, true);
  const loaded = await store.load("fork");
  const state = projectSession(loaded!.record, loaded!.mutations);
  assert.equal(loaded!.record.parentSessionId, "source");
  assert.deepEqual(Object.keys(state.entries), ["root", "anchor"]);
  assert.equal(state.lanes.main.leafId, "anchor");
});

test("total configuration validates model and tools before one durable write", async () => {
  const store = new InMemorySessionStore();
  await store.create({ sessionId: "configuration", seedConfiguration: seed });
  const configuration = {
    model: { provider: "test", model: "next" }, thinkingLevel: "medium" as const, activeToolNames: ["read", "write"],
  };
  const accepted = await setSessionConfiguration({
    store, sessionId: "configuration", lane: "main", configuration,
    resolveModel: async ({ model }) => model === "next",
    resolveTool: async (name) => ["read", "write"].includes(name),
  });
  assert.equal(accepted.ok, true);
  assert.deepEqual(projectSession((await store.load("configuration"))!.record, (await store.load("configuration"))!.mutations).lanes.main.configuration, configuration);

  const before = (await store.load("configuration"))!.record.version;
  const rejected = await setSessionConfiguration({
    store, sessionId: "configuration", lane: "main", configuration: { ...configuration, activeToolNames: ["missing"] },
    resolveModel: async () => true, resolveTool: async () => false,
  });
  assert.equal(rejected.ok, false);
  assert.equal(rejected.ok ? "" : rejected.error.code, "missing_identity");
  assert.equal((await store.load("configuration"))!.record.version, before);
});
