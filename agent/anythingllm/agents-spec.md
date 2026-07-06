# Agents Feature Specification

## Purpose

AnythingLLM agents let a workspace chat call tools while answering a user. A chat can become agentic in two ways:

1. The user explicitly starts an agent run with `@agent`.
2. The workspace is in `automatic` chat mode and the selected provider/model supports native tool calling.

The feature must work in the browser chat UI, developer/API contexts, Telegram contexts, and scheduled job contexts. Browser runs use a websocket because the agent can ask for tool approval, request clarifying input, stream thoughts, stream final text, and emit rich outputs. Non-browser runs use an HTTP-like event listener that mimics the websocket interface.

## User-Facing Requirements

- A user can send `@agent <task>` from workspace chat and receive status updates while the agent works.
- In automatic mode, capable models can use tools without requiring the `@agent` prefix.
- A user can continue an active browser agent session by typing another message. The next message is sent over the existing websocket as feedback.
- A user can stop an active agent run with `exit`, `/exit`, `stop`, `/stop`, `halt`, `/halt`, or `/reset`.
- The agent can use enabled built-in skills, imported custom skills, active agent flows, and active MCP tools.
- The agent can ask for approval before sensitive tool actions.
- The user can approve once, reject, or approve and whitelist a skill for future calls.
- The agent can ask clarifying questions through an interactive card instead of plain text.
- Final answers, citations, generated outputs, attachments, metrics, and clarifying-question answers are persisted in normal workspace chat history.
- Thread auto-rename behavior should still work for agent chats.

## Admin Requirements

- Admins can enable and disable default skills.
- Admins can enable and configure optional skills.
- Admins can enable, disable, edit, delete, and list agent flows.
- Admins can list, start/stop, delete, and suppress tools for MCP servers.
- Imported custom skills can be toggled, configured, and deleted.
- Some skills are hidden when unavailable on the current runtime, for example filesystem and generated-file tools.
- App integration skills can be hidden in multi-user mode when they only support single-user credentials.

## Core Data Model

Relevant database models are in `server/prisma/schema.prisma`.

- `workspaces.agentProvider`: optional provider override for agent runs.
- `workspaces.agentModel`: optional model override for agent runs.
- `workspaces.chatProvider`, `workspaces.chatModel`: fallback provider/model when no agent override exists.
- `workspaces.chatMode`: `automatic`, `chat`, or `query`; `automatic` can trigger agent mode without `@agent`.
- `workspace_agent_invocations`: short-lived browser websocket launch records. Contains `uuid`, `prompt`, `workspace_id`, optional `user_id`, optional `thread_id`, and `closed`.
- `workspace_chats`: stores the user prompt and final persisted response JSON.
- `system_settings`: stores enabled/disabled skills, whitelists, search provider settings, sub-skill preferences, agent flow settings, and tool-selection settings.

## Primary Backend Entry Points

- `server/utils/chats/stream.js`: normal browser streaming chat path. Calls `grepAgents` before normal RAG chat.
- `server/utils/chats/agents.js`: detects agent invocations, creates `workspace_agent_invocations`, and returns websocket instructions to the frontend.
- `server/endpoints/agentWebsocket.js`: websocket endpoint `/api/agent-invocation/:uuid`.
- `server/utils/agents/index.js`: browser `AgentHandler`.
- `server/utils/agents/ephemeral.js`: one-shot non-websocket `EphemeralAgentHandler`.
- `server/utils/agents/aibitat/index.js`: agent runtime loop and tool execution engine.
- `server/utils/agents/defaults.js`: builds the `USER` and `@agent` definitions and resolves enabled tools.
- `server/utils/agents/aibitat/plugins/*`: built-in skills and communication plugins.
- `server/utils/agentFlows/*`: file-backed flow plugins and execution.
- `server/utils/MCP/*`: MCP server management and MCP-to-agent-tool conversion.
- `server/utils/agents/imported.js`: imported custom skill loader.

## Primary Frontend Entry Points

- `frontend/src/models/workspace.js`: streams chat and receives `agentInitWebsocketConnection`.
- `frontend/src/utils/chat/index.js`: maps normal SSE chunks to chat history and opens agent websocket by UUID.
- `frontend/src/components/WorkspaceChat/ChatContainer/index.jsx`: owns active websocket lifecycle and feedback forwarding.
- `frontend/src/utils/chat/agent.js`: parses websocket messages into chat history items.
- `frontend/src/components/WorkspaceChat/ChatContainer/ChatHistory/ToolApprovalRequest`: approval card.
- `frontend/src/components/WorkspaceChat/ChatContainer/ChatHistory/ClarifyingQuestion`: clarifying-question card.
- `frontend/src/pages/Admin/Agents`: admin skill, imported skill, MCP, and flow settings.
- `frontend/src/components/WorkspaceChat/ChatContainer/PromptInput/ToolsMenu/Tabs/AgentSkills`: in-chat skill visibility and toggles.

## Tool Sources

The `@agent` tool list is assembled from:

- Default built-in skills: `rag-memory`, `document-summarizer`, `web-scraping`.
- Configurable built-in skills in `default_agent_skills`.
- Clarifying-question skill when `agent_clarifying_questions_enabled` is true.
- Imported custom skills with `active: true`.
- Active agent flows in `storage/plugins/agent-flows`.
- MCP servers from `storage/plugins/anythingllm_mcp_servers.json`.

## Non-Functional Requirements

- Tool execution must be bounded by `AGENT_MAX_TOOL_CALLS`, defaulting to 10.
- Provider failures must become visible agent errors rather than crashing the server.
- Tool calls must emit telemetry without blocking the response.
- File and flow paths must be normalized and checked with `isWithin` to prevent path traversal.
- Tool approvals must time out and fail closed in browser and Telegram contexts.
- Imported plugin zip extraction must prevent Zip Slip.
- Agent sessions must close their invocation record when the websocket closes.
- Agents should reuse the normal chat persistence format so historical chat rendering works.

## Out Of Scope

- The `open-computer` project is a separate experimental virtual machine environment for agents. It is not part of the core workspace chat agent implementation documented here.
- Normal non-agent RAG chat is only covered where it hands off to the agent feature.
