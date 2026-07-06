# Workflow 05: Executor Loop

This workflow explains the main agent runtime loop.

## Objective

Understand and implement the plan-act-observe loop:

```text
plan -> execute tool -> observe -> plan again -> finish
```

## Current Codebase Reference

Key file:

- `libs/langchain/langchain_classic/agents/agent.py`

Important methods:

- `AgentExecutor._call`
- `AgentExecutor._acall`
- `AgentExecutor._take_next_step`
- `AgentExecutor._iter_next_step`
- `AgentExecutor._perform_agent_action`
- `AgentExecutor._get_tool_return`
- `AgentExecutor._return`
- `AgentExecutor._prepare_intermediate_steps`

## Step 1: Build Tool Map

At the beginning of a run:

```python
name_to_tool_map = {tool.name: tool for tool in self.tools}
```

This lets the executor execute a model-requested tool by name.

## Step 2: Initialize State

```python
intermediate_steps = []
iterations = 0
time_elapsed = 0.0
start_time = time.time()
```

`intermediate_steps` is the run-local memory of actions and observations.

## Step 3: Check Stop Conditions

Current code:

```python
def _should_continue(self, iterations: int, time_elapsed: float) -> bool:
    if self.max_iterations is not None and iterations >= self.max_iterations:
        return False
    return self.max_execution_time is None or time_elapsed < self.max_execution_time
```

Always set a sensible `max_iterations` for user-facing agents.

## Step 4: Plan Next Step

Inside `_iter_next_step(...)`:

```python
output = self._action_agent.plan(
    intermediate_steps,
    callbacks=run_manager.get_child() if run_manager else None,
    **inputs,
)
```

The agent returns:

- `AgentFinish`;
- `AgentAction`;
- `list[AgentAction]`.

## Step 5: Parse Agent Output

The agent's output parser converts raw model output into structured control
objects.

Tool-calling parser:

- reads `AIMessage.tool_calls`;
- returns one `AgentAction` per tool call;
- returns `AgentFinish` if the model sent a normal message.

ReAct parser:

- parses `Action:` and `Action Input:`;
- returns `AgentFinish` when it sees `Final Answer:`.

## Step 6: Execute Tool Action

If the plan is an action:

```python
tool = name_to_tool_map[agent_action.tool]
observation = tool.run(agent_action.tool_input)
```

The executor wraps it as:

```python
AgentStep(action=agent_action, observation=observation)
```

## Step 7: Append Intermediate Step

```python
intermediate_steps.extend(next_step_output)
```

The next planning call sees this observation through the scratchpad.

## Step 8: Check Direct Tool Return

Some tools can set `return_direct=True`. If so, the executor returns the tool
observation as the final answer.

Current method:

```python
tool_return = self._get_tool_return(next_step_action)
```

Use direct return for tools where the tool output is already the final user
answer.

## Step 9: Return Final Output

If the agent returns `AgentFinish`, executor calls:

```python
return self._return(next_step_output, intermediate_steps, run_manager)
```

Default result:

```json
{"output": "final answer"}
```

If `return_intermediate_steps=True`:

```json
{
  "output": "final answer",
  "intermediate_steps": [...]
}
```

## Step 10: Stop By Limit

If the loop stops by max iterations or timeout:

```python
output = self._action_agent.return_stopped_response(
    self.early_stopping_method,
    intermediate_steps,
    **inputs,
)
```

Default `"force"` response:

```text
Agent stopped due to iteration limit or time limit.
```

## Sync vs Async

Sync method:

```python
AgentExecutor._call(...)
```

Async method:

```python
AgentExecutor._acall(...)
```

Async differences:

- uses `asyncio_timeout`;
- awaits `agent.aplan`;
- awaits `tool.arun`;
- multi-action tool calls run concurrently with `asyncio.gather`.

## Junior Developer Deep Dive

The executor is a small state machine. It does not "think"; it only follows the
control objects returned by the agent.

State at the start of a run:

```python
state = {
    "inputs": {"input": "What is the policy?"},
    "intermediate_steps": [],
    "iterations": 0,
    "time_elapsed": 0.0,
}
```

