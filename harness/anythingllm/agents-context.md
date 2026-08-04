# Agents Feature — Code Context Map

> Fast-lookup index for Claude Code / implementers. Exact files, symbols, and line anchors for every part of the agent pipeline. Line numbers are approximate anchors (verify with Grep before editing). Companion: `docs/agents-spec.md`.

## Quick lookup — "I want to change X, read Y"

| Task | Read first |
|---|---|
| Add a built-in agent skill | `server/utils/agents/aibitat/plugins/memory.js` (template), register in `aibitat/plugins/index.js`, expose in `defaults.js` (`DEFAULT_SKILLS` or configurable) + frontend `Admin/Agents/skills.jsx` |
| Add a multi-tool skill (like gmail) | `aibitat/plugins/sql-agent/index.js` (array plugin pattern) + `defaults.js` `SKILL_FILTER_CONFIG` |
| Change @agent trigger rules | `server/models/workspaceAgentInvocation.js:7` `parseAgents` + `server/utils/chats/agents.js:38` `grepAgents` |
| Change the agent loop / tool recursion | `server/utils/agents/aibitat/index.js` `chat()` :582, `handleExecution` :1135, `handleAsyncExecution` :982 |
| Change tool-calling for non-native models | `aibitat/providers/helpers/untooled.js` |
| Change native tool formatting | `aibitat/providers/helpers/tooled.js` |
| Add a provider | `aibitat/providers/` + registry switch `aibitat/index.js:1365-1446` + `AgentHandler.checkSetup` `agents/index.js:115` + `providerDefault` :291 |
| New socket message type | producer: `aibitat.socket.send` callers; consumer: `frontend/src/utils/chat/agent.js:40` `handleSocketResponse` (+ `handledEvents` :22) |
| Change persistence shape | `aibitat/plugins/chat-history.js` `_store` :107 |
| Tool approval behavior | `aibitat/plugins/websocket.js:101` `requestToolApproval`, `server/utils/helpers/agents.js:11` auto-approve, `server/models/agentSkillWhitelist` |
| Clarifying questions | `aibitat/plugins/request-user-input.js` + `websocket.js:212` |
| Agent flows blocks | `server/utils/agentFlows/flowTypes.js`, `executor.js`, `executors/*` |
| Mid-session tool toggle | `agents/index.js:714` `#toggleAgentTool` (+ `resolveAgentSkill` `defaults.js:210`), ws frame `toolToggle` → `websocket.js:114` `handleToolToggle`, frontend `frontend/src/utils/chat/agent.js:466` `toggleAgentSessionTool` |
| Model-router cooldown for agents | `aibitat/plugins/model-router-cooldown.js` (re-stamps on `onInterrupt`/`onTerminate`); wired `agents/index.js:887`, `ephemeral.js:553` |
| Scheduled-job creation skill | `aibitat/plugins/create-scheduled-job/index.js` (+ `cronUtils.js` local→UTC, tool catalog); single-user gate `defaults.js:17` `SINGLE_USER_ONLY_SKILLS`; runner `server/jobs/run-scheduled-job.js` |
| MCP tools | `server/utils/MCP/index.js` (`MCPCompatibilityLayer`), `MCP/hypervisor/index.js` |
| Imported skill contract | `server/utils/agents/imported.js` (`ImportedPlugin`) |
| Ephemeral/API agent runs | `server/utils/agents/ephemeral.js` + `server/utils/chats/apiChatHandler.js:158,524` |

## Layer 1 — Creation / Configuration

