import test from "node:test";
import assert from "node:assert/strict";
import {
  InMemoryHarnessStore,
  createAgentHarness,
  createAgenticModule,
  selectSkillCatalog,
  type AgentEvent,
  type SkillCatalogEntry,
  type SkillDefinition,
  type SkillReference,
} from "../src/index.ts";

const weatherCatalog: SkillCatalogEntry = {
  id: "weather-id",
  name: "weather",
  version: "2.0.0",
  digest: "sha256:weather-v2",
  description: "Read the current forecast for a city.",
  triggers: ["weather", "forecast"],
};

const weatherSkill: SkillDefinition = {
  ...weatherCatalog,
  instructions: "Always state which city the forecast applies to.",
  tools: [
    {
      name: "get-weather",
      description: "Get current weather.",
      parameters: { type: "object" },
      risk: "read",
      execute: async () => ({ type: "continue", content: "sunny" }),
    },
  ],
};

test("default selection gives explicit invocation priority and excludes disabled implicit skills", () => {
  const catalog: SkillCatalogEntry[] = [
    weatherCatalog,
    {
      id: "billing-id",
      name: "billing",
      version: "1.0.0",
      digest: "sha256:billing-v1",
      description: "Inspect invoices and account charges.",
      allowImplicitInvocation: false,
    },
  ];

  assert.deepEqual(
    selectSkillCatalog("Use $billing and then check the forecast", catalog, 1),
    [catalog[1]]
  );
  assert.deepEqual(selectSkillCatalog("Check the forecast", catalog, 5), [
    weatherCatalog,
  ]);
  assert.deepEqual(selectSkillCatalog("Weathering the migration", catalog, 5), []);
  assert.deepEqual(selectSkillCatalog("Inspect account charges", catalog, 5), []);
});

test("agent-scoped catalog hydrates only matching skills and injects their instructions", async () => {
  const events: AgentEvent[] = [];
  let catalogAgentId = "";
  let loaded: SkillReference[] = [];
  const module = createAgenticModule({
    skills: {
      listCatalog: async ({ agentId }) => {
        catalogAgentId = agentId;
        return [
          weatherCatalog,
          {
            id: "billing-id",
            name: "billing",
            version: "1.0.0",
            digest: "sha256:billing-v1",
            description: "Inspect invoices.",
          },
        ];
      },
      load: async ({ skills }) => {
        loaded = skills;
        return [weatherSkill];
      },
    },
    provider: {
      supportsNativeToolCalling: () => true,
      complete: async ({ messages, tools }) => {
        assert.deepEqual(tools.map(({ name }) => name), ["get-weather"]);
        assert.equal(
          messages.some(
            ({ role, content }) =>
              role === "system" &&
              content.includes("Always state which city")
          ),
          true
        );
        return { type: "text", text: "done" };
      },
    },
    policy: { authorize: () => true },
    emit: (event) => {
      events.push(event);
    },
  });

  const result = await module.start({
    runId: "agent-scoped",
    input: "What is the weather?",
    context: { agentId: "agent-weather", tenantId: "tenant-1" },
  });

  assert.equal(result.status, "completed");
  assert.equal(catalogAgentId, "agent-weather");
  assert.deepEqual(loaded, [
    {
      id: weatherCatalog.id,
      name: weatherCatalog.name,
      version: weatherCatalog.version,
      digest: weatherCatalog.digest,
    },
  ]);
  assert.deepEqual(
    events.find(({ type }) => type === "skills_selected"),
    {
      type: "skills_selected",
      runId: "agent-scoped",
      skills: loaded,
    }
  );
});

test("configured database skills fail closed without an agent identity", async () => {
  let queried = false;
  const module = createAgenticModule({
    skills: {
      listCatalog: async () => {
        queried = true;
        return [];
      },
      load: async () => [],
    },
    provider: {
      supportsNativeToolCalling: () => true,
      complete: async () => ({ type: "text", text: "unexpected" }),
    },
    policy: { authorize: () => true },
  });

  const result = await module.start({
    runId: "missing-agent",
    input: "weather",
    context: {},
  });

  assert.equal(result.status, "failed");
  assert.equal(result.error?.code, "INVALID_REQUEST");
  assert.equal(queried, false);
});

test("durable ownership prevents another agent from claiming the skill snapshot", async () => {
  const store = new InMemoryHarnessStore();
  await store.create({
    runId: "owned-skill",
    input: "forecast",
    context: { agentId: "agent-weather", principalId: "user-1" },
  });

  assert.equal(
    await store.claim(
      "owned-skill",
      { agentId: "agent-billing", principalId: "user-1" },
      "worker",
      1_000
    ),
    false
  );
});

test("durable recovery reloads the snapshotted skill version without reselecting", async () => {
  const store = new InMemoryHarnessStore();
  let catalogCalls = 0;
  const loadedSnapshots: SkillReference[][] = [];
  let providerCalls = 0;
  const config = {
    store,
    workerId: "worker",
    skills: {
      listCatalog: async () => {
        catalogCalls += 1;
        return [weatherCatalog];
      },
      load: async ({ skills }: { skills: SkillReference[] }) => {
        loadedSnapshots.push(skills);
        return [weatherSkill];
      },
    },
    provider: {
      supportsNativeToolCalling: () => true,
      complete: async () => {
        providerCalls += 1;
        return providerCalls === 1
          ? {
              type: "deferred" as const,
              handle: { provider: "test", id: "deferred", pollAfterMs: 1 },
            }
          : { type: "text" as const, text: "done" };
      },
      fetchDeferred: async () => ({ type: "text" as const, text: "done" }),
    },
    policy: { authorize: () => true },
  };
  const firstHarness = createAgentHarness(config);
  const first = await firstHarness.start({
    runId: "durable-skill",
    input: "forecast",
    context: { agentId: "agent-weather" },
  });
  assert.equal(first.status, "suspended");
  assert.equal(
    JSON.stringify((await store.load("durable-skill"))?.events).includes(
      "Always state which city"
    ),
    false
  );

  const recovered = await createAgentHarness(config).resumeDeferred(
    "durable-skill",
    { agentId: "agent-weather" }
  );

  assert.equal(recovered.status, "completed");
  assert.equal(catalogCalls, 1);
  assert.deepEqual(loadedSnapshots, [
    [
      {
        id: weatherCatalog.id,
        name: weatherCatalog.name,
        version: weatherCatalog.version,
        digest: weatherCatalog.digest,
      },
    ],
    [
      {
        id: weatherCatalog.id,
        name: weatherCatalog.name,
        version: weatherCatalog.version,
        digest: weatherCatalog.digest,
      },
    ],
  ]);
});