Possible transitions:

| Agent/runtime event | What executor does next |
|---|---|
| Agent returns `AgentFinish` | Stop and return final output. |
| Agent returns `AgentAction` | Execute one tool, append observation, continue loop. |
| Agent returns `list[AgentAction]` | Execute multiple tools, append observations, continue loop. |
| Agent asks for unknown tool | Run `InvalidTool`, append observation, continue loop. |
| Parser fails and retry is enabled | Run `_Exception`, append observation, continue loop. |
| Max iterations reached | Stop with early-stopping response. |
| Timeout reached | Stop with early-stopping response. |

## Actual Call Stack For `invoke`

When user code calls:

```python
agent_executor.invoke({"input": "What is the reimbursement limit?"})
```

the simplified call stack is:

```text
AgentExecutor.invoke(...)
-> Chain input preparation
-> AgentExecutor._call(inputs, run_manager)
-> AgentExecutor._take_next_step(...)
-> AgentExecutor._iter_next_step(...)
-> agent.plan(...)
-> model call
-> output parser
-> AgentAction or AgentFinish
-> AgentExecutor._perform_agent_action(...) if action
-> tool.run(...)
-> AgentStep
-> AgentExecutor._consume_next_step(...)
-> AgentExecutor._return(...) if finish
```

Most bugs happen in one of these places:

- prompt/model did not produce the expected action format;
- output parser could not parse the model output;
- tool name did not match an available tool;
- tool execution failed or returned bad observations;
- final serialization did not convert the result to the web response shape.

## Tool Map Details

At runtime, tools are provided as a list:

```python
tools = [policy_search_tool, calculator_tool]
```

The executor converts that list to a dictionary:

```python
name_to_tool_map = {
    "policy_search": policy_search_tool,
    "calculator": calculator_tool,
}
```

If the model returns:

```python
AgentAction(
    tool="policy_search",
    tool_input={"query": "remote work reimbursement"},
    log="Invoking policy_search...",
)
```

the executor can find and run:

```python
tool = name_to_tool_map["policy_search"]
observation = tool.run({"query": "remote work reimbursement"})
```

The model never receives the Python tool object. It only receives tool names,
descriptions, and schemas. The executor maps the chosen name back to executable
Python code.

## Intermediate Steps Details

`intermediate_steps` is the memory of work done during one run.

After one RAG tool call:

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

Do not confuse these concepts:

| Data | Lifetime | Purpose |
|---|---|---|
| `intermediate_steps` | One agent run | Let the model see tool observations during the current answer. |
| `chat_history` | Conversation/session | Let the model understand previous user and assistant messages. |
| long-term memory | Many sessions | Store durable facts or preferences. |

For RAG, retrieved text enters the agent through `intermediate_steps`.

## `_take_next_step` And `_consume_next_step`

`_take_next_step(...)` calls `_iter_next_step(...)`, gathers yielded values, then
normalizes them.

Conceptually:

```python
values = list(
    self._iter_next_step(
        name_to_tool_map,
        color_mapping,
        inputs,
        intermediate_steps,
        run_manager,
    )
)
next_step_output = self._consume_next_step(values)
```

`_iter_next_step(...)` may yield:

```python
AgentAction
AgentStep
AgentFinish
```

`_consume_next_step(...)` converts those into either:

```python
AgentFinish
```

or:

```python
list[tuple[AgentAction, str]]
```

Why this exists:

- streaming needs to see individual actions and tool results;
- the main loop wants a simpler result shape.

## Parser Error Flow

If the model returns malformed output, the output parser raises
`OutputParserException`.

Default behavior:

```python
handle_parsing_errors=False
```

The executor raises an error.

User-facing recommended behavior:

```python
handle_parsing_errors=True
```

The executor converts the parser error into an action:

```python
AgentAction(
    tool="_Exception",
    tool_input="Invalid or incomplete response",
    log="raw bad model output",
)
```

Then it runs `ExceptionTool`, which returns the observation string. The next
model call can see the error observation and try again.

This matters most for ReAct, JSON, and XML text formats. Native tool-calling
models usually have fewer parser errors, but invalid tool arguments can still
happen.

