# Codebase Detail Design: `langchain_classic.agents`

This document explains the detailed design of the agents feature in the current
codebase.

Audience: junior developers who need to read
`libs/langchain/langchain_classic/agents` and implement a similar feature in
another project.

## Big Picture

The classic agents package is built around one idea:

```text
An agent decides what to do next.
The executor runs that decision.
```

The model does not execute tools. The executor executes tools.

The agent returns one of:

- `AgentAction`: call one tool;
- `list[AgentAction]`: call multiple tools;
- `AgentFinish`: return final answer.

The executor repeats:

```text
agent.plan -> tool.run -> save observation -> agent.plan -> ... -> finish
```

## Package Layout

Important files:

```text
libs/langchain/langchain_classic/agents/
├── agent.py                         # Base agent classes and AgentExecutor
├── agent_iterator.py                # Streaming/step iterator
├── initialize.py                    # Legacy initialize_agent helper
├── agent_types.py                   # Agent type enum
├── tools.py                         # InvalidTool and exception tool helpers
├── tool_calling_agent/base.py       # Generic tool-calling Runnable agent
├── openai_tools/base.py             # OpenAI tools Runnable agent
├── openai_functions_agent/base.py   # OpenAI functions agent class/factory
├── react/agent.py                   # Runnable ReAct agent factory
├── mrkl/base.py                     # Older ZeroShotAgent/MRKLChain
├── output_parsers/                  # Converts model output to actions/finish
├── format_scratchpad/               # Converts intermediate steps to prompt input
└── agent_toolkits/
    ├── vectorstore/                 # Vector store agents and toolkits
    └── conversational_retrieval/    # Conversational retrieval agent helper
```

## Core Types

### `AgentAction`

Imported from `langchain_core.agents`.

Meaning: the model wants to call a tool.

Conceptual shape:

```python
AgentAction(
    tool="policy_search",
    tool_input={"query": "remote work reimbursement"},
    log="Invoking policy_search...",
)
```

Fields:

- `tool`: name of the tool to call;
- `tool_input`: input passed to the tool;
- `log`: raw model/action log.

### `AgentStep`

Imported from `langchain_core.agents`.

Meaning: a completed tool call.

Conceptual shape:

```python
AgentStep(
    action=agent_action,
    observation="Remote Work Policy: reimbursement limit is 300 USD.",
)
```

The executor converts steps into `intermediate_steps`:

```python
[(agent_action, observation)]
```

### `AgentFinish`

Imported from `langchain_core.agents`.

Meaning: the agent is done.

Conceptual shape:

```python
AgentFinish(
    return_values={"output": "The limit is 300 USD."},
    log="Final Answer: The limit is 300 USD.",
)
```

## Agent Base Classes

Source: `libs/langchain/langchain_classic/agents/agent.py`

### `BaseSingleActionAgent`

This is the base class for agents that return either:

- one `AgentAction`; or
- one `AgentFinish`.

Important methods:

```python
def plan(
    self,
    intermediate_steps: list[tuple[AgentAction, str]],
    callbacks: Callbacks = None,
    **kwargs: Any,
) -> AgentAction | AgentFinish:
    ...
```

```python
async def aplan(...) -> AgentAction | AgentFinish:
    ...
```

Meaning:

- `intermediate_steps` contains previous tool calls and observations;
- `kwargs` contains user inputs such as `input` and `chat_history`;
- return an action to continue or finish to stop.

Other important members:

- `return_values`: defaults to `["output"]`;
- `get_allowed_tools()`: returns allowed tool names or `None`;
- `input_keys`: required user input keys;
- `return_stopped_response(...)`: output when max iterations/time is reached;
- `save(...)`: saves supported agents to JSON/YAML.

### `BaseMultiActionAgent`

Similar to `BaseSingleActionAgent`, but `plan(...)` can return:

```python
list[AgentAction] | AgentFinish
```

This supports models that request multiple tools in one model response.

Async executor can run multiple tool calls concurrently.

### `Agent`

`Agent` is a classic single-action agent built around `LLMChain` and an output
parser.

Responsibilities:

- format the prompt;
- include previous scratchpad;
- call the LLM chain;
- parse text output into `AgentAction` or `AgentFinish`.

