# Workflow 05: Tool Approval And Whitelist

## Goal

Require user approval for sensitive tool actions and remember approved skills when requested.

## Key Files

- `server/utils/agents/aibitat/plugins/websocket.js`
- `server/utils/agents/aibitat/plugins/http-socket.js`
- `server/models/agentSkillWhitelist.js`
- `server/endpoints/agentSkillWhitelist.js`
- `server/utils/helpers/agents.js`
- `server/utils/agents/imported.js`
- `frontend/src/components/WorkspaceChat/ChatContainer/ChatHistory/ToolApprovalRequest/index.jsx`
- `frontend/src/models/agentSkillWhitelist.js`

## Approval API In AIbitat

The communication plugin adds:

```js
aibitat.requestToolApproval({
  skillName,
  payload,
  description
})
```

Tool handlers call this before performing risky actions. The function returns:

```json
{
  "approved": true,
  "message": "User approved the tool execution."
}
```

## Browser Approval Flow

1. A tool calls `aibitat.requestToolApproval`.
2. The websocket plugin checks global auto-approval with `skillIsAutoApproved`.
3. It checks `AgentSkillWhitelist.isWhitelisted(skillName, userId)`.
4. If neither applies, it creates a `requestId`.
5. It sends:

   ```json
   {
     "type": "toolApprovalRequest",
     "requestId": "...",
     "skillName": "...",
     "payload": {},
     "description": "...",
     "timeoutMs": 120000
   }
   ```

6. Frontend renders `ToolApprovalRequest`.
7. User approves or rejects.
8. Frontend sends:

   ```json
   {
     "type": "toolApprovalResponse",
     "requestId": "...",
     "approved": true
   }
   ```

9. The websocket plugin resolves the pending promise.
10. If the timeout expires, approval resolves as rejected.

## Always Allow

If the user approves and checks "Always allow", the frontend calls:

```text
POST /api/agent-skills/whitelist/add
```

Body:

```json
{ "skillName": "skill-name" }
```

In multi-user mode, the whitelist is stored as:

```text
user_<userId>_whitelisted_agent_skills
```

In single-user mode, it is stored as:

```text
whitelisted_agent_skills
```

Both are JSON arrays in `system_settings`.

## Global Auto-Approval

`AGENT_AUTO_APPROVED_SKILLS` can contain comma-separated skill names. If it contains `<all>`, all skills are auto-approved.

This applies globally and should be treated as an admin-level trust setting.

## Telegram And HTTP Contexts

`httpSocket` still resolves `skillIsAutoApproved` and the global whitelist (`isWhitelisted(skillName, null)`) first. Interactive approval is supported only when `telegramChatId` and worker IPC are available: the request is relayed to the parent `TelegramBotService` process over IPC and answered via a Telegram inline keyboard, with the same `requestId` matching and 120s fail-closed timeout. Otherwise it denies approval for safety.

Built-in write tools guard their approval call with `if (this.super.requestToolApproval)`, so contexts without an approval function (e.g. scheduled jobs) fall through as approved. Imported skills get `requestToolApproval` injected by `ImportedPlugin.createToolApprovalFn` after the skill's own runtime exports are spread, so a skill cannot override it or spoof another skill's name; it likewise returns approved when no approval function exists on the runtime.

## Rebuild Checklist

- Add an async approval function to the runtime object.
- Resolve immediately for global auto-approval and whitelists.
- Send a structured approval request over the active transport.
- Match responses by `requestId`.
- Time out and fail closed.
- Persist whitelists per user in multi-user mode and globally in single-user mode.
