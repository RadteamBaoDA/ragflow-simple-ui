# Spec: Chat Input Autocomplete (Ghost Text)

Inline AI autocompletion for the chat input box. When the user pauses typing, the current draft (plus recent chat history for context) is sent to a lightweight "task model" which predicts the continuation. The prediction renders as dimmed "ghost text" after the caret; **Tab** accepts it, any other input dismisses it.

---

## 1. Architecture Overview

```
┌──────────────────────────┐
│ Chat input (React)       │
│  user types … pauses     │
│  (debounce ~1000ms,      │
│   caret at end of text)  │
└─────────┬────────────────┘
          │ POST /api/tasks/autocomplete { prompt, messages, type }
          ▼
┌──────────────────────────┐
│ Backend                  │
│  guard: enabled? length? │
│  build prompt (template  │
│  + last 6 msgs + draft)  │
│  → task LLM (non-stream) │
│  parse { "text": "..." } │
└─────────┬────────────────┘
          │ { "text": " continuation" }
          ▼
   render ghost text after caret
   Tab = accept · type/Esc/blur = dismiss
```

---

## 2. Backend Spec

### 2.1 Endpoint

```
POST /api/tasks/autocomplete
Authorization: Bearer <user token>
Content-Type: application/json
```

**Request body:**

```json
{
  "model": "gpt-4o",
  "prompt": "How do I center a div in",
  "type": "General",
  "messages": [
    { "role": "user", "content": "..." },
    { "role": "assistant", "content": "..." }
  ]
}
```

- `prompt` — the user's current draft text (required, non-empty).
- `type` — completion mode: `"General"` (chat input) or `"Search Query"` (search boxes). Extensible enum.
- `messages` — optional recent chat history for context (client sends last messages of the active chat; empty/omitted for a fresh chat).
- `model` — active chat model; backend maps to task model (see 2.4).

**Response 200:**

```json
{ "text": " a flexbox container?" }
```

`text` is the raw continuation — exactly what should be appended at the caret (leading space included when needed). Empty string means "no suggestion".

**Feature disabled:** 200 `{ "text": "", "detail": "Autocomplete generation is disabled" }`.

**Errors:**
- `400` if `len(prompt) > AUTOCOMPLETE_INPUT_MAX_LENGTH` (when limit > 0): `{ "detail": "Input prompt exceeds max length of N" }`.
- `401` unauthenticated, `404` unknown model, `400` LLM failure.

### 2.2 Guards (in order)

1. `ENABLE_AUTOCOMPLETE_GENERATION` off → return disabled response.
2. `prompt` empty/whitespace → `{ "text": "" }` (no LLM call).
3. `AUTOCOMPLETE_INPUT_MAX_LENGTH > 0 and len(prompt) > limit` → 400. (Limit exists to cap token cost; `-1` = unlimited.)

### 2.3 Prompt Construction

History serialization: last 6 `user`/`assistant` messages as `ROLE: content` lines (same helper as follow-up spec). Substitute `{{MESSAGES:END:6}}`, `{{TYPE}}`, `{{PROMPT}}` into the template; send the rendered result as a single `user` message.

**Default prompt template:**

```
### Task:
You are an autocompletion system. Continue the text in `<text>` based on the **completion type** in `<type>` and the given language.

### **Instructions**:
1. Analyze `<text>` for context and meaning.
2. Use `<type>` to guide your output:
   - **General**: Provide a natural, concise continuation.
   - **Search Query**: Complete as if generating a realistic search query.
3. Start as if you are directly continuing `<text>`. Do **not** repeat, paraphrase, or respond as a model. Simply complete the text.
4. Ensure the continuation:
   - Flows naturally from `<text>`.
   - Avoids repetition, overexplaining, or unrelated ideas.
5. If unsure, return: `{ "text": "" }`.

### **Output Rules**:
- Respond only in JSON format: `{ "text": "<your_completion>" }`.

### **Examples**:
#### Example 1:
Input:
<type>General</type>
<text>The sun was setting over the horizon, painting the sky</text>
Output:
{ "text": "with vibrant shades of orange and pink." }

#### Example 2:
Input:
<type>Search Query</type>
<text>Top-rated restaurants in</text>
Output:
{ "text": "New York City for Italian cuisine." }

---
### Context:
<chat_history>
{{MESSAGES:END:6}}
</chat_history>
<type>{{TYPE}}</type>
<text>{{PROMPT}}</text>
#### Output:
```

