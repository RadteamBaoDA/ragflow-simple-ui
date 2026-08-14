import {
  AgentEventJournal,
  InMemoryHarnessStore,
  InMemorySessionStore,
  createAgentHarness,
  type HarnessStore,
} from "@agentic/module";

const store: HarnessStore = new InMemoryHarnessStore();
createAgentHarness({
  store,
  workerId: "fixture",
  provider: {
    supportsNativeToolCalling: () => true,
    complete: async () => ({ type: "text", text: "ok" }),
  },
  policy: { authorize: () => true },
});

new AgentEventJournal().publish({ type: "run_started", runId: "fixture" });
void new InMemorySessionStore().create({
  sessionId: "fixture",
  seedConfiguration: {
    model: { provider: "fixture", model: "fixture" },
    thinkingLevel: "off",
    activeToolNames: [],
  },
});