Older agents such as `ZeroShotAgent` inherit from this style.

### `RunnableAgent` And `RunnableMultiActionAgent`

`AgentExecutor` can accept a `Runnable` instead of a classic agent object.

During validation:

```python
if agent and isinstance(agent, Runnable):
    ...
    values["agent"] = RunnableAgent(...) or RunnableMultiActionAgent(...)
```

This is how `create_tool_calling_agent(...)` works. The factory returns a
Runnable sequence, and `AgentExecutor` wraps it in a compatible agent adapter.

## `AgentExecutor`

Source: `libs/langchain/langchain_classic/agents/agent.py`

`AgentExecutor` is the runtime orchestrator.

Class fields:

```python
agent: BaseSingleActionAgent | BaseMultiActionAgent | Runnable
tools: Sequence[BaseTool]
return_intermediate_steps: bool = False
max_iterations: int | None = 15
max_execution_time: float | None = None
early_stopping_method: str = "force"
handle_parsing_errors: bool | str | Callable = False
trim_intermediate_steps: int | Callable = -1
```

### Constructor Pattern

You can instantiate directly:

```python
executor = AgentExecutor(agent=agent, tools=tools)
```

Or through:

```python
executor = AgentExecutor.from_agent_and_tools(agent=agent, tools=tools)
```

### Tool Validation

`validate_tools(...)` checks whether the agent declared allowed tools:

```python
allowed_tools = agent.get_allowed_tools()
```

If declared, allowed tool names must match provided tool names exactly.

This prevents passing a tool set that is inconsistent with the agent prompt or
provider function schema.

### Runnable Agent Validation

`validate_runnable_agent(...)` detects `Runnable` agents and wraps them:

- `RunnableAgent` for single action;
- `RunnableMultiActionAgent` for multi-action output.

This lets the executor use a common interface:

```python
self._action_agent.plan(...)
```

even when the original agent was a Runnable pipeline.

### Input And Output Keys

Executor input keys come from:

```python
self._action_agent.input_keys
```

Executor output keys are:

```python
self._action_agent.return_values
```

If `return_intermediate_steps=True`, the executor also returns:

```python
"intermediate_steps"
```

## Sync Execution Flow

Method:

```python
AgentExecutor._call(...)
```

Detailed flow:

1. Build tool map:

   ```python
   name_to_tool_map = {tool.name: tool for tool in self.tools}
   ```

2. Build color mapping for logs/callbacks.

3. Start empty intermediate steps:

   ```python
   intermediate_steps = []
   ```

4. Track loop limits:

   ```python
   iterations = 0
   time_elapsed = 0.0
   start_time = time.time()
   ```

5. Loop while `_should_continue(...)`.

6. Call `_take_next_step(...)`.

7. If result is `AgentFinish`, call `_return(...)`.

8. Otherwise extend `intermediate_steps`.

9. Check `return_direct` tool behavior.

10. Increment iteration count and elapsed time.

11. If loop limit is reached, call `return_stopped_response(...)`.

## One-Step Flow

Method:

```python
AgentExecutor._iter_next_step(...)
```

This method is intentionally an iterator so streaming can yield actions and
observations as they happen.

Detailed flow:

1. Prepare intermediate steps:

   ```python
   intermediate_steps = self._prepare_intermediate_steps(intermediate_steps)
   ```

2. Ask agent to plan:

   ```python
   output = self._action_agent.plan(
       intermediate_steps,
       callbacks=run_manager.get_child() if run_manager else None,
       **inputs,
   )
   ```

3. If output parser fails, handle based on `handle_parsing_errors`.

4. If output is `AgentFinish`, yield finish and return.

5. Normalize single action vs multi-action:

   ```python
   actions = [output] if isinstance(output, AgentAction) else output
   ```

6. Yield each `AgentAction`.

7. Execute each action and yield each `AgentStep`.

## Tool Execution Flow

Method:

```python
AgentExecutor._perform_agent_action(...)
```

Flow:

1. Emit callback:

   ```python
   run_manager.on_agent_action(agent_action, color="green")
   ```

2. If tool name exists:

   ```python
   tool = name_to_tool_map[agent_action.tool]
   observation = tool.run(agent_action.tool_input, ...)
   ```

