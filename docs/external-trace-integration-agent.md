# Agent Specification: External Trace Client Implementation

**Goal:** Implement a client to send chat logs and user feedback to the Knowledge Base External Trace API.

---

## API Overview

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/external/health` | Health check endpoint |
| POST | `/api/external/trace/submit` | Submit user/assistant message trace |
| POST | `/api/external/trace/feedback` | Submit user feedback for a trace |

---

## Configuration Requirements

### Server-Side Environment Variables

```bash
# Enable external trace API (required)
EXTERNAL_TRACE_ENABLED=true

# Optional: API key for authentication
EXTERNAL_TRACE_API_KEY=your-secure-api-key

# CORS: Allow your agent's origin
CORS_ORIGINS=http://localhost:3001,http://your-agent-host:8000

# Langfuse (required for tracing to work)
LANGFUSE_SECRET_KEY=sk-lf-xxx
LANGFUSE_PUBLIC_KEY=pk-lf-xxx
LANGFUSE_BASE_URL=https://cloud.langfuse.com
```

---

## 0. Health Check (`GET /api/external/health`)

**When to call:**
- Before starting trace submissions to verify API availability.

**Response:**
```json
{
  "status": "ok",
  "service": "external-trace",
  "timestamp": "2025-12-25T10:00:00.000Z"
}
```

**Error (503 - API Disabled):**
```json
{
  "success": false,
  "error": "External trace API is not enabled"
}
```

---

## 1. Trace Submission (`POST /api/external/trace/submit`)

**When to call:**
- Immediately after a user sends a message.
- Immediately after the assistant (LLM) generates a response.

### Request Headers

```http
Content-Type: application/json
X-API-Key: your-api-key  # Optional, if EXTERNAL_TRACE_API_KEY is configured
```

### Input Payload

```json
{
  "email": "user@example.com",     // REQUIRED: Valid system user email
  "message": "User input text",    // REQUIRED: The message content
  "ipAddress": "127.0.0.1",        // REQUIRED: Client IP address
  "role": "user",                  // "user" or "assistant" (default: "user")
  "response": "LLM output",        // REQUIRED if role="assistant"
  "metadata": {
    "chatId": "unique-session-id", // REQUIRED for conversation threading
    "sessionId": "alt-session-id", // Alternative to chatId
    "source": "my-client-app",     // Identifier for your application
    "task": "custom_task_name",    // Custom task name (default: user_response/llm_response)
    "model": "gpt-4",              // Model ID
    "modelName": "GPT-4",          // Human-readable model name
    "tags": ["tag1", "tag2"],      // Array of tags for categorization
    "timestamp": "2025-12-25T10:00:00.000Z", // ISO timestamp
    "usage": {                     // Token usage (for assistant responses)
      "promptTokens": 100,
      "completionTokens": 200,
      "totalTokens": 300
    }
  }
}
```

### Success Response

```json
{
  "success": true,
  "traceId": "trace-12345-abcde"
}
```

### Error Response

```json
{
  "success": false,
  "error": "Invalid email: not registered in system"
}
```

### Handling Response
- Capture `traceId` from the JSON response.
- Store `traceId` associated with the specific assistant message in your UI/State.
- Use this `traceId` later for feedback submission.

---

## 2. Feedback Submission (`POST /api/external/trace/feedback`)

**When to call:**
- When a user clicks "Like", "Dislike", or provides a rating.

### Request Headers

```http
Content-Type: application/json
X-API-Key: your-api-key  # Optional
```

### Input Payload

```json
{
  "traceId": "stored-trace-id",    // REQUIRED: The ID from the Submit response
  "messageId": "alt-message-id",   // Alternative to traceId
  "value": 1,                      // 1 = Positive, 0 = Negative (or custom scale)
  "score": 1,                      // Alternative to value
  "comment": "Optional text"       // Optional feedback text
}
```

### Success Response

```json
{
  "success": true
}
```

---

## Implementation Logic (Flow Diagram)

```
┌─────────────────────────────────────────────────────────────────┐
│                    AGENT IMPLEMENTATION FLOW                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. User sends message                                          │
│     │                                                           │
│     ▼                                                           │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ POST /api/external/trace/submit                         │    │
│  │ {                                                        │    │
│  │   "email": "user@example.com",                          │    │
│  │   "message": "User's question",                         │    │
│  │   "ipAddress": "192.168.1.1",                           │    │
│  │   "role": "user",                                       │    │
│  │   "metadata": { "chatId": "session-001", "source": "app" }   │
│  │ }                                                        │    │
│  └─────────────────────────────────────────────────────────┘    │
│     │                                                           │
│     ▼                                                           │
│  2. LLM generates response                                      │
│     │                                                           │
│     ▼                                                           │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ POST /api/external/trace/submit                         │    │
│  │ {                                                        │    │
│  │   "email": "user@example.com",                          │    │
│  │   "message": "User's question",                         │    │
│  │   "ipAddress": "192.168.1.1",                           │    │
│  │   "role": "assistant",                                  │    │
│  │   "response": "LLM's answer...",                        │    │
│  │   "metadata": {                                         │    │
│  │     "chatId": "session-001",                            │    │
│  │     "source": "app",                                    │    │
│  │     "model": "gpt-4",                                   │    │
│  │     "usage": { "promptTokens": 50, "completionTokens": 100 } │
│  │   }                                                      │    │
│  │ }                                                        │    │
│  └─────────────────────────────────────────────────────────┘    │
│     │                                                           │
│     ▼                                                           │
│  3. Response: { "success": true, "traceId": "abc123" }          │
│     │                                                           │
│     ▼                                                           │
│  4. **SAVE traceId** with the assistant message                 │
│     │                                                           │
│     ▼                                                           │
│  5. Display message with Like/Dislike buttons                   │
│     │                                                           │
│     ▼                                                           │
│  6. User clicks "Like"                                          │
│     │                                                           │
│     ▼                                                           │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ POST /api/external/trace/feedback                       │    │
│  │ {                                                        │    │
│  │   "traceId": "abc123",                                  │    │
│  │   "value": 1,                                           │    │
│  │   "comment": "Great answer!"                            │    │
│  │ }                                                        │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Python Client Example

