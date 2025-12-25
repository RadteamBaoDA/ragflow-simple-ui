# Agent Specification: External History Client Implementation

**Goal:** Implement a client to send chat and search history logs to the Knowledge Base External History API for persistent storage and admin auditing.

---

## API Overview

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/external/health` | Health check endpoint |
| POST | `/api/external/history/chat` | Submit chat history (prompt/response/citations) |
| POST | `/api/external/history/search` | Submit search history (input/summary/files) |

---

## Configuration Requirements

### Server-Side Environment Variables

```bash
# Optional: API key for authentication (shared with trace API)
EXTERNAL_TRACE_API_KEY=your-secure-api-key

# CORS: Allow your agent's origin
CORS_ORIGINS=http://localhost:3001,http://your-agent-host:8000
```

---

## 0. Health Check (`GET /api/external/health`)

**When to call:**
- Before starting history submissions to verify API availability and authentication configuration.

**Response:**
```json
{
  "status": "ok",
  "service": "external-trace",
  "timestamp": "2025-12-25T10:00:00.000Z"
}
```

---

## 1. Chat History Collection (`POST /api/external/history/chat`)

**When to call:**
- After an LLM completion is finished and you have the final response and citations.

### Request Headers

```http
Content-Type: application/json
X-API-Key: your-api-key  # Optional, if EXTERNAL_TRACE_API_KEY is configured
```

### Input Payload

```json
{
  "session_id": "unique-session-id", // REQUIRED: ID for conversation threading
  "user_email": "user@example.com",  // OPTIONAL: Associate history with a specific user
  "user_prompt": "What is RAG?",     // REQUIRED: The user's question
  "llm_response": "RAG stands for...",// REQUIRED: The assistant's answer
  "citations": ["doc1.pdf", "web_link"]// OPTIONAL: Array of source references
}
```

### Success Response (202 Accepted)

*Note: History is processed asynchronously via a background queue.*

```json
{
  "message": "Chat history collection started"
}
```

---

## 2. Search History Collection (`POST /api/external/history/search`)

**When to call:**
- After a search operation is performed, typically combined with an AI summary.

### Request Headers

```http
Content-Type: application/json
X-API-Key: your-api-key  # Optional
```

### Input Payload

```json
{
  "search_input": "2024 projections", // REQUIRED: The search query
  "user_email": "user@example.com",   // OPTIONAL: Associate history with a specific user
  "ai_summary": "The summary is...",  // OPTIONAL: AI-generated summary of results
  "file_results": ["table.xlsx", "p.pdf"] // OPTIONAL: List of files found
}
```

### Success Response (202 Accepted)

```json
{
  "message": "Search history collection started"
}
```

---

## Implementation Logic (Flow Diagram)

```
┌─────────────────────────────────────────────────────────────────┐
│                    AGENT HISTORY FLOW                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. User interacts with Agent                                    │
│     │                                                           │
│     ▼                                                           │
│  2. Agent completes Task (Chat/Search)                           │
│     │                                                           │
│     ▼                                                           │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ POST /api/external/history/[type]                       │    │
│  │ {                                                        │    │
│  │   "user_email": "user@example.com",                     │    │
│  │   "session_id": "session_123",                          │    │
│  │   "user_prompt": "...",                                 │    │
│  │   "llm_response": "...",                                │    │
│  │   "citations": [...]                                    │    │
│  │ }                                                        │    │
│  └─────────────────────────────────────────────────────────┘    │
│     │                                                           │
│     ▼                                                           │
│  3. KB API validates API Key -> Enqueues Job                    │
│     │                                                           │
│     ▼                                                           │
│  4. Response: 202 "Collection started"                           │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Python Client Example

```python
import requests
from typing import Optional, List, Dict, Any

class KBHistoryClient:
    def __init__(self, base_url: str, api_key: Optional[str] = None):
        self.base_url = base_url.rstrip('/')
        self.headers = {'Content-Type': 'application/json'}
        if api_key:
            self.headers['X-API-Key'] = api_key

    def send_chat_history(self, session_id: str, prompt: str, response: str, 
                          email: Optional[str] = None, citations: List[str] = None):
        payload = {
            "session_id": session_id,
            "user_prompt": prompt,
            "llm_response": response,
            "user_email": email,
            "citations": citations or []
        }
        return requests.post(f"{self.base_url}/api/external/history/chat", 
                             json=payload, headers=self.headers).json()

    def send_search_history(self, search_input: str, email: Optional[str] = None,
                            summary: str = "", files: List[str] = None):
        payload = {
            "search_input": search_input,
            "user_email": email,
            "ai_summary": summary,
            "file_results": files or []
        }
        return requests.post(f"{self.base_url}/api/external/history/search", 
                             json=payload, headers=self.headers).json()

# Usage
client = KBHistoryClient("http://localhost:3001", "your-api-key")
client.send_chat_history("session-1", "Hello", "Hi there!", "user@example.com")
```

---

## Error Handling

| HTTP Status | Error Message | Solution |
|-------------|---------------|----------|
| 202 | `message: "Collection started"` | Success |
| 400 | `error: "Missing required fields"` | Check payload requirements |
| 401 | `error: "Unauthorized"` | Check `X-API-Key` |
| 500 | `error: "Internal server error"` | Check server/Redis logs |

---

## Best Practices

1. **Fire and Forget**: Since the API returns 202 immediately, you don't need to block your user interface waiting for a confirmation of persistence.
2. **Consistent Session IDs**: Use the same `session_id` for all messages in a single conversation to ensure they are grouped correctly in the admin view.
3. **Log Emails**: Always include the `user_email` if available to enable advanced filtering and auditing by user in the Knowledge Base dashboard.
