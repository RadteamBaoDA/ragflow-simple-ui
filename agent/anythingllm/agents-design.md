# Agents System Design

## High-Level Architecture

The agents feature is layered:

1. Chat entry detects whether a request is agentic.
2. An agent handler resolves provider/model, history, attachments, documents, and enabled tools.
3. `AIbitat` runs a two-party conversation between `USER` and `@agent`.
4. Provider adapters call the LLM with tool definitions.
5. Tool plugins execute requested functions and return results into the model loop.
6. Communication plugins translate runtime events to websocket or HTTP chunks.
7. Chat-history plugins persist the final result into `workspace_chats`.

The browser path is long lived:

```text
POST /workspace/:slug/stream-chat
  -> grepAgents()
  -> WorkspaceAgentInvocation.new()
  -> SSE chunk: agentInitWebsocketConnection
  -> frontend opens /api/agent-invocation/:uuid
  -> AgentHandler creates AIbitat and starts run
  -> websocket events update chat UI
```

The non-browser path is one-shot:

```text
API/Telegram/scheduled job caller
  -> EphemeralAgentHandler
  -> httpSocket plugin
  -> EphemeralEventListener packs or streams events
```

## Main Backend Components

### Agent Detection

`server/utils/chats/agents.js` contains `grepAgents`.

- It checks `WorkspaceAgentInvocation.parseAgents(message)` for `@agent`.
- It checks `workspace.chatMode === "automatic"` and `Workspace.supportsNativeToolCalling(workspace)`.
- It creates a `workspace_agent_invocations` row.
- It caches attachments in memory by invocation UUID.
- It writes an SSE `agentInitWebsocketConnection` chunk and closes the normal HTTP stream.

`server/models/workspace.js` decides whether native tool calling is supported by instantiating the chosen agent/chat/system provider through `AIbitat.getProviderForConfig`.

### Browser Agent Handler

`server/utils/agents/index.js` exports `AgentHandler`.

Responsibilities:

- Load the invocation row and workspace.
- Resolve provider and model using workspace agent settings, workspace chat settings, or system settings.
- Resolve model-router route when provider is `anythingllm-router`.
- Check required provider environment variables.
- Load cached attachments for the invocation.
- Build an `AIbitat` instance with prior chat history.
- Inject parsed files and pinned documents before each LLM turn.
- Attach websocket and chat-history plugins.
- Load `USER` and `@agent`.
- Attach enabled plugins.
- Start the `AIbitat` loop.

### Ephemeral Agent Handler

`server/utils/agents/ephemeral.js` extends the same concept without `workspace_agent_invocations`.

Differences:

- It receives workspace, prompt, user id, thread id, session id, and attachments directly.
- It attaches `httpSocket` instead of `websocket`.
- It can override the tool list for scheduled jobs.
- It returns packed events through `EphemeralEventListener`.

### AIbitat Runtime

`server/utils/agents/aibitat/index.js` is the agent loop.

Important state:

- `agents`: map of agent name to role/functions/provider config.
- `functions`: map of tool name to executable handler.
- `_chats`: internal conversation history.
- `_pendingCitations`: citations collected by tools.
- `_toolAttachments`: image attachments emitted by tools and injected back into the LLM.
- `_pendingClarifyingQuestionSurveys`: clarifying-question responses to persist.
- `maxToolCalls`: guardrail for recursive tool chaining.

Important behavior:

- `start()` records the first user message, then asks `@agent` to reply.
- `reply()` builds system and chat messages, appends fresh parsed-file context, selects functions, reranks tools if enabled, resolves model router if needed, and calls the provider.
- `handleAsyncExecution()` handles streaming providers.
- `handleExecution()` handles non-streaming providers.
- When a provider returns a function call, AIbitat executes the tool and recursively calls the model with the tool result.
- If `skipHandleExecution` is set by a tool, the tool result is returned directly as the final answer.

### Provider Layer

Providers live in `server/utils/agents/aibitat/providers`.

Each provider must expose:

- `supportsAgentStreaming`
- `supportsNativeToolCalling()`
- `stream(messages, functions, eventHandler)`
- `complete(messages, functions)`
- `getUsage()`
- `attachHandlerProps(handlerProps)`

OpenAI-compatible providers reuse `providers/helpers/tooled.js` for native `tools` calls and `providers/helpers/untooled.js` where prompt-based function calling is needed.

### Plugin Contract

A plugin exports an object with:

