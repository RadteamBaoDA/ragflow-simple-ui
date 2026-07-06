# Workflow 08: Memory And Conversation

This workflow explains how to support chat history and follow-up questions.

## Objective

Let users ask follow-up questions while keeping token usage controlled and
avoiding stale or unauthorized context.

## Current Codebase Reference

Key files:

- `libs/langchain/langchain_classic/agents/agent_toolkits/conversational_retrieval/openai_functions.py`
- `libs/langchain/langchain_classic/agents/openai_functions_agent/agent_token_buffer_memory.py`

## Memory Types

### Chat History

Stores user and assistant messages:

```python
[
    HumanMessage(content="What is the remote work policy?"),
    AIMessage(content="The policy says..."),
]
```

This is the most common memory.

### Intermediate Step Memory

Stores previous tool actions and observations.

Benefit:

- follow-up questions can reuse previous retrieved information.

Risk:

- uses more tokens;
- can include stale tool observations;
- may expose internal tool details if serialized incorrectly.

## Current Conversational Retrieval Agent

`create_conversational_retrieval_agent(...)` chooses memory based on:

```python
remember_intermediate_steps: bool = True
```

If true:

- uses `AgentTokenBufferMemory`;
- returns intermediate steps;
- remembers prior action/observation pairs.

If false:

- uses `ConversationTokenBufferMemory`;
- remembers normal chat messages only.

## Recommended Default

For most web apps:

```text
remember chat history, not intermediate steps
```

Use intermediate step memory only when the product clearly needs it, such as
multi-turn research over the same retrieved corpus.

## Step 1: Load Conversation

```python
chat_history = conversation_store.load_messages(conversation_id, limit=20)
```

Limit by:

- message count;
- token count;
- time window;
- conversation branch.

## Step 2: Trim Or Summarize

Options:

- last N messages;
- token buffer;
- summary plus recent messages;
- retrieve relevant past messages.

Do not pass unbounded history to the model.

## Step 3: Add History To Prompt

Chat prompt:

```python
prompt = ChatPromptTemplate.from_messages(
    [
        ("system", "You are a helpful assistant."),
        MessagesPlaceholder("chat_history", optional=True),
        ("human", "{input}"),
        MessagesPlaceholder("agent_scratchpad"),
    ]
)
```

Invoke:

```python
agent_executor.invoke(
    {
        "input": message,
        "chat_history": chat_history,
    }
)
```

## Step 4: Save Final Conversation

After final output:

```python
conversation_store.append(
    conversation_id,
    HumanMessage(content=message),
    AIMessage(content=result["output"]),
)
```

Save the rendered answer, not raw internal scratchpad.

## Follow-Up Question Example

Turn 1:

```text
User: What is the ergonomic equipment limit?
Assistant: The limit is 300 USD.
```

Turn 2:

```text
User: Does that include monitors?
```

The model can use chat history to understand "that" refers to ergonomic
equipment. It may still call retrieval if it needs policy details about monitors.

## Memory Security

- Do not share memory across tenants.
- Do not load messages from conversations the user cannot access.
- Redact secrets before storing if necessary.
- Do not store raw tool credentials.
- Do not put hidden system prompts in memory.

## Junior Developer Mental Model

Memory is not one thing. Treat it as separate buckets:

| Bucket | Example | Should model see it? |
|---|---|---|
| Chat history | previous user/assistant messages | Usually yes, trimmed |
| Current scratchpad | current tool calls and observations | Yes, during current run |
| Retrieved documents | vector DB chunks | Only relevant chunks |
| Long-term profile | user preferences | Only safe, relevant facts |
| Audit logs | tool calls and metadata | No, backend only |

Most bugs happen when these buckets are mixed.

## End-To-End Memory Recipe

### 1. Load Recent Chat History

```python
stored_messages = conversation_store.load_messages(
    conversation_id=conversation_id,
    user_id=user.id,
    limit=20,
)
```

### 2. Convert To Prompt Messages

```python
chat_history = []
for message in stored_messages:
    if message.role == "user":
        chat_history.append(HumanMessage(content=message.content))
    elif message.role == "assistant":
        chat_history.append(AIMessage(content=message.content))
```

### 3. Trim To Token Budget

Conceptual:

```python
chat_history = trim_messages_to_token_budget(
    chat_history,
    max_tokens=2000,
)
```

Keep recent messages first. If older context is important, summarize it.

### 4. Invoke Agent

```python
result = agent_executor.invoke(
    {
        "input": user_message,
        "chat_history": chat_history,
    }
)
```

### 5. Save Final Messages

