# External Trace API - Integration Guide

## Overview

The External Trace API allows external systems to collect trace data with Langfuse for observability.

**Base URL:** `http://external-trace-api-url/api/external`

---

## Endpoints

### POST `/api/external/trace`

Collect trace data from external systems.

#### Headers
| Header | Required | Description |
|--------|----------|-------------|
| `Content-Type` | Yes | `application/json` |
| `x-api-key` | Optional | API key (if configured via `EXTERNAL_CHAT_API_KEY`) |

#### Request Body
```json
{
  "email": "user@example.com",      // Required: User email (must exist in DB)
  "message": "User's question",     // Required: Chat message content
  "role": "user",                   // Optional: 'user' or 'assistant'
  "response": "LLM response...",    // Optional: For assistant role
  "metadata": {                     // Optional
    "source": "your-app-name",
    "chatId": "conversation-123",
    "sessionId": "session-456",
    "model": "gpt-4o",
    "modelName": "GPT-4o",
    "task": "llm_response",
    "usage": {
      "promptTokens": 100,
      "completionTokens": 200,
      "totalTokens": 300
    },
    "tags": ["custom-tag"]
  }
}
```

#### Response
```json
// Success
{ "success": true, "traceId": "langfuse-trace-id" }

// Error
{ "success": false, "error": "Invalid email: not registered in system" }
```

---

## Integration Examples

### Axios (Browser/Node.js)

```javascript
import axios from 'axios';

const API_BASE = 'http://external-trace-api-url/api/external';
const API_KEY = 'your-api-key'; // Require

// Send user message
async function sendUserMessage(email, message, chatId) {
  const response = await axios.post(`${API_BASE}/trace`, {
    email,
    message,
    role: 'user',
    metadata: { chatId, source: 'my-app' }
  }, {
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': API_KEY
    }
  });
  return response.data;
}

// Send LLM response with usage metrics
async function sendLLMResponse(email, message, llmResponse, chatId, usage) {
  const response = await axios.post(`${API_BASE}/trace`, {
    email,
    message,
    role: 'assistant',
    response: llmResponse,
    metadata: {
      chatId,
      source: 'my-app',
      model: 'gpt-4o',
      task: 'llm_response',
      usage
    }
  }, {
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': API_KEY
    }
  });
  return response.data;
}
```

---

### React (with fetch)

```tsx
// hooks/useExternalTrace.ts
import { useState } from 'react';

const API_BASE = process.env.REACT_APP_API_URL + '/api/external';

interface TraceResponse {
  success: boolean;
  traceId?: string;
  error?: string;
}

export function useExternalTrace() {
  const [loading, setLoading] = useState(false);

  const sendTrace = async (
    email: string,
    message: string,
    chatId: string
  ): Promise<TraceResponse> => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/trace`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.REACT_APP_API_KEY || ''
        },
        body: JSON.stringify({
          email,
          message,
          role: 'user',
          metadata: { chatId, source: 'react-app' }
        })
      });
      return await res.json();
    } finally {
      setLoading(false);
    }
  };

  return { sendTrace, loading };
}

// Usage in component
function ChatComponent() {
  const { sendTrace, loading } = useExternalTrace();
  
  const handleSend = async () => {
    const result = await sendTrace('user@example.com', 'Hello!', 'chat-123');
    console.log('Trace ID:', result.traceId);
  };

  return <button onClick={handleSend} disabled={loading}>Send</button>;
}
```

---

### Angular (HttpClient)

```typescript
// external-trace.service.ts
import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../environments/environment';

interface TraceRequest {
  email: string;
  message: string;
  role?: 'user' | 'assistant';
  response?: string;
  metadata?: Record<string, unknown>;
}

interface TraceResponse {
  success: boolean;
  traceId?: string;
  error?: string;
}

@Injectable({ providedIn: 'root' })
export class ExternalTraceService {
  private readonly apiUrl = `${environment.apiUrl}/api/external/trace`;

  constructor(private http: HttpClient) {}

  sendTrace(request: TraceRequest): Observable<TraceResponse> {
    const headers = new HttpHeaders({
      'Content-Type': 'application/json',
      'x-api-key': environment.apiKey || ''
    });

    return this.http.post<TraceResponse>(this.apiUrl, request, { headers });
  }

  // Convenience methods
  sendUserMessage(email: string, message: string, chatId: string) {
    return this.sendTrace({
      email,
      message,
      role: 'user',
      metadata: { chatId, source: 'angular-app' }
    });
  }

