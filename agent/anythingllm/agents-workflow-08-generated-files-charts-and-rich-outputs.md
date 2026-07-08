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

`create-files-agent` tools can generate text, PDF, DOCX, XLSX, and PPTX files. Files are written to `storage/generated-files` as `{fileType}-{uuid}.{extension}`. Each tool sends a `fileDownloadCard` event through the socket with `{ filename, storageFilename, fileSize }` and registers matching `{ type, payload }` output metadata into `_pendingOutputs` via `registerOutput`, so the card can be rebuilt from history.

`agentFileServerEndpoints` serves generated files at:

```text
/api/agent-skills/generated-files/:filename
```

The endpoint authenticates requests, validates the storage filename format, confirms ownership by finding a workspace chat the user can access (or, in single-user mode, a scheduled job run) whose persisted `outputs` reference the file, and reports telemetry when files are downloaded.

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

`ChatHistory/index.jsx` renders live and persisted `rechartVisualize` items with `Chartable` and `fileDownloadCard` items with `FileDownloadCard`. For persisted file cards, `HistoricalMessage/HistoricalOutputs` maps `response.outputs[]` entries back to `FileDownloadCard`, which downloads via the generated-files endpoint using `storageFilename`.

## Persistence

`chat-history` checks `_replySpecialAttributes`. If present, it calls `_storeSpecial`, which can:

- set `saveAsType`
- transform stored text with `storedResponse(response)`
- run `postSave()`
- merge existing sources with pending citations

Without special attributes, normal `_store` persists a standard `chat` response.

Both `_store` and `_storeSpecial` include `_pendingOutputs` as `response.outputs` when non-empty, then `_cleanup` clears the pending buffers (citations, outputs, clarifying questions, tracked chat ID).

## Rebuild Checklist

- Add explicit websocket event types for each rich output.
- Add frontend chat item renderers for those event types.
- Add a persistence hook so the artifact can be reconstructed from history.
- Add authenticated file-serving endpoints for generated files.
- Enforce a strict storage-filename format (`{fileType}-{uuid}.{extension}`) and serve only files referenced by an accessible chat inside the generated-file directory.
