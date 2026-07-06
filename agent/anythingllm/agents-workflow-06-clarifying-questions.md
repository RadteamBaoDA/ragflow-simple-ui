# Workflow 06: Clarifying Questions

## Goal

Let the agent collect missing information through structured UI instead of asking plain text questions.

## Key Files

- `server/utils/agents/defaults.js`
- `server/utils/agents/aibitat/plugins/request-user-input.js`
- `server/utils/agents/aibitat/plugins/websocket.js`
- `frontend/src/components/WorkspaceChat/ChatContainer/ChatHistory/ClarifyingQuestion`
- `frontend/src/utils/chat/agent.js`
- `frontend/src/pages/Admin/Agents/AgentSkillSettings/AgentClarifyingQuestions.jsx`

## Enablement

`clarifyingQuestionsSkillIfEnabled` checks:

```text
agent_clarifying_questions_enabled == "true"
```

When enabled, it adds child tools from `request-user-input` using `parent#child` identifiers.

The workspace agent role is also appended with an instruction:

```text
When you need information from the user ... you MUST use the request-user-input tool.
```

## Runtime API

The websocket plugin adds:

```js
aibitat.requestUserClarification({
  questions,
  allowSkip,
  timeoutMs
})
```

Question shape is determined by the request-user-input tools. The frontend supports:

- `kind: "input"`
- `kind: "choice"`

Choice questions support single-select and multi-select behavior.

## Browser Flow

1. Model calls a request-user-input sub-tool.
2. The tool calls `aibitat.requestUserClarification`.
3. The websocket plugin sends:

   ```json
   {
     "type": "clarificationRequest",
     "requestId": "...",
     "questions": [],
     "allowSkip": true,
     "timeoutMs": 120000
   }
   ```

4. Frontend `handleSocketResponse` creates a `clarifyingQuestion` chat item.
5. `ClarifyingQuestionCard` renders a paginated survey.
6. User submits, skips, or times out.
7. Frontend sends:

   ```json
   {
     "type": "clarificationResponse",
     "requestId": "...",
     "skipped": false,
     "answers": []
   }
   ```

8. The websocket plugin resolves with normalized answers.
9. The tool returns the answers to the model.
10. AIbitat continues the tool loop.

## Persistence

Completed surveys are buffered in:

```js
aibitat._pendingClarifyingQuestionSurveys
```

`chat-history` persists them under:

```json
{
  "clarifyingQuestions": []
}
```

Historical chat rendering can then show the same survey results in read-only mode.

## Timeout Behavior

Default timeout is 120 seconds. On timeout, answers are normalized as skipped values so the tool can continue gracefully.

## Rebuild Checklist

- Gate the skill behind an admin setting.
- Add a role instruction so the model uses the tool instead of asking in plain text.
- Send structured question batches over the websocket.
- Render the card as an assistant chat item.
- Match responses by `requestId`.
- Persist completed surveys in the final chat response JSON.
