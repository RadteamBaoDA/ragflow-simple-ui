# Workflow 13: Create Agent To Grounded User Response

## Goal

Document the full product and implementation workflow from configuring an agent, to a user asking a question, to the agent running tools, retrieving context, and returning a high-quality response grounded in the workspace knowledge base.

This is the "happy path" a junior developer should understand before changing agent behavior.

## End-To-End Flow

```text
Admin configures agent skills
  -> user asks a question
  -> chat endpoint detects agent mode
  -> frontend opens agent websocket
  -> AgentHandler builds AIbitat runtime
  -> @agent receives user message
  -> runtime injects workspace context
  -> model decides which tools to call
  -> tools retrieve KB/external context
  -> model synthesizes final answer
  -> websocket streams answer and citations
  -> chat-history persists response
```

## Flow diagram

```text
Participants: Admin, User, Frontend (FE), Chat backend (BE), AgentHandler (AH), AIbitat (AB), Model, Tools

Phase 1 - configure skills, no agent object saved
  Admin -> BE: skill, flow, MCP, workspace settings

Phases 2-3 - question and agent detection
  User -> FE: prompt
  FE -> BE: multiplexStream
    [alt prompt starts with agent tag, or automatic mode with tool calling]
      BE -> BE: create invocation row, cache attachments
      BE -> FE: agentInitWebsocketConnection, HTTP stream closes
    [alt normal chat]
      BE -> FE: regular chat stream

Phases 4-6 - websocket and runtime build
  FE -> AH: open websocket with invocation uuid
  AH -> AB: init, createAIbitat, attach plugins from settings, imports, flows, MCP

Phases 7-9 - run and tool choice
  AH -> AB: startAgentCluster sends USER message
  AB -> AB: fetchParsedFileContext injects parsed and pinned docs each turn
  AB -> Model: prompt, history, context, tool schemas
  [loop ReAct loop until final text or AGENT_MAX_TOOL_CALLS]
    Model -> Tools: rag-memory, document-summarizer, web-browsing, web-scraping
    Tools -> Model: context texts and citations

Phases 10-12 - KB search, external data, grounded synthesis
  Model -> AB: final grounded answer

Phases 13-14 - stream and persist
  AB -> FE: reportStreamEvent chunks, citations, metrics, chatId
  FE -> User: incremental answer with sources
  AB -> BE: chat-history upserts final chat row
```

## Phase 1: Create Or Configure The Agent

AnythingLLM does not create one saved "agent object" per workspace in the classic sense. Instead, a workspace agent is assembled at runtime from:

- workspace prompt and model settings
- global agent skill settings
- enabled default skills
- enabled optional skills
- imported custom skills
- active agent flows
- active MCP server tools
- current user/workspace/thread context

### Admin UI Entry

Frontend:

- `frontend/src/pages/Admin/Agents/index.jsx`
- `frontend/src/pages/Admin/Agents/skills.jsx`
- `frontend/src/pages/Admin/Agents/AgentSkillSettings`
- `frontend/src/pages/Admin/AgentBuilder`

Backend:

- `server/endpoints/admin.js`
- `server/endpoints/agentFlows.js`
- `server/endpoints/mcpServers.js`
- `server/endpoints/experimental/imported-agent-plugins.js`

### Settings Written

Common system settings:

- `default_agent_skills`: optional skills enabled globally.
- `disabled_agent_skills`: default skills disabled globally.
- `disabled_<skill>_skills`: disabled sub-tools for parent skills.
- `agent_search_provider`: web search backend.
- `agent_clarifying_questions_enabled`: whether the agent can ask structured questions.

Environment variables (written through the admin UI via `updateENV`, not `system_settings` rows):

- `AGENT_SKILL_RERANKER_ENABLED`: whether tool reranking is enabled (default on).
- `AGENT_SKILL_RERANKER_TOP_N`: max tools after reranking (default 15).
- `AGENT_MAX_TOOL_CALLS`: tool-call limit per response (default 10).

Workspace settings:

- `workspaces.openAiPrompt`: workspace system prompt.
- `workspaces.agentProvider`: optional agent-specific provider.
- `workspaces.agentModel`: optional agent-specific model.
- `workspaces.chatMode`: controls explicit versus automatic agent behavior.

### Result

At this point no long-running agent exists. The runtime is created only when a user asks a question that invokes agent mode.

## Phase 2: User Asks A Question

Frontend:

- `frontend/src/components/WorkspaceChat/ChatContainer/index.jsx`
- `frontend/src/models/workspace.js`
- `frontend/src/utils/chat/index.js`