3. If tool name does not exist:

   ```python
   observation = InvalidTool().run(
       {
           "requested_tool_name": agent_action.tool,
           "available_tool_names": list(name_to_tool_map.keys()),
       }
   )
   ```

4. Return:

   ```python
   AgentStep(action=agent_action, observation=observation)
   ```

## Async Execution Flow

Method:

```python
AgentExecutor._acall(...)
```

Differences from sync:

- wraps loop in `asyncio_timeout(self.max_execution_time)`;
- calls `_atake_next_step(...)`;
- calls `agent.aplan(...)`;
- calls `tool.arun(...)`;
- uses `asyncio.gather(...)` for multiple tool calls.

This is important for multi-action tool-calling models: if a model asks for
three independent tools, async execution can run them concurrently.

## Streaming Iterator

Source: `libs/langchain/langchain_classic/agents/agent_iterator.py`

`AgentExecutorIterator` powers:

- `executor.iter(...)`;
- `executor.stream(...)`;
- `executor.astream(...)`.

### Iterator State

Fields:

```python
intermediate_steps: list[tuple[AgentAction, str]]
iterations: int
time_elapsed: float
start_time: float
```

`reset()` clears this state for a new iteration.

### Sync Iteration

`__iter__` flow:

1. Configure callbacks.
2. Emit `on_chain_start`.
3. Loop while executor should continue.
4. Call executor `_iter_next_step(...)`.
5. Yield actions and steps if `yield_actions=True`.
6. Convert raw chunks with `_consume_next_step(...)`.
7. Process final vs intermediate output.
8. Yield final output.
9. Emit `on_chain_end`.

### Stream Chunk Shapes

When `yield_actions=True`:

```python
AddableDict(actions=[chunk], messages=chunk.messages)
```

or:

```python
AddableDict(steps=[chunk], messages=chunk.messages)
```

Final output includes:

```python
{"output": "...", "messages": [...]}
```

## Output Parsers

Output parsers translate raw model output into agent control objects.

### Tool Agent Parser

Source:

`libs/langchain/langchain_classic/agents/output_parsers/tools.py`

Main function:

```python
parse_ai_message_to_tool_action(message)
```

Behavior:

- if `AIMessage.tool_calls` exists, convert each tool call into
  `ToolAgentAction`;
- if no tool calls exist, return `AgentFinish` with message content;
- if tool call arguments are invalid JSON, raise `OutputParserException`.

### ReAct Parser

Source:

`libs/langchain/langchain_classic/agents/output_parsers/react_single_input.py`

Behavior:

- if text contains `Action:` and `Action Input:`, return `AgentAction`;
- if text contains `Final Answer:`, return `AgentFinish`;
- if required sections are missing, raise `OutputParserException` with an
  observation that can be sent back to the model.

## Scratchpad Formatters

Scratchpad formatters convert `intermediate_steps` into input for the next model
call.

### Tool Messages

Source:

`libs/langchain/langchain_classic/agents/format_scratchpad/tools.py`

Function:

```python
format_to_tool_messages(intermediate_steps)
```

Creates:

- prior AI tool-call message;
- matching `ToolMessage` containing the observation.

### OpenAI Tool Messages

Source:

`libs/langchain/langchain_classic/agents/format_scratchpad/openai_tools.py`

Same idea, but uses OpenAI tool message conventions.

### Text Logs

Source:

`libs/langchain/langchain_classic/agents/format_scratchpad/log.py`

Used by text ReAct agents.

Converts steps to:

```text
Action: ...
Action Input: ...
Observation: ...
Thought:
```

## Tool-Calling Agent Factory

Source:

`libs/langchain/langchain_classic/agents/tool_calling_agent/base.py`

Factory:

```python
create_tool_calling_agent(llm, tools, prompt)
```

Validation:

- prompt must include `agent_scratchpad`;
- LLM must implement `bind_tools`.

Pipeline:

```python
RunnablePassthrough.assign(
    agent_scratchpad=lambda x: message_formatter(x["intermediate_steps"])
)
| prompt
| llm.bind_tools(tools)
| ToolsAgentOutputParser()
```

Important lesson:

