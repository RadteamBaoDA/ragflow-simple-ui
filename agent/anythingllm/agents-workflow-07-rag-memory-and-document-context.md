# Workflow 07: RAG Memory And Document Context

## Goal

Give agents access to workspace documents, parsed uploads, pinned documents, and long-term vector memory.

## Key Files

- `server/utils/agents/aibitat/plugins/memory.js`
- `server/utils/agents/aibitat/plugins/summarize.js`
- `server/utils/agents/index.js`
- `server/utils/agents/ephemeral.js`
- `server/models/workspaceParsedFiles.js`
- `server/utils/DocumentManager`
- `server/utils/vectorDbProviders/*`

## Fresh Parsed File Injection

`AgentHandler.createAIbitat` assigns:

```js
this.aibitat.fetchParsedFileContext = () => this.#fetchParsedFileContext();
```

`AIbitat.reply` calls this before each model turn and appends the returned XML-like block to the latest user message:

```xml
<attached_documents>
  <document name="...">
    ...
  </document>
</attached_documents>
```

The handler fetches:

- parsed workspace/thread/user files via `WorkspaceParsedFiles.getContextFiles`
- pinned workspace documents via `DocumentManager.pinnedDocs()`

It also calls `aibitat.addDocumentCitations(allDocuments)` so the frontend can show sources.

## RAG Memory Skill

`rag-memory` supports two actions:

- `search`: similarity search in the workspace vector namespace.
- `store`: add a text memory into the workspace vector namespace.

Search flow:

1. Resolve the workspace LLM connector.
2. Use vector DB `performSimilaritySearch`.
3. Add returned sources as citations.
4. Return combined context text to the model.

Store flow:

1. Build a document metadata object with generated IDs.
2. Write it to the workspace vector namespace.
3. Return success/failure text to the model.

## Document Summarizer Skill

`document-summarizer` supports:

- `list`: list available workspace documents.
- `summarize`: load a named document and return content or summary.

If the document content is under the provider context limit, the skill returns raw content. If too long, it calls `summarizeContent`.

The summarizer registers an abort listener so `/reset` or socket abort can cancel long summarization.

## Citations

Agent citations are buffered in AIbitat and emitted with a final message UUID:

```json
{
  "type": "reportStreamEvent",
  "content": {
    "type": "citations",
    "uuid": "...",
    "citations": []
  }
}
```

`chat-history` persists the same citations as `response.sources`.

## Difference From Normal RAG Chat

Normal chat performs vector search before the LLM call. Agents use two mechanisms:

- Always inject parsed/pinned documents into the current user message.
- Let the model call `rag-memory` or `document-summarizer` when it decides extra retrieval is needed.

## Rebuild Checklist

- Expose fresh document context through a callback on the runtime.
- Append document context to the latest user message, not only the system prompt.
- Add a vector-memory tool with search and store actions.
- Add citations whenever tool output depends on a source.
- Reuse normal chat history persistence so sources render the same way.