The user submits a prompt. The frontend appends:

1. A user message.
2. A pending assistant placeholder.

Then it calls:

```js
Workspace.multiplexStream({
  workspaceSlug,
  threadSlug,
  prompt,
  chatHandler,
  attachments
});
```

## Phase 3: Backend Detects Agent Mode

Backend:

- `server/utils/chats/stream.js`
- `server/utils/chats/agents.js`
- `server/models/workspaceAgentInvocation.js`
- `server/models/workspace.js`

Detection order:

1. Slash commands are handled first by `grepCommand`.
2. `grepAgents` checks for explicit `@agent`.
3. If no explicit `@agent`, it checks automatic mode and native tool-calling support.

Agent mode starts when:

```text
prompt starts with @agent
OR
workspace.chatMode == automatic AND provider supports native tool calling
```

When agent mode starts:

1. A `workspace_agent_invocations` row is created.
2. Attachments are cached by invocation UUID.
3. The HTTP stream returns:

   ```json
   {
     "type": "agentInitWebsocketConnection",
     "websocketUUID": "<uuid>"
   }
   ```

4. The normal chat stream closes.

## Phase 4: Frontend Opens Agent Websocket

Frontend:

- `frontend/src/components/WorkspaceChat/ChatContainer/index.jsx`
- `frontend/src/utils/chat/agent.js`

The browser opens:

```text
ws(s)://<host>/api/agent-invocation/<uuid>
```

The active websocket is stored in React state. While it exists, additional user messages are sent over the websocket as feedback:

```json
{
  "type": "awaitingFeedback",
  "feedback": "next user message",
  "attachments": []
}
```

## Phase 5: Agent Runtime Is Built

Backend:

- `server/endpoints/agentWebsocket.js`
- `server/utils/agents/index.js`
- `server/utils/agents/defaults.js`
- `server/utils/agents/aibitat/index.js`

`agentWebsocket` creates:

```js
const agentHandler = await new AgentHandler({ uuid }).init();
```

`AgentHandler.init`:

1. Loads the invocation and workspace.
2. Rejects closed invocations.
3. Resolves provider and model.
4. Checks required provider env vars.
5. Retrieves cached attachments.

`AgentHandler.createAIbitat`:

1. Creates `AIbitat` with prior chat history.
2. Registers `fetchParsedFileContext`.
3. Attaches the websocket plugin.
4. Attaches the chat-history plugin.
5. Registers `USER`.
6. Registers `@agent`.
7. Resolves enabled tools and attaches plugins.

## Phase 6: Runtime Loads Agent Tools

Backend:

- `server/utils/agents/defaults.js`
- `server/utils/agents/aibitat/plugins/index.js`
- `server/utils/agents/imported.js`
- `server/utils/agentFlows/index.js`
- `server/utils/MCP/index.js`

`WORKSPACE_AGENT.getDefinition` builds the tool identifier list from:

- `agentSkillsFromSystemSettings()`
- clarifying-question tools when enabled
- `ImportedPlugin.activeImportedPlugins()`
- `AgentFlows.activeFlowPlugins()`
- `MCPCompatibilityLayer.activeMCPServers()`

`AgentHandler.#attachPlugins` converts identifiers into actual `aibitat.function` handlers.

## Phase 7: Agent Starts Running

Backend:

- `server/utils/agents/index.js`
- `server/utils/agents/aibitat/index.js`

`AgentHandler.startAgentCluster` sends the first message:

```js
{
  from: "USER",
  to: "@agent",
  content: stripAgentCommand(invocation.prompt),
  attachments
}
```

`stripAgentCommand` removes the leading `@agent` prefix; if nothing remains it substitutes `"Hello!"` so the agent still gets a message.

`AIbitat.start` records the message and asks `@agent` to reply.

## Phase 8: Runtime Injects Knowledge Base Context

Backend:

- `server/utils/agents/index.js`
- `server/models/workspaceParsedFiles.js`
- `server/utils/DocumentManager/index.js`
- `server/utils/agents/aibitat/index.js`

Before every model turn, `AIbitat.reply` calls:

```js
this.fetchParsedFileContext()
```

The handler fetches:

- parsed files visible to the workspace/thread/user
- pinned workspace documents

Then it appends:

```xml
<attached_documents>
  <document name="...">
    ...
  </document>
</attached_documents>
```

to the latest user message.

It also registers these documents as citations with:

```js
aibitat.addDocumentCitations(allDocuments)
```