| What | Where |
|---|---|
| Workspace columns `agentProvider`/`agentModel`/`openAiPrompt`/`router_id` | `server/prisma/schema.prisma:121-152` |
| System settings labels + validation (`default_agent_skills` :181, `disabled_agent_skills` :229, sub-skill deny lists :238+) | `server/models/systemSettings.js` |
| Read agent prefs endpoint (special-cases imported skills :425) | `server/endpoints/admin.js:331` GET `/admin/system-preferences-for` |
| Write prefs | `server/endpoints/admin.js` `updateSystemPreferences` POST `/admin/system-preferences` |
| Skill whitelist add | `server/endpoints/agentSkillWhitelist.js:48` |
| Imported skill toggle/config/delete | `server/endpoints/experimental/imported-agent-plugins.js:12,30,49` |
| Flow CRUD save :13 / list :54 / get :75 / delete :138 / toggle :167 | `server/endpoints/agentFlows.js` |
| MCP force-reload :12 / list :35 / toggle :55 / delete :78 / toggle-tool :99 | `server/endpoints/mcpServers.js` |
| Admin UI main page | `frontend/src/pages/Admin/Agents/index.jsx` (submit :188, hidden inputs `system::*` :577-592) |
| Skill registry (UI) | `frontend/src/pages/Admin/Agents/skills.jsx` |
| Flow builder UI | `frontend/src/pages/Admin/AgentBuilder/index.jsx` + `nodes/*` |
| Imported skill config UI | `frontend/src/pages/Admin/Agents/Imported/ImportedSkillConfig/index.jsx` |
| Frontend API clients | `frontend/src/models/agentFlows.js`, `mcpServers.js`, `experimental/agentPlugins.js`, `agentSkillWhitelist.js`, `admin.js` |
| In-chat skill toggles | `frontend/src/components/WorkspaceChat/ChatContainer/PromptInput/ToolsMenu/Tabs/AgentSkills/` |

Gotcha: `system::active_agent_flows` is submitted by the admin form but has no server handler — flow toggling actually happens live via `AgentFlows.toggleFlow` (`FlowPanel.jsx:80`).

## Layer 2 — Invocation / Session

| What | Where |
|---|---|
| `parseAgents` (must start with `@agent`) | `server/models/workspaceAgentInvocation.js:7-10` |
| Invocation model: `new` :22, `close` :12, `getWithWorkspace` :54 | `server/models/workspaceAgentInvocation.js` |
| `grepAgents` gate (automatic-mode check :47-55, emits `agentInitWebsocketConnection` :84) | `server/utils/chats/agents.js:38-109` |
| Attachment cache HTTP→WS (`cacheInvocationAttachments` :21) | `server/utils/chats/agents.js:14-36` |
| Stream chat calls grepAgents, early return | `server/utils/chats/stream.js:43-52` |
| express-ws setup :77, route registration :92 | `server/index.js` |
| WS endpoint `/agent-invocation/:uuid` (relayToSocket :12, bail :41, run :53-55) | `server/endpoints/agentWebsocket.js:23` |
| `AgentHandler` — init :702, `#validInvocation` :516, `#providerSetupAndCheck` :445, `#getFallbackProvider` :383, `providerDefault` :291, `checkSetup` :115, `#resolveRouterProvider` :460, `createAIbitat` :779, `#loadAgents` :680, `#attachPlugins` :545, `startAgentCluster` :865, `#stripAgentCommand` :857 | `server/utils/agents/index.js` |
| `EphemeralAgentHandler` (ctor :66, init :420, createAIbitat :503 w/ httpSocket + `toolOverrides` :563, own `#attachPlugins` :259) | `server/utils/agents/ephemeral.js` |
| `EphemeralEventListener` (send :640, packMessages :654, waitForClose :691, streamAgentEvents :707) | `server/utils/agents/ephemeral.js:634-792` |
| API chat agent branch (blocking :158-190, streaming :524-557) | `server/utils/chats/apiChatHandler.js` |
| Telegram agent | `server/utils/telegramBot/chat/agent.js:236`, gate `telegramBot/chat/stream.js:79` |
| Scheduled jobs | `server/jobs/run-scheduled-job.js:61` |
| Frontend: handleChat sees `agentInitWebsocketConnection` | `frontend/src/utils/chat/index.js:152-153` |
| Frontend: socket lifecycle useEffect `[socketId]` (open :356, close :380, START/END events :407-410) | `frontend/src/components/WorkspaceChat/ChatContainer/index.jsx:350-440` |
| `AGENT_SESSION_START/END`, `websocketURI`, `useIsAgentSessionActive` | `frontend/src/utils/chat/agent.js:8-9,34-38,382-406` |

