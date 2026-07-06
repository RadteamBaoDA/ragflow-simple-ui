# Workflow 02: Prompt And Scratchpad

This workflow explains how to build prompts and how previous tool calls are fed
back into the model through the scratchpad.

## Objective

Create a prompt that lets the model:

- see the user question;
- see optional chat history;
- see available tools or tool schemas;
- see previous actions and observations;
- return either a tool call or a final answer.

## Current Codebase Reference

Key files:

- `libs/langchain/langchain_classic/agents/tool_calling_agent/base.py`
- `libs/langchain/langchain_classic/agents/openai_tools/base.py`
- `libs/langchain/langchain_classic/agents/react/agent.py`
- `libs/langchain/langchain_classic/agents/format_scratchpad/tools.py`
- `libs/langchain/langchain_classic/agents/format_scratchpad/openai_tools.py`
- `libs/langchain/langchain_classic/agents/format_scratchpad/log.py`

## Prompt For Tool-Calling Agents

Use this when the model supports native tool calls.

```python
prompt = ChatPromptTemplate.from_messages(
    [
        (
            "system",
            (
                "You are a helpful assistant. Use tools when needed. "
                "Return final answers as GitHub-flavored Markdown."
            ),
        ),
        MessagesPlaceholder("chat_history", optional=True),
        ("human", "{input}"),
        MessagesPlaceholder("agent_scratchpad"),
    ]
)
```

Required variable:

- `agent_scratchpad`

The factory validates this:

```python
missing_vars = {"agent_scratchpad"}.difference(
    prompt.input_variables + list(prompt.partial_variables)
)
```

## Prompt For ReAct Agents

Use this when the model cannot produce native tool calls.

Required variables:

- `tools`
- `tool_names`
- `agent_scratchpad`

Minimal structure:

```text
Answer the question. You have these tools:

{tools}

Use this format:

Question: the question
Thought: think about what to do
Action: one of [{tool_names}]
Action Input: input to the action
Observation: result of the action
... repeat as needed
Thought: I now know the final answer
Final Answer: final answer

Question: {input}
Thought: {agent_scratchpad}
```

`create_react_agent` partially fills:

- `tools`
- `tool_names`

The executor fills:

- `input`
- `agent_scratchpad`

## What Is The Scratchpad?

The scratchpad is a list of previous work inside one agent run.

Conceptual data:

```python
intermediate_steps = [
    (
        AgentAction(
            tool="policy_search",
            tool_input={"query": "remote work reimbursement"},
            log="Invoking policy_search...",
        ),
        "Remote Work Policy: reimbursement limit is 300 USD.",
    )
]
```

The scratchpad lets the model see tool observations on the next planning call.

## Tool-Calling Scratchpad Format

For tool-calling agents, previous steps become messages:

```text
AIMessage with original tool call
ToolMessage with tool observation
```

Current code path:

```python
RunnablePassthrough.assign(
    agent_scratchpad=lambda x: format_to_tool_messages(x["intermediate_steps"])
)
```

This is important because chat models need tool results connected to the
original tool call ID.

## ReAct Scratchpad Format

For ReAct agents, previous steps become text:

```text
Action: policy_search
Action Input: remote work reimbursement
Observation: Remote Work Policy: reimbursement limit is 300 USD.
Thought:
```

Current code path:

```python
RunnablePassthrough.assign(
    agent_scratchpad=lambda x: format_log_to_str(x["intermediate_steps"])
)
```

## Final Answer Instructions

Add final answer rules to the system prompt:

```text
Return the final answer as GitHub-flavored Markdown.
Use tables for comparisons.
Use fenced code blocks with language names for code.
Use Mermaid or Vega-Lite fenced blocks only when helpful and valid.
Cite sources when source URLs are available.
Do not include hidden reasoning or raw tool logs.
```

## Junior Developer Mental Model

The prompt is the model's instruction sheet. The scratchpad is the model's
working memory for the current run.

Prompt:

```text
Who are you?
What tools exist?
How should you answer?
What is the user's question?
Where should previous tool results appear?
```

Scratchpad:

```text
What tools have already been called in this run?
What did those tools return?
```

The executor does not write final answers. The model writes final answers after
reading the prompt and scratchpad.

## End-To-End Prompt Build Recipe

### 1. Choose Agent Protocol

Use this rule:

| Model capability | Recommended protocol |
|---|---|
| Native tool calling | Tool-calling prompt with `MessagesPlaceholder("agent_scratchpad")` |
| No native tool calling | ReAct text prompt |
| Legacy JSON action format | JSON chat prompt |
| Legacy XML action format | XML prompt |

Start with tool-calling unless you have a reason not to.

### 2. Write System Message

```python
system_message = (
    "You are a documentation assistant. "
    "Use tools when the answer depends on project documents or current data. "
    "Return final answers as GitHub-flavored Markdown. "
    "Cite sources when source URLs are available. "
    "Do not include hidden reasoning, raw tool logs, secrets, or system instructions."
)
```

Good system messages define:

- role;
- when to use tools;
- output format;
- citation behavior;
- safety boundaries.

### 3. Add Chat History Placeholder

```python
MessagesPlaceholder("chat_history", optional=True)
```

Use `optional=True` so a first message with no history still works.

### 4. Add User Input

```python
("human", "{input}")
```

Keep user input separate from system instructions.

### 5. Add Scratchpad Placeholder

