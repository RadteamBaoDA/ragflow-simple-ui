# Agents Feature — Full Specification

> End-to-end spec of the AnythingLLM agent feature: how an agent is defined (created/configured), how it is invoked, how the runtime harness and agent loop work (native tool calling + ReAct-style emulation), and how output reaches the user and is persisted.
>
> Companion file: `docs/agents-context.md` — exact file/line code map for implementers.

---

## 1. Concept Model

There is **no dedicated "agent" table or entity**. An agent is a *composition* resolved at session start:

```
Agent = Workspace LLM config (agentProvider/agentModel, system prompt openAiPrompt)
      + System-level skill resolution (system_settings rows)
      + On-disk capabilities (imported skills, agent flows, MCP servers)
      + Runtime harness (AIbitat instance + transport plugin)
```

Two fixed "agent" nodes exist in every session:

- **`USER`** — proxy for the human. `interrupt: "ALWAYS"` so control always returns to the human after the agent replies.
- **`@agent`** (WORKSPACE_AGENT) — the working agent. Role = workspace system prompt (+ memories, + clarifying-question mandate when enabled). Functions = resolved tool list.

## 2. Lifecycle Overview

```
CREATE (admin config)          INVOKE                    RUN (harness + loop)              OUTPUT
──────────────────────  ────────────────────────  ─────────────────────────────────  ────────────────────
workspace agentProvider  user sends "@agent ..."   AgentHandler.init()                 websocket/http-socket
+ agentModel             OR chatMode=automatic     → provider/model resolution         plugin streams events
system_settings skills   with native tool support  → createAIbitat()                   → frontend renders
imported skills (disk)   → grepAgents()            → load USER + @agent defs           thoughts/chunks/cards
agent flows (disk)       → invocation row (uuid)   → attach plugins (skills/flows/     chat-history plugin
MCP servers (disk)       → frontend opens ws       MCP/imported)                       persists workspace_chats
                         /agent-invocation/:uuid   → aibitat.start() chat loop         session ends on
                                                   → tool-call recursion (ReAct)       TERMINATE/interrupt/close
```

## 3. Creation / Configuration Layer

### 3.1 Workspace-level (Prisma `workspaces`)

| Column | Meaning |
|---|---|
| `agentProvider` / `agentModel` | LLM override for agent runs. Fallback chain: agentProvider → workspace chatProvider/chatModel → `process.env.LLM_PROVIDER` + per-provider `*_MODEL_PREF` env default. |
| `openAiPrompt` | Workspace system prompt → agent role base. |
| `chatMode` | `automatic` \| `chat` \| `query`. `automatic` + native tool-calling model ⇒ agent runs without `@agent` prefix. |
| `router_id` | Optional model-router assignment (`anythingllm-router` provider resolves per-prompt). |

### 3.2 System-level (`system_settings` key/value rows)

| Label | Meaning |
|---|---|
| `default_agent_skills` | JSON array — opt-in configurable built-ins enabled (web-browsing, create-chart, sql-agent, filesystem-agent, create-files-agent, gmail/outlook/gcal agents, ...). |
| `disabled_agent_skills` | JSON array — default-on built-ins turned OFF (of `rag-memory`, `document-summarizer`, `web-scraping`). |
| `disabled_filesystem_skills`, `disabled_create_files_skills`, `disabled_gmail_skills`, `disabled_outlook_skills`, `disabled_google_calendar_skills` | Per-integration sub-tool deny lists. |
| `gmail_agent_config`, `outlook_agent_config`, `google_calendar_agent_config` | Integration OAuth/config blobs. |
| `agent_search_provider` | Web search engine for `web-browsing`. |
| `agent_sql_connections` | Saved SQL connector list for `sql-agent`. |
| `agent_clarifying_questions_enabled`, `agent_clarifying_questions_max_per_turn` | Clarifying-question tool gate + per-turn cap (default 3). |
| `imported_agent_skills` | Virtual — computed from disk, not a DB row. |

### 3.3 On-disk capability stores (`$STORAGE_DIR/plugins/…`)

| Store | Path | Unit |
|---|---|---|
| Imported skills | `plugins/agent-skills/<hubId>/` | `plugin.json` + `handler.js` |
| Agent flows | `plugins/agent-flows/<uuid>.json` | flow JSON |
| MCP servers | `plugins/anythingllm_mcp_servers.json` | `{ mcpServers: { <name>: def } }` |