Surfaces: workspace chat WS = full; developer API + Telegram + scheduled jobs = ephemeral; **embed widget = no agents** (`chats/embed.js` coerces automatic→chat).

## Layer 3 — AIbitat Core (harness + loop)

All in `server/utils/agents/aibitat/index.js` unless noted.

| Symbol | Anchor | Note |
|---|---|---|
| Registries `agents`/`channels`/`functions`, `_chats` | :39-43 | chat node `{from,to,content,state}` |
| `maxRounds`=100, `maxToolCalls` env default 10 | :73-78 | |
| `use(plugin)` | :150 | `plugin.setup(this)` |
| `agent()`/`channel()`/`function()` | :316/:329/:1453 | |
| `getAgentConfig` (default role merge) | :344 | |
| `start(message)` | :562 | |
| `chat(route)` main loop | :582-664 | direct + group paths; TERMINATE/INTERRUPT/maxRounds |
| `selectNext` (group speaker LLM pick) | :685-758 | role-play prompt :736 |
| `shouldAgentInterrupt` | :672 | |
| `reply(route)` turn prep | :857-951 | history format :809, ToolReranker :892, per-turn router :913 |
| `#safeProviderCall` → APIError | :961 | |
| `handleAsyncExecution` (streaming) | :982-1121 | direct-output :1057, recurse :1104 |
| `handleExecution` (sync) | :1135-1265 | unknown fn :1159-1168, cap :1248 |
| `continue(feedback)` / `retry()` | :1276/:1318 | resume after interrupt; manual retry only |
| `abort()` | :410 | emits "abort" |
| citations/chatId/routing emitters | :184-267 | `emitChatId`, `flushCitations`, `flushRoutingMetadata` |
| tool attachments buffer | :275-307 | |
| provider registry switch | :1365-1446 | string tag → class |
| `skipHandleExecution` flag | :29 | directOutput tools |

Support:
- Errors: `aibitat/error.js` — `AIbitatError` > `APIError` > `RetryError`.
- Dedupe: `aibitat/utils/dedupe.js` — `Deduplicator` (SHA runs :29, isDuplicate :57, 30s cooldown :17). UnTooled path only.
- Tool rerank: `aibitat/utils/toolReranker.js`.
- Summarize (tool-side, not loop): `aibitat/utils/summarize.js:104`.
- Agent defs: `server/utils/agents/defaults.js` — `USER_AGENT` :43, `WORKSPACE_AGENT.getDefinition` :53-95 (function list concat :86-92), `DEFAULT_SKILLS` :10, `SINGLE_USER_ONLY_SKILLS` :17, `SKILL_FILTER_CONFIG` :20, `agentSkillsFromSystemSettings` :123-190, clarifying gate :104, `resolveAgentSkill` :210 (UI id → loadable/registered names, used by mid-session toggle).

### Providers (`aibitat/providers/`)

- Base `Provider`: `ai-provider.js` — `supportsAgentStreaming` :538 (default false), native opt-out env :138-155, usage tracking :577-636, attachments :549-600, `systemPrompt` :510 (workspace vars + memories), `LangChainChatModel` :163, `contextLimit` :473, generic `stream` :647.
- Native helper: `helpers/tooled.js` — `formatFunctionsToTools` :26, `formatMessagesForTools` :79 (function→tool_calls), `tooledStream` :171, `tooledComplete` :300.
- **UnTooled (ReAct emulation)**: `helpers/untooled.js` — selection system prompt `buildToolCallMessages` :123, `showcaseFunctions` :28, `validFuncCall` (strict, no unknown props) :80, `functionCall` :152, `streamingFunctionCall` :181, `cleanMsgs` :12, MCP cooldown :64-72.
- Multi-inherit glue: `helpers/classes.js` `InheritMultiple`.
- MCP schema prep: `helpers/dereferenceSchema.js` — inlines `$ref` pointers before tool schemas hit LLM APIs.
- Key adapters: `openai.js` (Responses API, `parallel_tool_calls:false`), `anthropic.js` (tool_use/tool_result :427-450), `ollama.js` (capability probe :52-59). ~40 files total.

