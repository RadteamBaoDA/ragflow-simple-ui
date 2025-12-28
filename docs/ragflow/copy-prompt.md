# Prompt Library Integration with RAGFlow

## Overview
The Prompt Library modal allows users to select prompts and inject them directly into the RAGFlow chat textarea. This feature uses `postMessage` to communicate between the parent application and the RAGFlow iframe.

## How It Works

1. User opens the Prompt Library modal in the chat interface
2. User clicks on a prompt to select it
3. The parent application sends a `postMessage` to the iframe:
   ```javascript
   iframeRef.current.contentWindow.postMessage(
     { type: 'INSERT_PROMPT', payload: promptText },
     '*'
   );
   ```
4. RAGFlow receives the message and inserts the text into the textarea

## RAGFlow Message Handler (Required)

For this feature to work, the RAGFlow application running inside the iframe needs to have a message listener that handles the `INSERT_PROMPT` message type.

Add the following code to RAGFlow's initialization (e.g., in the main chat component):

```javascript
// Listen for prompt injection messages from parent window
window.addEventListener('message', (event) => {
  if (event.data?.type === 'INSERT_PROMPT') {
    const textarea = document.querySelector('textarea');
    if (textarea) {
      // Set the textarea value
      textarea.value = event.data.payload;
      
      // Trigger input event for React to detect the change
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
      
      // Focus the textarea so user can immediately edit or submit
      textarea.focus();
    }
  }
});
```

## Message Format

| Field | Type | Description |
|-------|------|-------------|
| `type` | `string` | Must be `'INSERT_PROMPT'` |
| `payload` | `string` | The prompt text to insert into the textarea |

## Security Considerations

- The message listener should validate the origin of incoming messages in production
- Consider using a specific origin instead of `'*'` for security:
  ```javascript
  // In RagflowIframe.tsx
  iframeRef.current.contentWindow.postMessage(
    { type: 'INSERT_PROMPT', payload: text },
    'https://your-ragflow-domain.com'  // Replace '*' with actual domain
  );
  ```

## Troubleshooting

1. **Prompt not appearing in textarea**: Check browser console for the `[RagflowIframe] Sent prompt to iframe:` log message
2. **Message not received**: Ensure RAGFlow has the message listener code implemented
3. **React state not updating**: Make sure to dispatch the `input` event after setting the value