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

It instantiates an AIbitat provider and asks `supportsNativeToolCalling()`.

## Model Router Case

If the provider is `anythingllm-router`, the code checks the router fallback provider/model as a proxy. During actual agent execution, `AgentHandler` resolves the route and can re-resolve before later turns.

## Frontend Command Visibility

`Workspace.agentCommandAvailable(slug)` calls:

```text
GET /api/workspace/:slug/is-agent-command-available
```

The backend returns whether the UI should show the `@agent` command. If a workspace is in automatic mode and native tool calling is supported, the command can be hidden because tool use is already automatic.

The tools menu also shows a message when a user must start an agent session first to use tools.

## Provider Requirements

A provider that supports native tool calling should implement:

- `supportsNativeToolCalling()`
- `stream(messages, functions, eventHandler)` using native `tools` when possible
- `complete(messages, functions)` using native `tools` when possible

OpenAI-compatible providers usually call:

- `tooledStream(...)`
- `tooledComplete(...)`

Those helpers convert AIbitat function definitions to OpenAI-compatible tool definitions and convert function result history back into `assistant.tool_calls` plus `tool` messages.

## Fallback Behavior

If native tool calling is disabled for a provider, explicit `@agent` can still be available. Some providers may use prompt-based function calling helpers instead of native tools.

`PROVIDER_DISABLE_NATIVE_TOOL_CALLING` can disable native tool calling by provider tag.

## Rebuild Checklist

- Store workspace chat mode.
- Add a provider capability check.
- Run capability checks before normal chat execution.
- If automatic mode is active and the provider can call tools, start the same agent flow used by explicit commands.
- Add frontend logic that hides or explains the explicit agent command depending on capability.