## Phase 9: Model Chooses Retrieval Tools

The model receives:

- workspace system prompt
- prior chat history
- user question
- attachments
- injected attached/pinned document context
- available tool schemas

If the visible context is enough, it can answer directly.

If more evidence is needed, it should call tools.

Common tool choices:

- `rag-memory`: search or store workspace vector memory.
- `document-summarizer`: list or summarize workspace documents.
- `web-browsing`: search the web.
- `web-scraping`: read a URL.
- `sql-agent`: query configured databases.
- integration tools: Gmail, Outlook, Google Calendar.
- MCP tools: external tools from configured MCP servers.

## Phase 10: Retrieve From Knowledge Base

Backend:

- `server/utils/agents/aibitat/plugins/memory.js`
- `server/utils/vectorDbProviders/*`

Typical `rag-memory` call:

```json
{
  "action": "search",
  "content": "contractors production data access HR policy"
}
```

The tool:

1. Resolves the workspace LLM connector.
2. Calls `performSimilaritySearch`.
3. Receives `contextTexts` and `sources`.
4. Adds `sources` as citations.
5. Returns combined context text to the model.

If no context is found, the model must not claim the knowledge base answered the question.

### Single Query Behavior

For a simple user question, the usual path is one `rag-memory` search call.

The model creates a focused search query from the user prompt, for example:

```json
{
  "action": "search",
  "content": "SRS login password reset acceptance criteria"
}
```

`rag-memory` runs one vector similarity search against the workspace namespace:

```js
vectorDB.performSimilaritySearch({
  namespace: workspace.slug,
  input: query,
  LLMConnector,
  topN: workspace?.topN ?? 4,
  rerank: workspace?.vectorSearchMode === "rerank"
});
```

This returns the best matching chunks for that query. The chunks become tool-result context, and the sources become citations.

### Multi-Turn Query Behavior

The agent runtime does keep prior chat history.

`AgentHandler.#chatHistory(20)` loads recent workspace chats for the same:

- workspace
- user
- thread

It converts them into AIbitat history:

```text
USER -> @agent: previous prompt
@agent -> USER: previous answer
```

That means a follow-up question like:

```text
Now create test cases for that SRS.
```

can use previous turns as conversational context.

However, `rag-memory` itself does not automatically rewrite follow-up questions into standalone retrieval queries. The model must decide to call `rag-memory` again with a good query. If the previous answer mentioned "password reset SRS", the model should call:

```json
{
  "action": "search",
  "content": "password reset SRS requirements acceptance criteria"
}
```

not just:

```json
{
  "action": "search",
  "content": "that SRS"
}
```

### ReAct / Loop Behavior

The current agent runtime supports a ReAct-like loop through model tool calls:

```text
model thinks it needs context
  -> model calls rag-memory
  -> tool returns chunks
  -> model reads chunks
  -> model may call another tool
  -> model eventually writes final answer
```

This loop is implemented in:

- `AIbitat.handleAsyncExecution`
- `AIbitat.handleExecution`

The loop continues until:

- the model returns final text, or
- the tool-call limit is reached.

The tool-call limit is controlled by:

```text
AGENT_MAX_TOOL_CALLS
```

If unset, the default is 10.

### Long Generative Tasks From Knowledge Base

For long outputs such as:

- source code
- technical document
- SRS
- test cases
- test plan
- implementation plan
- API specification

the current mechanism is:

1. The model receives current parsed/pinned documents from Phase 8.
2. The model calls `rag-memory` one or more times for missing sections.
3. The model may call `document-summarizer` for named files.
4. The model synthesizes the long output in the final answer.

This works for moderate-size outputs, but it is not a dedicated multi-step generation pipeline. The current code does not automatically:

- decompose a large task into sections
- retrieve separate chunks per section
- maintain a structured evidence map
- draft section-by-section
- verify each section against retrieved sources
- run a final consistency pass

For high-quality long-form generation, prefer adding an explicit agent flow or tool strategy:

```text
analyze user request
  -> create outline
  -> retrieve KB chunks per outline section
  -> draft each section
  -> validate against retrieved sources
  -> assemble final document
  -> persist citations and outputs
```

In this codebase, that can be implemented as:

- an `AgentFlow` with LLM instruction and retrieval-oriented steps
- a new built-in plugin specialized for long-document generation
- an imported custom skill that performs planning, retrieval, drafting, and verification internally

### Practical Quality Rule

For long generative answers, do not rely on one broad vector search query. Use multiple focused retrieval calls.