The agent itself is just a pipeline. The executor owns the loop.

## OpenAI Tools Agent Factory

Source:

`libs/langchain/langchain_classic/agents/openai_tools/base.py`

Factory:

```python
create_openai_tools_agent(llm, tools, prompt, strict=None)
```

Differences from generic tool-calling:

- converts tools with `convert_to_openai_tool`;
- binds tools using `llm.bind(tools=[...])`;
- parses with `OpenAIToolsAgentOutputParser`.

Use this when matching OpenAI tool-call behavior specifically.

## ReAct Agent Factory

Source:

`libs/langchain/langchain_classic/agents/react/agent.py`

Factory:

```python
create_react_agent(llm, tools, prompt, output_parser=None, tools_renderer=..., stop_sequence=True)
```

Validation:

- prompt must include `tools`;
- prompt must include `tool_names`;
- prompt must include `agent_scratchpad`.

Setup:

```python
prompt = prompt.partial(
    tools=tools_renderer(list(tools)),
    tool_names=", ".join([t.name for t in tools]),
)
```

Pipeline:

```python
RunnablePassthrough.assign(
    agent_scratchpad=lambda x: format_log_to_str(x["intermediate_steps"])
)
| prompt
| llm_with_stop
| output_parser
```

Default parser:

```python
ReActSingleInputOutputParser()
```

## OpenAI Functions Agent

Source:

`libs/langchain/langchain_classic/agents/openai_functions_agent/base.py`

Class:

```python
OpenAIFunctionsAgent(BaseSingleActionAgent)
```

Important fields:

- `llm`;
- `tools`;
- `prompt`;
- `output_parser`.

Important behavior:

- `get_allowed_tools()` returns tool names;
- `functions` converts tools with `convert_to_openai_function`;
- `plan(...)` formats scratchpad messages, formats prompt, calls LLM with
  functions, and parses the AI message.

This class shows the older class-based agent pattern, as opposed to the newer
Runnable factory pattern.

## MRKL And ZeroShotAgent

Source:

`libs/langchain/langchain_classic/agents/mrkl/base.py`

`ZeroShotAgent` is an older ReAct-style agent. It:

- renders tool descriptions into a prompt;
- expects single-input tools;
- uses `MRKLOutputParser`;
- has `observation_prefix = "Observation: "`;
- has `llm_prefix = "Thought:"`.

Vectorstore agents still use this path.

## Vector Store Toolkit

Source:

`libs/langchain/langchain_classic/agents/agent_toolkits/vectorstore/toolkit.py`

### `VectorStoreInfo`

Fields:

```python
vectorstore: VectorStore
name: str
description: str
```

This gives the toolkit a vector store and model-facing name/description.

### `VectorStoreToolkit`

Fields:

```python
vectorstore_info: VectorStoreInfo
llm: BaseLanguageModel
```

`get_tools()` creates:

- `VectorStoreQATool`;
- `VectorStoreQAWithSourcesTool`.

These tools come from `langchain_community.tools.vectorstore.tool`.

### `VectorStoreRouterToolkit`

Fields:

```python
vectorstores: list[VectorStoreInfo]
llm: BaseLanguageModel
```

`get_tools()` creates one `VectorStoreQATool` per vector store.

The model routes by choosing the tool whose name/description best matches the
question.

## Vector Store Agent Factories

Source:

`libs/langchain/langchain_classic/agents/agent_toolkits/vectorstore/base.py`

### `create_vectorstore_agent`

Flow:

1. `tools = toolkit.get_tools()`
2. `prompt = ZeroShotAgent.create_prompt(tools, prefix=prefix)`
3. `llm_chain = LLMChain(llm=llm, prompt=prompt)`
4. `agent = ZeroShotAgent(llm_chain=llm_chain, allowed_tools=tool_names)`
5. return `AgentExecutor.from_agent_and_tools(...)`

### `create_vectorstore_router_agent`

Same structure, but toolkit has multiple vector stores.

Important note:

These factories are deprecated in this codebase. For a new project, prefer:

```python
create_retriever_tool(vector_store.as_retriever(), name, description)
```

and use a normal tool-calling agent.

## Retriever Tool

Source:

`libs/core/langchain_core/tools/retriever.py`

Factory:

```python
create_retriever_tool(
    retriever,
    name,
    description,
    document_prompt=None,
    document_separator="\n\n",
    response_format="content",
)
```

Generated input schema:

```python
class RetrieverInput(BaseModel):
    query: str
```

Sync tool function:

```python
docs = retriever.invoke(query, config={"callbacks": callbacks})
content = document_separator.join(
    format_document(doc, document_prompt_) for doc in docs
)
return content
```

Async tool function:

```python
docs = await retriever.ainvoke(query, config={"callbacks": callbacks})
content = document_separator.join(
    [await aformat_document(doc, document_prompt_) for doc in docs]
)
return content
```

If `response_format="content_and_artifact"`, the tool returns:

```python
(content, docs)
```

This is useful when the runtime preserves tool artifacts.

## Conversational Retrieval Agent

Source:

`libs/langchain/langchain_classic/agents/agent_toolkits/conversational_retrieval/openai_functions.py`

Factory:

```python
create_conversational_retrieval_agent(
    llm,
    tools,
    remember_intermediate_steps=True,
    memory_key="chat_history",
    system_message=None,
    verbose=False,
    max_token_limit=2000,
    **kwargs,
)
```

Flow:

1. Choose memory:
   - `AgentTokenBufferMemory` if remembering intermediate steps;
   - `ConversationTokenBufferMemory` otherwise.
2. Create default system message if none is provided.
3. Build `OpenAIFunctionsAgent` prompt with `MessagesPlaceholder(memory_key)`.
4. Create `OpenAIFunctionsAgent`.
5. Return `AgentExecutor` with memory and tools.

This helper is a complete example of combining:

- tools;
- function-calling agent;
- memory;
- executor.

## Public Exports

Source:

`libs/langchain/langchain_classic/agents/__init__.py`

This file exports public agent APIs such as:

- `AgentExecutor`;
- `AgentExecutorIterator`;
- `create_tool_calling_agent`;
- `create_openai_tools_agent`;
- `create_openai_functions_agent`;
- `create_react_agent`;
- `create_vectorstore_agent`;
- `create_vectorstore_router_agent`;
- `create_xml_agent`;
- `create_json_chat_agent`;
- `create_structured_chat_agent`;
- `create_self_ask_with_search_agent`.

When changing public APIs, check exports and preserve signatures unless there is
a deliberate breaking change.

## Complete Classic Agent Type Map

Source:

- `libs/langchain/langchain_classic/agents/agent_types.py`
- `libs/langchain/langchain_classic/agents/types.py`

`AgentType` is deprecated, but it is still important for understanding legacy
construction through `initialize_agent(...)` and serialized agent loading.

| `AgentType` value | Class | Notes |
|---|---|---|
| `zero-shot-react-description` | `ZeroShotAgent` | ReAct-style text agent using tool descriptions. |
| `react-docstore` | `ReActDocstoreAgent` | ReAct variant for docstore lookup. |
| `self-ask-with-search` | `SelfAskWithSearchAgent` | Breaks complex questions into follow-up questions using exactly one search tool named `Intermediate Answer`. |
| `conversational-react-description` | `ConversationalAgent` | Text conversational ReAct agent with `chat_history`. |
| `chat-zero-shot-react-description` | `ChatAgent` | Chat prompt variant of zero-shot ReAct. |
| `chat-conversational-react-description` | `ConversationalChatAgent` | Chat conversational agent; deprecated in favor of JSON chat agent. |
| `structured-chat-zero-shot-react-description` | `StructuredChatAgent` | Chat agent designed for tools with multiple inputs, using JSON action blobs. |
| `openai-functions` | `OpenAIFunctionsAgent` | Provider-specific single-action OpenAI function-calling agent. |
| `openai-multi-functions` | `OpenAIMultiFunctionsAgent` | Provider-specific multi-action OpenAI function-calling agent. |

When implementing a new project, you do not need to copy every legacy agent
type. You should still understand them because users may migrate from these
names or serialized configs.

## Legacy Initialization

Source:

`libs/langchain/langchain_classic/agents/initialize.py`

Function:

```python
initialize_agent(
    tools,
    llm,
    agent=None,
    callback_manager=None,
    agent_path=None,
    agent_kwargs=None,
    tags=None,
    **kwargs,
)
```

Behavior:

1. If both `agent` and `agent_path` are missing, default to
   `AgentType.ZERO_SHOT_REACT_DESCRIPTION`.
2. If both `agent` and `agent_path` are provided, raise `ValueError`.
3. If `agent` is provided:
   - look it up in `AGENT_TO_CLASS`;
   - call `agent_cls.from_llm_and_tools(...)`;
   - append the agent type value to tags.
4. If `agent_path` is provided:
   - call `load_agent(...)`;
   - pass `llm`, `tools`, and callback manager.
5. Wrap the resulting agent in `AgentExecutor.from_agent_and_tools(...)`.

This function is deprecated, but it documents the old construction path:

```text
AgentType or file path -> agent object -> AgentExecutor
```

## Agent Save And Load

Sources:

- `libs/langchain/langchain_classic/agents/agent.py`
- `libs/langchain/langchain_classic/agents/loading.py`

### Saving

Agents can be saved if their `dict()` includes `_type`.

```python
agent.save("agent.yaml")
```

`AgentExecutor.save(...)` intentionally raises an error. To save the underlying
agent:

```python
agent_executor.save_agent("agent.yaml")
```

Supported file suffixes:

- `.json`
- `.yaml`
- `.yml`

### Loading

`load_agent(path, **kwargs)` loads from local JSON/YAML.

Flow:

1. Read JSON or YAML file.
2. Call `load_agent_from_config(...)`.
3. Require `_type` in config.
4. If `load_from_llm_and_tools=True`, require `llm` and `tools`, then call
   `agent_cls.from_llm_and_tools(...)`.
5. Otherwise load `llm_chain` from config or from `llm_chain_path`.
6. Ignore serialized `output_parser` with a warning because parser loading is
   not supported.

Important behavior:

- `lc://` GitHub Hub loading is no longer supported and raises `RuntimeError`.
- Loading is legacy/deprecated but still part of the codebase.

## Additional Agent Families

The earlier sections focus on the main production-friendly paths. The package
also includes several legacy or format-specific agents.

### `ChatAgent`

Source:

`libs/langchain/langchain_classic/agents/chat/base.py`

Characteristics:

- class-based `Agent`;
- chat prompt with system and human message templates;
- single-input tool validation;
- text ReAct prefixes:
  - `Observation: `
  - `Thought:`
- output parser: `ChatOutputParser`;
- stop sequence: `Observation:`.

### `ConversationalAgent`

Source:

`libs/langchain/langchain_classic/agents/conversational/base.py`

Characteristics:

- text prompt, not chat messages;
- default input variables:
  - `input`
  - `chat_history`
  - `agent_scratchpad`
- single-input tool validation;
- output parser: `ConvoOutputParser`;
- useful for older conversational ReAct behavior.

### `ConversationalChatAgent`

Source:

`libs/langchain/langchain_classic/agents/conversational_chat/base.py`

Characteristics:

- chat prompt with `MessagesPlaceholder("chat_history")`;
- scratchpad is a list of messages;
- tool observations are formatted into human messages;
- output parser expects JSON-in-Markdown style actions;
- deprecated in favor of `create_json_chat_agent`.

### `create_json_chat_agent`

Source:

`libs/langchain/langchain_classic/agents/json_chat/base.py`

Characteristics:

- Runnable factory;
- requires prompt variables:
  - `tools`
  - `tool_names`
  - `agent_scratchpad`
- `agent_scratchpad` must be message-compatible;
- validates `template_tool_response` includes `{observation}`;
- uses `JSONAgentOutputParser`;
- uses stop sequence `\nObservation` by default.

### `StructuredChatAgent` And `create_structured_chat_agent`

Source:

`libs/langchain/langchain_classic/agents/structured_chat/base.py`

Characteristics:

- designed for tools with multiple inputs;
- renders tool argument schemas into the prompt;
- JSON action format with `action` and `action_input`;
- Runnable factory requires:
  - `tools`
  - `tool_names`
  - `agent_scratchpad`;
