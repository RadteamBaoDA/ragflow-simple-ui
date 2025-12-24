# External Feedback API Integration

This document explains how to integrate with the External Feedback API to submit user feedback (scores) for Langfuse traces.

## Overview

The External Feedback API allows external applications to submit user feedback, such as thumbs up/down, star ratings, or comments, associated with a specific Langfuse trace. This feedback is recorded as "scores" in Langfuse.

## Authentication

All requests must be authenticated using an API key. The API key should be included in the request headers.

- **Header Name:** `x-api-key` or `Authorization: Bearer <your-api-key>`

## Endpoint

**POST** `/api/external/feedback`

### Request Body

The request body should be a JSON object with the following fields:

| Field | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `email` | string | Yes | The user's email address. Must correspond to a registered user in the system. |
| `traceId` | string | Yes | The Langfuse trace ID to associate the feedback with. |
| `value` | number | Yes | The score value (e.g., 1 for thumbs up, 0 for thumbs down, or 1-5 for star ratings). |
| `name` | string | No | The name of the feedback/score (default: "user-feedback"). |
| `comment` | string | No | Optional text comment provided by the user. |

### Example Request (JavaScript/TypeScript)

```javascript
const submitFeedback = async (traceId, value, comment) => {
  const response = await fetch('https://your-api-domain.com/api/external/feedback', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': 'your-secret-api-key'
    },
    body: JSON.stringify({
      email: 'user@example.com',
      traceId: traceId,
      value: value,
      name: 'user-satisfaction', // Optional
      comment: comment // Optional
    })
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || 'Failed to submit feedback');
  }

  return response.json();
};

// Usage
submitFeedback('trace-123456789', 1, 'Great response!');
```

### Example Request (cURL)

```bash
curl -X POST https://your-api-domain.com/api/external/feedback \
  -H "Content-Type: application/json" \
  -H "x-api-key: your-secret-api-key" \
  -d '{
    "email": "user@example.com",
    "traceId": "trace-123456789",
    "value": 1,
    "name": "user-satisfaction",
    "comment": "Great response!"
  }'
```

### Response

**Success (200 OK):**

```json
{
  "success": true
}
```

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

## Integration with Trace API

Typically, you would first use the [External Trace API](./external-trace-integration.md) (if available) or another method to generate a response and get a `traceId`. Then, you can use that `traceId` to submit feedback.

1.  **Call Trace/Chat API:** Receive a response which includes a `traceId`.
2.  **User Interaction:** User clicks "Thumbs Up" or "Thumbs Down".
3.  **Call Feedback API:** Send the `traceId` and the corresponding score (`value`) to this API.
