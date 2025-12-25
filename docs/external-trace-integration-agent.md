# Agent Specification: External Trace Client Implementation

**Goal:** Implement a client to send chat logs and user feedback to the Knowledge Base External Trace API.

## 1. Trace Submission (`POST /api/external/trace/submit`)

**When to call:**
- Immediately after a user sends a message.
- Immediately after the assistant (LLM) generates a response.

**Input Payload:**
```json
{
  "email": "user@example.com",     // REQUIRED: Valid system user email
  "message": "User input text",    // REQUIRED
  "ipAddress": "127.0.0.1",        // REQUIRED
  "role": "user",                  // "user" or "assistant"
  "response": "LLM output",        // REQUIRED if role="assistant"
  "metadata": {
    "chatId": "unique-session-id", // REQUIRED for threading
    "source": "my-client-app"
  }
}
```

**Handling Response:**
- Capture `traceId` from the JSON response: `{ "success": true, "traceId": "..." }`.
- Store `traceId` associated with the specific message in your UI/State.

## 2. Feedback Submission (`POST /api/external/trace/feedback`)

**When to call:**
- When a user clicks "Like", "Dislike", or provides a rating.

**Input Payload:**
```json
{
  "traceId": "stored-trace-id",    // REQUIRED: The ID from the Submit response
  "value": 1,                      // 1 = Positive, 0 = Negative (or custom scale)
  "comment": "Optional text"       // Optional
}
```

**Implementation Logic:**
1. User sends message -> Call `/submit` (role=user).
2. LLM responds -> Call `/submit` (role=assistant) -> **Save `traceId`**.
3. Render "Like/Dislike" buttons on the assistant message.
4. User clicks "Like" -> Call `/feedback` with saved `traceId` and `value: 1`.