- class-based version uses `StructuredChatOutputParserWithRetries`;
- Runnable factory uses `JSONAgentOutputParser`.

### `XMLAgent` And `create_xml_agent`

Source:

`libs/langchain/langchain_classic/agents/xml/base.py`

Characteristics:

- XML tag protocol:
  - `<tool>`
  - `<tool_input>`
  - `<observation>`
  - `<final_answer>`;
- Runnable factory requires:
  - `tools`
  - `agent_scratchpad`;
- scratchpad is formatted with `format_xml`;
- default stop sequence is `</tool_input>`;
- parser is `XMLAgentOutputParser`.

### `SelfAskWithSearchAgent`

Source:

`libs/langchain/langchain_classic/agents/self_ask_with_search/base.py`

Characteristics:

- specialized for self-ask prompting;
- requires exactly one tool;
- the tool must be named `Intermediate Answer`;
- output parser is `SelfAskOutputParser`;
- observation prefix is `Intermediate answer: `;
- Runnable factory binds stop sequence `\nIntermediate answer:`.

### `OpenAIMultiFunctionsAgent`

Source:

`libs/langchain/langchain_classic/agents/openai_functions_multi_agent/base.py`

Characteristics:

- subclass of `BaseMultiActionAgent`;
- wraps multiple tool calls inside one synthetic OpenAI function named
  `tool_selection`;
- model returns a JSON object with an `actions` array;
- parser converts each item into an `AgentAction`;
- async executor can run returned actions concurrently.

## Output Parser Matrix

| Parser | Source | Input format | Output |
|---|---|---|---|
| `ReActSingleInputOutputParser` | `output_parsers/react_single_input.py` | Text with `Action:` / `Action Input:` or `Final Answer:` | `AgentAction` or `AgentFinish` |
| `JSONAgentOutputParser` | `output_parsers/json.py` | Markdown JSON blob with `action` and `action_input` | `AgentAction` or `AgentFinish` |
| `XMLAgentOutputParser` | `output_parsers/xml.py` | XML tags for tool/final answer | `AgentAction` or `AgentFinish` |
| `ToolsAgentOutputParser` | `output_parsers/tools.py` | Chat `AIMessage.tool_calls` | `list[AgentAction]` or `AgentFinish` |
| `OpenAIToolsAgentOutputParser` | `output_parsers/openai_tools.py` | OpenAI `tool_calls` message field | `list[AgentAction]` or `AgentFinish` |
| `OpenAIFunctionsAgentOutputParser` | `output_parsers/openai_functions.py` | OpenAI `function_call` message field | `AgentAction` or `AgentFinish` |
| `SelfAskOutputParser` | `self_ask_with_search/output_parser.py` | Self-ask text format | `AgentAction` or `AgentFinish` |

Parser choice is part of the agent protocol. If you change prompt format, you
must change the parser too.

## Tool Validation Utilities

Source:

`libs/langchain/langchain_classic/agents/utils.py`

Function:

```python
validate_tools_single_input(class_name, tools)
```

Behavior:

- iterates through tools;
- raises `ValueError` if any tool has `is_single_input=False`.

Several legacy agents require single-input tools because their text prompt
formats only support one `Action Input` string. Structured chat and modern
tool-calling agents are better choices for multi-argument tools.

## Dynamic Community Toolkits

Source:

`libs/langchain/langchain_classic/agents/agent_toolkits/__init__.py`

The local package contains wrapper modules for many toolkits, but many concrete
implementations are dynamically imported from `langchain_community`.

Examples:

- `SQLDatabaseToolkit`
- `OpenAPIToolkit`
- `PowerBIToolkit`
- `SlackToolkit`
- `GmailToolkit`
- `JiraToolkit`
- `FileManagementToolkit`
- `PlayWrightBrowserToolkit`
- `ZapierToolkit`

Important design point:

```text
Toolkits are groups of tools. AgentExecutor still receives plain tools.
```

Security note from the package docstring: developers must inspect toolkit
capabilities and permissions before using them. Some toolkits can read external
data, write external data, browse websites, manage files, or call business APIs.

## Dynamic Deprecated Imports

Both `agents/__init__.py` and `agent_toolkits/__init__.py` use dynamic import
helpers.

Some old APIs are redirected to `langchain_community`.

