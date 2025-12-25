# Agent Code Integration Guide

This guide provides complete code examples for integrating AI agents (Python-based) with the Knowledge Base External Trace API for observability and feedback collection.

## Table of Contents
- [Quick Start](#quick-start)
- [Configuration](#configuration)
- [Complete Agent Class](#complete-agent-class)
- [Integration Patterns](#integration-patterns)
- [LangChain Integration](#langchain-integration)
- [OpenAI Agent Integration](#openai-agent-integration)
- [Error Handling](#error-handling)
- [Best Practices](#best-practices)

---

## Quick Start

### 1. Install Dependencies

```bash
pip install requests python-dotenv
```

### 2. Environment Setup

Create a `.env` file:

```bash
# Knowledge Base API Configuration
KB_API_URL=http://localhost:3001
KB_API_KEY=your-api-key  # Optional, if EXTERNAL_TRACE_API_KEY is set on server

# Your agent's identifier
AGENT_SOURCE=my-python-agent
```

### 3. Basic Usage

```python
from kb_trace_client import KBTraceClient

# Initialize client
client = KBTraceClient(
    base_url="http://localhost:3001",
    api_key="your-api-key"
)

# Track user message
user_trace = client.track_user_message(
    email="user@example.com",
    message="What is RAGFlow?",
    chat_id="session-001"
)

# Track assistant response
assistant_trace = client.track_assistant_response(
    email="user@example.com",
    user_message="What is RAGFlow?",
    response="RAGFlow is a Retrieval-Augmented Generation platform...",
    chat_id="session-001",
    model="gpt-4",
    usage={"promptTokens": 50, "completionTokens": 120, "totalTokens": 170}
)

# Track feedback
client.track_feedback(
    trace_id=assistant_trace["traceId"],
    value=1,
    comment="Helpful!"
)
```

---

## Configuration

### Server-Side Configuration

Ensure these environment variables are set on the Knowledge Base backend:

```bash
# Enable external trace API
EXTERNAL_TRACE_ENABLED=true

# Optional: API key for authentication
EXTERNAL_TRACE_API_KEY=your-secure-api-key

# CORS: Allow your agent's origin
CORS_ORIGINS=http://localhost:3001,http://your-agent-host:8000

# Langfuse (required for tracing)
LANGFUSE_SECRET_KEY=sk-lf-xxx
LANGFUSE_PUBLIC_KEY=pk-lf-xxx
LANGFUSE_BASE_URL=https://cloud.langfuse.com
```

---

## Complete Agent Class

Save this as `kb_trace_client.py`:

```python
"""
Knowledge Base Trace Client for AI Agents
==========================================

A production-ready client for sending traces and feedback to the
Knowledge Base External Trace API.

Usage:
    from kb_trace_client import KBTraceClient
    
    client = KBTraceClient(base_url="http://localhost:3001")
    client.track_user_message(email="user@example.com", message="Hello", chat_id="123")
"""

import os
import socket
import logging
from typing import Optional, Dict, Any, List
from datetime import datetime
import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

logger = logging.getLogger(__name__)


class KBTraceClient:
    """Client for Knowledge Base External Trace API."""
    
    def __init__(
        self,
        base_url: str = None,
        api_key: str = None,
        source: str = "python-agent",
        default_tags: List[str] = None,
        timeout: int = 30,
        max_retries: int = 3
    ):
        """
        Initialize the trace client.
        
        Args:
            base_url: Knowledge Base API URL (default: from KB_API_URL env)
            api_key: API key for authentication (default: from KB_API_KEY env)
            source: Identifier for this agent/client
            default_tags: Tags to include with all traces
            timeout: Request timeout in seconds
            max_retries: Number of retry attempts for failed requests
        """
        self.base_url = (base_url or os.getenv("KB_API_URL", "http://localhost:3001")).rstrip("/")
        self.api_key = api_key or os.getenv("KB_API_KEY")
        self.source = source or os.getenv("AGENT_SOURCE", "python-agent")
        self.default_tags = default_tags or []
        self.timeout = timeout
        
        # Setup session with retry logic
        self.session = requests.Session()
        retry_strategy = Retry(
            total=max_retries,
            backoff_factor=0.5,
            status_forcelist=[429, 500, 502, 503, 504],
        )
        adapter = HTTPAdapter(max_retries=retry_strategy)
        self.session.mount("http://", adapter)
        self.session.mount("https://", adapter)
        
        # Set headers
        self.session.headers.update({
            "Content-Type": "application/json",
            "User-Agent": f"KBTraceClient/1.0 ({self.source})"
        })
        if self.api_key:
            self.session.headers["X-API-Key"] = self.api_key
        
        # Cache for IP address
        self._ip_address: Optional[str] = None
    
    def _get_ip_address(self) -> str:
        """Get the local IP address for logging."""
        if self._ip_address:
            return self._ip_address
        try:
            s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            s.connect(("8.8.8.8", 80))
            self._ip_address = s.getsockname()[0]
            s.close()
        except Exception:
            self._ip_address = "127.0.0.1"
        return self._ip_address
    
    def _make_request(self, endpoint: str, payload: Dict[str, Any]) -> Dict[str, Any]:
        """Make a POST request to the API."""
        url = f"{self.base_url}{endpoint}"
        try:
            response = self.session.post(url, json=payload, timeout=self.timeout)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            logger.error(f"API request failed: {e}")
            return {"success": False, "error": str(e)}
    
    def track_user_message(
        self,
        email: str,
        message: str,
        chat_id: str,
        ip_address: str = None,
        tags: List[str] = None,
        metadata: Dict[str, Any] = None
    ) -> Dict[str, Any]:
        """
        Track a user message in the conversation.
        
        Args:
            email: User's email (must be registered in Knowledge Base)
            message: The user's message content
            chat_id: Unique conversation/session identifier
            ip_address: Client IP (auto-detected if not provided)
            tags: Additional tags for categorization
            metadata: Extra metadata to include
            
        Returns:
            API response with traceId
        """
        payload = {
            "email": email,
            "message": message,
            "ipAddress": ip_address or self._get_ip_address(),
            "role": "user",
            "metadata": {
                "chatId": chat_id,
                "source": self.source,
                "tags": self.default_tags + (tags or []),
                "timestamp": datetime.utcnow().isoformat() + "Z",
                **(metadata or {})
            }
        }
        
        result = self._make_request("/api/external/trace/submit", payload)
        if result.get("success"):
            logger.debug(f"User message tracked: {result.get('traceId')}")
        else:
            logger.warning(f"Failed to track user message: {result.get('error')}")
        return result
    
    def track_assistant_response(
        self,
        email: str,
        user_message: str,
        response: str,
        chat_id: str,
        model: str = None,
        model_name: str = None,
        usage: Dict[str, int] = None,
        ip_address: str = None,
        tags: List[str] = None,
        metadata: Dict[str, Any] = None
    ) -> Dict[str, Any]:
        """
        Track an assistant/LLM response.
        
        Args:
            email: User's email
            user_message: The original user message (for context)
            response: The assistant's response content
            chat_id: Unique conversation/session identifier
            model: Model identifier (e.g., "gpt-4", "claude-3")
            model_name: Human-readable model name
            usage: Token usage dict with promptTokens, completionTokens, totalTokens
            ip_address: Client IP (auto-detected if not provided)
            tags: Additional tags
            metadata: Extra metadata
            
        Returns:
            API response with traceId (save this for feedback!)
        """
        meta = {
            "chatId": chat_id,
            "source": self.source,
            "tags": self.default_tags + (tags or []),
            "timestamp": datetime.utcnow().isoformat() + "Z",
            **(metadata or {})
        }
        
        if model:
            meta["model"] = model
        if model_name:
            meta["modelName"] = model_name
        if usage:
            meta["usage"] = usage
        
        payload = {
            "email": email,
            "message": user_message,
            "ipAddress": ip_address or self._get_ip_address(),
            "role": "assistant",
            "response": response,
            "metadata": meta
        }
        
        result = self._make_request("/api/external/trace/submit", payload)
        if result.get("success"):
            logger.debug(f"Assistant response tracked: {result.get('traceId')}")
        else:
            logger.warning(f"Failed to track assistant response: {result.get('error')}")
        return result
    
    def track_feedback(
        self,
        trace_id: str,
        value: int,
        comment: str = None
    ) -> Dict[str, Any]:
        """
        Track user feedback for a response.
        
        Args:
            trace_id: The traceId from track_assistant_response
            value: Feedback score (1 = positive, 0 = negative, or custom scale)
            comment: Optional feedback text
            
        Returns:
            API response
        """
        payload = {
            "traceId": trace_id,
            "value": value
        }
        if comment:
            payload["comment"] = comment
        
        result = self._make_request("/api/external/trace/feedback", payload)
        if result.get("success"):
            logger.debug(f"Feedback tracked for trace: {trace_id}")
        else:
            logger.warning(f"Failed to track feedback: {result.get('error')}")
        return result
    
    def track_conversation(
        self,
        email: str,
        user_message: str,
        assistant_response: str,
        chat_id: str,
        model: str = None,
        usage: Dict[str, int] = None
    ) -> Dict[str, Any]:
        """
        Convenience method to track both user message and assistant response.
        
        Args:
            email: User's email
            user_message: User's input
            assistant_response: LLM's output
            chat_id: Conversation identifier
            model: Model identifier
            usage: Token usage
            
        Returns:
            Dict with both trace results
        """
        user_result = self.track_user_message(
            email=email,
            message=user_message,
            chat_id=chat_id
        )
        
        assistant_result = self.track_assistant_response(
            email=email,
            user_message=user_message,
            response=assistant_response,
            chat_id=chat_id,
            model=model,
            usage=usage
        )
        
        return {
            "user_trace": user_result,
            "assistant_trace": assistant_result,
            "trace_id": assistant_result.get("traceId")
        }


# Singleton instance for easy import
_default_client: Optional[KBTraceClient] = None

def get_client(**kwargs) -> KBTraceClient:
    """Get or create the default trace client."""
    global _default_client
    if _default_client is None:
        _default_client = KBTraceClient(**kwargs)
    return _default_client
```

---

## Integration Patterns

### Pattern 1: Wrapper Function

```python
from kb_trace_client import KBTraceClient
import openai

client = KBTraceClient(source="openai-wrapper")

def chat_with_tracking(
    email: str,
    message: str,
    chat_id: str,
    model: str = "gpt-4"
) -> str:
    """Chat with OpenAI and track to Knowledge Base."""
    
    # Track user message
    client.track_user_message(
        email=email,
        message=message,
        chat_id=chat_id
    )
    
    # Call OpenAI
    response = openai.chat.completions.create(
        model=model,
        messages=[{"role": "user", "content": message}]
    )
    
    assistant_message = response.choices[0].message.content
    usage = {
        "promptTokens": response.usage.prompt_tokens,
        "completionTokens": response.usage.completion_tokens,
        "totalTokens": response.usage.total_tokens
    }
    
    # Track assistant response
    result = client.track_assistant_response(
        email=email,
        user_message=message,
        response=assistant_message,
        chat_id=chat_id,
        model=model,
        usage=usage
    )
    
    # Return response with trace_id for feedback
    return assistant_message, result.get("traceId")


# Usage
response, trace_id = chat_with_tracking(
    email="user@example.com",
    message="Explain quantum computing",
    chat_id="session-001"
)

# Later, when user gives feedback
client.track_feedback(trace_id=trace_id, value=1, comment="Great explanation!")
```

### Pattern 2: Decorator

```python
from functools import wraps
from kb_trace_client import get_client

def track_llm_call(source: str = "decorated-agent"):
    """Decorator to automatically track LLM calls."""
    def decorator(func):
        @wraps(func)
        def wrapper(email: str, message: str, chat_id: str, *args, **kwargs):
            client = get_client(source=source)
            
            # Track user input
            client.track_user_message(
                email=email,
                message=message,
                chat_id=chat_id
            )
            
            # Call the actual function
            result = func(email, message, chat_id, *args, **kwargs)
            
            # Extract response and usage from result
            if isinstance(result, tuple):
                response, usage = result[0], result[1] if len(result) > 1 else None
            else:
                response, usage = result, None
            
            # Track assistant response
            trace_result = client.track_assistant_response(
                email=email,
                user_message=message,
                response=response,
                chat_id=chat_id,
                usage=usage
            )
            
            return response, trace_result.get("traceId")
        return wrapper
    return decorator


# Usage
@track_llm_call(source="my-custom-agent")
def my_llm_function(email: str, message: str, chat_id: str):
    # Your LLM logic here
    response = "This is the LLM response"
    usage = {"promptTokens": 10, "completionTokens": 20, "totalTokens": 30}
    return response, usage

response, trace_id = my_llm_function(
    email="user@example.com",
    message="Hello",
    chat_id="session-001"
)
```

### Pattern 3: Context Manager

```python
from contextlib import contextmanager
from kb_trace_client import KBTraceClient

@contextmanager
def tracked_conversation(
    email: str,
    chat_id: str,
    source: str = "context-agent"
):
    """Context manager for tracking conversations."""
    client = KBTraceClient(source=source)
    conversation = {
        "email": email,
        "chat_id": chat_id,
        "messages": [],
        "trace_ids": []
    }
    
    def add_user_message(message: str):
        client.track_user_message(
            email=email,
            message=message,
            chat_id=chat_id
        )
        conversation["messages"].append({"role": "user", "content": message})
    
    def add_assistant_response(user_message: str, response: str, model: str = None, usage: dict = None):
        result = client.track_assistant_response(
            email=email,
            user_message=user_message,
            response=response,
            chat_id=chat_id,
            model=model,
            usage=usage
        )
        conversation["messages"].append({"role": "assistant", "content": response})
        conversation["trace_ids"].append(result.get("traceId"))
        return result.get("traceId")
    
    conversation["add_user"] = add_user_message
    conversation["add_assistant"] = add_assistant_response
    conversation["client"] = client
    
    yield conversation


# Usage
with tracked_conversation("user@example.com", "session-001") as conv:
    # User message
    conv["add_user"]("What is Python?")
    
    # Simulate LLM call
    response = "Python is a programming language..."
    trace_id = conv["add_assistant"](
        user_message="What is Python?",
        response=response,
        model="gpt-4"
    )
    
    # Add feedback
    conv["client"].track_feedback(trace_id, value=1)
```

---

## LangChain Integration

```python
from langchain.callbacks.base import BaseCallbackHandler
from langchain_openai import ChatOpenAI
from langchain.schema import HumanMessage
from kb_trace_client import KBTraceClient


class KBTraceCallback(BaseCallbackHandler):
    """LangChain callback handler for Knowledge Base tracing."""
    
    def __init__(
        self,
        email: str,
        chat_id: str,
        base_url: str = None,
        api_key: str = None
    ):
        self.email = email
        self.chat_id = chat_id
        self.client = KBTraceClient(
            base_url=base_url,
            api_key=api_key,
            source="langchain-agent"
        )
        self.current_input = None
        self.last_trace_id = None
    
    def on_llm_start(self, serialized, prompts, **kwargs):
        """Track when LLM starts processing."""
        if prompts:
            self.current_input = prompts[0]
            self.client.track_user_message(
                email=self.email,
                message=self.current_input,
                chat_id=self.chat_id
            )
    
    def on_llm_end(self, response, **kwargs):
        """Track LLM response."""
        if response.generations:
            output = response.generations[0][0].text
            
            # Extract usage if available
            usage = None
            if hasattr(response, 'llm_output') and response.llm_output:
                token_usage = response.llm_output.get('token_usage', {})
                if token_usage:
                    usage = {
                        "promptTokens": token_usage.get('prompt_tokens', 0),
                        "completionTokens": token_usage.get('completion_tokens', 0),
                        "totalTokens": token_usage.get('total_tokens', 0)
                    }
            
            result = self.client.track_assistant_response(
                email=self.email,
                user_message=self.current_input or "",
                response=output,
                chat_id=self.chat_id,
                model=kwargs.get('model', 'unknown'),
                usage=usage
            )
            self.last_trace_id = result.get("traceId")
    
    def submit_feedback(self, value: int, comment: str = None):
        """Submit feedback for the last response."""
        if self.last_trace_id:
            return self.client.track_feedback(
                trace_id=self.last_trace_id,
                value=value,
                comment=comment
            )


# Usage with LangChain
email = "user@example.com"
chat_id = "langchain-session-001"

callback = KBTraceCallback(
    email=email,
    chat_id=chat_id,
    base_url="http://localhost:3001"
)

llm = ChatOpenAI(
    model="gpt-4",
    callbacks=[callback]
)

# This will automatically track to Knowledge Base
response = llm.invoke([HumanMessage(content="What is machine learning?")])

# Submit feedback
callback.submit_feedback(value=1, comment="Excellent explanation!")
```

---

## OpenAI Agent Integration

```python
import openai
from kb_trace_client import KBTraceClient


class TrackedOpenAIAgent:
    """OpenAI agent with automatic Knowledge Base tracing."""
    
    def __init__(
        self,
        openai_api_key: str,
        kb_base_url: str = "http://localhost:3001",
        kb_api_key: str = None,
        model: str = "gpt-4",
        system_prompt: str = "You are a helpful assistant."
    ):
        self.openai_client = openai.OpenAI(api_key=openai_api_key)
        self.kb_client = KBTraceClient(
            base_url=kb_base_url,
            api_key=kb_api_key,
            source="openai-agent"
        )
        self.model = model
        self.system_prompt = system_prompt
        self.conversations: dict = {}
    
    def chat(
        self,
        email: str,
        message: str,
        chat_id: str = None
    ) -> tuple[str, str]:
        """
        Send a message and get a response with tracing.
        
        Returns:
            Tuple of (response_text, trace_id)
        """
        # Generate chat_id if not provided
        if not chat_id:
            chat_id = f"chat-{email}-{id(self)}"
        
        # Initialize conversation history
        if chat_id not in self.conversations:
            self.conversations[chat_id] = [
                {"role": "system", "content": self.system_prompt}
            ]
        
        # Add user message to history
        self.conversations[chat_id].append({
            "role": "user",
            "content": message
        })
        
        # Track user message
        self.kb_client.track_user_message(
            email=email,
            message=message,
            chat_id=chat_id
        )
        
        # Call OpenAI
        response = self.openai_client.chat.completions.create(
            model=self.model,
            messages=self.conversations[chat_id]
        )
        
        assistant_message = response.choices[0].message.content
        
        # Add assistant message to history
        self.conversations[chat_id].append({
            "role": "assistant",
            "content": assistant_message
        })
        
        # Track assistant response
        usage = {
            "promptTokens": response.usage.prompt_tokens,
            "completionTokens": response.usage.completion_tokens,
            "totalTokens": response.usage.total_tokens
        }
        
        result = self.kb_client.track_assistant_response(
            email=email,
            user_message=message,
            response=assistant_message,
            chat_id=chat_id,
            model=self.model,
            model_name=self.model,
            usage=usage
        )
        
        return assistant_message, result.get("traceId")
    
    def submit_feedback(self, trace_id: str, value: int, comment: str = None):
        """Submit feedback for a response."""
        return self.kb_client.track_feedback(
            trace_id=trace_id,
            value=value,
            comment=comment
        )
    
    def clear_history(self, chat_id: str):
        """Clear conversation history."""
        if chat_id in self.conversations:
            self.conversations[chat_id] = [
                {"role": "system", "content": self.system_prompt}
            ]


# Usage
agent = TrackedOpenAIAgent(
    openai_api_key="sk-...",
    kb_base_url="http://localhost:3001",
    kb_api_key="your-kb-api-key",
    model="gpt-4"
)

# Multi-turn conversation
response1, trace1 = agent.chat(
    email="user@example.com",
    message="What is Python?",
    chat_id="demo-session"
)
print(f"Response: {response1}")

response2, trace2 = agent.chat(
    email="user@example.com",
    message="How do I install it?",
    chat_id="demo-session"
)
print(f"Response: {response2}")

# Submit feedback
agent.submit_feedback(trace2, value=1, comment="Very helpful!")
```

---

## Error Handling

```python
from kb_trace_client import KBTraceClient
import logging

logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)


def safe_track_message(client: KBTraceClient, **kwargs):
    """Safely track a message with error handling."""
    try:
        result = client.track_user_message(**kwargs)
        if not result.get("success"):
            error = result.get("error", "Unknown error")
            if "not registered" in error.lower():
                logger.warning(f"User email not registered: {kwargs.get('email')}")
            else:
                logger.error(f"Tracking failed: {error}")
        return result
    except Exception as e:
        logger.exception(f"Exception during tracking: {e}")
        return {"success": False, "error": str(e)}


# Usage with retry logic
import time

def track_with_retry(client: KBTraceClient, max_retries: int = 3, **kwargs):
    """Track with exponential backoff retry."""
    for attempt in range(max_retries):
        result = safe_track_message(client, **kwargs)
        if result.get("success"):
            return result
        
        if attempt < max_retries - 1:
            wait_time = 2 ** attempt
            logger.info(f"Retrying in {wait_time}s...")
            time.sleep(wait_time)
    
    return result
```

---

## Best Practices

### 1. Use Consistent Chat IDs
```python
# Good: Use deterministic IDs
chat_id = f"user-{user_id}-session-{session_id}"

# Bad: Random IDs that can't be correlated
chat_id = str(uuid.uuid4())  # Loses conversation context
```

### 2. Always Track Usage for Cost Monitoring
```python
usage = {
    "promptTokens": response.usage.prompt_tokens,
    "completionTokens": response.usage.completion_tokens,
    "totalTokens": response.usage.total_tokens
}
```

### 3. Use Meaningful Tags
```python
tags = [
    "production",      # Environment
    "customer-support", # Use case
    "high-priority"    # Priority level
]
```

### 4. Store Trace IDs for Feedback
```python
# Store trace_id with the message in your UI/database
message_store[message_id] = {
    "content": response,
    "trace_id": result.get("traceId")
}

# Later, when feedback is received
trace_id = message_store[message_id]["trace_id"]
client.track_feedback(trace_id=trace_id, value=1)
```

### 5. Handle Graceful Degradation
```python
# Don't let tracking failures break your main flow
try:
    client.track_user_message(...)
except Exception as e:
    logger.warning(f"Tracking failed (non-critical): {e}")
    # Continue with main logic
```

---

## API Reference

### Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/external/trace/submit` | Submit user/assistant message |
| POST | `/api/external/trace/feedback` | Submit user feedback |

### Headers

| Header | Required | Description |
|--------|----------|-------------|
| `Content-Type` | Yes | `application/json` |
| `X-API-Key` | Optional | API key for authentication |

### Error Codes

| Error | Cause | Solution |
|-------|-------|----------|
| `Invalid email: not registered in system` | Email not in KB database | Register user first |
| `Failed to submit trace` | Server error | Check Langfuse config |
| `Failed to submit feedback` | Invalid trace_id | Verify trace_id exists |
