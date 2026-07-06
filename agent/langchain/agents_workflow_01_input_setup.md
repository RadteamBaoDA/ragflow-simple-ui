# Workflow 01: Input Setup

This workflow explains how to receive a user request and prepare the data needed
to run an agent.

## Objective

Convert a web/API request into a clean agent input dictionary:

```python
{
    "input": "What is the reimbursement limit?",
    "chat_history": [...],
}
```

The executor should receive only the fields the prompt expects. Security and
authorization context should be used by the backend, not blindly inserted into
the model prompt.

## Current Codebase Reference

`AgentExecutor` inherits from `Chain`, so it uses the chain input preparation
flow before `_call(...)` runs. The agent defines expected keys through
`input_keys`.

Key files:

- `libs/langchain/langchain_classic/agents/agent.py`
- `libs/langchain/langchain_classic/agents/openai_functions_agent/base.py`
- `libs/langchain/langchain_classic/agents/tool_calling_agent/base.py`

## Step 1: Define Request Type

Example API request:

```json
{
  "message": "What is the reimbursement limit for remote work equipment?",
  "conversation_id": "conv_123",
  "user_context": {
    "user_id": "u_123",
    "tenant_id": "tenant_a",
    "roles": ["employee"],
    "locale": "en-US",
    "timezone": "America/New_York"
  }
}
```

Use `message` for the public API if you prefer, but convert it to `input` before
calling the agent.

## Step 2: Validate The Request

Required validation:

- `message` is a non-empty string;
- length is within your configured limit;
- `conversation_id` exists or a new one is created;
- user is authenticated;
- tenant and role information is available;
- request does not exceed rate limits.

Example validation function:

```python
def validate_agent_request(payload: dict) -> str:
    message = payload.get("message")
    if not isinstance(message, str) or not message.strip():
        msg = "`message` must be a non-empty string."
        raise ValueError(msg)
    if len(message) > 8000:
        msg = "`message` is too long."
        raise ValueError(msg)
    return message.strip()
```

## Step 3: Load Chat History

For a chat-model prompt, use message objects:

```python
chat_history = [
    HumanMessage(content="Hi, my name is Sam."),
    AIMessage(content="Hello Sam. How can I help?"),
]
```

For a text-only ReAct prompt, convert history to a string:

```text
Human: Hi, my name is Sam.
AI: Hello Sam. How can I help?
```

Do not load unlimited history. Use a window or token buffer.

## Step 4: Build Agent Input

For tool-calling and OpenAI-functions prompts:

```python
agent_input = {
    "input": message,
    "chat_history": chat_history,
}
```

For a prompt without history:

```python
agent_input = {
    "input": message,
}
```

Only include keys that the prompt expects. Extra keys can cause template errors
or accidental prompt leakage.

## Step 5: Keep Security Context Out Of The Prompt By Default

Use user context for backend decisions:

- which tools are allowed;
- which vector stores are allowed;
- which metadata filters apply;
- what audit fields to write.

Do not automatically include roles, tenant IDs, or internal IDs in the prompt.
If the model needs user-facing context, add only a minimal safe summary.

Example:

```python
safe_context = {
    "locale": user_context["locale"],
}
```

## Step 6: Create Run Metadata

Create metadata before invoking the agent:

```python
run_metadata = {
    "run_id": create_run_id(),
    "conversation_id": conversation_id,
    "tenant_id": tenant_id,
    "user_id": user_id,
}
```

Use this for logs, callbacks, tracing, and response metadata.

## Step 7: Call The Agent

```python
raw_result = agent_executor.invoke(
    agent_input,
    config={
        "metadata": run_metadata,
        "tags": ["agent", "web"],
    },
)
```

## Junior Developer Mental Model

Input setup has two separate outputs:

```text
1. agent_input: safe data passed to the model/prompt
2. run_context: backend-only data used for auth, filters, logging, and tracing
```

Do not mix them.

Good:

```python
agent_input = {
    "input": "What is the reimbursement limit?",
    "chat_history": chat_history,
}

run_context = {
    "user_id": "u_123",
    "tenant_id": "tenant_a",
    "roles": ["employee"],
}
```

Bad:

```python
agent_input = {
    "input": "What is the reimbursement limit?",
    "tenant_id": "tenant_a",
    "roles": ["employee"],
    "internal_auth_token": "...",
}
```

The model does not need raw permission data. The backend uses permission data to
choose tools and retrieval filters before the model runs.

## End-To-End Input Setup Recipe

Use this implementation order in another project.

### 1. Receive HTTP Request

Example request body:

```json
{
  "message": "What is the remote work reimbursement limit?",
  "conversation_id": "conv_123"
}
```

Example route handler shape:

```python
def post_agent_message(request: Request) -> dict:
    payload = request.json()
    user = authenticate_request(request)
    return agent_service.answer(payload, user)
```

### 2. Authenticate User

Authentication should happen before any agent or tool is constructed.

```python
user = auth_service.get_current_user(request)
if user is None:
    msg = "Authentication required."
    raise PermissionError(msg)
```

### 3. Validate Message

```python
message = validate_agent_request(payload)
```

Validation should reject:

- empty messages;
- messages above the configured size limit;
- unsupported content types;
- missing required conversation or app IDs.

### 4. Load Conversation

```python
conversation_id = payload.get("conversation_id") or create_conversation(user)
chat_history = conversation_store.load_messages(
    conversation_id=conversation_id,
    user_id=user.id,
    limit=20,
)
```

Always verify the user can access the conversation.

### 5. Convert History To Prompt Format

For chat prompts:

```python
chat_history = [
    HumanMessage(content=item.content)
    if item.role == "user"
    else AIMessage(content=item.content)
    for item in stored_messages
]
```

For text-only ReAct prompts:

```python
chat_history_text = "\n".join(
    f"{item.role.title()}: {item.content}" for item in stored_messages
)
```

### 6. Build Run Context

```python
run_context = {
    "run_id": create_run_id(),
    "conversation_id": conversation_id,
    "user_id": user.id,
    "tenant_id": user.tenant_id,
    "roles": user.roles,
    "locale": user.locale,
    "timezone": user.timezone,
}
```

This object is for backend code.

### 7. Select Allowed Tools

```python
tools = []

if user.can("read_policies"):
    tools.append(create_policy_search_tool(user))

if user.can("search_issues"):
    tools.append(create_issue_search_tool(user))
```

This is part of input setup because the user's context determines the agent's
available action space.

### 8. Build Agent Input

```python
agent_input = {
    "input": message,
    "chat_history": chat_history,
}
```

If your prompt does not include `chat_history`, do not pass it.

### 9. Invoke Agent

```python
result = agent_executor.invoke(
    agent_input,
    config={
        "metadata": {
            "run_id": run_context["run_id"],
            "tenant_id": run_context["tenant_id"],
            "conversation_id": run_context["conversation_id"],
        },
        "tags": ["agent", "web"],
    },
)
```

### 10. Save Conversation

```python
conversation_store.append_user_message(conversation_id, message)
conversation_store.append_assistant_message(conversation_id, result["output"])
```

Save the final answer. Do not save raw scratchpad as normal chat messages.

## Input Shape By Agent Type

| Agent type | Typical input | History shape |
|---|---|---|
| Tool-calling chat agent | `{"input": str, "chat_history": list[BaseMessage]}` | Message list |
| OpenAI tools/functions agent | `{"input": str, "chat_history": list[BaseMessage]}` | Message list |
| ReAct text agent | `{"input": str, "chat_history": str}` | Text string |
| XML text agent | `{"input": str, "chat_history": str}` | Text string |
| Self-ask agent | `{"input": str}` | Usually none |

The prompt decides the required keys. Check `prompt.input_variables` before
calling the executor.

## Concrete Example Trace

Incoming request:

```json
{
  "message": "Does the remote work reimbursement include monitors?",
  "conversation_id": "conv_123"
}
```

Stored chat history:

```text
User: What is the remote work equipment reimbursement limit?
Assistant: The limit is 300 USD.
```

Backend builds:

```python
agent_input = {
    "input": "Does the remote work reimbursement include monitors?",
    "chat_history": [
        HumanMessage(content="What is the remote work equipment reimbursement limit?"),
        AIMessage(content="The limit is 300 USD."),
    ],
}
```

Backend also builds:

```python
run_context = {
    "run_id": "run_456",
    "conversation_id": "conv_123",
    "tenant_id": "tenant_a",
    "user_id": "u_123",
}
```

The model sees only the safe prompt inputs. The retriever uses `tenant_id` in a
metadata filter, but `tenant_id` does not need to appear in the prompt.

## Validation Helpers

### Message Validation

```python
def validate_message(message: object) -> str:
    if not isinstance(message, str):
        msg = "`message` must be a string."
        raise ValueError(msg)
    cleaned = message.strip()
    if not cleaned:
        msg = "`message` cannot be empty."
        raise ValueError(msg)
    if len(cleaned) > 8000:
        msg = "`message` is too long."
        raise ValueError(msg)
    return cleaned
```

### Prompt Input Validation

```python
def validate_prompt_inputs(prompt, agent_input: dict) -> None:
    required = set(prompt.input_variables)
    provided = set(agent_input)
    missing = required - provided - {"agent_scratchpad"}
    if missing:
        msg = f"Missing prompt inputs: {missing}"
        raise ValueError(msg)
```

`agent_scratchpad` is usually filled internally by the agent factory, not by the
API caller.

## Testing Input Setup

### Test Clean Input

```python
def test_build_agent_input() -> None:
    payload = {"message": "Hello", "conversation_id": "conv_1"}
    agent_input = build_agent_input(payload, chat_history=[])
    assert agent_input == {"input": "Hello", "chat_history": []}
```

### Test Empty Message

```python
def test_reject_empty_message() -> None:
    with pytest.raises(ValueError):
        validate_message("   ")
```

### Test Security Context Not Passed To Prompt

```python
def test_security_context_not_in_agent_input() -> None:
    agent_input = build_agent_input(payload, chat_history=[])
    assert "tenant_id" not in agent_input
    assert "roles" not in agent_input
    assert "token" not in agent_input
```

## Debugging Input Setup

Log safe metadata:

```python
logger.info("run_id=%s", run_context["run_id"])
logger.info("conversation_id=%s", run_context["conversation_id"])
logger.info("input_length=%s", len(agent_input["input"]))
logger.info("chat_history_count=%s", len(agent_input.get("chat_history", [])))
logger.info("tool_names=%s", [tool.name for tool in tools])
```

Do not log:

- auth tokens;
- full private documents;
- raw secrets;
- sensitive user profile fields.

## Common Mistakes

- Passing `message` to the executor when the prompt expects `input`.
- Passing chat history as strings to a chat prompt.
- Passing message objects to a text-only ReAct prompt.
- Forgetting to limit chat history length.
- Putting secrets or raw user permission data into the prompt.
- Reusing one agent executor across users when tools differ by permissions.

## Done Checklist

- [ ] User message is validated.
- [ ] Chat history is loaded and trimmed.
- [ ] Input keys match prompt variables.
- [ ] User context is used for backend authorization.
- [ ] Run metadata is created.
- [ ] Agent receives a clean input dictionary.
- [ ] User permissions are used to select tools before executor construction.
- [ ] Security context is not blindly inserted into the prompt.
- [ ] Tests cover valid input, invalid input, and prompt key matching.
