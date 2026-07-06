# Workflow 04: Plugin Execution Lifecycle

## Goal

Explain how a skill becomes a callable LLM tool and how tool results are fed back into the model.

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
4. `#loadAgents` registers:
   - `USER`
   - `@agent`
5. `WORKSPACE_AGENT.getDefinition` returns the system prompt and function identifiers.
6. `#attachPlugins` resolves every identifier into actual `aibitat.function` registrations.

## Identifier Resolution

`#attachPlugins` handles five cases:

- `parent#child`: find child plugin in parent plugin array.
- `@@flow_<uuid>`: load an agent flow plugin.
- `@@mcp_<server>`: convert MCP server tools into plugins.
- `@@<hubId>`: load imported custom skill.
- normal name: load built-in plugin from `AgentPlugins`.

## Tool Definition Shape

Every callable tool is registered with:

- `name`
- `description`
- `parameters`
- `handler(args)`

The `parameters` object is JSON schema. Provider helpers convert it into provider-specific tool schemas.

## Runtime Sequence

1. `AIbitat.start` records a message from `USER` to `@agent`.
2. `AIbitat.chat` asks `@agent` to reply.
3. `AIbitat.reply` builds:
   - system message from agent role
   - prior chat history
   - current user message
   - fresh parsed-file/pinned-doc context
   - tool definitions
4. Optional `ToolReranker` reduces the function list.
5. Model router may re-resolve provider/model.
6. Provider returns either:
   - final text
   - function call
7. If there is a function call:
   - AIbitat finds the tool in `functions`.
   - AIbitat executes `fn.handler(args)`.
   - The tool result is appended as a function/tool result message.
   - AIbitat calls the model again.
8. Recursion stops when the provider returns final text or `maxToolCalls` is reached.

## Tool Call Limits

`AIbitat.defaultMaxToolCalls()` reads `AGENT_MAX_TOOL_CALLS`. If unset or invalid, default is 10.

When the depth reaches the limit, AIbitat executes the current tool but passes no tools into the next model call, forcing a final answer.

## Direct Output

A tool can set:

```js
aibitat.skipHandleExecution = true;
```

The tool result then becomes the final answer without another model pass. Agent flows use this for direct-output blocks.

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
