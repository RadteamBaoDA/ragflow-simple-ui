# External History API Specification

This document describes the external history collection APIs for integrating with third-party applications.

## Authentication

All endpoints require an API key passed in the `x-api-key` header.

```
x-api-key: YOUR_EXTERNAL_API_KEY
```

---

## Endpoints

### 1. Collect Chat History

**POST** `/api/external/history/chat`

Collects chat conversation history from external clients.

#### Request Headers

| Header | Required | Description |
|--------|----------|-------------|
| `Content-Type` | Yes | `application/json` |
| `x-api-key` | Yes | External API key for authentication |

#### Request Body

```json
{
  "session_id": "string",
  "share_id": "string",
  "user_email": "string",
  "user_prompt": "string",
  "llm_response": "string",
  "citations": []
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `session_id` | string | **Yes** | Unique session identifier |
| `share_id` | string | No | Share ID of the source (from knowledge base config) |
| `user_email` | string | No | Email of the user |
| `user_prompt` | string | **Yes** | User's message/question |
| `llm_response` | string | **Yes** | AI assistant's response |
| `citations` | array | No | Array of citation objects (default: []) |

#### Example Request

```bash
curl -X POST https://your-domain.com/api/external/history/chat \
  -H "Content-Type: application/json" \
  -H "x-api-key: YOUR_API_KEY" \
  -d '{
    "session_id": "abc123-session-456",
    "share_id": "8ba5b33ed9c111f0883b8ade979b1598",
    "user_email": "user@example.com",
    "user_prompt": "What is RAG?",
    "llm_response": "RAG stands for Retrieval-Augmented Generation...",
    "citations": [
      {"source": "document.pdf", "page": 1}
    ]
  }'
```

#### Success Response

**Status:** `201 Created`

```json
{
  "message": "Chat history saved successfully"
}
```

#### Error Responses

| Status | Description |
|--------|-------------|
| `400 Bad Request` | Missing required fields (session_id, user_prompt, or llm_response) |
| `401 Unauthorized` | Invalid or missing API key |
| `500 Internal Server Error` | Server processing error |

---

### 2. Collect Search History

**POST** `/api/external/history/search`

Collects search query history from external clients.

#### Request Headers

| Header | Required | Description |
|--------|----------|-------------|
| `Content-Type` | Yes | `application/json` |
| `x-api-key` | Yes | External API key for authentication |

#### Request Body

```json
{
  "session_id": "string",
  "share_id": "string",
  "user_email": "string",
  "search_input": "string",
  "ai_summary": "string",
  "file_results": []
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `session_id` | string | No | Unique session identifier |
| `share_id` | string | No | Share ID of the source (from knowledge base config) |
| `user_email` | string | No | Email of the user |
| `search_input` | string | **Yes** | The search query text |
| `ai_summary` | string | No | AI-generated summary of search results |
| `file_results` | array | No | Array of file names found (default: []) |

#### Example Request

```bash
curl -X POST https://your-domain.com/api/external/history/search \
  -H "Content-Type: application/json" \
  -H "x-api-key: YOUR_API_KEY" \
  -d '{
    "session_id": "search-session-789",
    "share_id": "9ca6c44fd0d222f1994c9bef080c2699",
    "user_email": "user@example.com",
    "search_input": "annual report 2024",
    "ai_summary": "The annual report shows revenue growth of 15%...",
    "file_results": ["annual_report_2024.pdf", "financial_summary.xlsx"]
  }'
```

#### Success Response

**Status:** `201 Created`

```json
{
  "message": "Search history saved successfully"
}
```

#### Error Responses

| Status | Description |
|--------|-------------|
| `400 Bad Request` | Missing required field (search_input) |
| `401 Unauthorized` | Invalid or missing API key |
| `500 Internal Server Error` | Server processing error |

---

## Database Schema

### external_chat_history

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `session_id` | TEXT | Session identifier (indexed) |
| `share_id` | TEXT | Source share ID (indexed) |
| `user_email` | TEXT | User email (indexed) |
| `user_prompt` | TEXT | User's prompt |
| `llm_response` | TEXT | AI response |
| `citations` | JSONB | Citation array |
| `created_at` | TIMESTAMP | Creation time (indexed DESC) |
| `search_vector` | TSVECTOR | Full-text search (GIN indexed) |

### external_search_history

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `session_id` | TEXT | Session identifier (indexed) |
| `share_id` | TEXT | Source share ID (indexed) |
| `user_email` | TEXT | User email (indexed) |
| `search_input` | TEXT | Search query |
| `ai_summary` | TEXT | AI summary |
| `file_results` | JSONB | File names array |
| `created_at` | TIMESTAMP | Creation time (indexed DESC) |
| `search_vector` | TSVECTOR | Full-text search (GIN indexed) |

---

## Trace API

### 3. Submit Trace

**POST** `/api/external/trace`

Submits execution traces to Langfuse observability platform.

#### Request Headers

| Header | Required | Description |
|--------|----------|-------------|
| `Content-Type` | Yes | `application/json` |
| `x-api-key` | Yes | External API key for authentication |

#### Request Body

```json
{
  "email": "string",
  "message": "string",
  "share_id": "string",
  "role": "user",
  "response": "string",
  "metadata": {}
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `email` | string | **Yes** | User email for identification |
| `message` | string | **Yes** | Input message/prompt |
| `share_id` | string | No | Source Share ID (added as tag `share_id:XXX`) |
| `role` | string | No | 'user' or 'assistant' (default: 'user') |
| `response` | string | No | Output response (if role is assistant) |
| `metadata` | object | No | Additional metadata key-value pairs |

#### Example Request

```bash
curl -X POST https://your-domain.com/api/external/trace \
  -H "Content-Type: application/json" \
  -H "x-api-key: YOUR_API_KEY" \
  -d '{
    "email": "user@example.com",
    "message": "Explain quantum computing",
    "share_id": "8ba5b33ed9c111f0883b8ade979b1598",
    "metadata": {
      "model": "gpt-4",
      "tokens": 150
    }
  }'
```

#### Success Response

**Status:** `200 OK`

```json
{
  "success": true,
  "traceId": "trace-uuid-1234"
}
```
