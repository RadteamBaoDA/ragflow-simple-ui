# Workflow 09: Error Handling

This workflow explains how to handle parser errors, invalid tools, tool
failures, and stop limits.

## Objective

Make agent failures understandable, recoverable where possible, and safe for
users.

## Current Codebase Reference

Key files:

- `libs/langchain/langchain_classic/agents/agent.py`
- `libs/langchain/langchain_classic/agents/tools.py`
- `libs/langchain/langchain_classic/agents/output_parsers/react_single_input.py`
- `libs/langchain/langchain_classic/agents/output_parsers/tools.py`

## Parser Errors

Parser errors happen when the model output cannot be converted into
`AgentAction` or `AgentFinish`.

Current executor setting:

```python
handle_parsing_errors: bool | str | Callable = False
```

Modes:

| Value | Behavior |
|---|---|
| `False` | Raise error immediately. |
| `True` | Send parser observation back to model as an `_Exception` action. |
| string | Send this string as the observation. |
| callable | Call function with exception and send return value as observation. |

Recommended user-facing default:

```python
handle_parsing_errors=True
```

## Invalid Tool

If the model asks for a tool that does not exist, executor calls `InvalidTool`.

Observation includes:

- requested tool name;
- available tool names.

This lets the model correct its tool choice in the next loop.

## Tool Timeout

Expected timeout:

```python
def policy_search(query: str) -> str:
    try:
        return retriever_search(query)
    except TimeoutError:
        return "Policy search timed out. Try a narrower question."
```

Unexpected timeout in infrastructure should be logged with run ID and surfaced
as a safe error.

## Permission Error

Permission errors should fail closed.

```python
if not user.can_use_tool("issue_tracker_search"):
    msg = "User is not allowed to use issue tracker search."
    raise PermissionError(msg)
```

Do not ask the model to decide whether the user has permission.

## Stop Limits

Set limits:

```python
AgentExecutor(
    max_iterations=10,
    max_execution_time=60,
)
```

When exceeded, current default output is:

```text
Agent stopped due to iteration limit or time limit.
```

For web apps, wrap this in a user-friendly message:

```markdown
I could not complete the request within the allowed steps. Try narrowing the
question or asking about one document/source at a time.
```

## Model Provider Errors

Examples:

- rate limit;
- authentication failure;
- context length exceeded;
- model unavailable.

Handling:

- retry safe transient errors with backoff;
- do not retry invalid credentials;
- reduce context or ask user to narrow query for context length issues;
- log provider error type and request ID if available.

## Tool Output Too Large

Large observations can break model context.

Mitigation:

- limit result count;
- summarize tool output;
- truncate with clear note;
- store full data as artifact;
- feed only relevant rows/chunks to the model.

## Safe Error Response

Do not return stack traces to users.

```json
{
  "answer_markdown": "I could not complete the request because policy search timed out. Try a narrower question.",
  "sources": [],
  "artifacts": [],
  "metadata": {
    "stop_reason": "tool_timeout"
  }
}
```

## Logging

Log:

- run ID;
- error type;
- tool name if applicable;
- sanitized input preview;
- iteration count;
- duration;
- stack trace in server logs only.

Do not log:

- API keys;
- raw credentials;
- full private prompts;
- sensitive document content unless policy allows it.

## Junior Developer Mental Model

Agent errors fall into five buckets:

| Bucket | Example | User sees | Developer sees |
|---|---|---|---|
| Input error | empty message | validation message | request details |
| Model/parser error | malformed ReAct output | retry or safe failure | raw parser exception |
| Tool error | search timeout | safe tool failure message | tool stack/logs |
| Permission error | unauthorized tool | access denied | user/tool policy details |
| Stop-limit error | too many iterations | narrow your question | iteration trace |

Do not handle every error the same way. Some should be retried, some should be
shown safely, and some should fail closed.

## Error Handling Decision Table

| Error | Retry? | Continue agent loop? | Final user message |
|---|---:|---:|---|
| Parser format error | Yes, if configured | Yes | Usually hidden unless retries fail |
| Invalid tool name | Yes | Yes | Usually hidden unless loop fails |
| Retriever no results | No | Yes | "I could not find matching sources." |
| Retriever timeout | Maybe | Maybe | "Search timed out. Try a narrower question." |
| Unauthorized tool | No | No | "You do not have access to that action." |
| Model rate limit | Yes with backoff | No | "The model is temporarily busy." |
| Context length exceeded | No | No | "The request/context is too large." |
| Max iterations | No | No | "I could not complete this within the allowed steps." |

## Parser Error Deep Dive

Text-based agents can produce malformed output.

Expected ReAct:

```text
Action: policy_search
Action Input: reimbursement limit
```

Bad output:

```text
I should search the policy database.
```

The parser cannot convert this into `AgentAction` or `AgentFinish`.

With:

```python
handle_parsing_errors=True
```

the executor feeds an observation back to the model:

```text
Invalid Format: Missing 'Action:' after 'Thought:'
```

The model can then try again.

Use a string when you want a simpler correction:

```python
AgentExecutor(
    handle_parsing_errors="Please respond with a valid tool call or final answer."
)
```

Use a callable when you want custom handling:

```python
def parser_error_message(error: OutputParserException) -> str:
    return "Your last response was not valid. Use the required action format."
```

## Tool Error Deep Dive

Tool implementations should distinguish expected and unexpected errors.

Expected no-result:

```python
def policy_search(query: str) -> str:
    docs = retriever.invoke(query)
    if not docs:
        return "No policy documents matched that query."
    return format_docs(docs)
```

Expected timeout:

```python
def policy_search(query: str) -> str:
    try:
        docs = retriever.invoke(query)
    except TimeoutError:
        return "Policy search timed out. Try a narrower query."
    return format_docs(docs)
```

Unexpected bug:

```python
def policy_search(query: str) -> str:
    try:
        return run_search(query)
    except TimeoutError:
        return "Policy search timed out. Try a narrower query."
    except Exception:
        logger.exception("Unexpected policy_search failure")
        raise
```

## Permission Error Deep Dive

Best pattern:

```text
do not include unauthorized tools in the tool list
```

If a user cannot search issues:

```python
tools = [policy_search_tool]
```

not:

```python
tools = [policy_search_tool, issue_search_tool]
```

If a permission error still happens inside a tool, fail closed:

```python
if not user.can_read_policy(policy_id):
    msg = "User is not allowed to read this policy."
    raise PermissionError(msg)
```

Do not convert permission errors into model-readable observations that might
invite the model to work around the restriction.

## Safe Error Serializer

Backend exception:

```python
try:
    raw = agent_executor.invoke(agent_input)
except PermissionError:
    return error_response("You do not have access to that action.", "permission_denied")
except TimeoutError:
    return error_response("The request timed out. Try a narrower question.", "timeout")
except Exception:
    logger.exception("agent run failed")
    return error_response("I could not complete the request.", "internal_error")
```

Helper:

```python
def error_response(message: str, error_type: str) -> dict:
    return {
        "answer_markdown": message,
        "sources": [],
        "artifacts": [],
        "metadata": {
            "stop_reason": "error",
            "error_type": error_type,
        },
    }
```

## Concrete Error Traces

### Invalid Tool Trace

```text
Model: call hr_search
Available tools: policy_search, calculator
Executor: InvalidTool observation
Model next call: call policy_search
```

This can recover.

### Permission Error Trace

```text
User lacks issue permission
Backend does not include issue_search tool
Model cannot call issue_search
```

This is better than letting the model call a forbidden tool.

### Max Iteration Trace

```text
Iteration 1: search policies
Iteration 2: search policies again
...
Iteration 10: still no final answer
Executor: stop response
```

This should be logged as an agent quality issue.

## Testing Errors

### Test Parser Retry

```python
def test_parser_error_can_retry() -> None:
    executor = AgentExecutor(
        agent=bad_then_good_agent,
        tools=[search_tool],
        handle_parsing_errors=True,
    )
    result = executor.invoke({"input": "hi"})
    assert "output" in result
```

### Test Permission Failure

```python
def test_unauthorized_tool_not_available() -> None:
    tools = build_tools_for_user(user_without_issue_permission)
    assert "issue_search" not in {tool.name for tool in tools}
```

### Test Safe Error Message

```python
def test_internal_error_hides_stack_trace() -> None:
    response = error_response("I could not complete the request.", "internal_error")
    assert "Traceback" not in response["answer_markdown"]
```

## Debugging Errors

When debugging an agent failure, collect:

```text
run_id
input length
tool names available
tool names called
iteration count
parser error count
last observation preview
stop reason
exception type
```

Do not start by changing the prompt. First identify which layer failed:

1. input setup;
2. prompt/model output;
3. parser;
4. tool;
5. executor loop;
6. serializer/frontend.

## Done Checklist

- [ ] Parser error policy is configured.
- [ ] Invalid tool errors are recoverable.
- [ ] Tool timeouts return safe messages.
- [ ] Permission errors fail closed.
- [ ] Stop limits are set.
- [ ] User-facing errors are safe.
- [ ] Server logs include enough details for debugging.
- [ ] Permission errors fail closed and are not delegated to the model.
- [ ] Tests cover parser retry, invalid tool, tool timeout, permission denial, and max-iteration stop.
- [ ] Error responses use the same web response contract as successful responses.
