# External Trace API Integration

This document explains how to integrate with the External Trace API to submit chat logs and traces to Langfuse.

## Overview

The External Trace API allows external applications to submit chat messages, LLM responses, and metadata to be recorded as traces in Langfuse. This enables observability for external chat interfaces.

## Authentication

All requests must be authenticated using an API key. The API key should be included in the request headers.

- **Header Name:** `x-api-key` or `Authorization: Bearer <your-api-key>`

## Endpoint

**POST** `/api/external/trace`

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

### Example Request (JavaScript/TypeScript)

```javascript
const submitTrace = async (email, message, response) => {
  const response = await fetch('https://your-api-domain.com/api/external/trace', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': 'your-secret-api-key'
    },
    body: JSON.stringify({
      email: email,
      message: message,
      role: 'user',
      response: response, // Optional: if you want to log the response immediately
      metadata: {
        source: 'my-custom-app',
        sessionId: 'session-123'
      }
    })
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || 'Failed to submit trace');
  }

  return response.json();
};

// Usage
const result = await submitTrace('user@example.com', 'Hello AI', 'Hi there!');
console.log('Trace ID:', result.traceId);
```

### Example Request (cURL)

```bash
curl -X POST https://your-api-domain.com/api/external/trace \
  -H "Content-Type: application/json" \
  -H "x-api-key: your-secret-api-key" \
  -d '{
    "email": "user@example.com",
    "message": "Explain quantum computing",
    "role": "user",
    "metadata": {
      "source": "terminal",
      "tags": ["science"]
    }
  }'
```

### Response

**Success (200 OK):**

```json
{
  "success": true,
  "traceId": "trace-a1b2c3d4e5f6..."
}
```

**Note:** The `traceId` returned in the response is crucial for submitting user feedback later using the [Feedback API](./external-feedback-integration.md).

**Error (400 Bad Request):**

```json
{
  "success": false,
  "error": "Missing or invalid email"
}
```

**Error (401 Unauthorized):**

```json
{
  "success": false,
  "error": "Invalid or missing API key"
}
```

**Error (403 Forbidden):**

```json
{
  "success": false,
  "error": "Invalid email: not registered in system"
}
```
