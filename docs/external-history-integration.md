# External History Integration Guide

This guide describes how to integrate external applications with the Knowledge Base History API. This API allows third-party clients (extensions, other apps) to store chat and search history in the central knowledge base system.

## Authentication

All endpoints require the `X-External-API-Key` header.
Configure the key in `be/.env`: `EXTERNAL_TRACE_API_KEY`.

## API Endpoints

Base URL: `https://your-domain.com/api`

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| GET | `/api/external/health` | Health check |
| POST | `/api/external/history/chat` | Submit chat history |
| POST | `/api/external/history/search` | Submit search history |

### 1. Health Check

**GET** `/api/external/health`

**Headers:**
```
X-External-API-Key: YOUR_API_KEY
```

**Response:**
```json
{
  "status": "ok",
  "service": "external-trace",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### 2. Chat History Collection

**POST** `/api/external/history/chat`

**Headers:**
```
Content-Type: application/json
X-External-API-Key: YOUR_API_KEY
```

**Body:**
```json
{
  "sessionId": "session-uuid",
  "userEmail": "user@company.com",
  "prompt": "What is RAG?",
  "response": "Retrieval-Augmented Generation...",
  "citations": [
    {
      "source": "doc.pdf",
      "text": "RAG combines..."
    }
  ],
  "model": "gpt-4"
}
```

### 3. Search History Collection

**POST** `/api/external/history/search`

**Headers:**
```
Content-Type: application/json
X-External-API-Key: YOUR_API_KEY
```

**Body:**
```json
{
  "sessionId": "session-uuid",
  "userEmail": "user@company.com",
  "query": "revenue 2024",
  "summary": "Revenue was $1M...",
  "results": [
    {
      "title": "Q1 Report",
      "snippet": "..."
    }
  ]
}
```

## Python Example

```python
import requests

API_KEY = "your-api-key"
BASE_URL = "https://kb.example.com"

def log_chat(session_id, email, prompt, response):
    headers = {
        "X-External-API-Key": API_KEY,
        "Content-Type": "application/json"
    }
    data = {
        "sessionId": session_id,
        "userEmail": email,
        "prompt": prompt,
        "response": response
    }
    requests.post(f"{BASE_URL}/api/external/history/chat", json=data, headers=headers)
```
