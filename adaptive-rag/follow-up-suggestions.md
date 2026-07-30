# Spec: Follow-Up Question Auto-Generation

Automatically generate 3–5 suggested follow-up questions after each assistant response. Suggestions are produced by a lightweight "task model" from recent conversation history and rendered as clickable chips under the assistant message. Clicking a chip sends it as the user's next message.

---

## 1. Architecture Overview

```
┌──────────┐  1. chat completion finishes   ┌──────────────┐
│ Frontend │ ─────────────────────────────► │   Backend    │
│ (React)  │                                │              │
│          │  2. POST /api/tasks/follow-up  │  build prompt│
│          │ ─────────────────────────────► │  from last 6 │
│          │                                │  messages    │
│          │                                │      │       │
│          │                                │      ▼       │
│          │  3. { follow_ups: [...] }      │  Task LLM    │
│          │ ◄───────────────────────────── │  (non-stream)│
│          │                                └──────────────┘
│ 4. render chips → click → send as user message
└──────────┘
```

Two integration styles — pick ONE:

- **A. Client-triggered (recommended, simpler):** frontend calls the follow-up endpoint after the assistant response stream completes.
- **B. Server-triggered:** backend fires follow-up generation as a post-completion background task and pushes results over the existing websocket/SSE channel (event `chat:message:follow_ups`). Use only if the app already has a server-push channel.

This spec details style A; style B differences are noted at the end.

---

## 2. Backend Spec

### 2.1 Endpoint

```
POST /api/tasks/follow-up
Authorization: Bearer <user token>
Content-Type: application/json
```

**Request body:**

```json
{
  "chat_id": "abc123",
  "message_id": "msg-9",
  "model": "gpt-4o",
  "messages": [
    { "role": "user", "content": "How do I center a div?" },
    { "role": "assistant", "content": "Use flexbox: ..." }
  ]
}
```

- `messages` is optional. If omitted, backend loads history from DB by `chat_id` (see 2.2). If present, backend uses it directly (avoids a DB read when client already has history).
- `model` = the model used in the main chat; backend may map it to a cheaper dedicated task model (see 2.4).

**Response 200:**

```json
{ "follow_ups": ["Question 1?", "Question 2?", "Question 3?"] }
```

**Response 200 when feature disabled:** `{ "follow_ups": [], "detail": "Follow-up generation is disabled" }` — return 200, not an error; the client silently renders nothing.

**Errors:** `401` unauthenticated, `404` unknown model, `400` LLM call failed (`{ "detail": "..." }`).

### 2.2 History Retrieval

If `messages` not supplied:

1. Load chat by `chat_id`, verify it belongs to the requesting user (403 otherwise).
2. Fetch messages ordered oldest → newest.
3. Keep only `role` ∈ {`user`, `assistant`} and non-empty `content`; strip attachments/tool calls to plain text.
4. Take the **last 6 messages** (window is a config value `FOLLOW_UP_HISTORY_WINDOW`, default 6).

### 2.3 Prompt Construction

Render history into the template. `{{MESSAGES:END:6}}` means: last 6 messages serialized as:

```
USER: <content>
ASSISTANT: <content>
USER: <content>
...
```

**Default prompt template (send as a single `user` message to the task model):**

```
### Task:
Suggest 3-5 relevant follow-up questions or prompts that the user might naturally ask next in this conversation as a **user**, based on the chat history, to help continue or deepen the discussion.
### Guidelines:
- Write all follow-up questions from the user's point of view, directed to the assistant.
- Make questions concise, clear, and directly related to the discussed topic(s).
- Only suggest follow-ups that make sense given the chat content and do not repeat what was already covered.
- If the conversation is very short or not specific, suggest more general (but relevant) follow-ups the user might ask.
- Use the conversation's primary language; default to English if multilingual.
- Response must be a JSON object with a "follow_ups" key containing an array of strings, no extra text or formatting.
### Output:
JSON format: { "follow_ups": ["Question 1?", "Question 2?", "Question 3?"] }
### Chat History:
<chat_history>
{{MESSAGES:END:6}}
</chat_history>
```

The template must be overridable via config (`FOLLOW_UP_PROMPT_TEMPLATE`); empty string → use default.

### 2.4 LLM Call

```json
{
  "model": "<task_model_id>",
  "messages": [{ "role": "user", "content": "<rendered template>" }],
  "stream": false,
  "temperature": 0.7,
  "max_tokens": 512
}
```

- **Task model resolution:** config `TASK_MODEL` (e.g. a small/cheap model). If unset, fall back to the chat's `model`. Never stream.
- If the provider supports JSON mode / `response_format: {"type": "json_object"}`, use it.

### 2.5 Response Parsing (must be robust)

