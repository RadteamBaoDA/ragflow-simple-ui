# Workflow 04: Plugin Execution Lifecycle

## Goal

Explain how a skill becomes a callable LLM tool and how tool results are fed back into the model.

## Flow diagram

```text
User -> AIbitat: AIbitat.start records message to agent
AIbitat -> AIbitat: reply builds system prompt, history, file context, tool definitions
[opt ToolReranker enabled]
  AIbitat -> AIbitat: reduce function list
[opt workspace uses model router]
  AIbitat -> AIbitat: resolveRoute re-resolves provider and model
AIbitat -> Provider LLM: stream or complete with tools
[alt provider returns final text]
  Provider LLM -> AIbitat: final text
  AIbitat -> User: answer
[alt provider returns function call]
  Provider LLM -> AIbitat: function call
  [alt unknown function name]
    AIbitat -> AIbitat: append not-found function message, recurse with depth plus 1
  [alt known function]
    AIbitat -> Tool plugin: fn.handler args
    Tool plugin -> AIbitat: tool result
    AIbitat -> AIbitat: emit toolCallResult, append result message
    [opt tool queued image attachments]
      AIbitat -> AIbitat: inject follow-up user message
    [alt skipHandleExecution set by tool]
      AIbitat -> User: tool result becomes final answer, flush citations
    [alt depth below maxToolCalls]
      AIbitat -> Provider LLM: call model again with depth plus 1
    [alt depth at maxToolCalls]
      AIbitat -> Provider LLM: call model with no tools, forcing final answer
```

## Key Files

- `server/utils/agents/index.js`
- `server/utils/agents/ephemeral.js`
- `server/utils/agents/defaults.js`
- `server/utils/agents/aibitat/index.js`
- `server/utils/agents/aibitat/plugins/index.js`
- `server/utils/agents/aibitat/providers/helpers/tooled.js`

## Setup Sequence

1. `AgentHandler.createAIbitat` creates an `AIbitat` instance.
2. It attaches communication plugin:
   - browser: `websocket`
   - non-browser: `httpSocket`
3. It attaches persistence plugin:
   - browser: `chat-history`
   - ephemeral: normally caller persists packed output
4. It registers per-turn callbacks on the instance:
   - `aibitat.fetchParsedFileContext` — fetches fresh parsed files and pinned docs each turn.
   - `aibitat.resolveRoute` — only when the workspace uses the model router; re-resolves provider/model per turn.
5. `#loadAgents` registers:
   - `USER` (interrupt: `"ALWAYS"`)
   - `@agent`
6. `WORKSPACE_AGENT.getDefinition` returns the system prompt and function identifiers.
7. `#attachPlugins` resolves every identifier into actual `aibitat.function` registrations.

## Identifier Resolution

`#attachPlugins` handles five cases:

- `parent#child`: find child plugin in parent plugin array.
- `@@flow_<uuid>`: load an agent flow plugin.
- `@@mcp_<server>`: convert MCP server tools into plugins.
- `@@<hubId>`: load imported custom skill.
- normal name: load built-in plugin from `AgentPlugins`.

Notes:

- Flow and MCP cases rewrite `@agent`'s function list: the `@@flow_`/`@@mcp_` placeholder is removed and replaced with the actual registered tool name(s), so lookup in `reply()` succeeds.
- One MCP server expands into multiple sub-tool plugins (one per tool).
- Invalid or unknown identifiers are logged and skipped, never fatal.

## Tool Definition Shape

Every callable tool is registered via `aibitat.function(...)` into the central `functions` Map with:

- `name`
- `description`
- `parameters`
- `handler(args)`
- `super` (back-reference to the aibitat instance; handlers use `this.super.introspect`, `this.super.socket.send`, `this.super.addCitation`, etc.)
- `examples` (optional, used by the UnTooled prompt path)

The `parameters` object is JSON schema. Provider helpers convert it into provider-specific tool schemas.

Multi-tool plugins export an array of sub-plugins and are addressed as `parent#child` in the agent's function list. `reply()` resolves each entry through `#parseFunctionName`, which strips the `parent#` and `@@` prefixes before the `functions` Map lookup.

## Runtime Sequence

1. `AIbitat.start` records a message from `USER` to `@agent`.
2. `AIbitat.chat` asks `@agent` to reply.
3. `AIbitat.reply` builds:
   - system message from agent role
   - prior chat history
   - current user message
   - fresh parsed-file/pinned-doc context
   - tool definitions
4. Optional `ToolReranker` reduces the function list (when disabled, a log hint suggests enabling it if the tool count is large).
5. Model router may re-resolve provider/model (`resolveRoute`).
6. AIbitat branches on `providerInstance.supportsAgentStreaming`:
   - streaming providers: `handleAsyncExecution` (stream events sent over the socket)
   - non-streaming providers: `handleExecution`
7. Provider returns either:
   - final text
   - function call
8. If there is a function call:
   - AIbitat finds the tool in `functions`.
   - Unknown name: AIbitat appends `Function "<name>" not found. Try again.` as a `role: "function"` message and recurses (still consumes a depth level).
   - AIbitat executes `fn.handler(args)`, sends `agent_tool_call` telemetry, and emits a `toolCallResult` event.
   - The tool result is appended as a function/tool result message.
   - Image attachments queued by the tool (`addToolAttachment`) are injected as a follow-up user message.
   - AIbitat calls the model again with `depth + 1`.
9. Recursion stops when the provider returns final text or `maxToolCalls` is reached.

## Tool Call Limits

`AIbitat.defaultMaxToolCalls()` reads `AGENT_MAX_TOOL_CALLS`. If unset or invalid, default is 10.

When the depth reaches the limit, AIbitat executes the current tool but passes no tools into the next model call, forcing a final answer.

## Direct Output

A tool can set:

```js
aibitat.skipHandleExecution = true;
```

The tool result then becomes the final answer without another model pass. The flag resets to `false` after one use. On the streaming path the raw result is emitted as a `fullTextResponse` stream event plus `usageMetrics`, then citations are flushed. Agent flows use this for direct-output blocks; the router-classifier plugin also uses it.

## Citations And Attachments

Tools can call:

- `aibitat.addCitation(...)`
- `aibitat.addToolAttachment(...)`
- `aibitat.addClarifyingQuestionSurvey(...)`

AIbitat flushes citations and metrics through websocket stream events. Chat persistence reads pending buffers in `chat-history`.

## Rebuild Checklist

- Implement plugin registration separately from plugin selection.
- Keep tool handler functions in a central map by name.
- Let providers return either text or a structured function call.
- Feed tool results back into model history.
- Add max-depth protection.
- Provide a direct-output escape hatch.
- Buffer citations and rich outputs until final message persistence.
