# External Trace API Integration

This document outlines the API specification for integrating external chat interfaces with the Knowledge Base backend's tracing and feedback system (powered by Langfuse).

## Table of Contents
- [Configuration](#configuration)
- [CORS Setup](#cors-setup)
- [Authentication](#authentication)
- [API Endpoints](#api-endpoints)
- [Python Client Example](#python-client-example)
- [JavaScript/Fetch Example](#javascriptfetch-example)

---

## Configuration

### Environment Variables

Add these to your backend `.env` file:

```bash
# Enable external trace API
EXTERNAL_TRACE_ENABLED=true

# API key for external system authentication (optional)
EXTERNAL_TRACE_API_KEY=your-secure-api-key

# Cache TTL for email validation in seconds (default: 300 = 5 minutes)
EXTERNAL_TRACE_CACHE_TTL=300

# Lock timeout for preventing race conditions in milliseconds
EXTERNAL_TRACE_LOCK_TIMEOUT=5000

# Langfuse Configuration (required for tracing)
LANGFUSE_SECRET_KEY=sk-lf-xxx
LANGFUSE_PUBLIC_KEY=pk-lf-xxx
LANGFUSE_BASE_URL=https://cloud.langfuse.com
```

---

## CORS Setup

To allow external applications to access the API, configure CORS origins:

```bash
# Allow specific origins (comma-separated)
CORS_ORIGINS=http://localhost:5173,https://your-external-app.com

# Or allow all origins (use with caution in production)
CORS_ORIGINS=*
CORS_CREDENTIALS=false  # Required when using '*'
```

> **⚠️ Warning**: Using `CORS_ORIGINS=*` in production is not recommended for security reasons. Always specify explicit origins when possible.

---

## Authentication

Ensure the backend is configured with `EXTERNAL_TRACE_ENABLED=true`.

If `EXTERNAL_TRACE_API_KEY` is set, include it in your request headers:

```http
X-API-Key: your-secure-api-key
```

---

## API Endpoints

### Base URL
```
/api/external/trace
```

---

### 1. Submit Chat Trace

Records a chat message (user or assistant) to the observability system.

**Endpoint:** `POST /api/external/trace/submit`

**Content-Type:** `application/json`

#### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `email` | string | Yes | User email (must exist in the system for validation). |
| `message` | string | Yes | The content of the message (user input or assistant output). |
| `ipAddress` | string | Yes | Client IP address (for rate limiting/logging). |
| `role` | string | No | `user` or `assistant` (default: `user`). |
| `response` | string | No | If capturing an LLM generation, the output text. |
| `metadata` | object | No | Additional context (see below). |

#### Metadata Fields (Recommended)

| Field | Type | Description |
|-------|------|-------------|
| `chatId` | string | Unique identifier for the conversation (or use `sessionId`). |
| `sessionId` | string | Alternative to `chatId` for conversation tracking. |
| `source` | string | Origin of the chat (e.g., `"slack-bot"`, `"web-widget"`, `"python-app"`). |
| `task` | string | Custom task name (default: `user_response` or `llm_response`). |
| `model` | string | Model ID used for generation. |
| `modelName` | string | Human-readable model name. |
| `tags` | string[] | Array of strings for categorization. |
| `timestamp` | string | ISO timestamp of the message. |
| `usage` | object | Token usage info (see below). |

#### Usage Object (for LLM responses)

| Field | Type | Description |
|-------|------|-------------|
| `promptTokens` | number | Number of input/prompt tokens. |
| `completionTokens` | number | Number of output/completion tokens. |
| `totalTokens` | number | Total tokens used. |

#### Example Request - User Message

```json
{
  "email": "user@example.com",
  "message": "How do I create a knowledge base?",
  "ipAddress": "192.168.1.100",
  "role": "user",
  "metadata": {
    "chatId": "chat-12345",
    "source": "python-app",
    "tags": ["support", "knowledge-base"]
  }
}
```

#### Example Request - Assistant Response with Token Usage

```json
{
  "email": "user@example.com",
  "message": "How do I create a knowledge base?",
  "ipAddress": "192.168.1.100",
  "role": "assistant",
  "response": "To create a knowledge base, go to the Knowledge Base section and click 'Create New'...",
  "metadata": {
    "chatId": "chat-12345",
    "source": "python-app",
    "model": "gpt-4",
    "modelName": "GPT-4",
    "usage": {
      "promptTokens": 150,
      "completionTokens": 200,
      "totalTokens": 350
    }
  }
}
```

#### Response

```json
{
  "success": true,
  "traceId": "trace-12345-abcde",
  "error": null
}
```

#### Error Response

```json
{
  "success": false,
  "error": "Invalid email: not registered in system"
}
```

---

### 2. Submit User Feedback

Records user feedback (score/comment) for a specific trace or message.

**Endpoint:** `POST /api/external/trace/feedback`

**Content-Type:** `application/json`

#### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `traceId` | string | Yes* | The Trace ID returned from `/submit`. |
| `messageId` | string | Yes* | Alternative to `traceId`. |
| `value` | number | Yes* | Score value (e.g., 1 for like, 0 for dislike). |
| `score` | number | Yes* | Alternative to `value`. |
| `comment` | string | No | Optional text feedback from user. |

*Either `traceId` or `messageId` is required. Either `value` or `score` is required.

#### Example Request

```json
{
  "traceId": "trace-12345-abcde",
  "value": 1,
  "comment": "Helpful answer!"
}
```

#### Response

```json
{
  "success": true
}
```

---

## Python Client Example

```python
import requests
from typing import Optional, Dict, Any

class KnowledgeBaseTraceClient:
    """Client for sending traces to Knowledge Base External Trace API."""
    
    def __init__(self, base_url: str, api_key: Optional[str] = None):
        """
        Initialize the trace client.
        
        Args:
            base_url: The base URL of the Knowledge Base API (e.g., "http://localhost:3001")
            api_key: Optional API key for authentication
        """
        self.base_url = base_url.rstrip('/')
        self.api_key = api_key
        self.session = requests.Session()
        
        if api_key:
            self.session.headers['X-API-Key'] = api_key
        self.session.headers['Content-Type'] = 'application/json'
    
    def submit_trace(
        self,
        email: str,
        message: str,
        ip_address: str,
        role: str = 'user',
        response: Optional[str] = None,
        chat_id: Optional[str] = None,
        source: str = 'python-app',
        model: Optional[str] = None,
        model_name: Optional[str] = None,
        tags: Optional[list] = None,
        usage: Optional[Dict[str, int]] = None,
        metadata: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Submit a chat trace to the Knowledge Base.
        
        Args:
            email: User email (must be registered in the system)
            message: The message content
            ip_address: Client IP address
            role: 'user' or 'assistant'
            response: LLM response text (for assistant role)
            chat_id: Unique conversation identifier
            source: Origin identifier (e.g., 'slack-bot', 'python-app')
            model: Model ID
            model_name: Human-readable model name
            tags: List of tags for categorization
            usage: Token usage dict with promptTokens, completionTokens, totalTokens
            metadata: Additional metadata dict
            
        Returns:
            Dict with success status and traceId
        """
        payload = {
            'email': email,
            'message': message,
            'ipAddress': ip_address,
            'role': role,
        }
        
        if response:
            payload['response'] = response
        
        meta = metadata.copy() if metadata else {}
        if chat_id:
            meta['chatId'] = chat_id
        if source:
            meta['source'] = source
        if model:
            meta['model'] = model
        if model_name:
            meta['modelName'] = model_name
        if tags:
            meta['tags'] = tags
        if usage:
            meta['usage'] = usage
        
        if meta:
            payload['metadata'] = meta
        
        url = f"{self.base_url}/api/external/trace/submit"
        resp = self.session.post(url, json=payload)
        resp.raise_for_status()
        return resp.json()
    
    def submit_feedback(
        self,
        trace_id: str,
        value: int,
        comment: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Submit user feedback for a trace.
        
        Args:
            trace_id: The trace ID returned from submit_trace
            value: Score value (1 for like, 0 for dislike)
            comment: Optional feedback text
            
        Returns:
            Dict with success status
        """
        payload = {
            'traceId': trace_id,
            'value': value,
        }
        
        if comment:
            payload['comment'] = comment
        
        url = f"{self.base_url}/api/external/trace/feedback"
        resp = self.session.post(url, json=payload)
        resp.raise_for_status()
        return resp.json()


# Usage Example
if __name__ == '__main__':
    # Initialize client
    client = KnowledgeBaseTraceClient(
        base_url='http://localhost:3001',
        api_key='your-api-key'  # Optional
    )
    
    # Submit user message
    result = client.submit_trace(
        email='user@example.com',
        message='What is RAGFlow?',
        ip_address='192.168.1.100',
        role='user',
        chat_id='session-001',
        source='python-example',
        tags=['demo', 'test']
    )
    print(f"User trace: {result}")
    trace_id = result.get('traceId')
    
    # Submit assistant response with token usage
    result = client.submit_trace(
        email='user@example.com',
        message='What is RAGFlow?',
        ip_address='192.168.1.100',
        role='assistant',
        response='RAGFlow is a Retrieval-Augmented Generation platform...',
        chat_id='session-001',
        source='python-example',
        model='gpt-4',
        model_name='GPT-4',
        usage={
            'promptTokens': 50,
            'completionTokens': 120,
            'totalTokens': 170
        }
    )
    print(f"Assistant trace: {result}")
    
    # Submit feedback
    if trace_id:
        feedback = client.submit_feedback(
            trace_id=trace_id,
            value=1,
            comment='Great response!'
        )
        print(f"Feedback: {feedback}")
```

---

## JavaScript/Fetch Example

```javascript
/**
 * Knowledge Base External Trace API Client
 */
class KnowledgeBaseTraceClient {
  constructor(baseUrl, apiKey = null) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.apiKey = apiKey;
  }

  async submitTrace({
    email,
    message,
    ipAddress,
    role = 'user',
    response = null,
    chatId = null,
    source = 'web-app',
    model = null,
    modelName = null,
    tags = null,
    usage = null,
    metadata = {}
  }) {
    const payload = {
      email,
      message,
      ipAddress,
      role,
      metadata: {
        ...metadata,
        ...(chatId && { chatId }),
        ...(source && { source }),
        ...(model && { model }),
        ...(modelName && { modelName }),
        ...(tags && { tags }),
        ...(usage && { usage })
      }
    };

    if (response) {
      payload.response = response;
    }

    const headers = {
      'Content-Type': 'application/json',
      ...(this.apiKey && { 'X-API-Key': this.apiKey })
    };

    const resp = await fetch(`${this.baseUrl}/api/external/trace/submit`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload)
    });

    if (!resp.ok) {
      throw new Error(`HTTP ${resp.status}: ${await resp.text()}`);
    }

    return resp.json();
  }

  async submitFeedback({ traceId, value, comment = null }) {
    const payload = {
      traceId,
      value,
      ...(comment && { comment })
    };

    const headers = {
      'Content-Type': 'application/json',
      ...(this.apiKey && { 'X-API-Key': this.apiKey })
    };

    const resp = await fetch(`${this.baseUrl}/api/external/trace/feedback`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload)
    });

    if (!resp.ok) {
      throw new Error(`HTTP ${resp.status}: ${await resp.text()}`);
    }

    return resp.json();
  }
}

// Usage Example
async function example() {
  const client = new KnowledgeBaseTraceClient(
    'http://localhost:3001',
    'your-api-key' // Optional
  );

  // Submit user message
  const result = await client.submitTrace({
    email: 'user@example.com',
    message: 'What is RAGFlow?',
    ipAddress: '192.168.1.100',
    role: 'user',
    chatId: 'session-001',
    source: 'web-app',
    tags: ['demo']
  });
  console.log('User trace:', result);

  // Submit assistant response
  const assistantResult = await client.submitTrace({
    email: 'user@example.com',
    message: 'What is RAGFlow?',
    ipAddress: '192.168.1.100',
    role: 'assistant',
    response: 'RAGFlow is a Retrieval-Augmented Generation platform...',
    chatId: 'session-001',
    source: 'web-app',
    model: 'gpt-4',
    modelName: 'GPT-4',
    usage: {
      promptTokens: 50,
      completionTokens: 120,
      totalTokens: 170
    }
  });
  console.log('Assistant trace:', assistantResult);

  // Submit feedback
  if (result.traceId) {
    const feedback = await client.submitFeedback({
      traceId: result.traceId,
      value: 1,
      comment: 'Great response!'
    });
    console.log('Feedback:', feedback);
  }
}

example().catch(console.error);
```

---

## Error Codes

| HTTP Status | Error | Description |
|-------------|-------|-------------|
| 200 | - | Success |
| 400 | `Invalid email: not registered in system` | The email is not found in the Knowledge Base user database |
| 500 | `Failed to submit trace` | Internal server error during trace processing |
| 500 | `Failed to submit feedback` | Internal server error during feedback processing |

---

## Rate Limiting

The API uses the general rate limiter configured for the backend:
- **Window**: 15 minutes
- **Max Requests**: 1000 per window

For high-volume applications, consider using batch submissions or contacting the administrator to adjust limits.