Template overridable via config `AUTOCOMPLETE_PROMPT_TEMPLATE`; empty → default.

### 2.4 LLM Call

```json
{
  "model": "<task_model_id>",
  "messages": [{ "role": "user", "content": "<rendered template>" }],
  "stream": false,
  "temperature": 0.3,
  "max_tokens": 60
}
```

- Task model: config `TASK_MODEL`, fallback to request `model`. **Must be a fast, cheap model** — this endpoint fires on every typing pause.
- Low `max_tokens` (suggestions are short) and low temperature (predictable continuations).
- Use provider JSON mode if available.

### 2.5 Response Parsing

```python
raw = response_text
raw = raw[raw.find("{") : raw.rfind("}") + 1]
try:
    text = json.loads(raw).get("text", "")
except Exception:
    text = ""
if not isinstance(text, str):
    text = ""
return {"text": text}
```

Never error on parse failure — return empty text.

### 2.6 Config

| Key | Default | Meaning |
|---|---|---|
| `ENABLE_AUTOCOMPLETE_GENERATION` | `false` | Feature flag (default OFF — costs tokens per keystroke pause); expose to frontend via app-config endpoint |
| `AUTOCOMPLETE_INPUT_MAX_LENGTH` | `-1` | Max draft length sent to LLM; `-1` unlimited |
| `AUTOCOMPLETE_PROMPT_TEMPLATE` | `""` | Custom template override |
| `TASK_MODEL` | `""` | Cheap model for utility tasks |

---

## 3. Frontend Spec (React)

### 3.1 Behavior State Machine

```
IDLE ──(input change, caret at end, text non-empty)──► DEBOUNCING (1000ms)
DEBOUNCING ──(more input)──► DEBOUNCING (timer reset)
DEBOUNCING ──(timer fires)──► LOADING (POST /api/tasks/autocomplete, abortable)
LOADING ──(more input)──► abort → DEBOUNCING
LOADING ──(response.text non-empty AND draft unchanged)──► SUGGESTING
LOADING ──(empty/error)──► IDLE
SUGGESTING ──(Tab)──► accept: append text, caret to end → IDLE
SUGGESTING ──(any typing / Esc / blur / caret move / send)──► dismiss → IDLE
```

Hard rules:

- **Debounce 1000ms** after last keystroke (configurable constant).
- Trigger **only when caret is at the very end** of the input — never suggest mid-text.
- Trigger only when draft is non-empty and not only whitespace.
- **One in-flight request max**; new keystroke aborts it (AbortController).
- **Staleness check:** when the response arrives, compare against the draft captured at request time; if the draft changed, discard.
- Never trigger during IME composition (`compositionstart`/`compositionend` guard) — critical for CJK input.
- Sending the message clears any pending timer/request/suggestion.

### 3.2 Hook

```ts
function useAutocomplete(opts: {
  enabled: boolean;                       // serverFlag && userSetting
  getContext: () => { model: string; messages: Msg[] };
  debounceMs?: number;                    // default 1000
}) {
  const [suggestion, setSuggestion] = useState("");
  const abortRef = useRef<AbortController>();
  const timerRef = useRef<number>();

  const onInput = (text: string, caretAtEnd: boolean) => {
    setSuggestion("");
    abortRef.current?.abort();
    clearTimeout(timerRef.current);
    if (!opts.enabled || !caretAtEnd || !text.trim()) return;

    timerRef.current = window.setTimeout(async () => {
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      const { model, messages } = opts.getContext();
      try {
        const res = await fetch("/api/tasks/autocomplete", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ model, prompt: text, type: "General", messages }),
          signal: ctrl.signal,
        });
        if (!res.ok) return;
        const { text: completion } = await res.json();
        // staleness: only show if draft is still exactly `text`
        if (completion?.trim() && currentDraft() === text) setSuggestion(completion);
      } catch { /* aborted or network — ignore */ }
    }, opts.debounceMs ?? 1000);
  };

  const accept = () => { /* append suggestion to draft, caret to end */ setSuggestion(""); };
  const dismiss = () => setSuggestion("");
  return { suggestion, onInput, accept, dismiss };
}
```