```python
"""
Minimal Python client for Knowledge Base External Trace API.
"""

import requests
from typing import Optional, Dict, Any


class KBTraceClient:
    """
    Client for sending traces to Knowledge Base External Trace API.
    
    This client handles:
    - User message tracking
    - Assistant response tracking with token usage
    - User feedback submission
    """
    
    def __init__(self, base_url: str, api_key: Optional[str] = None, source: str = "python-agent"):
        """
        Initialize the trace client.
        
        Args:
            base_url: Knowledge Base API URL (e.g., "http://localhost:3001")
            api_key: Optional API key for authentication
            source: Identifier for this agent/client
        """
        self.base_url = base_url.rstrip('/')
        self.source = source
        self.session = requests.Session()
        self.session.headers['Content-Type'] = 'application/json'
        if api_key:
            self.session.headers['X-API-Key'] = api_key
    
    def check_health(self) -> Dict[str, Any]:
        """
        Check if external trace API is available.
        
        Returns:
            Health status response
        """
        resp = self.session.get(f"{self.base_url}/api/external/health")
        return resp.json()
    
    def submit_user_message(
        self,
        email: str,
        message: str,
        chat_id: str,
        ip_address: str = "127.0.0.1"
    ) -> Dict[str, Any]:
        """
        Track a user message.
        
        Args:
            email: User's email (must be registered in Knowledge Base)
            message: The user's message content
            chat_id: Unique conversation/session identifier
            ip_address: Client IP address
            
        Returns:
            API response (contains traceId on success)
        """
        payload = {
            "email": email,
            "message": message,
            "ipAddress": ip_address,
            "role": "user",
            "metadata": {
                "chatId": chat_id,
                "source": self.source
            }
        }
        resp = self.session.post(f"{self.base_url}/api/external/trace/submit", json=payload)
        return resp.json()
    
    def submit_assistant_response(
        self,
        email: str,
        user_message: str,
        response: str,
        chat_id: str,
        ip_address: str = "127.0.0.1",
        model: Optional[str] = None,
        usage: Optional[Dict[str, int]] = None
    ) -> Dict[str, Any]:
        """
        Track an assistant/LLM response.
        
        Args:
            email: User's email
            user_message: The original user message (for context)
            response: The assistant's response content
            chat_id: Unique conversation/session identifier
            ip_address: Client IP address
            model: Model identifier (e.g., "gpt-4")
            usage: Token usage dict with promptTokens, completionTokens, totalTokens
            
        Returns:
            API response (contains traceId - SAVE THIS FOR FEEDBACK!)
        """
        metadata = {
            "chatId": chat_id,
            "source": self.source
        }
        if model:
            metadata["model"] = model
            metadata["modelName"] = model
        if usage:
            metadata["usage"] = usage
        
        payload = {
            "email": email,
            "message": user_message,
            "ipAddress": ip_address,
            "role": "assistant",
            "response": response,
            "metadata": metadata
        }
        resp = self.session.post(f"{self.base_url}/api/external/trace/submit", json=payload)
        return resp.json()
    
    def submit_feedback(
        self,
        trace_id: str,
        value: int,
        comment: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Submit user feedback for a response.
        
        Args:
            trace_id: The traceId from submit_assistant_response
            value: Feedback score (1 = positive, 0 = negative)
            comment: Optional feedback text
            
        Returns:
            API response
        """
        payload = {"traceId": trace_id, "value": value}
        if comment:
            payload["comment"] = comment
        resp = self.session.post(f"{self.base_url}/api/external/trace/feedback", json=payload)
        return resp.json()


# =============================================================================
# USAGE EXAMPLE
# =============================================================================

if __name__ == '__main__':
    # Initialize client
    client = KBTraceClient(
        base_url='http://localhost:3001',
        api_key='your-api-key',  # Optional
        source='my-python-agent'
    )
    
    # Check health first
    health = client.check_health()
    print(f"API Health: {health}")
    
    if health.get("status") != "ok":
        print("API is not available!")
        exit(1)
    
    # Define conversation context
    email = "user@example.com"
    chat_id = "session-001"
    
    # Step 1: Track user message
    user_result = client.submit_user_message(
        email=email,
        message="What is RAGFlow?",
        chat_id=chat_id
    )
    print(f"User trace: {user_result}")
    
    # Step 2: Simulate LLM call and track response
    llm_response = "RAGFlow is a Retrieval-Augmented Generation platform that combines..."
    
    assistant_result = client.submit_assistant_response(
        email=email,
        user_message="What is RAGFlow?",
        response=llm_response,
        chat_id=chat_id,
        model="gpt-4",
        usage={
            "promptTokens": 50,
            "completionTokens": 120,
            "totalTokens": 170
        }
    )
    print(f"Assistant trace: {assistant_result}")
    
    # Step 3: IMPORTANT - Save traceId for feedback
    trace_id = assistant_result.get("traceId")
    
    # Step 4: Later, when user gives feedback
    if trace_id:
        feedback_result = client.submit_feedback(
            trace_id=trace_id,
            value=1,  # 1 = Like
            comment="Great explanation!"
        )
        print(f"Feedback: {feedback_result}")
```