**Imported skill `plugin.json` schema:** `{ hubId, active, name, description, examples?, entrypoint: { params }, setup_args: { <key>: { required, value, default } } }`. `handler.js` must export `module.exports.runtime = { handler: async fn }`. No code sandboxing — handler is `require`d into the server process (require-cache busted per load). Import path guards: Zip-Slip check, `isWithin` path validation, forced `active:false` on import.

**Flow JSON schema:** `{ name, description, active, steps: [{ type, config }] }`. Server-supported block types (`FLOW_TYPES` whitelist enforced on save): `start` (variables → tool params), `apiCall`, `llmInstruction`, `webScraping`. Variable substitution syntax `${var.path[0].key}`.

**MCP server def:** stdio `{ command, args, env }` or http/sse `{ type, url, headers }` plus AnythingLLM extensions `anythingllm.autoStart` (bool) and `anythingllm.suppressedTools` (string[]).

### 3.4 Admin surfaces

- `frontend/src/pages/Admin/Agents` — skill toggles (default + configurable + app integrations), imported skill list/config, MCP server list, agent flows list.
- `frontend/src/pages/Admin/AgentBuilder` — visual flow builder (React-Flow style nodes).
- In-chat quick toggles: PromptInput ToolsMenu → AgentSkills tab.
- Endpoints: `/admin/system-preferences(-for)`, `/agent-flows/*`, `/mcp-servers/*`, `/experimental/agent-plugins/*`, `/agent-skills/whitelist/add`.

### 3.5 Active-tool resolution (session start)

`WORKSPACE_AGENT.getDefinition()` concatenates, in order:

1. `agentSkillsFromSystemSettings()` — DEFAULT_SKILLS (`rag-memory`, `document-summarizer`, `web-scraping`) minus `disabled_agent_skills`, plus `default_agent_skills`; multi-tool skills expand to `parent#child` names; availability-gated (filesystem/create-files/gmail/outlook) and sub-tool-filtered.
2. `request-user-input#request-user-input` — only if clarifying questions enabled.
3. `@@<hubId>` per active imported skill.
4. `@@flow_<uuid>` per active agent flow.
5. `@@mcp_<serverName>` per running MCP server (boots servers as side effect).

The result is a **list of string identifiers**, expanded to real functions by `#attachPlugins` (see §5.3).

## 4. Invocation Layer

### 4.1 Trigger detection

- `WorkspaceAgentInvocation.parseAgents(prompt)` — message must **start with** literal `@agent`.
- `grepAgents()` in the streaming chat path also triggers when `workspace.chatMode === "automatic"` AND `Workspace.supportsNativeToolCalling(workspace)` — agent mode without the prefix.

### 4.2 Websocket path (browser workspace chat)

1. `streamChatWithWorkspace` → `grepAgents` → creates `workspace_agent_invocations` row (`uuid`, `prompt`, `workspace_id`, `user_id?`, `thread_id?`, `closed:false`).
2. Attachments cached in-memory keyed by invocation uuid (bridges HTTP → WS process memory).
3. HTTP stream emits `{ type: "agentInitWebsocketConnection", websocketUUID }` then a closing `statusResponse`; HTTP stream ends.
4. Frontend opens `WS /api/agent-invocation/:uuid`; dispatches `AGENT_SESSION_START`.
5. Server WS handler: `new AgentHandler({ uuid }).init()` → validates invocation not closed → `createAIbitat({ socket })` → `startAgentCluster()`.
6. Inbound WS frames route to `handleFeedback` / `handleToolApproval` / `handleClarificationResponse`; bail commands (`exit /exit stop /stop halt /halt /reset`) → `aibitat.abort()` + close.
7. Socket close ⇒ invocation row `closed:true`; frontend dispatches `AGENT_SESSION_END`, reverts to normal chat.

Session guard = the `closed` flag (invocation UUID is single-use); no separate mutex.

### 4.3 Ephemeral path (no websocket)

`EphemeralAgentHandler extends AgentHandler` + `EphemeralEventListener` (EventEmitter mocking the socket interface). No DB invocation row. Used by:

| Surface | Notes |
|---|---|
| Developer API `/v1/workspace/:slug/chat` (+ thread chat) | Blocking: `waitForClose()` → `{thoughts, textResponse, outputs, metrics}`. Streaming: `streamAgentEvents(response, uuid)` maps socket events → HTTP chunks (`agentThought`, `textResponseChunk`, `textResponse`, `fileDownload`, `usageMetrics`). |
| Telegram bot | Tool approval via worker IPC (`telegramChatId`). |
| Scheduled jobs | Supports `toolOverrides` to pin the tool set. |
| Embed widget | **NOT supported** — `automatic` coerced to `chat`, no agent path. |

