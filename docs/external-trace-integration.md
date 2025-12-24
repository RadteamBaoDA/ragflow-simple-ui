# External Trace and Feedback API Integration

This document explains how to integrate with the External Trace API to submit chat logs to Langfuse and how to submit user feedback for those traces.

## Overview

The External Trace API allows external applications to submit chat messages, LLM responses, and metadata to be recorded as traces in Langfuse. This enables observability for external chat interfaces.

Additionally, it provides an endpoint to submit user feedback (scores) for these traces, which is useful for evaluation and monitoring quality.

## Authentication

All requests must be authenticated using an API key. The API key should be included in the request headers.

- **Header Name:** `x-api-key` or `Authorization: Bearer <your-api-key>`

---

## 1. Trace API

**Endpoint:** `POST /api/external/trace`

### Request Body

The request body should be a JSON object with the following fields:

| Field | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `email` | string | Yes | The user's email address. Must correspond to a registered user in the system. |
| `message` | string | Yes | The content of the user message or prompt. |
| `role` | string | No | The role of the message sender (`user` or `assistant`). Defaults to `user`. |
| `response` | string | No | The content of the LLM response (typically used when role is `assistant` or for request/response pairs). |
| `metadata` | object | No | Additional metadata about the trace. |

#### Metadata Object

| Field | Type | Description |
| :--- | :--- | :--- |
| `sessionId` | string | Session ID from the external system. Useful for grouping traces into a conversation. |
| `chatId` | string | Chat/conversation ID. |
| `source` | string | Source system identifier (e.g., "slack-bot", "web-widget"). |
| `model` | string | Model ID used for generation. |
| `tags` | string[] | Array of tags for filtering in Langfuse. |
| `usage` | object | Token usage information (`promptTokens`, `completionTokens`, `totalTokens`). |

### Response

**Success (200 OK):**

```json
{
  "success": true,
  "traceId": "trace-a1b2c3d4e5f6..."
}
```

The `traceId` returned in the response is crucial for submitting user feedback.

---

## 2. Feedback API

**Endpoint:** `POST /api/external/trace/feedback`

This endpoint allows you to attach a score (feedback) to an existing trace.

### Request Body

The request body should be a JSON object with the following fields:

| Field | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `email` | string | Yes | The user's email address. Must correspond to a registered user in the system. |
| `traceId` | string | Yes | The Langfuse trace ID to associate the feedback with (returned from the Trace API). |
| `value` | number | Yes | The score value (e.g., 1 for thumbs up, 0 for thumbs down, or 1-5 for star ratings). |
| `name` | string | No | The name of the feedback/score (default: "user-feedback"). |
| `comment` | string | No | Optional text comment provided by the user. |

### Response

**Success (200 OK):**

```json
{
  "success": true
}
```

---

## Example Workflow (JavaScript/TypeScript)

```javascript
const API_BASE = 'https://your-api-domain.com/api/external/trace';
const API_KEY = 'your-secret-api-key';

// 1. Submit a trace
const submitTrace = async (email, message, response) => {
  const res = await fetch(API_BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': API_KEY },
    body: JSON.stringify({
      email,
      message,
      metadata: { source: 'my-app' }
    })
  });
  return res.json();
};

// 2. Submit feedback for that trace
const submitFeedback = async (email, traceId, score, comment) => {
  const res = await fetch(`${API_BASE}/feedback`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': API_KEY },
    body: JSON.stringify({
      email,
      traceId,
      value: score,
      comment
    })
  });
  return res.json();
};

// Usage
const run = async () => {
  const traceResult = await submitTrace('user@example.com', 'Hello AI', 'Hi there!');
  if (traceResult.success) {
    console.log('Trace created:', traceResult.traceId);

    // Later, if user likes the response:
    await submitFeedback('user@example.com', traceResult.traceId, 1, 'Great response!');
    console.log('Feedback submitted');
  }
};
run();
```

## Error Handling

Both endpoints return standard HTTP error codes:

*   **400 Bad Request:** Missing or invalid parameters.
*   **401 Unauthorized:** Invalid or missing API key.
*   **403 Forbidden:** Email not registered in the system.
*   **500 Internal Server Error:** Server-side processing error.

```json
{
  "success": false,
  "error": "Error message description"
}
```
