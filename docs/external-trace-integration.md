# External Trace Integration Guide

This guide describes how to integrate external applications with the Knowledge Base Trace API. This allows external LLM applications to push execution traces and user feedback to the central Langfuse instance managed by the Knowledge Base.

## Authentication

All endpoints require the `X-External-API-Key` header if configured, although some deployments might leave it public if behind a VPN.
(Default configuration requires key: `EXTERNAL_TRACE_API_KEY`)

## API Endpoints

Base URL: `https://your-domain.com/api`

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| POST | `/api/external/trace/submit` | Submit trace data |
| POST | `/api/external/trace/feedback` | Submit user feedback |

### 1. Submit Trace

**POST** `/api/external/trace/submit`

**Headers:**
```
Content-Type: application/json
X-External-API-Key: YOUR_API_KEY
```

**Body:**
```json
{
  "traceId": "trace-uuid",
  "name": "chat-interaction",
  "userId": "user@company.com",
  "sessionId": "session-uuid",
  "input": { "message": "hello" },
  "output": { "message": "hi there" },
  "metadata": { "model": "gpt-4" }
}
```

### 2. Submit Feedback

**POST** `/api/external/trace/feedback`

**Headers:**
```
Content-Type: application/json
X-External-API-Key: YOUR_API_KEY
```

**Body:**
```json
{
  "traceId": "trace-uuid",
  "value": 1,
  "comment": "Good response"
}
```
*Note: `value` is typically 1 (like) or 0 (dislike), or a score scale.*

## Python Example

```python
import requests
import uuid

API_KEY = "your-api-key"
BASE_URL = "https://kb.example.com"

def log_trace(user_input, ai_output, user_id):
    trace_id = str(uuid.uuid4())
    headers = {"X-External-API-Key": API_KEY}
    
    # 1. Submit Trace
    requests.post(
        f"{BASE_URL}/api/external/trace/submit",
        headers=headers,
        json={
            "traceId": trace_id,
            "name": "external-chat",
            "userId": user_id,
            "input": user_input,
            "output": ai_output
        }
    )
    
    return trace_id

def log_feedback(trace_id, score, comment=""):
    headers = {"X-External-API-Key": API_KEY}
    requests.post(
        f"{BASE_URL}/api/external/trace/feedback",
        headers=headers,
        json={
            "traceId": trace_id,
            "value": score,
            "comment": comment
        }
    )
```
