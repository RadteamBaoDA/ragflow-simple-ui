# External Trace API Integration

This document outlines the API specification for integrating external chat interfaces with the Knowledge Base backend's tracing and feedback system (powered by Langfuse).

## Base URL
`/api/external/trace`

## Authentication
Ensure the backend is configured with `EXTERNAL_TRACE_ENABLED=true`.
(Note: Currently, no specific API key header is enforced by the middleware, but network-level security or future API key integration is recommended).

---

## 1. Submit Chat Trace
Records a chat message (user or assistant) to the observability system.

**Endpoint:** `POST /submit`
**Content-Type:** `application/json`

### Request Body
| Field | Type | Required | Description |
|---|---|---|---|
| `email` | string | Yes | User email (must exist in the system for validation). |
| `message` | string | Yes | The content of the message. |
| `ipAddress` | string | Yes | Client IP address (for rate limiting/logging). |
| `role` | string | No | `user` or `assistant` (default: `user`). |
| `response` | string | No | If capturing an LLM generation, the output text. |
| `metadata` | object | No | Additional context (e.g., `chatId`, `sessionId`, `model`, `tags`). |

#### Metadata Fields (Recommended)
- `chatId` or `sessionId`: Unique identifier for the conversation.
- `source`: Origin of the chat (e.g., "slack-bot", "web-widget").
- `tags`: Array of strings for categorization.

### Response
```json
{
  "success": true,
  "traceId": "trace-12345-abcde",
  "error": null
}
```

---

## 2. Submit User Feedback
Records user feedback (score/comment) for a specific trace or message.

**Endpoint:** `POST /feedback`
**Content-Type:** `application/json`

### Request Body
| Field | Type | Required | Description |
|---|---|---|---|
| `traceId` | string | Yes* | The Trace ID returned from `/submit`. (*`messageId` also accepted). |
| `value` | number | Yes* | Score value (e.g., 1 for like, 0 for dislike). (*`score` also accepted). |
| `comment` | string | No | Optional text feedback. |

### Example Request
```json
{
  "traceId": "trace-12345-abcde",
  "value": 1,
  "comment": "Helpful answer!"
}
```

### Response
```json
{
  "success": true
}
```