Some old experimental APIs raise import errors telling the user to import from
`langchain_experimental`, for example:

- `create_csv_agent`
- `create_pandas_dataframe_agent`
- `create_python_agent`
- `create_spark_dataframe_agent`
- `create_xorbits_agent`

If another project wants compatibility with old imports, implement a small
compatibility layer instead of duplicating these dynamic import details inside
the executor.

## OpenAI Assistant Runnable

Source:

`libs/langchain/langchain_classic/agents/openai_assistant/base.py`

This module is present in the agents package tree but is not exported from
`langchain_classic.agents.__all__`.

Key classes:

- `OpenAIAssistantRunnable`
- `OpenAIAssistantAction`
- `OpenAIAssistantFinish`

Design:

- wraps OpenAI Assistants API threads and runs;
- can create an assistant with `create_assistant(...)`;
- supports sync and async invoke;
- can run as a normal Runnable or with `as_agent=True`;
- when used as an agent, tool calls become `OpenAIAssistantAction` objects with
  `tool_call_id`, `run_id`, and `thread_id`;
- executor tool observations are submitted back to the Assistant run as tool
  outputs.

This is a special provider integration. It does not follow the same prompt and
parser structure as ReAct or tool-calling Runnable agents.

## Extension Points

To customize behavior in another project:

### Add A New Tool

Implement a `BaseTool`, `StructuredTool`, or `@tool` function.

### Add A New Agent Type

Implement:

```python
plan(intermediate_steps, callbacks=None, **kwargs)
aplan(intermediate_steps, callbacks=None, **kwargs)
input_keys
return_values
```

or return a `Runnable` that outputs `AgentAction` or `AgentFinish`.

### Add A New Output Parser

Subclass an agent output parser and return:

- `AgentAction`;
- `list[AgentAction]`;
- `AgentFinish`.

### Customize The Loop

Subclass `AgentExecutor` and override:

- `_iter_next_step`;
- `_perform_agent_action`;
- `_prepare_intermediate_steps`;
- `_return`.

Only do this when a normal tool or parser extension is not enough.

## Implementation Lessons For Another Project

### Keep Planning Separate From Acting

The model plans. The executor acts.

This separation makes it possible to:

- validate tool names;
- enforce permissions;
- log tool calls;
- retry failures;
- stream progress;
- test logic without real model calls.

### Keep Tool Outputs Short

Tool observations become model context. Long observations increase cost and can
cause context overflows.

### Preserve Structured Metadata Outside The Model

The model needs text. The web app needs structured sources and artifacts.

Collect both.

### Use Runnable Pipelines For New Agent Constructors

The modern pattern is:

```python
scratchpad_formatter | prompt | model_with_tools | output_parser
```

Then pass the Runnable to the executor.

### Enforce Stop Limits

Agents can loop. Always set max iterations or timeouts.

## Reading Order For Junior Developers

1. Read `docs/agents_feature_spec.md`.
2. Read `docs/agents_feature_design.md`.
3. Read `docs/agents_workflow_01_input_setup.md`.
4. Read `docs/agents_workflow_02_prompt_and_scratchpad.md`.
5. Read `docs/agents_workflow_03_tool_definition.md`.
6. Read `docs/agents_workflow_04_retrieval_and_vector_db.md`.
7. Read this file while opening `agent.py`.
8. Read `tool_calling_agent/base.py`.
9. Read `output_parsers/tools.py`.
10. Read `agent_iterator.py`.

## Minimal Reimplementation Checklist

- [ ] Define `AgentAction`, `AgentStep`, and `AgentFinish` equivalents.
- [ ] Define a tool interface with `name`, `description`, schema, `run`, and
      `arun`.
- [ ] Define an agent interface with `plan` and `aplan`.
- [ ] Implement an executor loop with intermediate steps.
- [ ] Implement tool lookup and invalid tool handling.
- [ ] Implement parser error handling.
- [ ] Implement max iteration and timeout stopping.
- [ ] Implement scratchpad formatting.
- [ ] Implement a tool-calling agent pipeline.
- [ ] Implement a retriever tool.
- [ ] Implement streaming events.
- [ ] Serialize final output to a web response envelope.