LLM output may include prose or code fences around the JSON. Parse defensively:

```python
raw = response_text
raw = raw[raw.find("{") : raw.rfind("}") + 1]   # trim to outermost braces
try:
    follow_ups = json.loads(raw).get("follow_ups", [])
except Exception:
    follow_ups = []
follow_ups = [s.strip() for s in follow_ups if isinstance(s, str) and s.strip()][:5]
```

On any parse failure return `{ "follow_ups": [] }` with 200 — never surface a parse error to the user.

### 2.6 Persistence (optional but recommended)

Store `follow_ups` array on the assistant message record (`message.follow_ups`), so suggestions survive page reload without regeneration.

### 2.7 Config

| Key | Default | Meaning |
|---|---|---|
| `ENABLE_FOLLOW_UP_GENERATION` | `true` | Feature flag; expose to frontend via app-config endpoint |
| `FOLLOW_UP_PROMPT_TEMPLATE` | `""` | Custom template override |
| `FOLLOW_UP_HISTORY_WINDOW` | `6` | Messages included in prompt |
| `TASK_MODEL` | `""` | Cheap model for utility tasks |

---

## 3. Frontend Spec (React)

### 3.1 Components

```
<ChatMessage role="assistant">
  <MessageContent />
  <FollowUps
    followUps={message.followUps}       // string[] | undefined
    onSelect={(q) => sendMessage(q)}
  />
</ChatMessage>
```

**`FollowUps.tsx`** — pure presentational:

```tsx
type Props = { followUps?: string[]; onSelect: (q: string) => void };

export function FollowUps({ followUps, onSelect }: Props) {
  if (!followUps?.length) return null;
  return (
    <div className="followups" role="list" aria-label="Suggested follow-up questions">
      {followUps.map((q) => (
        <button key={q} role="listitem" className="followup-chip" onClick={() => onSelect(q)}>
          {q}
        </button>
      ))}
    </div>
  );
}
```

### 3.2 Trigger Flow

```
assistant stream ends (done event)
  └─► if config.enable_follow_up_generation && userSettings.showFollowUps:
        POST /api/tasks/follow-up  { chat_id, message_id, model, messages: last6 }
          ├─ success → setMessage(id, { followUps: res.follow_ups })
          └─ failure → ignore silently (no toast, no retry)
```

Rules:

- Fire **only for the latest assistant message**, only after the stream fully completes (not on partial chunks).
- Only ONE in-flight request; if user sends a new message before the response arrives, **abort** (AbortController) and discard.
- Do not regenerate on reload if `message.followUps` was persisted; render stored value.
- When user clicks a chip: call the same send-message path as typed input (chip text becomes the user message). All existing suggestions disappear (they belong to the previous turn).
- When user starts typing or a new response begins streaming, hide/ignore stale suggestions for previous turns — only the last assistant message shows chips.

### 3.3 API client

```ts
export async function generateFollowUps(
  token: string,
  body: { chat_id: string; message_id: string; model: string; messages?: Msg[] },
  signal?: AbortSignal
): Promise<string[]> {
  const res = await fetch("/api/tasks/follow-up", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok) return [];
  return (await res.json()).follow_ups ?? [];
}
```

### 3.4 UI / UX Spec

- **Placement:** below the assistant message body, above the message action bar (copy/regenerate).
- **Layout:** horizontal wrap (`display: flex; flex-wrap: wrap; gap: 8px`), each chip is a pill button.
- **Chip style:** rounded-full, 1px border in muted color, padding `6px 12px`, font-size 13–14px, text left-aligned, max-width 100% with normal wrapping (no ellipsis — full question must be readable).
- **Hover:** background shifts to subtle accent tint; cursor pointer.
- **Appear animation:** fade-in + 4px rise, 150ms ease-out, chips may stagger 30ms each. No layout jump: container appears only when data arrives.
- **Loading state:** none. Do NOT show a spinner while generating — suggestions appear when ready or never. (Silent enhancement, not blocking UI.)
- **Empty/error:** render nothing.
- **Dark mode:** border/hover colors from theme tokens.
- **Accessibility:** chips are real `<button>`s, keyboard focusable, visible focus ring; container `aria-label="Suggested follow-up questions"`.
- **User setting:** toggle "Show follow-up suggestions" in chat settings (default on), gated additionally by the server feature flag.

### 3.5 State Shape

```ts
interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  followUps?: string[];   // present only on assistant messages after generation
}
```

---

## 4. Mechanism — End-to-End Sequence

Complete operational mechanism, numbered. A coding agent should be able to implement the whole feature from this section alone.