## Layer 4 — Capabilities (tools)

| What | Where |
|---|---|
| Plugin registry (16 modules, dual-keyed; excludes `router-classifier` + `file-history`) | `server/utils/agents/aibitat/plugins/index.js` |
| Single plugin template | `aibitat/plugins/memory.js` (`rag-memory`, params :8) |
| Multi-tool template | `aibitat/plugins/sql-agent/index.js` (array of sub-plugins) |
| doc summarizer / web-scraping / web-browsing / rechart | `plugins/summarize.js` / `web-scraping.js` / `web-browsing.js` / `rechart.js` |
| filesystem (10 tools, availability `lib.js isToolAvailable`) | `plugins/filesystem/` |
| create-files (5 generators + `lib.js saveGeneratedFile` :213, `registerOutput` :158) | `plugins/create-files/` |
| gmail (18) / outlook (10) / gcal (10) — bridges in each `lib.js` | `plugins/gmail/`, `outlook/`, `google-calendar/` |
| clarifying questions tool (cap via `_clarifyState`, survey buffer :208) | `plugins/request-user-input.js` |
| create-scheduled-job (single-user only; `listTools` catalog discovery, cron local→UTC, `registerOutput` :200) | `plugins/create-scheduled-job/` |
| model-router-cooldown (infra, no LLM tool) | `plugins/model-router-cooldown.js` |
| Attach dispatch by prefix (`parent#child` :547, `@@flow_` :582, `@@mcp_` :610, `@@hubId` :643, plain :662; `parseCallOptions` :525) | `server/utils/agents/index.js:545-677` (mirror: `ephemeral.js:259`) |
| Imported skills: `ImportedPlugin` (require-cache bust :20, `plugin()` :211, forced approval :240, `activeImportedPlugins` :64, Zip-Slip :327, `importCommunityItemFromUrl` :259) | `server/utils/agents/imported.js` |
| Flows: `AgentFlows` (`saveFlow` whitelist :112, `loadFlowPlugin` :218, `sanitizeToolName` :201, `activeFlowPlugins` :188, `executeFlow` :177) | `server/utils/agentFlows/index.js` |
| Flow executor (`replaceVariables` :106, directOutput stop :211) | `server/utils/agentFlows/executor.js` + `executors/{api-call,llm-instruction,web-scraping}.js` + `flowTypes.js` |
| MCP: `MCPHypervisor` (config path :67, transports :344-441, boot :494, suppressedTools :188) | `server/utils/MCP/hypervisor/index.js` |
| MCP: `MCPCompatibilityLayer` (`activeMCPServers` :17, `convertServerToolsToPlugins` :28, fn name `<server>-<tool>` :60, `callTool` proxy :78-117) | `server/utils/MCP/index.js` |

## Layer 5 — HITL (approval + clarification)

| What | Where |
|---|---|
| `requestToolApproval` (auto-approve → whitelist → interactive, 120s fail-closed :182-194) | `aibitat/plugins/websocket.js:101` |
| `skillIsAutoApproved` env `AGENT_AUTO_APPROVED_SKILLS` | `server/utils/helpers/agents.js:11` |
| Whitelist model | `server/models/agentSkillWhitelist.js` |
| `requestUserClarification` (120s) | `aibitat/plugins/websocket.js:212` |
| Ephemeral approval (Telegram IPC :13-38, else auto-deny :148-159) | `aibitat/plugins/http-socket.js` |
| Frontend approval card | `frontend/.../ChatHistory/ToolApprovalRequest/` |
| Frontend clarify card | `frontend/.../ChatHistory/ClarifyingQuestion/` |

## Layer 6 — Output / Streaming / Persistence

### Server producers

