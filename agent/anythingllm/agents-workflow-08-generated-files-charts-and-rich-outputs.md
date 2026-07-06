# Workflow 08: Generated Files, Charts, And Rich Outputs

## Goal

Let tools produce UI artifacts beyond plain text, while still saving those artifacts in chat history.

## Key Files

- `server/utils/agents/aibitat/plugins/rechart.js`
- `server/utils/agents/aibitat/plugins/create-files/*`
- `server/endpoints/agentFileServer.js`
- `server/utils/agents/aibitat/plugins/chat-history.js`
- `frontend/src/utils/chat/agent.js`
- `frontend/src/components/WorkspaceChat/ChatContainer/ChatHistory`

## Chart Output

The `create-chart` skill validates JSON dataset input and sends:

```js
this.super.socket.send("rechartVisualize", {
  type,
  dataset,
  title
});
```

Frontend receives `rechartVisualize` and creates a chat history item with:

```json
{
  "type": "rechartVisualize",
  "content": {
    "type": "bar",
    "dataset": "...",
    "title": "..."
  }
}
```

The tool also sets `_replySpecialAttributes` so `chat-history` saves the chat as type `rechartVisualize` with chart metadata and optional caption.

## Generated File Output

`create-files-agent` tools can generate files such as text, DOCX, XLSX, and presentation formats. Generated-file tools send a `fileDownloadCard` event through the socket and can add output metadata to `_pendingOutputs`.

`agentFileServerEndpoints` serves generated files at:

```text
/api/agent-skills/generated-files/:filename
```

The endpoint authenticates requests, validates filename/path safety, and reports telemetry when files are downloaded.

## Direct Output Vs Rich Output

There are two related mechanisms:

- `socket.send("fileDownloadCard" | "rechartVisualize", payload)` renders a rich card immediately.
- `_replySpecialAttributes` tells `chat-history` to persist the final response as a special type.

For flows, `aibitat.skipHandleExecution` can return a direct text result and stop further model processing.

## Frontend Event Handling

`frontend/src/utils/chat/agent.js` handles:

- `fileDownloadCard`: create file download card message.
- `rechartVisualize`: create chart visualization message.
- `reportStreamEvent.fullTextResponse`: create direct full text response.
- `reportStreamEvent.usageMetrics`: attach metrics to final message.

## Persistence

`chat-history` checks `_replySpecialAttributes`. If present, it calls `_storeSpecial`, which can:

- set `saveAsType`
- transform stored text with `storedResponse(response)`
- run `postSave()`
- merge existing sources with pending citations

Without special attributes, normal `_store` persists a standard `chat` response.

## Rebuild Checklist

- Add explicit websocket event types for each rich output.
- Add frontend chat item renderers for those event types.
- Add a persistence hook so the artifact can be reconstructed from history.
- Add authenticated file-serving endpoints for generated files.
- Use path normalization and allow only files inside the generated-file directory.
