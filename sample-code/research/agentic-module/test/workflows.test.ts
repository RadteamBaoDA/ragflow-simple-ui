import test from "node:test";
import assert from "node:assert/strict";
import {
  AgenticError,
  ToolRegistry,
  authorizeArtifactAccess,
  createAgenticModule,
  createDocumentTools,
  createMemoryStoreTool,
  retrieveGroundedEvidence,
  validateFlow,
} from "../src/index.ts";

const context = { principalId: "u1", workspaceId: "w1" };

test("fresh authorized context is injected on every turn and forged citation fails", async () => {
  let contextLoads = 0;
  let calls = 0;
  const module = createAgenticModule({
    provider: {
      supportsNativeToolCalling: () => true,
      complete: async () => ++calls === 1
        ? { type: "text", text: "first", citationIds: ["ctx-1"] }
        : { type: "text", text: "forged", citationIds: ["missing"] },
    },
    policy: { authorize: () => true },
    loadContext: async () => {
      contextLoads += 1;
      return [{ content: `fresh-${contextLoads}`, citation: { id: "ctx-1", title: "Context", sourceRef: "doc-1" } }];
    },
  });
  const first = await module.start({ runId: "context", input: "one", context });
  assert.deepEqual(first.citations.map(({ id }) => id), ["ctx-1"]);
  const second = await module.continue("context", "two");
  assert.equal(contextLoads, 2);
  assert.equal(second.error?.code, "INVALID_CITATION");
});

test("grounding follows local priority and discloses insufficient evidence", async () => {
  const calls: string[] = [];
  const local = await retrieveGroundedEvidence("policy", context, {
    context: async () => { calls.push("context"); return []; },
    vector: async () => { calls.push("vector"); return [{ content: "local", citation: { id: "v1", title: "V", sourceRef: "v" } }]; },
    documents: async () => { calls.push("documents"); return []; },
    external: async () => { calls.push("external"); return []; },
  });
  assert.equal(local.status, "grounded");
  assert.deepEqual(calls, ["context", "vector"]);

  const missing = await retrieveGroundedEvidence("unknown", context, {
    context: async () => [], vector: async () => [], documents: async () => [],
  });
  assert.equal(missing.status, "insufficient_evidence");
});

test("memory write, document tools, artifact access, and flow validation use host boundaries", async () => {
  let stored = "";
  const memory = createMemoryStoreTool({ store: async ({ content }) => { stored = content; } });
  await memory.execute({ content: "remember" }, {
    runId: "r", execution: context, signal: new AbortController().signal,
    addCitation: () => undefined, addArtifact: () => undefined,
  });
  assert.equal(memory.risk, "write");
  assert.equal(stored, "remember");

  const documents = createDocumentTools({
    list: async () => [{ id: "d1", title: "Doc" }],
    read: async () => ({ content: "body", citation: { id: "d1", title: "Doc", sourceRef: "d1" } }),
  });
  assert.deepEqual(documents.map(({ name }) => name), ["document-list", "document-read"]);

  assert.equal(await authorizeArtifactAccess("runs/r/file.txt", context, async () => true), "runs/r/file.txt");
  await assert.rejects(() => authorizeArtifactAccess("../secret", context, async () => true));
  await assert.rejects(() => authorizeArtifactAccess("runs/r/file.txt", context, async () => false));

  assert.equal(validateFlow({ id: "f", name: "F", active: true, steps: [{ type: "start", config: { variables: [] } }] }).ok, true);
  assert.equal(validateFlow({ id: "f", name: "F", active: true, steps: [{ type: "code", config: {} }] }).ok, false);
});
