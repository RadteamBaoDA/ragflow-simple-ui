# Workflow 12: Agent Context Retrieval And Grounded Answering

## Goal

Explain the detailed flow for running an agent that retrieves context from the workspace knowledge base and external sources, then returns a high-quality answer grounded in the best available evidence.

This workflow connects four pieces:

1. Agent execution loop.
2. Knowledge-base retrieval.
3. External data retrieval.
4. Final response generation and persistence.

## Key Files

Backend:

- `server/utils/agents/index.js`
- `server/utils/agents/ephemeral.js`
- `server/utils/agents/aibitat/index.js`
- `server/utils/agents/aibitat/plugins/memory.js`
- `server/utils/agents/aibitat/plugins/summarize.js`
- `server/utils/agents/aibitat/plugins/web-browsing.js`
- `server/utils/agents/aibitat/plugins/web-scraping.js`
- `server/utils/chats/stream.js`
- `server/utils/helpers/chat/index.js`
- `server/utils/vectorDbProviders/base.js`
- `server/utils/DocumentManager/index.js`
- `server/models/workspaceParsedFiles.js`
- `server/utils/collectorApi/index.js`

Frontend:

- `frontend/src/utils/chat/agent.js`
- `frontend/src/components/WorkspaceChat/ChatContainer/index.jsx`
- `frontend/src/components/WorkspaceChat/ChatContainer/ChatHistory`
- `frontend/src/components/WorkspaceChat/ChatContainer/ChatSidebar`

## Context Sources

Agents can use several context sources. They are not all loaded the same way.

### Always-Injected Workspace Context

These are fetched by the agent handler on every model turn:

- Parsed files uploaded into the current workspace/thread/user context.
- Pinned workspace documents.

Implementation:

- Browser handler: `AgentHandler.#fetchParsedFileContext`
- Ephemeral handler: `EphemeralAgentHandler.#fetchParsedFileContext`
- Runtime hook: `aibitat.fetchParsedFileContext`

The handler formats these documents as:

```xml
<attached_documents>
  <document name="filename.ext">
    document text
  </document>
</attached_documents>
```

`AIbitat.reply` appends this block to the latest user message before calling the model.

### Knowledge Base Vector Search

The `rag-memory` skill searches the workspace vector namespace.

Implementation:

- `server/utils/agents/aibitat/plugins/memory.js`
- `getVectorDbClass()`
- `vectorDB.performSimilaritySearch`

Inputs:

- workspace namespace: `workspace.slug`
- user query or model-generated search phrase
- top N: `workspace.topN` or default 4
- rerank flag: `workspace.vectorSearchMode === "rerank"`
- similarity threshold: the vector provider's default (the tool does not pass the workspace `similarityThreshold` setting)

Outputs:

- `contextTexts`: text chunks for the model.
- `sources`: citation objects for UI and persistence.
- `message`: error text when search fails.

### Document Listing And Summarization

The `document-summarizer` skill lets the model inspect workspace documents by file name.

Actions:

- `list`: returns available documents and descriptions.
- `summarize`: returns a document's full content when it fits context, otherwise summarizes it.

This is useful when a user asks about a named file or when similarity search is not enough.

### External Web Search

The `web-browsing` skill searches external data sources.

Supported provider selection is controlled by `agent_search_provider` and environment variables. Examples include DuckDuckGo, SerpApi, SearchApi, Serper, Bing, Brave, Tavily, Exa, Perplexity, and others.

The search tool:

1. Chooses the configured provider.
2. Executes the search.
3. Normalizes result objects.
4. Adds result citations with `aibitat.addCitation`.
5. Returns JSON search results to the model.

### External Web Page Scraping

The `web-scraping` skill retrieves page content for a URL. Agent flows can also execute web scraping blocks.

Common use:

- The model first calls `web-browsing` to discover candidate URLs.
- The model then calls `web-scraping` to fetch page content from the best URL.
- If content is too large, helper logic summarizes it before returning to the model.

### Other External Tool Sources

Depending on enabled skills, the model can retrieve context from:

- SQL databases through `sql-agent`.
- Gmail through `gmail-agent`.
- Outlook through `outlook-agent`.
- Google Calendar through `google-calendar-agent`.
- Filesystem tools through `filesystem-agent`.
- MCP tools through `@@mcp_<serverName>`.
- Imported custom skills through `@@<hubId>`.

Each tool should add citations when it returns externally sourced facts that the user may need to inspect.

## Detailed Runtime Flow

### 1. User Starts An Agent Run

The browser sends a normal workspace chat request. `grepAgents` switches it into agent mode if:

- the prompt starts with `@agent`, or
- the workspace is automatic and the provider supports tool calling.

The frontend opens a websocket to `/api/agent-invocation/:uuid`.

### 2. Handler Builds Runtime Context

`AgentHandler.init`:

1. Loads the invocation and workspace.
2. Resolves agent provider/model.
3. Loads cached attachments.

`AgentHandler.createAIbitat`:

1. Creates `AIbitat` seeded with the last 20 workspace chats for the same workspace/user/thread.
2. Registers `fetchParsedFileContext`.
3. Attaches websocket and chat-history plugins.
4. Registers `USER` and `@agent`.
5. Loads all enabled tools.

### 3. Agent Receives Initial User Message

`AgentHandler.startAgentCluster` sends:

```js
{
  from: "USER",
  to: "@agent",
  content: strippedPrompt,
  attachments
}
```

The `@agent` system prompt comes from the workspace prompt plus memory/system-prompt variables. It also includes available tool definitions.

### 4. Runtime Injects Fresh Workspace Documents

Before each model call, `AIbitat.reply` calls `fetchParsedFileContext`.

The injected context includes:

- parsed files from `WorkspaceParsedFiles.getContextFiles`
- pinned docs from `DocumentManager.pinnedDocs`

The same documents are added as citations with `addDocumentCitations`.

This means the model always sees the current attached/pinned knowledge base context, even if the user did not explicitly ask to search.

### 5. Model Decides Whether More Context Is Needed

The model can answer directly if the injected documents and chat history are enough.

It should call tools when:

- the prompt asks about local knowledge not present in injected documents
- the user names a document and content is not in context
- the question requires current or external information
- the user asks to compare knowledge-base content with external data
- the answer depends on data behind an integration, SQL source, MCP server, or web page

### 6. Knowledge Base Search Tool Call

For workspace knowledge-base search, the model calls `rag-memory`:

```json
{
  "action": "search",
  "content": "search query written from the user's question"
}
```

The handler:

1. Resolves the workspace LLM connector.
2. Runs vector similarity search.
3. Adds citations from vector search results.
4. Returns combined context text to the model.

If no chunks are found, the tool returns a message telling the model that local context was not found and that web search may be needed.

### 7. External Search Tool Call

For current or non-local facts, the model calls `web-browsing`:

```json
{
  "query": "precise external search query"
}
```

The handler:

1. Uses the configured search provider.
2. Returns normalized search result JSON.
3. Adds citations from result URLs/snippets.

The model should treat search results as leads, not always final evidence. For important details, it should scrape/read the source page.

### 8. External Page Read Tool Call

For source-page evidence, the model calls `web-scraping` with a URL. The tool:

1. Uses `CollectorApi.getLinkContent` with the default `"text"` capture mode.
2. Adds a citation for the page.
3. Summarizes if content exceeds the model context limit.
4. Returns readable page content or summary to the model.

### 9. Model Synthesizes Final Answer

After tool results are appended into conversation history, AIbitat calls the model again.

The final answer should:

- answer the user's actual question directly
- prefer knowledge-base evidence when the user asks about workspace content
- clearly distinguish workspace facts from external facts when both are used
- avoid claiming a fact was in the knowledge base if it came from web search
- mention uncertainty when retrieved context is weak, missing, stale, or conflicting
- include citations/sources through the existing source panel, not by inventing inline source IDs
- avoid dumping raw tool JSON unless the user asked for raw data

### 10. Response Streams To Frontend

Provider streaming emits:

- `textResponseChunk`
- `toolCallInvocation`
- `usageMetrics`
- `citations`
- `chatId`

Frontend `handleSocketResponse`:

1. Creates or updates the assistant message.
2. Buffers citations if they arrive before the message exists.
3. Attaches metrics and chat id.
4. Renders sources in the normal source UI.