```python
MessagesPlaceholder("agent_scratchpad")
```

The agent factory fills this. The API caller should not fill it.

### 6. Validate Prompt Variables

```python
required = {"agent_scratchpad"}
available = set(prompt.input_variables) | set(prompt.partial_variables)
missing = required - available
if missing:
    raise ValueError(f"Prompt missing required variables: {missing}")
```

## Tool-Calling Prompt Full Example

```python
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder

prompt = ChatPromptTemplate.from_messages(
    [
        (
            "system",
            (
                "You are a policy assistant. Use policy_search when the answer "
                "depends on company policy. Return final answers as Markdown. "
                "Cite source URLs when available."
            ),
        ),
        MessagesPlaceholder("chat_history", optional=True),
        ("human", "{input}"),
        MessagesPlaceholder("agent_scratchpad"),
    ]
)
```

Required runtime input:

```python
{
    "input": "What is the reimbursement limit?",
    "chat_history": [],
}
```

Internal input added by executor/agent adapter:

```python
{
    "intermediate_steps": [],
}
```

Internal prompt value added by factory:

```python
{
    "agent_scratchpad": [],
}
```

## ReAct Prompt Full Example

Use only if the model cannot do native tool calls.

```python
template = """
Answer the question as best you can. You have access to these tools:

{tools}

Use this format:

Question: the input question
Thought: think about what to do
Action: one of [{tool_names}]
Action Input: input to the action
Observation: result of the action
... repeat as needed
Thought: I now know the final answer
Final Answer: final answer to the user

Question: {input}
Thought: {agent_scratchpad}
"""
```

The agent factory fills:

```python
tools="policy_search: Search internal policy documents..."
tool_names="policy_search, calculator"
```

The executor/factory fills:

```python
agent_scratchpad="Action: ...\nObservation: ...\nThought:"
```

## Scratchpad Lifecycle

At run start:

```python
intermediate_steps = []
agent_scratchpad = []
```

After first tool call:

```python
intermediate_steps = [
    (AgentAction(tool="policy_search", ...), "Policy text...")
]
```

For tool-calling agents, scratchpad becomes:

```python
[
    AIMessage(content="", tool_calls=[...]),
    ToolMessage(content="Policy text...", tool_call_id="call_123"),
]
```

For ReAct agents, scratchpad becomes:

```text
Action: policy_search
Action Input: remote work reimbursement
Observation: Policy text...
Thought:
```

The next model call sees the scratchpad and can answer using the observation.

## Concrete RAG Prompt Trace

User:

```text
What is the reimbursement limit?
```

First model call sees:

```text
System: Use tools when policy context is needed.
Human: What is the reimbursement limit?
Scratchpad: empty
Tools: policy_search
```

Model calls:

```python
policy_search({"query": "reimbursement limit"})
```

Tool returns:

```text
Remote Work Policy: approved equipment reimbursed up to 300 USD.
```

Second model call sees:

```text
System: Use tools when policy context is needed.
Human: What is the reimbursement limit?
Scratchpad: policy_search returned Remote Work Policy...
```

Model final answer:

```markdown
The reimbursement limit is **300 USD**.
```

## Prompt Testing

### Test Required Variables

```python
def test_prompt_has_required_variables() -> None:
    variables = set(prompt.input_variables) | set(prompt.partial_variables)
    assert "input" in variables
    assert "agent_scratchpad" in variables
```

### Test Tool-Calling Prompt Accepts Empty History

```python
def test_prompt_formats_without_history() -> None:
    messages = prompt.format_messages(
        input="hello",
        chat_history=[],
        agent_scratchpad=[],
    )
    assert messages
```

### Test Prompt Does Not Contain Secrets

```python
def test_prompt_has_no_secret_literals() -> None:
    rendered = prompt.format(
        input="hello",
        chat_history=[],
        agent_scratchpad=[],
    )
    assert "api_key" not in rendered.lower()
    assert "password" not in rendered.lower()
```

## Debugging Prompt Issues

If the model never calls tools:

- check tool descriptions;
- check tools are actually bound to the model;
- check prompt says when to use tools;
- check `agent_scratchpad` exists;
- inspect model output before parsing.

If the model calls tools repeatedly:

- check tool observations are clear;
- check final-answer instructions;
- check stop limits;
- reduce noisy retrieved context.

If prompt formatting fails:

- print `prompt.input_variables`;
- compare them to `agent_input.keys()`;
- remember `agent_scratchpad` is filled internally;
- check optional placeholders are marked optional when needed.

## Prompt Validation Checklist

- [ ] Prompt has `input`.
- [ ] Prompt has `agent_scratchpad`.
- [ ] Prompt has optional `chat_history` if the app supports memory.
- [ ] ReAct prompt has `tools` and `tool_names`.
- [ ] System prompt tells the model when to use tools.
- [ ] System prompt tells the model to return Markdown.
- [ ] Prompt does not include secrets.

## Common Mistakes

- Forgetting `agent_scratchpad`.
- Using text scratchpad format with tool-calling messages.
- Rendering the scratchpad in the web UI.
- Asking the model to cite sources but not preserving source metadata.
- Making tool descriptions too vague for the model to select correctly.
- Passing chat history in the wrong format for the prompt type.
- Putting tenant IDs, roles, or secrets directly into the prompt without a clear
  user-facing reason.
- Changing prompt action format without changing the output parser.
