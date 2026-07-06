# Detailed Design: Agents Feature

## Implement The Feature In Layers

This design is written for a junior developer implementing the same feature from scratch.

Build these layers in order:

1. Invocation detection and transport handoff.
2. Agent runtime loop.
3. Provider adapters.
4. Plugin registry and built-in tools.
5. Browser websocket event protocol.
6. Chat persistence.
7. Admin skill settings.
8. Dynamic tools: flows, imported skills, MCP.
9. Safety: approvals, path checks, tool limits, aborts.

## Layer 1: Invocation Detection

Add a normal chat endpoint first. Before doing normal RAG or chat completion, check:

```text
explicit = prompt starts with @agent
automatic = workspace.chatMode == automatic and provider supports native tools
```

If neither condition is true, continue normal chat.

If agentic:

1. Create an invocation row with UUID, workspace id, prompt, optional user id, optional thread id.
2. Cache request attachments by UUID if your websocket cannot receive them directly.
3. Return a stream event telling the browser to open `/agent-invocation/:uuid`.
4. End the normal HTTP/SSE response.

Data model:

```text
workspace_agent_invocations
  id
  uuid unique
  prompt
  closed boolean default false
  workspace_id
  user_id nullable
  thread_id nullable
```

## Layer 2: Agent Runtime

Create a runtime class like `AIbitat`.

State to keep:

- registered agents
- registered channels if you need multi-agent routing
- registered tool functions
- chat history
- event emitter
- pending citations
- pending outputs
- provider and model
- max tool call depth

Minimum public methods:

```js
agent(name, definition)
function(functionDefinition)
use(plugin)
start(message)
chat(route)
continue(feedback, attachments)
abort()
terminate()
```

The core loop:

1. Convert internal chat history to provider messages.
2. Add system prompt.
3. Add tool definitions.
4. Call provider.
5. If response has tool call:
   - execute handler
   - append tool result to messages
   - call provider again
6. If response has text:
   - emit final message
   - flush citations and metrics

Protect recursion with a max tool call count.

## Layer 3: Provider Adapters

Every provider adapter should implement one interface:

```js
class AgentProvider {
  supportsNativeToolCalling() {}
  get supportsAgentStreaming() {}
  stream(messages, functions, eventHandler) {}
  complete(messages, functions) {}
  attachHandlerProps(props) {}
  getUsage() {}
}
```

For OpenAI-compatible APIs:

- Convert tool definitions to `tools: [{ type: "function", function: ... }]`.
- Convert old function result messages into `assistant.tool_calls` and `tool` messages.
- Stream text chunks to the frontend with stable UUIDs.
- Return only the first tool call if the provider emits multiple parallel calls, unless your runtime supports parallel tool execution.

## Layer 4: Agent Handler

Create a request-specific handler.

Responsibilities:

- Load invocation/workspace/user/thread.
- Choose provider/model.
- Validate required environment settings.
- Load prior chat history.
- Create runtime.
- Attach communication plugin.
- Attach persistence plugin.
- Register `USER` and `@agent`.
- Build enabled tool list.
- Attach plugins.
- Start runtime with stripped prompt.

Provider/model fallback:

1. workspace agent provider/model
2. workspace chat provider/model
3. system provider/model
4. provider default

If using a model router, resolve once before starting and optionally before every model turn.

## Layer 5: Plugin Contract

A plugin should be pure registration logic. It should not run work during setup except cheap availability checks.

Recommended shape:

```js
const mySkill = {
  name: "my-skill",
  startupConfig: { params: {} },
  plugin: function (runtimeArgs = {}) {
    return {
      name: this.name,
      setup(aibitat) {
        aibitat.function({
          super: aibitat,
          name: this.name,
          description: "What the model sees.",
          parameters: {
            type: "object",
            properties: {}
          },
          handler: async function (args) {
            return "tool result";
          }
        });
      }
    };
  }
};
```

Inside handlers:

- Use `this.super.introspect(...)` for progress messages.
- Use `this.super.socket.send(type, payload)` for rich UI events.
- Use `this.super.addCitation(...)` for sources.
- Use `this.super.requestToolApproval(...)` for risky actions.
- Return a concise string to the model.

## Layer 6: Browser Websocket Protocol

Attach these runtime functions in your websocket plugin:

- `aibitat.introspect(message)`
- `aibitat.socket.send(type, content)`
- `aibitat.requestToolApproval(...)`
- `aibitat.requestUserClarification(...)`

Server-to-client events to support:

- status/thought
- text chunk
- full text
- tool call assembly
- citations
- usage metrics
- persisted chat id
- tool approval request
- clarification request
- rich output card
- error
- thread rename

Client-to-server messages to support:

- feedback for agent continuation
- tool approval response
- clarification response
- bail commands

Use `requestId` for approval and clarification messages so stale responses do not unblock the wrong promise.

## Layer 7: Chat Persistence

Persist in two phases:

1. On user message, create a chat row with empty response and remember the row id.
2. On final assistant response, upsert the row with full response JSON.

Response JSON should include:

```json
{
  "text": "answer",
  "sources": [],
  "type": "chat",
  "attachments": [],
  "metrics": {},
  "outputs": [],
  "clarifyingQuestions": []
}
```

Keep the format compatible with normal chat history rendering.

For special outputs, let tools provide special persistence options:

- saved type
- stored response transformer
- post-save cleanup

## Layer 8: Admin Settings

Store skill settings in a simple key/value table.

Recommended keys:

- `default_agent_skills`: enabled optional skills
- `disabled_agent_skills`: disabled default skills
- `disabled_<parent>_skills`: disabled child tools
- `agent_search_provider`
- `agent_clarifying_questions_enabled`
- `agent_skill_reranker_enabled`
- `agent_skill_reranker_top_n`
- `agent_max_tool_calls`

Frontend should maintain a central skill registry with:

- skill key
- display title
- description
- icon/image
- settings component
- backend skill name
- mode restrictions
- sub-skill preference key

## Layer 9: Dynamic Tools

### Agent Flows

Store flows as JSON. Expose active flows as tool identifiers. Convert start variables to tool parameters. Execute steps sequentially and substitute `${variable.path}` in configs.

### Imported Skills

Store custom skills in one folder per skill. Require `plugin.json` and `handler.js`. Validate paths. Convert manifest params to tool schema. Pass setup args and helpers into the handler.

### MCP

Use a singleton supervisor. Start configured servers once. Convert each MCP tool schema into an agent function. Allow admins to suppress individual tools.

## Layer 10: Safety And Failure Handling

Required safeguards:

- Max tool call depth.
- Tool approval timeout.
- Websocket idle feedback timeout.
- Invocation closed flag.
- Path traversal checks for file-backed plugins and flows.
- Zip Slip checks for imported skill zips.
- Provider errors converted into user-visible agent errors.
- Abort event that long-running tools can listen to.
- Admin-only endpoints for MCP and flows.

## Tests To Add

Minimum test coverage:

- `@agent` detection and automatic-mode detection.
- Provider fallback resolution.
- Built-in skill discovery with enabled/disabled settings.
- Child skill filtering.
- Flow save rejects unsupported blocks.
- Flow variable replacement.
- MCP result stringification.
- Imported plugin path validation.
- Chat-history persistence with citations and outputs.
- Websocket approval timeout and whitelist behavior.

## Common Mistakes

- Starting the agent inside the initial HTTP stream instead of handing off to websocket.
- Forgetting to close the invocation when the socket closes.
- Passing all tools to every model even when the list is very large.
- Asking clarification questions in plain text after enabling the structured tool.
- Persisting rich outputs only in UI state and not in `workspace_chats`.
- Loading imported files without checking they are inside the plugin directory.
- Assuming every provider streams or supports native tools.