```
User            Frontend                 Backend                    Task LLM
 │                 │                        │                          │
 │ sends message   │                        │                          │
 │────────────────►│ POST /chat (stream)    │                          │
 │                 │───────────────────────►│                          │
 │                 │◄── tokens stream ──────│                          │
 │                 │  [done]                │                          │
 │                 │                        │                          │
 │                 │ (T1) detect stream end │                          │
 │                 │ (T2) check flags       │                          │
 │                 │ (T3) POST /api/tasks/follow-up                    │
 │                 │───────────────────────►│ (S1) validate + flags    │
 │                 │                        │ (S2) get history         │
 │                 │                        │ (S3) render template     │
 │                 │                        │ (S4) call task model ───►│
 │                 │                        │◄──── raw completion ─────│
 │                 │                        │ (S5) extract+parse JSON  │
 │                 │                        │ (S6) persist on message  │
 │                 │◄── {follow_ups:[...]}──│                          │
 │                 │ (T4) staleness check   │                          │
 │ sees chips      │ (T5) render chips      │                          │
 │◄────────────────│                        │                          │
 │ clicks chip     │                        │                          │
 │────────────────►│ (T6) send chip text as new user message → cycle repeats
```

### 4.1 Frontend trigger mechanism (T1–T6)

- **T1 — completion detection.** The chat stream handler fires a single `onResponseComplete(messageId)` callback when the SSE/stream emits its final done event. Hook follow-up generation ONLY here — never on partial chunks, never on user-message send.
- **T2 — gate check.** Proceed only if `config.features.enable_follow_up_generation && userSettings.showFollowUps && message.followUps === undefined` (undefined = never generated; empty array = generated-but-none, don't retry).
- **T3 — request dispatch.** Build `messages` = last 6 turns from local state (or send `chat_id` only). Create an `AbortController`, store on a ref keyed by chat; any new user message or chat switch calls `.abort()`.
- **T4 — staleness guard.** On response arrival, verify the target `messageId` is still the newest assistant message of the active chat; otherwise discard silently.
- **T5 — render.** Patch message state `{ followUps }`; chips mount with fade-in. No re-render of message body (chips are a sibling component).
- **T6 — selection.** Chip click routes through the exact same `sendMessage(text)` path as the input box. Chips of that turn unmount immediately (new turn began ⇒ T4 rule hides them anyway).

### 4.2 Backend mechanism (S1–S6)

- **S1 — validation.** Auth → feature flag (disabled ⇒ 200 empty, cheap exit) → model exists.
- **S2 — history acquisition.** Priority: `messages` from body if present, else DB lookup by `chat_id` (ownership check). Normalize: keep user/assistant roles, plain-text content, last N=6.
- **S3 — prompt assembly.** Serialize history as `ROLE: content` lines; substitute into template (custom-or-default); result = one `user` message.
- **S4 — LLM invocation.** Resolve task model (config `TASK_MODEL` → fallback chat model). Non-streaming call, temperature 0.7, max_tokens 512, JSON mode if supported. Timeout 30s.
- **S5 — parse.** Trim to outermost `{...}`, `json.loads`, take `follow_ups` key, filter non-empty strings, cap at 5. Any failure ⇒ empty array, still 200.
- **S6 — persist.** Write array onto the assistant message record so reloads skip regeneration. Persist failure is non-fatal (log only).

### 4.3 Failure & race mechanics

| Scenario | Mechanism |
|---|---|
| User sends new message while generating | T3 abort fires; backend result (if any) dropped by T4 |
| LLM returns prose around JSON | S5 brace-trim recovers; else empty |
| LLM timeout / provider error | Backend 400; frontend swallows, no chips |
| Duplicate trigger (double done-event) | T2 `followUps === undefined` check makes it idempotent |
| Reload mid-generation | No persisted value ⇒ chips absent for that turn (acceptable; no client retry) |
| Chat switched during flight | T4 messageId/chat check discards result |

---

## 5. Style B (server-push) differences

- Backend runs follow-up generation as a fire-and-forget task after saving the completed assistant message.
- Result pushed as event: `{ "type": "chat:message:follow_ups", "data": { "message_id": "...", "follow_ups": [...] } }`.
- Frontend subscribes and patches the message by `message_id`. No client-side POST.
- Everything else (prompt, parsing, persistence, UI) identical.

---

## 6. Acceptance Criteria

1. After an assistant response completes, chips appear within a few seconds (when task model responds).
2. Clicking a chip sends its exact text as a new user message; chips of previous turns disappear.
3. Feature off (server flag or user setting) → zero network calls, no UI.
4. LLM returning malformed JSON → no chips, no error surfaced, no console spam.
5. Sending a new message while generation is in-flight cancels the request; stale chips never appear on the new turn.
6. Reload of a persisted chat shows stored suggestions without a new LLM call.
7. Double completion events never produce duplicate requests (idempotency via `followUps === undefined` gate).