---

## Error Handling

| HTTP Status | Error Message | Cause | Solution |
|-------------|---------------|-------|----------|
| 200 | `success: true` | Success | - |
| 200 | `success: false, error: "Invalid email..."` | Email not in KB | Register the user first |
| 500 | `error: "Failed to submit trace"` | Server error | Check Langfuse config |
| 500 | `error: "Failed to submit feedback"` | Invalid traceId | Verify traceId exists |
| 503 | `error: "External trace API is not enabled"` | API disabled | Set `EXTERNAL_TRACE_ENABLED=true` |

---

## Best Practices

1. **Always check health before sending traces**
   ```python
   health = client.check_health()
   if health.get("status") != "ok":
       # Handle gracefully, don't block main flow
   ```

2. **Use consistent chat IDs for conversation threading**
   ```python
   chat_id = f"user-{user_id}-session-{session_id}"
   ```

3. **Always save traceId from assistant responses**
   ```python
   trace_id = result.get("traceId")
   message_store[message_id] = {"content": response, "trace_id": trace_id}
   ```

4. **Include token usage for cost monitoring**
   ```python
   usage = {
       "promptTokens": response.usage.prompt_tokens,
       "completionTokens": response.usage.completion_tokens,
       "totalTokens": response.usage.total_tokens
   }
   ```

5. **Handle failures gracefully (don't break main flow)**
   ```python
   try:
       client.submit_user_message(...)
   except Exception as e:
       logger.warning(f"Tracing failed (non-critical): {e}")
       # Continue with main logic
   ```
