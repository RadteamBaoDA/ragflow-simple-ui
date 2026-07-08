# Workflow 02: Automatic Native Tool Calling

## Goal

Let capable models use tools automatically in `automatic` chat mode without requiring the user to type `@agent`.

## Key Files

- `server/utils/chats/agents.js`
- `server/models/workspace.js`
- `server/utils/agents/index.js`
- `server/utils/agents/aibitat/providers/*`
- `server/utils/agents/aibitat/providers/helpers/tooled.js`
- `frontend/src/models/workspace.js`
- `frontend/src/components/WorkspaceChat/ChatContainer/PromptInput/ToolsMenu/Tabs/AgentSkills/index.jsx`

## Backend Decision

`grepAgents` does this check:

```text
if workspace.chatMode == automatic:
  nativeToolingEnabled = Workspace.supportsNativeToolCalling(workspace)
```

If true, the request follows the same websocket path as explicit `@agent`.

`Workspace.supportsNativeToolCalling` chooses the provider in this order:

1. `workspace.agentProvider`
2. `workspace.chatProvider`
3. `process.env.LLM_PROVIDER`

It chooses the model in this order:

1. `workspace.agentModel`
2. `workspace.chatModel`
3. base model for the provider

It instantiates a provider via `AIbitat.getProviderForConfig({ provider, model })` and asks `supportsNativeToolCalling()`.

Note this waterfall differs slightly from `AgentHandler`'s own fallback at execution time, which requires both `chatProvider` and `chatModel` before falling back to `LLM_PROVIDER` plus `providerDefault()`.

## Model Router Case

If the provider is `anythingllm-router`, the code looks up the router (from `workspace.router_id` or the `MODEL_ROUTER_ID` env) and checks the router's fallback provider/model as a proxy; if no router can be resolved, it returns false. During actual agent execution, `AgentHandler.#resolveRouterProvider` resolves the real route and `aibitat.resolveRoute` can re-resolve before later turns.

## Frontend Command Visibility

`Workspace.agentCommandAvailable(slug)` calls:

```text
GET /api/workspace/:slug/is-agent-command-available
```

The backend responds with `{ showAgentCommand }` from `Workspace.isAgentCommandAvailable`: it is always `true` when `chatMode !== "automatic"`, and `false` when the workspace is in automatic mode and native tool calling is supported — the command is hidden because tool use is already automatic.

The tools menu also shows a message when a user must start an agent session first to use tools.

## Provider Requirements

A provider that supports native tool calling should implement:

- `supportsNativeToolCalling()`
- `stream(messages, functions, eventHandler)` using native `tools` when possible
- `complete(messages, functions)` using native `tools` when possible

The base `Provider` class (`ai-provider.js`) defaults `supportsNativeToolCalling()` to `true` for any provider with a `providerTag`, unless that tag is opted out via env. Providers can override it — the Ollama provider probes the actual model's capabilities via `getModelCapabilities()` and caches the result.

OpenAI-compatible providers usually call:

- `tooledStream(...)`
- `tooledComplete(...)`

Those helpers (`providers/helpers/tooled.js`) use `formatFunctionsToTools` to convert AIbitat function definitions to OpenAI-compatible tool definitions, and `formatMessagesForTools` to convert `role: "function"` result history back into `assistant.tool_calls` plus `tool` messages. `tooledStream` accumulates streamed tool call deltas by index but returns only the first tool call, since the agent framework processes one tool call per turn.

## Fallback Behavior

If native tool calling is disabled for a provider, explicit `@agent` can still be available. Providers without native support use the prompt-based helpers in `providers/helpers/untooled.js`, which inject a JSON tool-selection prompt, strictly validate the model's JSON output against the function schema, and deduplicate repeated calls.

`PROVIDER_DISABLE_NATIVE_TOOL_CALLING` is a comma-separated list of provider tags. `Provider.optsOutOfNativeToolCallingViaEnv` (`providers/ai-provider.js`) checks it to opt a provider out of native tool calling.

Embed widget chats never take this path — `server/utils/chats/embed.js` coerces `automatic` mode to `chat`.

## Rebuild Checklist

- Store workspace chat mode.
- Add a provider capability check.
- Run capability checks before normal chat execution.
- If automatic mode is active and the provider can call tools, start the same agent flow used by explicit commands.
- Add frontend logic that hides or explains the explicit agent command depending on capability.