### 3.3 Ghost Text Rendering

Two options depending on the input widget:

**A. Plain `<textarea>` — overlay technique:**

- Wrap textarea in `position: relative` container.
- Behind/over it, an absolutely-positioned, `pointer-events: none` mirror `<div>` with **identical** font, size, line-height, padding, `white-space: pre-wrap`, `word-break`.
- Mirror content: `<span style="visibility:hidden">{draft}</span><span class="ghost">{suggestion}</span>` — the hidden span positions the ghost exactly after the caret.
- Sync mirror scrollTop with textarea scroll.

**B. ContentEditable / rich-text editor (ProseMirror, Lexical, Slate):**

- Insert suggestion as a decoration / inline node marked `data-suggestion="true"`, styled as ghost, excluded from the serialized value.
- On accept, convert decoration to real text; on dismiss, remove it.

**Ghost style:** `color: gray-400/gray-500 (theme token); user-select: none;` same font as input. No underline, no background.

### 3.4 Keyboard Handling

| Key | With suggestion visible | Effect |
|---|---|---|
| `Tab` | yes | `preventDefault()`; accept suggestion (append, caret to end) |
| `Esc` | yes | dismiss |
| `Enter` | yes | dismiss suggestion, send only typed draft (ghost text is never sent) |
| any character | yes | dismiss, restart debounce cycle |
| `Tab` | no | default behavior (focus move) |

Mobile: no Tab key — render a small tappable "↹ accept" affordance at the end of ghost text, or support swipe-right to accept. Minimum: feature silently degrades (suggestion shows, typing over it dismisses).

### 3.5 UI / UX Rules

- **No loading indicator** anywhere — autocomplete is invisible until a suggestion exists.
- Suggestion appears instantly on arrival (no animation, or ≤100ms fade — must feel typed-ahead, not popped-in).
- Errors are always silent: no toasts, no retries, no console errors for aborts.
- **First-use hint (optional):** first time a suggestion appears, show a one-time tooltip "Press Tab to accept"; persist dismissal in localStorage.
- **User setting:** "Prompt autocomplete" toggle in settings, **default off**; effective only when server flag is also on.
- Accessibility: announce suggestion via visually-hidden `aria-live="polite"` region ("Suggestion: … Press Tab to accept"); ghost span itself `aria-hidden="true"`.

### 3.6 Cost / Rate Safeguards (client-side)

- Debounce is the primary throttle; additionally skip the call if the draft is identical to the last requested prompt (user paused twice without typing).
- Skip when draft length exceeds the server's max-length config (read from app config) — avoid a guaranteed 400.

---

## 4. Mechanism — End-to-End Sequence

Complete operational mechanism, numbered. Implementable from this section alone.

```
User               Frontend                     Backend              Task LLM
 │ types "How do"     │                            │                     │
 │───────────────────►│ (T1) input event           │                     │
 │                    │ (T2) reset debounce 1000ms │                     │
 │ types " I cent"    │                            │                     │
 │───────────────────►│ (T2) reset debounce again  │                     │
 │ ...pauses 1s...    │                            │                     │
 │                    │ (T3) timer fires: guards   │                     │
 │                    │ (T4) POST /api/tasks/autocomplete                │
 │                    │───────────────────────────►│ (S1) guards         │
 │                    │                            │ (S2) build prompt   │
 │                    │                            │ (S3) call LLM ─────►│
 │                    │                            │◄─── raw json ───────│
 │                    │                            │ (S4) parse {text}   │
 │                    │◄── { text: "er a div?" }───│                     │
 │                    │ (T5) staleness check       │                     │
 │ sees ghost text    │ (T6) render ghost after caret                    │
 │◄───────────────────│                            │                     │
 │ presses Tab        │                            │                     │
 │───────────────────►│ (T7) accept: ghost → real text, caret to end     │
 │  — or types more → │ (T8) dismiss ghost, back to T2                   │
```

