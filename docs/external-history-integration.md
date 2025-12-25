# External History Integration Guide

This guide explains how to integrate your external ReactJS application (e.g., RAGFlow) with the Knowledge Base External History API. This API allows you to store and retrieve chat and search history securely.

## Prerequisites

1.  **API Key**: You must have a valid API Key configured in the backend (`EXTERNAL_TRACE_API_KEY` in `.env`).
2.  **Base URL**: The base URL of the Knowledge Base API (e.g., `https://api.knowledge-base.com`).

## 1. Environment Configuration

Add the following environment variables to your ReactJS application:

```env
REACT_APP_KB_API_URL=https://api.knowledge-base.com
REACT_APP_KB_API_KEY=your-secure-api-key
```

## 2. API Client Implementation

Create an API client helper to handle requests.

```typescript
// api.ts
const API_BASE_URL = process.env.REACT_APP_KB_API_URL;
const API_KEY = process.env.REACT_APP_KB_API_KEY;

export async function sendHistory(endpoint: string, data: any) {
  try {
    const response = await fetch(`${API_BASE_URL}/api/external/history/${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY,
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      console.error('Failed to send history:', await response.text());
    }
  } catch (error) {
    console.error('Error sending history:', error);
  }
}
```

## 3. Usage Examples

### 3.1 Collect Chat History

Call this function after a chat completion event.

```typescript
import { sendHistory } from './api';

// Example data
const chatData = {
  session_id: "unique-session-id-123",
  user_prompt: "What is the capital of France?",
  llm_response: "The capital of France is Paris.",
  citations: ["Source A", "Source B"] // Optional
};

// Send to backend
sendHistory('chat', chatData);
```

### 3.2 Collect Search History

Call this function after a search operation is completed.

```typescript
import { sendHistory } from './api';

// Example data
const searchData = {
  search_input: "revenue report 2023",
  ai_summary: "The revenue for 2023 was $10M...",
  file_results: ["report_2023.pdf", "q4_summary.docx"]
};

// Send to backend
sendHistory('search', searchData);
```

## 4. Troubleshooting

*   **401 Unauthorized**: Check if `x-api-key` header matches the backend configuration.
*   **400 Bad Request**: Ensure all required fields are present in the payload.
*   **500 Internal Server Error**: Check backend logs for processing errors.

## 5. View History

You can view the collected history in the Knowledge Base UI under the "External History" section.