Example for generating a test plan:

```text
Search 1: project scope and modules
Search 2: user roles and permissions
Search 3: functional requirements
Search 4: non-functional requirements
Search 5: acceptance criteria
Search 6: integrations and external dependencies
```

Then generate:

```text
overview
scope
test strategy
test environment
test data
functional test cases
non-functional test cases
risks
traceability notes
```

This gives better grounding than asking the vector DB once for "create a test plan".

## Phase 11: Retrieve External Data

Backend:

- `server/utils/agents/aibitat/plugins/web-browsing.js`
- `server/utils/agents/aibitat/plugins/web-scraping.js`
- `server/utils/collectorApi/index.js`

For current or external data:

1. The model calls `web-browsing` with a precise query.
2. The search tool returns normalized search result JSON and citations.
3. The model calls `web-scraping` for source pages that need verification.
4. The scraper returns readable page content or summary.

External data should be used only when:

- the user asks for current/external information
- the local knowledge base has no answer
- the answer requires comparing internal and public information

## Phase 12: Generate Final Grounded Answer

Backend:

- `server/utils/agents/aibitat/index.js`
- `server/utils/agents/aibitat/providers/*`

After each tool result, AIbitat appends the result to the model history and calls the model again.

The final answer should:

- answer directly first
- ground claims in retrieved context
- prefer workspace KB for workspace policy/process questions
- distinguish KB facts from external facts
- admit missing evidence
- mention conflicts when sources disagree
- avoid exposing raw tool JSON unless requested

## Phase 13: Stream Response And Citations

Backend emits websocket events:

- `statusResponse`
- `reportStreamEvent.textResponseChunk`
- `reportStreamEvent.fullTextResponse`
- `reportStreamEvent.toolCallInvocation`
- `reportStreamEvent.citations`
- `reportStreamEvent.usageMetrics`
- `reportStreamEvent.chatId`
- `reportStreamEvent.modelRouteNotification`
- `reportStreamEvent.removeStatusResponse`

Each `reportStreamEvent` payload carries a message `uuid` so the frontend can correlate chunks, citations, and metrics to one assistant message.

Frontend `handleSocketResponse`:

1. Updates the assistant message incrementally.
2. Buffers citations if the message is not created yet.
3. Attaches sources to the final message.
4. Attaches metrics.
5. Marks the message complete.

## Phase 14: Persist Final Chat

Backend:

- `server/utils/agents/aibitat/plugins/chat-history.js`
- `server/models/workspaceChats.js`

`chat-history` pre-creates a chat row for the user prompt. When the final agent response arrives, it upserts:

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

`outputs` and `clarifyingQuestions` are included only when non-empty. The plugin also auto-renames a new thread from the first prompt (emitting a `rename_thread` event) and skips the save entirely when the run was aborted (for example a `/reset` bail).

The response then appears in historical chat like any normal workspace answer.

## Answer Quality Rules

### Retrieval Priority For KB Questions

1. Current parsed attachments and pinned documents.
2. `rag-memory` vector search.
3. `document-summarizer` for named or broad document requests.
4. External tools only when local evidence is missing or the user asks for external data.

### Retrieval Priority For External Questions

1. `web-browsing` to find candidate sources.
2. `web-scraping` to read high-value source pages.
3. KB search only if the user asks to compare external data with workspace content.

### Final Answer Shape

Use this structure:

1. Direct answer.
2. Evidence summary.
3. Caveats or missing context.
4. Suggested next action only if useful.

Example:

```text
Contractors should not access production data unless they have explicit approval and a documented business need. The retrieved workspace policy context says production access requires approval and role-based authorization; I did not find a contractor-specific exception in the knowledge-base context.
```

## Failure Handling

- No KB result: say the knowledge base did not contain enough information.
- Missing search API key: say external search is not configured.
- Scrape failure: say the page could not be read reliably.
- Tool limit reached: answer with current evidence and state remaining gaps.
- Conflicting sources: explain the conflict instead of choosing silently.

## Implementation Checklist

- Keep agent creation/configuration separate from runtime invocation.
- Detect agent mode before normal chat retrieval.
- Create websocket invocation and close normal HTTP stream.
- Build runtime from workspace settings and enabled skills.
- Inject parsed/pinned documents on every model turn.
- Use `rag-memory` for vector KB search.
- Use `web-browsing` plus `web-scraping` for external facts.
- Add citations for every KB/external context source.
- Stream final answer chunks and source events.
- Persist answer text, sources, metrics, outputs, and clarifying-question records.
