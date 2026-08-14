# Agentic Module

Independent TypeScript agent runtime implementing twelve portable Agentic
workflows. It imports no host-application code and has no runtime dependencies.

## Use

Copy this directory into another repository, then:

```bash
npm install
npm run build
```

```ts
import {
  DurableInteractionManager,
  InMemoryHarnessStore,
  ToolRegistry,
  createAgentHarness,
  type ProviderAdapter,
} from "@agentic/module";

const provider: ProviderAdapter = {
  supportsNativeToolCalling: () => true,
  complete: async ({ messages, tools, signal }) => {
    // Map your LLM SDK response to text or one tool_call.
    return { type: "text", text: "Hello" };
  },
};

const tools = new ToolRegistry().register({
  name: "clock",
  description: "Read the host clock",
  parameters: { type: "object", additionalProperties: false },
  risk: "read",
  execute: async () => ({ type: "continue", content: new Date().toISOString() }),
});

const store = new InMemoryHarnessStore(); // Replace with the host database adapter.
const agent = createAgentHarness({
  store,
  workerId: "worker-1",
  interactions: new DurableInteractionManager({ store }),
  provider,
  tools,
  skills: {
    // Query enabled bindings using all authenticated scope columns shown here.
    listCatalog: ({ agentId, context }) => db.agentSkills.listMetadata({
      agentId,
      tenantId: context.tenantId,
      workspaceId: context.workspaceId,
    }),
    // Load exact id/version/digest rows; do not substitute the latest version.
    load: ({ agentId, skills, context }) =>
      db.agentSkills.loadDefinitions({ agentId, skills, tenantId: context.tenantId }),
  },
  policy: { authorize: () => true },
  emit: console.log,
});

const result = await agent.start({
  runId: crypto.randomUUID(),
  input: "What time is it?",
  context: {
    agentId: "agent-1",
    principalId: "user-1",
    tenantId: "tenant-1",
    workspaceId: "workspace-1",
  },
});
```

Public API is exported only through `src/index.ts` / built package root.
See `INTEGRATION_SPEC.md` for production adapters and workflow mapping.
See `OPERATOR_RUNBOOK.md` for rollout, monitoring, recovery, and kill-switch procedures.

## Included

- explicit/automatic activation;
- provider text streaming and tool calls;
- safe thinking-summary, tool-call payload, redacted tool-output, usage, and final-validation events;
- one sequenced event envelope with SSE/WebSocket serializers and a framework-neutral UI reducer;
- agent-scoped skill catalog, request matching, lazy hydration, instruction injection,
  and durable version/digest snapshots inside the normal policy/approval loop;
- automatic host-tokenized context compaction before provider boundaries;
- bounded provider → tool → provider loop;
- append-only events, atomic claim/lease, recovery, continuation, abort, and close;
- central authorization and fail-closed risky-tool approval;
- pre-policy JSON Schema validation hook and authorized live tool toggles;
- tool registry and five Agentic identifier forms;
- durable approval/clarification suspension and resume;
- retrieval, document, memory, and artifact capability factories;
- citation/artifact events;
- current-run provenance ledger and unsafe reference/path guards;
- sequential four-block flow executor;
- imported-skill manifest validation/normalization;
- MCP tool normalization, schema dereferencing, suppression, and safe output serialization;
- reusable database adapter conformance runner;
- ownership-aware in-memory harness store for tests/demos only;
- terminal result persistence hook that fails closed.

The host supplies its actual LLM, transport, database-backed `HarnessStore`, vector search, artifact
storage, imported-code isolation, and MCP transport.

See `UI_STREAMING_SPEC.md` for SSE, WebSocket, UI, retrieval, auto-skill, and compaction setup. HFS 100 remains a target until every row in the external acceptance matrix has executable evidence.
See `JSDOC_STANDARD.md` for the source documentation contract enforced by `npm run check:docs`.
