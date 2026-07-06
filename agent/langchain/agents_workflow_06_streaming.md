# Workflow 06: Streaming

This workflow explains how to stream agent progress to a web client.

## Objective

Show progress while the agent is running:

- run started;
- agent selected a tool;
- tool returned results;
- final answer is ready.

Classic `AgentExecutor` streams actions and steps. It does not always stream
individual model tokens unless model callbacks are also wired.

## Current Codebase Reference

Key files:

- `libs/langchain/langchain_classic/agents/agent.py`
- `libs/langchain/langchain_classic/agents/agent_iterator.py`

Important methods:

- `AgentExecutor.stream`
- `AgentExecutor.astream`
- `AgentExecutorIterator.__iter__`
- `AgentExecutorIterator.__aiter__`

## Executor Streaming

`AgentExecutor.stream(...)` creates:

```python
AgentExecutorIterator(
    self,
    input,
    callbacks,
    yield_actions=True,
)
```

With `yield_actions=True`, the iterator can yield:

```python
{"actions": [AgentAction(...)], "messages": [...]}
{"steps": [AgentStep(...)], "messages": [...]}
{"output": "...", "messages": [...]}
```

## Web Event Mapping

Convert internal chunks to stable public events.

| Internal chunk | Public event |
|---|---|
| `actions` | `agent_action` |
| `steps` | `tool_result` |
| final `output` | `final` |
| exception | `error` |

Example events:

```json
{"type": "run_started", "run_id": "run_123"}
{"type": "agent_action", "tool": "policy_search", "input_preview": "remote work"}
{"type": "tool_result", "tool": "policy_search", "source_count": 5}
{"type": "final", "answer_markdown": "## Answer\n\n..."}
```

## Do Not Stream Hidden Reasoning

Do not stream raw model reasoning or scratchpad text to normal users.

Safe to stream:

- tool name;
- sanitized input preview;
- status message;
- source count;
- elapsed time;
- final answer.

Unsafe to stream:

- system prompt;
- full scratchpad;
- raw internal observations with secrets;
- hidden chain-of-thought;
- access tokens.

## Streaming API Pseudocode

```python
def stream_agent_response(agent_executor, agent_input):
    yield {"type": "run_started", "run_id": run_id}

    try:
        for chunk in agent_executor.stream(agent_input):
            if "actions" in chunk:
                for action in chunk["actions"]:
                    yield {
                        "type": "agent_action",
                        "tool": action.tool,
                        "input_preview": preview(action.tool_input),
                    }
            elif "steps" in chunk:
                for step in chunk["steps"]:
                    yield {
                        "type": "tool_result",
                        "tool": step.action.tool,
                        "summary": summarize_observation(step.observation),
                    }
            elif "output" in chunk:
                yield {
                    "type": "final",
                    "answer_markdown": chunk["output"],
                    "sources": source_collector.to_list(),
                }
    except Exception as error:
        yield {"type": "error", "message": safe_error_message(error)}
```

## Server-Sent Events Format

For SSE:

```text
event: agent_action
data: {"tool":"policy_search","input_preview":"remote work"}

event: final
data: {"answer_markdown":"## Answer\n\n..."}
```

## WebSocket Format

For WebSocket:

```json
{
  "type": "agent_action",
  "run_id": "run_123",
  "tool": "policy_search"
}
```

## Token Streaming

If the product requires token-by-token final answer rendering:

1. Enable streaming on the model.
2. Add callbacks that receive model tokens.
3. Correlate token events with the current run ID.
4. Still keep executor action/step events for tool progress.

Important: tool-calling models often emit structured tool calls before final
answer tokens. The UI should handle both phases.

## Frontend Behavior

Recommended UI states:

| Event | UI behavior |
|---|---|
| `run_started` | Disable send button and show pending state. |
| `agent_action` | Show "Searching policies..." or similar. |
| `tool_result` | Update source side panel or progress message. |
| `final` | Render Markdown answer and sources. |
| `error` | Show safe error message and allow retry. |

## Junior Developer Mental Model

Streaming is not a different agent. It is the same agent loop, but the backend
sends progress events before the run is finished.

Normal invoke:

```text
request -> wait -> final response
```

Streaming:

```text
request -> run_started -> agent_action -> tool_result -> final
```

The most important rule:

```text
Stream product-safe events, not raw internal state.
```

## Internal Chunk To Public Event Recipe

LangChain internal chunk:

```python
{"actions": [AgentAction(tool="policy_search", tool_input=...)]}
```

Public event:

```json
{
  "type": "agent_action",
  "tool": "policy_search",
  "label": "Searching policies"
}
```

LangChain internal chunk:

```python
{"steps": [AgentStep(action=..., observation="...")]}
```

Public event:

```json
{
  "type": "tool_result",
  "tool": "policy_search",
  "source_count": 4
}
```

LangChain internal chunk:

```python
{"output": "## Answer\n\n..."}
```

Public event:

```json
{
  "type": "final",
  "answer_markdown": "## Answer\n\n...",
  "sources": []
}
```

## End-To-End Streaming Handler

