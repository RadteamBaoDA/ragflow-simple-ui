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

### Build-order diagram

```text
Layer 1 Invocation detection + transport handoff
  -> Layer 2 Agent runtime loop
  -> Layer 3 Provider adapters (native tooled + UnTooled fallback)
  -> Layer 4 Plugin registry + built-in tools
  -> Layer 5 Browser websocket event protocol
  -> Layer 6 Chat persistence
  -> Layer 7 Admin skill settings
  -> Layer 8 Dynamic tools (flows, imported skills, MCP)
  -> Layer 9 Safety (approvals, path checks, limits, aborts)
```

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
   - append tool result to messages as a `role: "function"` message
   - call provider again
6. If response has text:
   - emit final message
   - flush citations and metrics

Loop edge cases the runtime must handle:

- **Max tool call depth**: when recursion depth reaches the cap, still execute the current tool once, then pass an **empty tool list** on the next provider call. This forces the model to produce a plain-text final answer instead of erroring out mid-task.
- **Unknown function name**: do not crash. Inject a function-result message like `Function "X" not found. Try again.` and recurse. The model self-corrects.
- **Direct output**: a tool can set a `skipHandleExecution` flag (for example flow steps or chart tools with `directOutput`). The runtime then returns the tool result verbatim as the final answer and skips further tool calls.

Interrupt semantics (human-in-the-loop control):

- Register the human as a `USER` agent with `interrupt: "ALWAYS"`. After every agent reply, control returns to the human instead of looping.
- A reply of `"TERMINATE"` or hitting max conversation rounds ends the session.
- `continue(feedback, attachments)` resumes an interrupted session by injecting the user's next message and re-entering the loop. There is no automatic retry on provider errors — surface the error and let the user retry.

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

### Fallback strategy for models without native tool calling (UnTooled / ReAct emulation)

Support any model by adding a second strategy. A provider without native tool support should:

1. Prepend a tool-selection system prompt: "pick a single function, respond in JSON with exactly two keys `name` and `arguments`, or reply with plain text if no function helps." Render each tool as name + description + parameter schema + optional few-shot examples.
2. Fold prior `role: "function"` results into adjacent messages, since these models cannot see a function role.
3. Parse the response with a safe JSON parse. Unparseable output is treated as the final plain-text answer, not an error.
4. Validate strictly before executing: the function must exist, all required params present, **no unknown params** (anti-hallucination guard).
5. Guard with a **deduplicator**: hash of function name + arguments; identical repeat calls, per-tool cooldowns (~30s), and once-per-session flags block weak models from looping the same call. Apply a cooldown to every MCP tool by default.
6. On a valid call, return `{ functionCall }` to the runtime; otherwise return `{ textResponse }`.

Selection between strategies: probe or hardcode per provider (OpenAI/Anthropic always native; local models probe capabilities), and allow an env override to force the fallback per provider.

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

### Non-browser transport (ephemeral runs)

Make the transport a swappable plugin so the same runtime serves surfaces without a websocket (REST API, chat bots, scheduled jobs):

- Implement the same interface (`socket.send`, `introspect`, `requestToolApproval`, `requestUserClarification`) backed by an in-memory event listener instead of a real socket.
- The event listener collects emitted messages and either:
  - **blocks** until session close, then compacts them into `{ thoughts, textResponse, outputs, metrics }` for a synchronous API response, or
  - **re-streams** each event as HTTP chunks (`agentThought`, `textResponseChunk`, `textResponse`, `fileDownload`, `usageMetrics`).
- Ephemeral runs skip the invocation row and the persistence plugin; the caller persists the result itself.
- Tool approval on ephemeral transports must fail closed (auto-deny) unless the surface has its own approval channel (for example a bot IPC).
- Scheduled/automated runs should support a `toolOverrides` option to pin the tool set.

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

Operational tuning can live in environment variables instead of settings rows (the reference implementation does this): tool-reranker enable/top-N (`AGENT_SKILL_RERANKER_ENABLED`, `AGENT_SKILL_RERANKER_TOP_N`) and max tool calls (`AGENT_MAX_TOOL_CALLS`).

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

### Tool identifier prefix conventions

Keep the agent's tool list as **string identifiers** until attach time, and dispatch by prefix:

| Form | Meaning |
|---|---|
| `plain-slug` | built-in single-tool skill |
| `parent#child` | one sub-tool of a built-in multi-tool skill |
| `@@<hubId>` | imported custom skill folder |
| `@@flow_<uuid>` | agent flow (becomes one tool; params from start-block variables) |
| `@@mcp_<server>` | MCP server (expands to one function per tool, named `<server>-<tool>`) |

This keeps tool resolution lazy and lets flows/MCP/imported sources register themselves without touching the core runtime.

### Agent Flows

Store flows as JSON. Expose active flows as tool identifiers. Convert start variables to tool parameters. Execute steps sequentially and substitute `${variable.path}` in configs.

### Imported Skills

Store custom skills in one folder per skill. Require `plugin.json` and `handler.js`. Validate paths. Convert manifest params to tool schema. Pass setup args and helpers into the handler.

### MCP

Use a singleton supervisor. Start configured servers once. Convert each MCP tool schema into an agent function. Allow admins to suppress individual tools.

## Layer 10: Safety And Failure Handling

Required safeguards:

- Max tool call depth.
- Tool approval resolution chain: env auto-approve list → per-user whitelist → interactive prompt; timeout **fails closed** (denied).
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
