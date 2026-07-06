# Workflow 01: Browser Chat Agent Invocation

## Goal

Turn a normal workspace chat request into a websocket-backed agent run.

## Entry Points

- Frontend send: `frontend/src/components/WorkspaceChat/ChatContainer/index.jsx`
- Frontend stream API: `frontend/src/models/workspace.js`
- SSE handler: `frontend/src/utils/chat/index.js`
- Backend stream path: `server/utils/chats/stream.js`
- Agent detector: `server/utils/chats/agents.js`
- Websocket endpoint: `server/endpoints/agentWebsocket.js`
- Browser agent handler: `server/utils/agents/index.js`

## Trigger Conditions

The backend switches to agent mode when either condition is true:

- The prompt starts with `@agent`.
- The workspace uses `chatMode === "automatic"` and `Workspace.supportsNativeToolCalling(workspace)` returns true.

`WorkspaceAgentInvocation.parseAgents` only recognizes prompts that start with `@agent`.

## Sequence

1. `ChatContainer.handleSubmit` appends the user message and pending assistant message to local chat history.
2. `Workspace.multiplexStream` calls `streamChat` or `threads.streamChat`.
3. The backend enters `streamChatWithWorkspace`.
4. `grepCommand` handles slash commands first.
5. `grepAgents` checks whether this is an agent request.
6. `WorkspaceAgentInvocation.new` creates a row with a UUID.
7. Attachments are cached in `invocationAttachmentsCache` by UUID.
8. The backend writes an SSE chunk:

   ```json
   {
     "type": "agentInitWebsocketConnection",
     "websocketUUID": "<uuid>"
   }
   ```

9. The backend writes a `statusResponse` saying the chat is swapping to agent mode and closes the SSE stream.
10. `frontend/src/utils/chat/index.js` sees `agentInitWebsocketConnection` and stores the UUID in `socketId`.
11. `ChatContainer` opens `/api/agent-invocation/:uuid`.
12. `agentWebsocket` creates `AgentHandler({ uuid }).init()`.
13. `AgentHandler` validates the invocation, resolves provider/model, loads attachments, creates `AIbitat`, loads agents and tools, and starts the cluster.

## Websocket Close Behavior

On socket close:

- `agentHandler.closeAlert()` logs completion.
- `WorkspaceAgentInvocation.close(uuid)` marks the invocation as closed.
- Frontend dispatches `AGENT_SESSION_END`.
- Frontend appends `Agent session complete.` unless the close was caused by `/reset`.
- Local websocket state is cleared.

## Bail Commands

`WEBSOCKET_BAIL_COMMANDS` are:

- `exit`
- `/exit`
- `stop`
- `/stop`
- `halt`
- `/halt`
- `/reset`

`agentWebsocket` checks incoming socket messages. If feedback matches a bail command, it calls `agentHandler.aibitat.abort()` and closes the socket.

## Implementation Notes

- The normal SSE response only bootstraps the websocket. It does not run the agent.
- The websocket endpoint is protected by the unguessable invocation UUID and the `closed` flag.
- Attachments are currently cached in memory, so they must be retrieved before process restart and before cache eviction.
- Once `ChatContainer` has a websocket, the next user prompt is sent as `awaitingFeedback` instead of opening another HTTP stream.

## Rebuild Checklist

- Create an invocation table with a unique UUID and closed flag.
- Detect agent triggers before normal RAG chat.
- Return a stream event that tells the browser which websocket UUID to open.
- Build a websocket endpoint that validates the UUID, starts the agent, and closes the invocation on disconnect.
- Teach the chat UI to hold active websocket state and send follow-up messages over it.