## 5. Runtime Harness & Agent Loop (AIbitat)

### 5.1 Harness construction

`AgentHandler.createAIbitat()`:

- `new AIbitat({ provider, model, chats: last 20 workspace chats, handlerProps })`.
- `use(websocket.plugin({...}))` (browser) or `use(httpSocket.plugin({...}))` (ephemeral) — installs `aibitat.socket.send`, `aibitat.introspect`, `requestToolApproval`, `requestUserClarification`, error/terminate/interrupt handlers.
- `use(chatHistory.plugin())` (browser only) — persistence.
- Register `USER` + `@agent` agent defs; expand and attach every tool plugin.
- Optional per-turn model router (`resolveRoute`) when workspace uses `anythingllm-router`.

AIbitat internals: three registries (`agents`, `channels`, `functions` Maps), an EventEmitter, flat `_chats` log of `{from, to, content, state}`. Config: `maxRounds` (default 100), `maxToolCalls` (env `AGENT_MAX_TOOL_CALLS`, default 10), `defaultInterrupt`.

### 5.2 Conversation loop

`start(message)` → `chat({ from, to })` recursion:

- **Direct path** (USER ⇄ @agent, the normal case): `reply(route)` produces one agent turn. Reply `"TERMINATE"` or max rounds ⇒ terminate. Reply `"INTERRUPT"` or target agent `interrupt:"ALWAYS"` ⇒ interrupt (hand control to user; websocket plugin asks for feedback). Otherwise auto-reply continues the ping-pong.
- **Group/channel path** (multi-agent, mostly unused in product): LLM-based next-speaker selection with a role-play prompt; per-channel `maxRounds`.
- `continue(feedback)` resumes after interrupt (user's next message injected). `retry()` re-runs a failed turn (manual only — **no automatic retry loop**; provider `RetryError`/`APIError` surface as `wssFailure` + terminate).

### 5.3 Single turn (`reply`)

1. Compose messages: `[{role:"system", content: agentRole}, ...history mapped to user/assistant]` (+ parsed file context appended to last user msg when present).
2. Resolve function configs from the agent's function-name list.
3. Optional **ToolReranker** — embedding-based top-N tool filtering when tool list is large.
4. Optional per-turn model routing.
5. Branch on `providerInstance.supportsAgentStreaming`: `handleAsyncExecution` (streaming) vs `handleExecution` (sync). Both wrap provider calls in `#safeProviderCall` → converts throws to `APIError`.

### 5.4 Tool-call loop (the ReAct core)

```
completion = provider.complete/stream(messages, functions)
if completion.functionCall:
    fn = functions.get(name)
    unknown fn  → inject 'Function "X" not found. Try again.' as role:"function" msg, recurse
    result = await fn.handler(args)              # ACTION
    emit toolCallResult; telemetry
    if aibitat.skipHandleExecution:              # directOutput tools (e.g. flows)
        return result verbatim (no more tool calls)
    messages += {role:"function", content: result, originalFunctionCall}   # OBSERVATION
    (+ image tool attachments as follow-up user msg)
    recurse(depth+1)                             # REASON again
else:
    emit usageMetrics, flush citations, emit chatId
    return completion.textResponse               # final answer
```

- **Ceiling:** `depth >= maxToolCalls` ⇒ current tool executes once more, then `functions=[]` forces a plain-text final answer.
- One `msgUUID` per turn correlates all stream events; tool-call chunks use `<msgUUID>:tool_call_invocation`.

### 5.5 Provider abstraction — two tool-calling strategies

- **Native (`helpers/tooled.js`)** — OpenAI/Anthropic always; capable others (probed or env-gated). Converts aibitat `role:"function"` history to `tool_calls`/`tool` messages; streams; returns first tool call. Providers may opt out via env `PROVIDER_DISABLE_NATIVE_TOOL_CALLING` (comma list of provider tags).
- **UnTooled (`helpers/untooled.js`)** — ReAct emulation for models without native tool calling. Prepends a tool-selection system prompt ("pick a single function… respond in JSON with keys `name`,`arguments` only… or reply plain text"), renders each tool with name/description/params/few-shot `examples`, then: `safeJsonParse` → strict validation (function exists, all required params, **no unknown params**) → `Deduplicator` guard (SHA of name+args; 30s cooldowns; MCP tools always cooldown) → return `{functionCall}` or treat as `{textResponse}`. `role:"function"` history is folded into adjacent messages (`cleanMsgs`) since such models can't see a function role.

~40 provider adapters; base class `Provider` (`ai-provider.js`) handles usage tracking (`prompt/completion tokens`, duration, TPS → `usageMetrics` events), multimodal attachment formatting, system-prompt composition (workspace prompt variables + user memories), context limits.

## 6. Capability System (Tools)

### 6.1 Plugin contract

```js
{ name, startupConfig: { params }, plugin: (callOpts) => ({
    name, setup(aibitat) {
      aibitat.function({
        super: aibitat, name, description, examples: [{prompt, call}],
        parameters: { type:"object", properties, additionalProperties:false },
        handler: async (args) => "string result",
      });
    }})}
```

Multi-tool skills export `plugin` as an **array** of sub-plugins, addressed `parent#child`.

### 6.2 Identifier prefix conventions (attach-time dispatch)

| Form | Source | Loader |
|---|---|---|
| `plain-slug` | built-in single | `AgentPlugins[name]` |
| `parent#child` | built-in multi-tool | `AgentPlugins[parent].plugin.find(child)` |
| `@@<hubId>` | imported skill | `ImportedPlugin.loadPluginByHubId` |
| `@@flow_<uuid>` | agent flow | `AgentFlows.loadFlowPlugin` (flow → one tool; params from start-block variables; `directOutput` support) |
| `@@mcp_<server>` | MCP server | `MCPCompatibilityLayer.convertServerToolsToPlugins` — one aibitat fn per MCP tool, named `<server>-<tool>`, proxied via `callTool` |

### 6.3 Built-in skill inventory

Always-on (unless disabled): `rag-memory` (vector search/store), `document-summarizer` (list/summarize workspace docs), `web-scraping`.
Opt-in: `web-browsing` (search provider from settings), `create-chart` (rechart), `sql-agent` (4 tools), `filesystem-agent` (10 tools), `create-files-agent` (5 generators: txt/pdf/docx/xlsx/pptx), `gmail-agent` (18), `outlook-agent` (10), `google-calendar-agent` (10), `request-user-input` (clarifying questions, gated by setting).
Infrastructure plugins (not LLM tools): `websocket`/`http-socket` (transport), `chat-history` (persistence), `file-history`, `cli` (debug).

## 7. Human-in-the-Loop

### 7.1 Tool approval

`aibitat.requestToolApproval({ skillName, payload, description })` resolution order:

1. Env auto-approve: `AGENT_AUTO_APPROVED_SKILLS` (comma list or `<all>`).
2. Per-user DB whitelist: `AgentSkillWhitelist.isWhitelisted(skillName, userId)` (added via approve-and-whitelist UI → `/agent-skills/whitelist/add`).
3. Interactive: send `toolApprovalRequest` frame, block until `toolApprovalResponse { requestId, approved }`; **120s timeout ⇒ fail closed (denied)**.

All write/side-effect tools call it (filesystem writes, file creation, email send, calendar mutation). Imported skills get it **force-injected** — bound after the handler-export spread so the skill's own code cannot override it; the `skillName` used for whitelisting is the manifest `name` from `plugin.json`. Ephemeral runs: Telegram uses worker IPC; otherwise auto-deny/auto-approve fallback per transport.

### 7.2 Clarifying questions

`request-user-input` tool → `aibitat.requestUserClarification({ questions, allowSkip })` → `clarificationRequest` frame → interactive card → `clarificationResponse`. Per-turn cap from settings (default 3), 120s timeout, surveys buffered and persisted with chat history. Enabled setting also appends a role-prompt mandate to use the tool.

## 8. Output & Persistence

### 8.1 Wire protocol (server → client)

Envelope `{ type, content }` (plus untyped raw agent messages `{from, to, content, state}`). Types:

| type | Meaning |
|---|---|
| `statusResponse` | Introspection/"thought" line (`aibitat.introspect`), `animate:true` |
| `reportStreamEvent` | Streaming container; inner types: `textResponseChunk`, `fullTextResponse`, `toolCallInvocation`, `usageMetrics`, `citations`, `chatId`, `modelRouteNotification`, `removeStatusResponse` |
| `fileDownloadCard` | Generated file card `{filename, storageFilename, fileSize}` |
| `rechartVisualize` | Chart payload `{type, dataset(JSON string), title}` |
| `toolApprovalRequest` / `clarificationRequest` | HITL cards |
| `wssFailure` | Error; terminates session |
| `rename_thread` | Thread auto-rename |
| `WAITING_ON_INPUT` | Legacy feedback prompt |

Client → server: `awaitingFeedback` (next user message + attachments), `toolApprovalResponse`, `clarificationResponse`, bail-command strings.

### 8.2 Frontend rendering

`handleSocketResponse` (frontend/src/utils/chat/agent.js) maps frames to chat-history message objects: statusResponse groups → expandable chain-of-thought `StatusResponse` component; `textResponseChunk` accumulates into a `textResponse` message; `rechartVisualize` → `Chartable`; `fileDownloadCard` → `FileDownloadCard` (downloads via storage endpoint); approval/clarification → interactive pending cards. `socket.supportsAgentStreaming` flips true on first `reportStreamEvent`.

### 8.3 Persistence (`workspace_chats`)

chat-history plugin: pre-registers a row (`include:false`) on the first USER message, upserts on agent reply:

```json
{ "prompt": "<user msg>",
  "response": { "text": "...", "sources": [citations], "type": "chat",
                "attachments": [], "metrics": {usage}, "outputs?": [...],
                "clarifyingQuestions?": [...] } }
```

Agent turns persist as `type:"chat"` (NOT a distinct "agent" type) so historical rendering is uniform. Special outputs override via `_replySpecialAttributes` (e.g. charts stored as `type:"rechartVisualize"` with the chart JSON as `text`). Generated files persist in `response.outputs[]` → `HistoricalOutputs` renders download cards on reload. `/reset`-abort sets `_aborted` and skips the save. Thread auto-rename still fires.

## 9. Failure & Bounds Summary

| Concern | Mechanism |
|---|---|
| Runaway tool loops | `maxToolCalls` recursion cap (env `AGENT_MAX_TOOL_CALLS`, default 10) → forced text answer |
| Runaway conversation | `maxRounds` (100 default; 10 per channel) → terminate |
| Duplicate tool spam (weak models) | `Deduplicator` SHA + cooldowns (UnTooled path); MCP tools always cooldown |
| Oversized tool list | `ToolReranker` embedding top-N |
| Provider failure | `RetryError`/`APIError` → `wssFailure` frame + terminate (no auto-retry) |
| Approval timeout | 120s → fail closed |
| Feedback timeout | 300s socket wait |
| Path traversal | `isWithin` / `isValidLocation` on filesystem + imported plugin paths |
| Zip Slip | Guarded entry extraction on skill import |
| Stale sessions | Invocation `closed` flag; WS close handler closes the row |

## 10. Env Vars

`AGENT_MAX_TOOL_CALLS`, `AGENT_AUTO_APPROVED_SKILLS`, `AGENT_SKILL_RERANKER_ENABLED` + `AGENT_SKILL_RERANKER_TOP_N` (tool reranker — env, not system settings; default topN 15), `PROVIDER_DISABLE_NATIVE_TOOL_CALLING`, `MCP_NO_COOLDOWN`, `ANTHROPIC_CACHE_CONTROL`, `LLM_PROVIDER` + per-provider `*_MODEL_PREF` (fallback model resolution), `STORAGE_DIR` (capability stores).

## 11. Reusing This Architecture (checklist for a similar feature)

To build a comparable "agent" feature elsewhere, replicate these seams:

1. **Composition over entity** — resolve agent = model config + tool-identifier list at session start; keep tools as string IDs with prefix conventions until attach time.
2. **Transport as plugin** — one interface (`socket.send`, `introspect`, `requestToolApproval`, `requestUserClarification`) with two impls (real websocket, HTTP event-listener mock) so the same loop serves browser, API, bots, cron.
3. **Two-tier tool calling** — native tool API when supported; JSON-selection prompt + strict validation + dedupe as fallback.
4. **Recursion-with-depth loop** — tool result re-injected as `role:"function"` message; depth cap forces terminal answer with empty tool list.
5. **HITL as awaitable promises over the transport** — approval/clarification block the tool handler, timeout fail-closed.
6. **Persistence plugin listening to the same event stream** — persist in the normal chat format so history rendering needs no special path.