```python
def stream_agent_response(agent_executor, agent_input, source_collector):
    run_id = create_run_id()
    yield {
        "type": "run_started",
        "run_id": run_id,
    }

    try:
        for chunk in agent_executor.stream(
            agent_input,
            config={"metadata": {"run_id": run_id}},
        ):
            if "actions" in chunk:
                for action in chunk["actions"]:
                    yield {
                        "type": "agent_action",
                        "run_id": run_id,
                        "tool": action.tool,
                        "input_preview": preview_tool_input(action.tool_input),
                    }

            elif "steps" in chunk:
                for step in chunk["steps"]:
                    yield {
                        "type": "tool_result",
                        "run_id": run_id,
                        "tool": step.action.tool,
                        "summary": summarize_observation(step.observation),
                        "sources": source_collector.to_list(),
                    }

            elif "output" in chunk:
                yield {
                    "type": "final",
                    "run_id": run_id,
                    "answer_markdown": chunk["output"],
                    "sources": source_collector.to_list(),
                }

    except Exception as error:
        yield {
            "type": "error",
            "run_id": run_id,
            "message": safe_error_message(error),
        }
```

## SSE Implementation Details

Server-Sent Events are good for one-way streaming from backend to browser.

Each event is text:

```text
event: agent_action
data: {"run_id":"run_123","tool":"policy_search"}

```

Helper:

```python
def to_sse(event: dict) -> str:
    event_type = event["type"]
    data = json.dumps(event)
    return f"event: {event_type}\ndata: {data}\n\n"
```

Route:

```python
def sse_route(request):
    def generate():
        for event in stream_agent_response(executor, agent_input, source_collector):
            yield to_sse(event)

    return StreamingResponse(generate(), media_type="text/event-stream")
```

## WebSocket Implementation Details

Use WebSocket when:

- client needs to cancel runs interactively;
- backend and frontend need bidirectional messages;
- multiple channels are multiplexed over one connection.

Message shape:

```json
{
  "type": "agent_action",
  "run_id": "run_123",
  "tool": "policy_search"
}
```

Keep message types identical between SSE and WebSocket when possible.

## Token Streaming Vs Step Streaming

There are two kinds of streaming:

| Type | What it streams | Where it comes from |
|---|---|---|
| Step streaming | tool actions, tool results, final output | `AgentExecutor.stream` |
| Token streaming | individual model tokens | model callbacks / model stream |

`AgentExecutor.stream` is enough to show:

- "Searching policies";
- "Found 4 sources";
- final answer.

It may not be enough to show the final answer token-by-token. For token
streaming, wire model callbacks and emit token events:

```json
{"type": "token", "text": "The"}
{"type": "token", "text": " limit"}
```

## Concrete RAG Streaming Trace

User asks:

```text
What is the reimbursement limit?
```

Events:

```json
{"type": "run_started", "run_id": "run_1"}
{"type": "agent_action", "tool": "policy_search", "input_preview": "reimbursement limit"}
{"type": "tool_result", "tool": "policy_search", "source_count": 2}
{"type": "final", "answer_markdown": "The limit is **300 USD**.", "sources": [...]}
```

Frontend states:

```text
run_started -> show spinner
agent_action -> show "Searching policies..."
tool_result -> show source cards
final -> render answer, stop spinner
```

## Cancellation And Disconnects

If the user closes the browser or clicks stop:

- stop reading from the stream;
- cancel the backend task if your framework supports it;
- close external tool requests when possible;
- mark run metadata as cancelled.

Conceptual metadata:

```json
{
  "run_id": "run_123",
  "stop_reason": "client_cancelled"
}
```

## Testing Streaming

### Test Event Order

```python
def test_stream_event_order() -> None:
    events = list(stream_agent_response(fake_executor, agent_input, collector))
    assert events[0]["type"] == "run_started"
    assert events[-1]["type"] == "final"
```

### Test Tool Event Redaction

```python
def test_tool_input_preview_redacts_secrets() -> None:
    preview = preview_tool_input({"query": "x", "api_key": "secret"})
    assert "secret" not in preview
```

### Test Error Event

```python
def test_stream_error_event() -> None:
    events = list(stream_agent_response(failing_executor, agent_input, collector))
    assert events[-1]["type"] == "error"
    assert "Traceback" not in events[-1]["message"]
```

## Debugging Streaming

Log:

```python
logger.info("stream_event=%s run_id=%s", event["type"], run_id)
logger.info("stream_tool=%s", event.get("tool"))
```

If frontend receives no events:

- verify response uses streaming media type;
- disable proxy buffering;
- flush chunks;
- check browser EventSource/WebSocket errors.

If final event is missing:

- check backend exceptions;
- ensure `AgentExecutor.stream` loop is fully consumed;
- ensure final chunk mapping handles `"output"`;
- check client did not disconnect.

## Done Checklist

- [ ] Streaming endpoint emits stable public event names.
- [ ] Tool inputs are sanitized before streaming.
- [ ] Raw scratchpad is hidden.
- [ ] Final event includes Markdown and sources.
- [ ] Error event uses safe messages.
- [ ] Frontend can handle action, tool result, final, and error events.
- [ ] SSE or WebSocket format is documented.
- [ ] Stream tests cover event order, error events, and redaction.
- [ ] Client cancellation or disconnect behavior is defined.