### 11. Response Is Persisted

`chat-history` stores:

```json
{
  "text": "final answer",
  "sources": ["citations from KB and external tools"],
  "type": "chat",
  "attachments": [],
  "metrics": {},
  "outputs": [],
  "clarifyingQuestions": []
}
```

This makes agent answers behave like normal workspace chat history.

## Design For High-Quality Grounded Answers

### Retrieval Priority

Use this retrieval priority for knowledge-base-oriented questions:

1. Current parsed attachments and pinned documents.
2. `rag-memory` vector search.
3. `document-summarizer` for named files or broad file inspection.
4. External tools only when the user asks for current/external data or the knowledge base does not contain enough information.

Use this retrieval priority for current/external questions:

1. `web-browsing` to find candidate sources.
2. `web-scraping` to read the best source pages.
3. Knowledge base search if the question asks to connect external facts to workspace content.

### Query Construction

The model should generate retrieval queries that are:

- short enough for vector search
- specific to the user's entity, product, file, date, or topic
- free of irrelevant chat phrasing
- decomposed into multiple searches when the user asks multiple questions

Example:

User asks:

```text
Based on our HR policy, can contractors access production data?
```

Good `rag-memory` query:

```text
contractors production data access HR policy
```

Poor query:

```text
Based on our HR policy, can contractors access production data?
```

### Evidence Handling

The model should classify retrieved evidence:

- Direct evidence: answers the question explicitly.
- Supporting evidence: gives related policy, definition, or constraint.
- Conflicting evidence: disagrees with another source.
- Missing evidence: no retrieved context answers the question.

Final answer behavior:

- Direct evidence: answer confidently and cite.
- Supporting evidence only: answer with caveats.
- Conflicting evidence: explain the conflict and avoid choosing silently.
- Missing evidence: say the knowledge base did not contain enough information; optionally summarize external findings if external search was used.

### Context Budget Management

The current implementation relies on:

- provider context limits
- document summarization
- optional tool reranking
- top-N vector search
- pinned document token caps through `DocumentManager`

For better quality, keep these rules:

- Do not stuff every available document into the prompt.
- Prefer fewer high-signal chunks over many weak chunks.
- Summarize long web pages and documents before returning them to the model.
- Keep citations tied to the exact chunks or pages used.

### Answer Contract

A high-quality answer should have this shape:

1. Direct answer first.
2. Brief reasoning grounded in retrieved context.
3. Relevant caveats or missing information.
4. Next action only if useful.

Example answer shape:

```text
Contractors should not access production data unless they have explicit approval and a documented business need. The workspace policy context says production access requires approval and role-based authorization; I did not find a contractor-specific exception in the retrieved knowledge-base context.
```

The UI source list carries the citations, so the answer does not need to invent source labels.

## Failure Modes And Correct Behavior

### No Knowledge Base Results

If `rag-memory` returns no context:

- Do not pretend the knowledge base answered.
- Say the workspace knowledge base did not contain relevant information.
- Use external search only if the user asked for it or the task benefits from it.

### Search Provider Missing API Key

`web-browsing` returns setup text when the provider is not configured. The model should tell the user search is not configured and answer from local context if possible.

### Scraped Page Too Long

The scraper should summarize. If summarization fails, the model should say the page could not be read reliably instead of hallucinating.

### Tool Call Limit Reached

When `AGENT_MAX_TOOL_CALLS` is reached, AIbitat executes the current tool and forces a final answer with no additional tools. The model should summarize what it found and state any remaining gap.

### Conflicting Sources

If workspace knowledge base and external data conflict, prefer the workspace source for workspace-specific policy/process questions. Mention that external data differs when relevant.

## Implementation Checklist

- Ensure `fetchParsedFileContext` runs before every agent model call.
- Ensure knowledge-base tools add citations with `aibitat.addCitation`.
- Ensure external search/scrape tools add citations for URLs.
- Keep `rag-memory` enabled by default unless explicitly disabled.
- Make the agent prompt tell the model to use tools for missing/current data.
- Persist citations in `workspace_chats.response.sources`.
- Surface citations in the frontend source UI.
- Add tests for no-result, direct-result, conflicting-result, and external-search-needed cases.