## Invalid Tool Flow

If the model asks for:

```python
AgentAction(tool="unknown_search", tool_input="policy", log="...")
```

but available tools are:

```python
["policy_search", "calculator"]
```

the executor runs `InvalidTool`.

Conceptual observation:

```json
{
  "requested_tool_name": "unknown_search",
  "available_tool_names": ["policy_search", "calculator"]
}
```

The next model call can correct itself:

```python
AgentAction(
    tool="policy_search",
    tool_input={"query": "policy"},
    log="..."
)
```

## Direct Tool Return Flow

The executor checks direct return after a tool call:

```python
if len(next_step_output) == 1:
    tool_return = self._get_tool_return(next_step_output[0])
    if tool_return is not None:
        return self._return(tool_return, intermediate_steps, run_manager)
```

`_get_tool_return(...)` checks whether the tool has:

```python
return_direct=True
```

If true, it creates:

```python
AgentFinish({"output": observation}, "")
```

Use this only when the tool output is already the final answer. For RAG
retrieval tools, usually keep `return_direct=False` because raw chunks need a
final model synthesis step.

## RAG Through The Executor Loop

RAG is not special in `_call(...)`.

Timeline:

```text
Iteration 1:
  model -> AgentAction(tool="policy_search")
  executor -> policy_search.run(...)
  retriever -> documents
  tool -> formatted document text
  executor -> append observation

Iteration 2:
  model sees observation in scratchpad
  model -> AgentFinish(markdown answer)
  executor -> return output
```

If the model searches multiple sources:

```text
Iteration 1: search policies
Iteration 2: search benefits handbook
Iteration 3: final answer
```

the executor still treats each search as a normal tool action.

## Worked Example: One RAG Question

Input:

```python
inputs = {
    "input": "What is the remote work equipment reimbursement limit?"
}
```

Tools:

```python
tools = [policy_search_tool]
```

Initial state:

```python
intermediate_steps = []
iterations = 0
```

First planning result:

```python
AgentAction(
    tool="policy_search",
    tool_input={"query": "remote work equipment reimbursement limit"},
    log="Invoking policy_search...",
)
```

Tool observation:

```text
Remote Work Policy: Approved ergonomic equipment may be reimbursed up to 300 USD.
```

State after tool call:

```python
intermediate_steps = [
    (
        AgentAction(tool="policy_search", tool_input={"query": "..."}),
        "Remote Work Policy: Approved ergonomic equipment may be reimbursed up to 300 USD.",
    )
]
iterations = 1
```

Second planning result:

```python
AgentFinish(
    return_values={
        "output": "The limit is **300 USD** for approved ergonomic equipment."
    },
    log="The limit is **300 USD** for approved ergonomic equipment.",
)
```

Raw executor output:

```python
{
    "output": "The limit is **300 USD** for approved ergonomic equipment."
}
```

For a web product, convert this to:

```json
{
  "answer_markdown": "The limit is **300 USD** for approved ergonomic equipment.",
  "sources": [],
  "artifacts": [],
  "metadata": {
    "stop_reason": "agent_finish",
    "iteration_count": 2
  }
}
```

## Implementation Recipe From Scratch

If you implement this loop in another project, build these pieces in order.

### 1. Define Control Types

```python
class AgentAction:
    tool: str
    tool_input: object
    log: str

class AgentFinish:
    return_values: dict[str, object]
    log: str

class AgentStep:
    action: AgentAction
    observation: str
```

### 2. Define Tool Interface

```python
class Tool:
    name: str
    description: str
    return_direct: bool = False

    def run(self, tool_input: object) -> str:
        ...
```

### 3. Define Agent Interface

```python
class Agent:
    def plan(
        self,
        intermediate_steps: list[tuple[AgentAction, str]],
        **inputs: object,
    ) -> AgentAction | list[AgentAction] | AgentFinish:
        ...
```

### 4. Implement Minimal Executor