### 4.1 Frontend trigger mechanism (T1–T8)

- **T1 — input capture.** Every editor change event routes through one handler receiving `(text, caretAtEnd)`. Also clears any visible ghost immediately (ghost never coexists with fresh typing).
- **T2 — debounce.** `clearTimeout` + `setTimeout(1000ms)` on every event. Abort any in-flight fetch at the same moment — at most one request alive.
- **T3 — guard chain at timer fire.** Skip silently if any fails: feature enabled (server flag && user toggle) · caret at end of text · text non-empty after trim · not inside IME composition · text !== last requested prompt (dedup) · text length ≤ server max length (from app config).
- **T4 — dispatch.** Snapshot `promptAtRequest = text`. Send `{ model, prompt, type: "General", messages: last6 }` with fresh `AbortController`.
- **T5 — staleness check.** On arrival: if `currentDraft !== promptAtRequest` or response `text` empty ⇒ discard. Aborted fetch ⇒ swallow exception.
- **T6 — ghost render.** Suggestion stored OUTSIDE the input's value (React state / editor decoration). Rendered dimmed after caret via mirror-overlay (textarea) or decoration node (rich editor). `aria-live=polite` announces it.
- **T7 — accept (Tab).** `preventDefault()`; append suggestion verbatim to value; caret to end; clear suggestion; do NOT immediately re-trigger (require next real keystroke to restart cycle).
- **T8 — dismiss.** Any character key, Esc, blur, caret move, or send clears the ghost. Enter sends typed text only — ghost is never part of the submitted value.

### 4.2 Backend mechanism (S1–S4)

- **S1 — guard chain.** Auth → feature flag (off ⇒ 200 `{text:""}` cheap exit) → prompt non-empty (else `{text:""}`, no LLM call) → length ≤ max (else 400) → model exists.
- **S2 — prompt assembly.** Serialize last 6 history messages as `ROLE: content`; substitute `{{MESSAGES:END:6}}`, `{{TYPE}}`, `{{PROMPT}}` into custom-or-default template; single `user` message.
- **S3 — LLM invocation.** Task model (config → fallback request model). Non-stream, temperature 0.3, max_tokens 60, JSON mode if available. Timeout 10s (short — suggestion older than that is useless).
- **S4 — parse.** Trim to outermost `{...}`, parse, take `text` string; any failure or non-string ⇒ `{"text": ""}`, always 200.

### 4.3 Failure & race mechanics

| Scenario | Mechanism |
|---|---|
| Keystroke during flight | T2 aborts fetch; T5 would also discard via prompt mismatch |
| Response after draft changed (slow LLM) | T5 snapshot comparison discards |
| Two pauses, same text | T3 dedup check — no second request |
| CJK IME composing | T3 composition guard — no request mid-composition |
| Model returns prose / bad JSON | S4 ⇒ empty text; T5 discards; nothing renders |
| LLM timeout | S3 10s cap → 400; frontend swallows |
| Caret moved to middle | T3 caret guard — no request; existing ghost dismissed by T8 |
| Tab with no ghost | Default browser behavior untouched |
| Send pressed | T8 clears timer, aborts, dismisses; submitted value = typed text only |

---

## 5. Acceptance Criteria

1. Pause ≥1s with caret at end of non-empty draft → one POST fires; continued typing before 1s fires nothing.
2. Suggestion renders as gray ghost text exactly after the caret; input's real value is unchanged.
3. Tab inserts the suggestion verbatim (including its leading space) and moves caret to end; suggestion never doubles the typed text.
4. Typing, Esc, blur, or caret movement dismisses the ghost; Enter sends only the typed text.
5. Rapid typing bursts: earlier in-flight requests are aborted; a stale response never overwrites a newer draft.
6. CJK IME composition never triggers requests mid-composition.
7. Feature off (server flag or user toggle) → zero network calls.
8. Backend returns `{ "text": "" }` on parse failure/uncertainty; UI shows nothing.
9. Draft over max length → client skips call (no 400 spam).
10. Two consecutive pauses with unchanged text → only one request (dedup guard).
11. Accepting via Tab does not immediately fire a new request; next keystroke restarts the cycle.
