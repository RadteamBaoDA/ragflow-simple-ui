# Workflow 09: Agent Flows Builder And Execution

## Goal

Let admins create deterministic multi-step workflows and expose active flows as agent-callable tools.

## Key Files

- Backend endpoints: `server/endpoints/agentFlows.js`
- Flow storage/loader: `server/utils/agentFlows/index.js`
- Flow executor: `server/utils/agentFlows/executor.js`
- Flow types: `server/utils/agentFlows/flowTypes.js`
- Step executors: `server/utils/agentFlows/executors/*`
- Frontend model: `frontend/src/models/agentFlows.js`
- Admin list/panel: `frontend/src/pages/Admin/Agents/AgentFlows`
- Builder: `frontend/src/pages/Admin/AgentBuilder`

## Storage

Flows are JSON files under:

```text
storage/plugins/agent-flows/<uuid>.json
```

When `STORAGE_DIR` is unset, the path is relative to the server working directory (`process.cwd()/storage/plugins/agent-flows`).

Each flow contains:

- `name`
- `description`
- `active` (a flow counts as active unless `active` is explicitly `false`)
- `steps` (each step is `{ type, config }`)

## CRUD Endpoints

- `POST /agent-flows/save`: create or update a flow.
- `GET /agent-flows/list`: list summaries.
- `GET /agent-flows/:uuid`: load one flow.
- `DELETE /agent-flows/:uuid`: delete one flow.
- `POST /agent-flows/:uuid/toggle`: update active flag.

All endpoints require admin access.

## Supported Blocks

`FLOW_TYPES` currently defines:

- `start`: initialize variables.
- `apiCall`: make an HTTP request.
- `llmInstruction`: send an instruction to the current agent LLM.
- `webScraping`: scrape a webpage and optionally summarize it.

`saveFlow` rejects unsupported block types (e.g. file/code blocks from flows exported by AnythingLLM Desktop).

The builder UI also has `flowInfo` and `finish` blocks, but they are UI-only and stripped from `steps` before saving. Website, file, and code node components exist under `AgentBuilder/nodes/` but are currently disabled in `BlockList`.

## Tool Exposure

`AgentFlows.activeFlowPlugins()` returns `@@flow_<uuid>` for every flow whose `active` flag is not `false`.

During agent setup:

1. `#attachPlugins` sees `@@flow_<uuid>`.
2. It calls `AgentFlows.loadFlowPlugin(uuid)`.
3. The flow name is sanitized into an OpenAI-compatible tool name (`^[a-zA-Z0-9_-]{1,64}$`), falling back to `flow_<uuid>` if sanitization yields an empty string.
4. Variables from the `start` block become tool input parameters.
5. The placeholder function is replaced with the real sanitized tool name.
6. `aibitat.use(plugin.plugin())` registers the flow tool.

## Execution

When the model calls a flow tool:

1. The flow plugin calls `AgentFlows.executeFlow(uuid, args, aibitat)`.
2. `FlowExecutor` initializes variables from start-block defaults and tool arguments.
3. Each step config is variable-expanded using `${path.to.value}` syntax.
4. Steps execute sequentially.
5. Step results can be stored in `resultVariable` or `responseVariable`.
6. If a step has `directOutput`, execution stops; the flow plugin sets `aibitat.skipHandleExecution = true` and returns that result without another model pass.
7. Otherwise the full execution result returns to the model.

## Variable Paths

`FlowExecutor.getValueFromPath` supports:

- dot paths: `user.name`
- array indexes: `items[0].title`
- bracket keys: `data["some-key"]`

## Rebuild Checklist

- Store flows as versionable JSON files or database rows.
- Validate supported blocks on save.
- Expose active flows as tool identifiers.
- Convert start variables into JSON schema tool parameters.
- Implement sequential execution with variable replacement.
- Support direct output when a workflow result should bypass another model pass.