| What | Where |
|---|---|
| WS plugin: envelope `send` :84, `introspect`→`statusResponse` :73, onError→`wssFailure` :66, onMessage raw :292, onTerminate close :299, bail cmds :23-31, inbound handlers `handleFeedback` :330 / `handleToolApproval` :143 / `handleClarificationResponse` :221, timeouts :6-8 | `aibitat/plugins/websocket.js` |
| HTTP-socket plugin (single-shot close-on-message :233-243) | `aibitat/plugins/http-socket.js` |
| Stream event producers: `chatId` :186, `citations` :235, `modelRouteNotification` :262, `fullTextResponse`+`usageMetrics` :1067-1079, `usageMetrics` terminal :1113/:1257 | `aibitat/index.js` |
| `textResponseChunk`/`toolCallInvocation` chunks | providers: `openai.js:172-199`, `anthropic.js:285-321`, `tooled.js:219,252`, `untooled.js:197-347`, `ai-provider.js:671,684` |
| Chart emit + `_replySpecialAttributes` (save as `rechartVisualize`) | `aibitat/plugins/rechart.js:79-95` |
| File card emit + `registerOutput` → `_pendingOutputs` | `plugins/create-files/lib.js:158-231`, generators e.g. `text/create-text-file.js:129` |
| Persistence: pre-register :23, save-on-reply :62, `_store` shape :107-122 (`type:"chat"` always), `_storeSpecial` :153, auto-rename :174, abort guard :18 | `aibitat/plugins/chat-history.js` |

### Frontend consumers

| What | Where |
|---|---|
| `handleSocketResponse` dispatch, `handledEvents` :22-32, `reportStreamEvent` inner switch :87-251 | `frontend/src/utils/chat/agent.js:40-380` |
| Thought grouping → `StatusResponse` (expandable CoT) | `frontend/.../ChatHistory/index.jsx:292-299` + `StatusResponse/index.jsx` |
| Chart render | `frontend/.../ChatHistory/Chartable/index.jsx` |
| File card render (live + historical `response.outputs[]`) | `FileDownloadCard` + `HistoricalMessage/HistoricalOutputs/index.jsx` |
| Session end UI ("Agent session complete.", `pendingResetRef`) | `ChatContainer/index.jsx:380-406` |

### Message-type wire catalog

Server→client types: `statusResponse`, `reportStreamEvent` (inner: `textResponseChunk`, `fullTextResponse`, `toolCallInvocation`, `usageMetrics`, `citations`, `chatId`, `modelRouteNotification`, `removeStatusResponse`), `fileDownloadCard`, `rechartVisualize`, `toolApprovalRequest`, `clarificationRequest`, `wssFailure`, `rename_thread`, `WAITING_ON_INPUT`, untyped raw `{from,to,content,state}`.
Client→server: `awaitingFeedback`, `toolApprovalResponse`, `clarificationResponse`, bail strings (`exit`, `/exit`, `stop`, `/stop`, `halt`, `/halt`, `/reset`).
Ephemeral HTTP chunk types: `agentThought`, `textResponseChunk`, `textResponse`, `fileDownload`, `usageMetrics`.

## Conventions cheat-sheet

- Tool identifier prefixes: plain slug (built-in), `parent#child` (built-in sub-tool), `@@hubId` (imported), `@@flow_<uuid>` (flow), `@@mcp_<server>` (MCP → expands to `<server>-<tool>` functions).
- Tool result re-injection: `{ name, role: "function", content: result, originalFunctionCall }` message, then recurse.
- `skipHandleExecution` / flow `directOutput`: tool result returned verbatim as final answer.
- Turn correlation: one `msgUUID` per `handleExecution` root; tool-call stream uuid `<msgUUID>:tool_call_invocation`; route note `<msgUUID>:route`.
- Persisted agent turns are `type:"chat"` in `workspace_chats` (special: `rechartVisualize`); files in `response.outputs[]`.
- Provider tag is a string; instance resolved per turn via registry switch; streaming iff `supportsAgentStreaming`.
- Fail-closed defaults: approval timeout denies; unknown flow block types rejected on save; unknown fn name → error message fed back to model.