  sendAssistantResponse(email: string, message: string, response: string, chatId: string) {
    return this.sendTrace({
      email,
      message,
      role: 'assistant',
      response,
      metadata: { chatId, source: 'angular-app', task: 'llm_response' }
    });
  }
}
```

---

### Node.js (native fetch)

```javascript
// external-trace-client.js
const API_BASE = process.env.EXTERNAL_TRACE_API_URL || 'http://localhost:3000/api/external';
const API_KEY = process.env.EXTERNAL_TRACE_API_KEY;

async function sendTrace(payload) {
  const response = await fetch(`${API_BASE}/trace`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(API_KEY && { 'x-api-key': API_KEY })
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  return response.json();
}

// Send a complete conversation turn
async function logConversationTurn(email, userMessage, assistantResponse, chatId, usage) {
  // Log user input
  await sendTrace({
    email,
    message: userMessage,
    role: 'user',
    metadata: { chatId, source: 'nodejs-app' }
  });

  // Log LLM response
  return sendTrace({
    email,
    message: userMessage,
    role: 'assistant',
    response: assistantResponse,
    metadata: {
      chatId,
      source: 'nodejs-app',
      task: 'llm_response',
      usage
    }
  });
}

module.exports = { sendTrace, logConversationTurn };
```

---

### Python (requests)

```python
import requests
from typing import Optional, Dict, Any

API_BASE = "http://localhost:3000/api/external"
API_KEY = "your-api-key"  # Optional

def send_trace(
    email: str,
    message: str,
    role: str = "user",
    response: Optional[str] = None,
    metadata: Optional[Dict[str, Any]] = None
) -> dict:
    """Send trace data to external API."""
    headers = {
        "Content-Type": "application/json",
    }
    if API_KEY:
        headers["x-api-key"] = API_KEY

    payload = {
        "email": email,
        "message": message,
        "role": role,
        "metadata": metadata or {"source": "python-app"}
    }
    if response:
        payload["response"] = response

    res = requests.post(f"{API_BASE}/trace", json=payload, headers=headers)
    res.raise_for_status()
    return res.json()

# Usage
result = send_trace(
    email="user@example.com",
    message="What is RAG?",
    metadata={"chatId": "conv-123", "source": "python-app"}
)
print(f"Trace ID: {result.get('traceId')}")
```

---

### cURL

```bash
# User message
curl -X POST http://localhost:3000/api/external/trace \
  -H "Content-Type: application/json" \
  -H "x-api-key: your-api-key" \
  -d '{
    "email": "user@example.com",
    "message": "Hello, what is RAG?",
    "role": "user",
    "metadata": {
      "chatId": "abc123",
      "source": "curl-test"
    }
  }'

# LLM response with usage
curl -X POST http://localhost:3000/api/external/trace \
  -H "Content-Type: application/json" \
  -H "x-api-key: your-api-key" \
  -d '{
    "email": "user@example.com",
    "message": "Hello, what is RAG?",
    "role": "assistant",
    "response": "RAG stands for Retrieval-Augmented Generation...",
    "metadata": {
      "chatId": "abc123",
      "model": "gpt-4o",
      "task": "llm_response",
      "usage": {"promptTokens": 50, "completionTokens": 100}
    }
  }'
```

---

## Health Check

```bash
# GET /api/external/health
curl http://localhost:3000/api/external/health
# Response: { "status": "ok", "service": "external-trace" }
```

---

## Error Codes

| HTTP Code | Description |
|-----------|-------------|
| 200 | Success |
| 400 | Invalid request (missing email/message) |
| 401 | Invalid or missing API key |
| 403 | Email not registered in system |
| 503 | External trace API is disabled |

---

## AI Agent Quick Integration (ReactJS + Axios)

> **For AI Agents**: Copy these files directly to integrate external tracing.

### Step 1: Create API Client

**File: `src/services/externalTraceApi.ts`**

```typescript
import axios, { AxiosInstance } from 'axios';

interface TracePayload {
  email: string;
  message: string;
  role?: 'user' | 'assistant';
  response?: string;
  metadata?: {
    source?: string;
    chatId?: string;
    sessionId?: string;
    model?: string;
    modelName?: string;
    task?: string;
    usage?: {
      promptTokens?: number;
      completionTokens?: number;
      totalTokens?: number;
    };
    tags?: string[];
    [key: string]: unknown;
  };
}

interface TraceResponse {
  success: boolean;
  traceId?: string;
  error?: string;
}