```python
conversation_store.append_user_message(conversation_id, user_message)
conversation_store.append_assistant_message(conversation_id, result["output"])
```

Do not save raw `intermediate_steps` as normal assistant messages.

## Follow-Up Question Trace

Turn 1:

```text
User: What is the remote work equipment reimbursement limit?
Assistant: The limit is 300 USD.
```

Turn 2:

```text
User: Does that include monitors?
```

Agent input:

```python
{
    "input": "Does that include monitors?",
    "chat_history": [
        HumanMessage(content="What is the remote work equipment reimbursement limit?"),
        AIMessage(content="The limit is 300 USD."),
    ],
}
```

The model can understand:

```text
"that" = remote work equipment reimbursement
```

It may still call retrieval:

```python
policy_search({"query": "remote work equipment reimbursement monitors"})
```

## Chat History Vs RAG Context

Chat history tells the model what the conversation is about.

RAG context tells the model what the source documents say.

Example:

```text
Chat history: user asked about reimbursement
RAG context: policy says monitors are included if approved
Final answer: yes, monitors are included if approved
```

Do not assume chat history replaces retrieval. A follow-up question can still
need fresh document context.

## Summarization Strategy

When history grows too long:

```text
old messages -> summary
recent messages -> keep verbatim
```

Example prompt memory:

```text
Conversation summary: The user is asking about remote work reimbursements.
Recent messages:
User: What is the equipment limit?
Assistant: The limit is 300 USD.
```

Rules:

- never summarize secrets into memory;
- mark summaries as summaries;
- refresh summary when new important facts appear;
- keep source-backed facts separate from guesses.

## Intermediate Step Memory Decision

Use `remember_intermediate_steps=True` only when:

- follow-up questions need previous tool observations;
- users are doing multi-step research;
- token budget can handle tool observations;
- tool observations are safe to retain.

Avoid it when:

- tool observations are large;
- tool observations may become stale;
- tools return sensitive raw data;
- simple chat history is enough.

## Memory Storage Schema

Simple message table:

```json
{
  "conversation_id": "conv_123",
  "message_id": "msg_456",
  "role": "assistant",
  "content": "The limit is 300 USD.",
  "created_at": "2026-07-06T10:00:00Z",
  "metadata": {
    "run_id": "run_789"
  }
}
```

Optional run table:

```json
{
  "run_id": "run_789",
  "conversation_id": "conv_123",
  "tools_called": ["policy_search"],
  "source_ids": ["remote-work-policy"],
  "duration_ms": 1200
}
```

Keep run/debug data separate from user-visible chat messages.

## Testing Memory

### Test History Is Included

```python
def test_agent_input_includes_chat_history() -> None:
    agent_input = build_agent_input("Does that include monitors?", history)
    assert "chat_history" in agent_input
    assert len(agent_input["chat_history"]) == len(history)
```

### Test History Is Trimmed

```python
def test_history_is_trimmed() -> None:
    long_history = make_messages(100)
    trimmed = trim_history(long_history, max_messages=20)
    assert len(trimmed) == 20
```

### Test Tenant Isolation

```python
def test_cannot_load_other_tenant_conversation() -> None:
    with pytest.raises(PermissionError):
        conversation_store.load_messages("other_tenant_conv", user_id="u_123")
```

## Debugging Memory

Log safe counts:

```python
logger.info("conversation_id=%s", conversation_id)
logger.info("history_message_count=%s", len(chat_history))
logger.info("history_token_estimate=%s", estimate_tokens(chat_history))
```

If follow-up questions fail:

- check chat history was loaded;
- check format matches prompt type;
- check history was not trimmed too aggressively;
- check retrieval query includes resolved context;
- check prompt has `MessagesPlaceholder("chat_history")`.

## Common Mistakes

- Passing all historical messages forever.
- Saving raw intermediate steps as user-visible chat messages.
- Reusing one memory object across users.
- Forgetting that follow-up questions may still require retrieval.
- Letting stale retrieved context override fresh retrieval.
- Mixing audit logs, scratchpad, and chat history in one prompt field.
- Loading conversation history before checking user permission.

## Done Checklist

- [ ] Chat history is loaded by conversation ID and user permission.
- [ ] History is trimmed or summarized.
- [ ] Prompt includes `chat_history`.
- [ ] Final message is saved after successful run.
- [ ] Raw scratchpad is not shown as chat history.
- [ ] Memory is isolated by tenant/user.
- [ ] Follow-up questions are tested.
- [ ] Long conversations are trimmed or summarized.
- [ ] Run/debug metadata is stored separately from chat messages.