```js
{
  name: "skill-name",
  startupConfig: { params: {} },
  plugin: function (runtimeArgs) {
    return {
      name: this.name,
      setup(aibitat) {
        aibitat.function({
          name: this.name,
          description: "...",
          parameters: { type: "object", properties: {} },
          handler: async function (args) {}
        });
      }
    };
  }
}
```

Child-skill plugins expose `plugin` as an array, and the handler loads them with `parent#child` identifiers.

Special plugin identifiers:

- `@@flow_<uuid>` loads an agent flow.
- `@@mcp_<serverName>` loads all unsuppressed tools from an MCP server.
- `@@<hubId>` loads an imported custom skill.

## Frontend Design

### Normal Chat to Agent Socket

`Workspace.multiplexStream` calls the normal streaming endpoint. `handleChat` sees `agentInitWebsocketConnection` and sets `socketId`. `ChatContainer` then opens:

```text
ws(s)://<host>/api/agent-invocation/:uuid
```

The websocket object is stored in state. While it exists, new prompt submissions are sent to the socket as:

```json
{
  "type": "awaitingFeedback",
  "feedback": "next user message",
  "attachments": []
}
```

### Websocket Event Handling

`frontend/src/utils/chat/agent.js` translates server events into chat history items.

Important event types:

- `statusResponse`: agent thought/status bubble.
- `reportStreamEvent.textResponseChunk`: final answer streaming chunk.
- `reportStreamEvent.fullTextResponse`: direct-output final answer.
- `reportStreamEvent.citations`: attach citations to a message UUID.
- `reportStreamEvent.usageMetrics`: attach usage metrics.
- `reportStreamEvent.chatId`: attach persisted chat id.
- `reportStreamEvent.modelRouteNotification`: show route decision.
- `toolApprovalRequest`: render approval card.
- `clarificationRequest`: render clarifying-question card.
- `fileDownloadCard`: render generated-file card.
- `rechartVisualize`: render chart card.
- `rename_thread`: update sidebar thread title.
- `wssFailure`: show error.

### Admin UI

`frontend/src/pages/Admin/Agents/index.jsx` loads:

- system settings
- enabled default skills
- disabled default skills
- imported skills
- flow list
- MCP server list
- filesystem/create-file availability

It writes settings through `Admin.updateSystemPreferences`, `System.updateSystem`, `AgentFlows`, and `MCPServers`.

## Persistence Design

`chat-history` plugin pre-creates a `workspace_chats` row when it sees a `USER` message. When the final assistant response arrives, it upserts the same row with:

```json
{
  "text": "final answer",
  "sources": [],
  "type": "chat",
  "attachments": [],
  "metrics": {},
  "outputs": [],
  "clarifyingQuestions": []
}
```

Special outputs can override `type` and stored response, for example `rechartVisualize`.

## Security Design

- Tool approval defaults to manual approval unless whitelisted or globally auto-approved.
- Browser and Telegram approvals time out after 120 seconds.
- No approval channel in `httpSocket` denies tool approval for safety, except imported plugin helper falls back to approved when no approval function exists.
- File-backed flows and imported plugins normalize paths and ensure paths stay inside the plugin directory.
- MCP servers are arbitrary external code by design; the admin controls the server config and can suppress tools.

## Extension Points

To add a new built-in skill:

1. Add plugin module under `server/utils/agents/aibitat/plugins`.
2. Export it from `plugins/index.js`.
3. Add it to `DEFAULT_SKILLS` or make it configurable in `agentSkillsFromSystemSettings`.
4. Add frontend metadata in `frontend/src/pages/Admin/Agents/skills.jsx`.
5. Add sub-skill registry entries if needed.
6. Add tests around the tool handler and plugin loading.

To add a new provider:

1. Add a provider file under `server/utils/agents/aibitat/providers`.
2. Export it from `providers/index.js`.
3. Add it to `AIbitat.getProviderForConfig`.
4. Add provider setup checks and defaults in `AgentHandler`.
5. Implement native tool-call support or a fallback.

## Grounded Answering Flow

For the detailed context retrieval and grounded-answer design, see
`docs/agents-workflow-12-context-retrieval-grounded-answer.md`. That document
covers how the running agent combines parsed files, pinned documents, vector
knowledge-base search, document summarization, web search, web scraping,
citations, and final answer persistence.

For the full create/configure-to-answer lifecycle, see
`docs/agents-workflow-13-create-agent-to-grounded-response.md`. For a comparison
with a comparable open-source agentic workflow/RAG platform over 50k GitHub
stars, see `docs/agents-comparison-dify.md`.