class ExternalTraceApi {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: process.env.REACT_APP_API_URL || 'http://localhost:3000',
      headers: {
        'Content-Type': 'application/json',
        ...(process.env.REACT_APP_TRACE_API_KEY && {
          'x-api-key': process.env.REACT_APP_TRACE_API_KEY
        })
      }
    });
  }

  async sendTrace(payload: TracePayload): Promise<TraceResponse> {
    const { data } = await this.client.post<TraceResponse>('/api/external/trace', payload);
    return data;
  }

  async sendUserMessage(email: string, message: string, chatId: string): Promise<TraceResponse> {
    return this.sendTrace({
      email,
      message,
      role: 'user',
      metadata: { chatId, source: 'react-app' }
    });
  }

  async sendAssistantResponse(
    email: string,
    message: string,
    response: string,
    chatId: string,
    model?: string,
    usage?: { promptTokens?: number; completionTokens?: number; totalTokens?: number }
  ): Promise<TraceResponse> {
    return this.sendTrace({
      email,
      message,
      role: 'assistant',
      response,
      metadata: {
        chatId,
        source: 'react-app',
        model,
        task: 'llm_response',
        usage
      }
    });
  }
}

export const externalTraceApi = new ExternalTraceApi();
```

---

### Step 2: Create React Hook

**File: `src/hooks/useExternalTrace.ts`**

```typescript
import { useCallback, useState } from 'react';
import { externalTraceApi } from '../services/externalTraceApi';

interface UseExternalTraceOptions {
  email: string;
  chatId: string;
}

export function useExternalTrace({ email, chatId }: UseExternalTraceOptions) {
  const [isTracing, setIsTracing] = useState(false);
  const [lastTraceId, setLastTraceId] = useState<string | null>(null);

  const traceUserMessage = useCallback(async (message: string) => {
    setIsTracing(true);
    try {
      const result = await externalTraceApi.sendUserMessage(email, message, chatId);
      if (result.traceId) setLastTraceId(result.traceId);
      return result;
    } finally {
      setIsTracing(false);
    }
  }, [email, chatId]);

  const traceAssistantResponse = useCallback(async (
    message: string,
    response: string,
    model?: string,
    usage?: { promptTokens?: number; completionTokens?: number }
  ) => {
    setIsTracing(true);
    try {
      const result = await externalTraceApi.sendAssistantResponse(
        email, message, response, chatId, model, usage
      );
      if (result.traceId) setLastTraceId(result.traceId);
      return result;
    } finally {
      setIsTracing(false);
    }
  }, [email, chatId]);

  return { traceUserMessage, traceAssistantResponse, isTracing, lastTraceId };
}
```

---

### Step 3: Usage in Chat Component

**File: `src/components/ChatWindow.tsx`**

```tsx
import React, { useState } from 'react';
import { useExternalTrace } from '../hooks/useExternalTrace';

interface ChatWindowProps {
  userEmail: string;
}

export function ChatWindow({ userEmail }: ChatWindowProps) {
  const [chatId] = useState(() => `chat-${Date.now()}`);
  const [input, setInput] = useState('');
  const { traceUserMessage, traceAssistantResponse, isTracing } = useExternalTrace({
    email: userEmail,
    chatId
  });

  const handleSend = async () => {
    if (!input.trim()) return;
    const userMessage = input;
    setInput('');

    // Trace user message
    await traceUserMessage(userMessage);

    // Call your LLM API here...
    const llmResponse = await callYourLLMApi(userMessage);

    // Trace assistant response
    await traceAssistantResponse(
      userMessage,
      llmResponse.content,
      llmResponse.model,
      llmResponse.usage
    );
  };

  return (
    <div>
      <input value={input} onChange={(e) => setInput(e.target.value)} />
      <button onClick={handleSend} disabled={isTracing}>Send</button>
    </div>
  );
}
```

---

### Step 4: Environment Variables

**File: `.env`**

```bash
EXTERNAL_TRACE_API_URL=http://localhost:3000
EXTERNAL_TRACE_API_KEY=your-api-key-here
```

---

### Quick Checklist for AI Agents

1. ✅ Copy `externalTraceApi.ts` to `src/services/`
2. ✅ Copy `useExternalTrace.ts` to `src/hooks/`
3. ✅ Add env variables to `.env`
4. ✅ Import and use `useExternalTrace` hook in chat components
5. ✅ Call `traceUserMessage()` when user sends message
6. ✅ Call `traceAssistantResponse()` after LLM responds