```python
class AgentExecutor:
    def __init__(self, agent: Agent, tools: list[Tool]) -> None:
        self.agent = agent
        self.tools = tools

    def invoke(self, inputs: dict) -> dict:
        tools_by_name = {tool.name: tool for tool in self.tools}
        steps = []
        iterations = 0

        while iterations < 10:
            plan = self.agent.plan(steps, **inputs)

            if isinstance(plan, AgentFinish):
                return plan.return_values

            actions = [plan] if isinstance(plan, AgentAction) else plan
            new_steps = []

            for action in actions:
                tool = tools_by_name.get(action.tool)
                if tool is None:
                    observation = f"Invalid tool {action.tool}"
                else:
                    observation = tool.run(action.tool_input)
                new_steps.append((action, observation))

            steps.extend(new_steps)
            iterations += 1

        return {"output": "Agent stopped due to iteration limit."}
```

### 5. Add Production Features

After the minimal loop works, add:

- callbacks and tracing;
- async execution;
- streaming;
- parser error handling;
- invalid tool helper;
- direct tool return;
- source collection;
- timeouts;
- permission filtering.

## Debugging The Executor Loop

Add logs at these points during development:

```python
logger.info("agent_start input=%s", inputs.get("input"))
logger.info("agent_iteration=%s", iterations)
logger.info("agent_action tool=%s input=%s", action.tool, action.tool_input)
logger.info("tool_observation_preview=%s", observation[:500])
logger.info("agent_finish output_preview=%s", output[:500])
```

For RAG, inspect:

- selected tool;
- generated retrieval query;
- retrieved document titles/source IDs;
- observation text length;
- final answer text.

## Testing The Executor Loop

### Test Direct Finish

```python
class FinishAgent:
    def plan(self, steps, **inputs):
        return AgentFinish({"output": "hello"}, "hello")
```

Expected:

```python
assert executor.invoke({"input": "hi"})["output"] == "hello"
```

### Test One Tool Call Then Finish

```python
class ToolThenFinishAgent:
    def plan(self, steps, **inputs):
        if not steps:
            return AgentAction("search", "policy", "call search")
        return AgentFinish({"output": f"Used: {steps[0][1]}"}, "finish")

class SearchTool:
    name = "search"
    return_direct = False

    def run(self, tool_input):
        return "retrieved policy"
```

Expected:

```python
assert executor.invoke({"input": "policy"})["output"] == "Used: retrieved policy"
```

### Test Invalid Tool

Fake agent asks for:

```python
AgentAction("missing_tool", "input", "bad")
```

Expected:

- executor does not crash if invalid tool handling is implemented;
- observation tells the model available tools;
- loop can continue.

### Test Max Iterations

Fake agent always asks for a tool.

Expected:

```python
{"output": "Agent stopped due to iteration limit."}
```

## Junior Developer Pseudocode

```python
def run_agent(inputs):
    steps = []
    iterations = 0
    started_at = now()

    while should_continue(iterations, started_at):
        plan = agent.plan(steps, **inputs)

        if isinstance(plan, AgentFinish):
            return make_final_output(plan, steps)

        actions = [plan] if isinstance(plan, AgentAction) else plan

        new_steps = []
        for action in actions:
            tool = tools_by_name.get(action.tool)
            if tool is None:
                observation = invalid_tool_message(action.tool)
            else:
                observation = tool.run(action.tool_input)
            new_steps.append((action, observation))

        steps.extend(new_steps)

        if len(new_steps) == 1 and tool_return_direct(new_steps[0]):
            return make_direct_tool_output(new_steps[0])

        iterations += 1

    return stopped_response(steps)
```

## Done Checklist

- [ ] Tool map is built from allowed tools only.
- [ ] Intermediate steps start empty for each run.
- [ ] Stop limits are enforced.
- [ ] Parser errors have a policy.
- [ ] Invalid tools produce a useful observation.
- [ ] Direct-return tools are handled.
- [ ] Final output includes intermediate steps only when requested.
- [ ] RAG tool observations are fed into the next model call through the scratchpad.
- [ ] Logs show selected tools, tool inputs, observation previews, iteration count, and stop reason.
- [ ] Unit tests cover direct finish, one tool call, invalid tool, and max-iteration stop.
- [ ] Raw executor output is converted to the web response contract before returning to the frontend.
