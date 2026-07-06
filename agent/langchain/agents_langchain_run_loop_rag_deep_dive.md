# LangChain Agent Run Loop And RAG Deep Dive

This document explains exactly how the current
`libs/langchain/langchain_classic/agents` agent loop runs and how RAG fits into
that loop.

Audience: junior developers who need to implement the same behavior in another
project.

Read this after:

- `docs/agents_feature_spec.md`
- `docs/agents_feature_design.md`
- `docs/agents_codebase_detail_design.md`

## Core Idea

LangChain classic agents do not have a separate "RAG mode" inside
`AgentExecutor`.

Instead:

```text
RAG = retrieval tool call inside the normal agent loop
```

The executor does not know that `policy_search` is a vector DB search. It only
knows:

1. the model requested a tool named `policy_search`;
2. `policy_search` exists in `tools`;
3. the executor should call `policy_search.run(...)`;
4. the returned observation should be added to `intermediate_steps`;
5. the next model call can use that observation as context.

## Important Source Files

| Source | Purpose |
|---|---|
| `libs/langchain/langchain_classic/agents/agent.py` | Main agent classes and `AgentExecutor` loop. |
| `libs/langchain/langchain_classic/agents/agent_iterator.py` | Streaming iterator over actions, steps, and final answer. |
| `libs/langchain/langchain_classic/agents/tool_calling_agent/base.py` | Generic tool-calling agent factory. |
| `libs/langchain/langchain_classic/agents/openai_tools/base.py` | OpenAI tools agent factory. |
| `libs/langchain/langchain_classic/agents/react/agent.py` | ReAct text agent factory. |
| `libs/langchain/langchain_classic/agents/output_parsers/tools.py` | Converts chat model tool calls into actions. |
| `libs/langchain/langchain_classic/agents/output_parsers/react_single_input.py` | Converts ReAct text into action or finish. |
| `libs/langchain/langchain_classic/agents/format_scratchpad/tools.py` | Formats previous tool calls as chat tool messages. |
| `libs/langchain/langchain_classic/agents/format_scratchpad/log.py` | Formats previous tool calls as text logs. |
| `libs/core/langchain_core/tools/retriever.py` | `create_retriever_tool` implementation. |
| `libs/langchain/langchain_classic/agents/agent_toolkits/vectorstore/base.py` | Deprecated vectorstore agent factories. |
| `libs/langchain/langchain_classic/agents/agent_toolkits/vectorstore/toolkit.py` | Deprecated vectorstore toolkit that creates vectorstore QA tools. |

## Main Runtime Objects

### `AgentExecutor`

The executor owns the loop.

Main fields:

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

The executor is responsible for:

- preparing inputs;
- validating tools;
- calling the agent planner;
- executing tools;
- storing observations;
- stopping safely;
- returning final output.

### Agent

The agent decides what to do next.

It returns:

```python
AgentAction | AgentFinish
```

or for multi-action agents:

```python
list[AgentAction] | AgentFinish
```

### Tool

A tool is an executable backend capability.

For RAG, the tool is usually a retriever wrapper:

```python
policy_search = create_retriever_tool(
    retriever,
    "policy_search",
    "Search internal policy documents.",
)
```

### Intermediate Steps

`intermediate_steps` is the run-local memory:

```python
list[tuple[AgentAction, str]]
```

Example:

```python
[
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

This is not final chat history. It is the scratchpad context for one run.

## Full Sync Run Flow

The sync run starts from:

```python
agent_executor.invoke({"input": "What is the reimbursement limit?"})
```

Internally, the base `Chain` machinery prepares inputs, then calls:

```python
AgentExecutor._call(inputs, run_manager)
```

## `_call(...)` Step By Step

Source:

`libs/langchain/langchain_classic/agents/agent.py`

### Step 1: Build Tool Lookup

```python
name_to_tool_map = {tool.name: tool for tool in self.tools}
```

If tools are:

```python
[
    policy_search,
    web_search,
    calculator,
]
```

the map is:

```python
{
    "policy_search": policy_search,
    "web_search": web_search,
    "calculator": calculator,
}
```

The model only outputs tool names. The executor uses this map to find the Python
object to run.

### Step 2: Build Color Mapping

```python
color_mapping = get_color_mapping(
    [tool.name for tool in self.tools],
    excluded_colors=["green", "red"],
)
```

This is for logs/callback display only. It is not business logic.

### Step 3: Initialize Run State

```python
intermediate_steps = []
iterations = 0
time_elapsed = 0.0
start_time = time.time()
```

Important:

- `intermediate_steps` starts empty for every run.
- Do not reuse it across users or requests.

### Step 4: Start Loop

```python
while self._should_continue(iterations, time_elapsed):
    ...
```

Stop logic:

```python
if self.max_iterations is not None and iterations >= self.max_iterations:
    return False
return self.max_execution_time is None or time_elapsed < self.max_execution_time
```

Default max iterations is `15`.

### Step 5: Take Next Step

```python
next_step_output = self._take_next_step(
    name_to_tool_map,
    color_mapping,
    inputs,
    intermediate_steps,
    run_manager=run_manager,
)
```

This method performs one planning and tool-execution cycle.

It returns either:

```python
AgentFinish
```

or:

```python
list[tuple[AgentAction, str]]
```

### Step 6: If Finished, Return

```python
if isinstance(next_step_output, AgentFinish):
    return self._return(next_step_output, intermediate_steps, run_manager)
```

Final output normally looks like:

```json
{
  "output": "The reimbursement limit is 300 USD."
}
```

### Step 7: Save Observations

If the result is not final:

```python
intermediate_steps.extend(next_step_output)
```

For RAG, this is where retrieved document text enters the agent context.

### Step 8: Direct Tool Return Check

If exactly one tool was called:

```python
tool_return = self._get_tool_return(next_step_action)
```

If the tool has:

```python
return_direct=True
```

the executor returns the tool observation as the final answer.

This is uncommon for RAG because RAG usually needs a second model call to write
a polished answer using retrieved context.

### Step 9: Increment Loop Counters

```python
iterations += 1
time_elapsed = time.time() - start_time
```

### Step 10: Stop By Limit

If the loop reaches max iterations or timeout:

```python
output = self._action_agent.return_stopped_response(
    self.early_stopping_method,
    intermediate_steps,
    **inputs,
)
return self._return(output, intermediate_steps, run_manager)
```

Default response:

```text
Agent stopped due to iteration limit or time limit.
```

## One Step Deep Dive: `_iter_next_step(...)`

This is the most important method for understanding agent behavior.

Source:

`AgentExecutor._iter_next_step(...)`

It is an iterator because streaming can yield the action before the tool result.

### Step 1: Prepare Intermediate Steps

```python
intermediate_steps = self._prepare_intermediate_steps(intermediate_steps)
```

If `trim_intermediate_steps` is:

- `-1`: keep all steps;
- positive integer: keep only last N steps;
- callable: use custom trimming logic.

This matters for RAG because retrieved observations can be long.

### Step 2: Call Agent Planner

```python
output = self._action_agent.plan(
    intermediate_steps,
    callbacks=run_manager.get_child() if run_manager else None,
    **inputs,
)
```

At this point the agent receives:

- user input;
- chat history if included;
- current intermediate steps.

For a tool-calling Runnable agent, `plan(...)` eventually calls:

```python
self.runnable.stream(...)
```

or:

```python
self.runnable.invoke(...)
```

### Step 3: Handle Parser Error

If output parsing fails:

```python
except OutputParserException as e:
    ...
```

Default:

```python
handle_parsing_errors=False
```

means raise an error.

Recommended for user-facing agents:

```python
handle_parsing_errors=True
```

Then parser error becomes an observation:

```python
AgentAction("_Exception", observation, text)
```

and the executor runs `ExceptionTool`, which just returns the observation. The
next model call can fix its format.

### Step 4: If AgentFinish, Yield Finish

```python
if isinstance(output, AgentFinish):
    yield output
    return
```

No tool is called.

### Step 5: Normalize Actions

```python
actions = [output] if isinstance(output, AgentAction) else output
```

This supports both single-action and multi-action agents.

### Step 6: Yield Actions

```python
for agent_action in actions:
    yield agent_action
```

Streaming uses this to show progress:

```json
{"type": "agent_action", "tool": "policy_search"}
```

### Step 7: Execute Actions

```python
for agent_action in actions:
    yield self._perform_agent_action(...)
```

This returns `AgentStep` objects.

## Tool Execution Deep Dive

Source:

`AgentExecutor._perform_agent_action(...)`

### Step 1: Log Action

```python
run_manager.on_agent_action(agent_action, color="green")
```

### Step 2: Find Tool

```python
if agent_action.tool in name_to_tool_map:
    tool = name_to_tool_map[agent_action.tool]
```

If the tool does not exist, `InvalidTool` is called instead.

### Step 3: Run Tool

```python
observation = tool.run(
    agent_action.tool_input,
    verbose=self.verbose,
    color=color,
    callbacks=run_manager.get_child() if run_manager else None,
    **tool_run_kwargs,
)
```

For RAG:

- `tool` is the retriever tool;
- `agent_action.tool_input` includes the retrieval query;
- `observation` is formatted retrieved context.

### Step 4: Return AgentStep

```python
return AgentStep(action=agent_action, observation=observation)
```

The executor later converts this to:

```python
(agent_action, observation)
```

inside `intermediate_steps`.

## Tool-Calling Agent Deep Dive

Source:

`libs/langchain/langchain_classic/agents/tool_calling_agent/base.py`

Factory:

```python
create_tool_calling_agent(llm, tools, prompt)
```

Pipeline:

```python
(
    RunnablePassthrough.assign(
        agent_scratchpad=lambda x: message_formatter(x["intermediate_steps"]),
    )
    | prompt
    | llm.bind_tools(tools)
    | ToolsAgentOutputParser()
)
```

### What Each Part Does

#### `RunnablePassthrough.assign(...)`

Adds `agent_scratchpad` to the input dictionary.

Input:

```python
{
    "input": "What is the reimbursement limit?",
    "intermediate_steps": [...],
}
```

Output:

```python
{
    "input": "What is the reimbursement limit?",
    "intermediate_steps": [...],
    "agent_scratchpad": [ToolMessage(...), ...],
}
```

#### `prompt`

Creates chat messages:

```python
[
    SystemMessage(...),
    HumanMessage("What is the reimbursement limit?"),
    ToolMessage(... previous observations ...)
]
```

#### `llm.bind_tools(tools)`

Sends tool schemas to the model. The model can respond with:

- normal assistant message;
- tool call message.

#### `ToolsAgentOutputParser`

If the model returned tool calls:

```python
list[AgentAction]
```

If the model returned normal content:

```python
AgentFinish({"output": message.content}, ...)
```

## Tool-Calling RAG Timeline

Example question:

```text
What is the reimbursement limit for remote work equipment?
```

### Iteration 1: Model Decides To Retrieve

Prompt includes:

- system instructions;
- user question;
- available tools;
- empty scratchpad.

Model returns tool call:

```json
{
  "name": "policy_search",
  "args": {
    "query": "remote work equipment reimbursement limit"
  }
}
```

Parser returns:

```python
ToolAgentAction(
    tool="policy_search",
    tool_input={"query": "remote work equipment reimbursement limit"},
    ...
)
```

Executor runs:

```python
policy_search.run({"query": "remote work equipment reimbursement limit"})
```

Retriever returns documents. Tool formats them into observation:

```text
Title: Remote Work Policy
Section: Equipment
Content: Approved ergonomic equipment may be reimbursed up to 300 USD.
URL: https://example.internal/policies/remote-work
```

Executor stores:

```python
intermediate_steps = [
    (policy_search_action, retrieved_context)
]
```

### Iteration 2: Model Answers With Retrieved Context

Prompt now includes scratchpad messages:

```text
Assistant requested policy_search(...)
Tool returned Remote Work Policy context
```

Model returns normal message:

```markdown
## Remote Work Equipment Reimbursement

The reimbursement limit is **300 USD** for approved ergonomic equipment.

Source: [Remote Work Policy](https://example.internal/policies/remote-work)
```

Parser returns:

```python
AgentFinish(
    return_values={"output": "...markdown..."},
    log="...markdown...",
)
```

Executor returns:

```json
{
  "output": "## Remote Work Equipment Reimbursement\n\n..."
}
```

If `return_intermediate_steps=True`, it also returns the retrieval action and
observation.

## ReAct RAG Timeline

For ReAct, the same logic happens with text instead of native tool calls.

### Iteration 1 Model Output

```text
Thought: I need the company policy.
Action: policy_search
Action Input: remote work equipment reimbursement limit
```

`ReActSingleInputOutputParser` returns:

```python
AgentAction(
    tool="policy_search",
    tool_input="remote work equipment reimbursement limit",
    log="Thought: I need..."
)
```

Executor runs the tool and stores observation.

### Iteration 2 Prompt Scratchpad

```text
Thought: I need the company policy.
Action: policy_search
Action Input: remote work equipment reimbursement limit
Observation: Title: Remote Work Policy...
Thought:
```

### Iteration 2 Model Output

```text
Thought: I now know the final answer.
Final Answer: The reimbursement limit is 300 USD.
```

Parser returns `AgentFinish`.

## Retriever Tool Deep Dive

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

### Input Schema

The generated tool has:

```python
class RetrieverInput(BaseModel):
    query: str = Field(description="query to look up in retriever")
```

The model should call it with:

```json
{"query": "remote work reimbursement"}
```

### Sync Function

The generated sync function is conceptually:

```python
def func(query: str, callbacks: Callbacks = None):
    docs = retriever.invoke(query, config={"callbacks": callbacks})
    content = document_separator.join(
        format_document(doc, document_prompt_) for doc in docs
    )
    if response_format == "content_and_artifact":
        return (content, docs)
    return content
```

### Async Function

Conceptually:

```python
async def afunc(query: str, callbacks: Callbacks = None):
    docs = await retriever.ainvoke(query, config={"callbacks": callbacks})
    content = document_separator.join(
        [await aformat_document(doc, document_prompt_) for doc in docs]
    )
    if response_format == "content_and_artifact":
        return (content, docs)
    return content
```

### Default Document Prompt

Default:

```python
PromptTemplate.from_template("{page_content}")
```

So by default the model only sees document text, not title, URL, or section.

For production RAG, use a richer document prompt or collect sources separately.

Example:

```python
document_prompt = PromptTemplate.from_template(
    "Title: {title}\nURL: {url}\nSection: {section}\nContent: {page_content}"
)
```

## RAG Data Flow With Source Collection

The retriever tool returns text to the model. The web UI needs structured
sources.

Recommended design:

```text
retriever returns Document objects
-> tool formats Documents as text observation for model
-> source collector stores Document metadata for web response
```

Example wrapper:

```python
class SourceCollectingRetriever:
    def __init__(self, retriever, source_collector):
        self.retriever = retriever
        self.source_collector = source_collector

    def invoke(self, query: str, config: dict | None = None):
        docs = self.retriever.invoke(query, config=config)
        self.source_collector.add_documents(docs)
        return docs

    async def ainvoke(self, query: str, config: dict | None = None):
        docs = await self.retriever.ainvoke(query, config=config)
        self.source_collector.add_documents(docs)
        return docs
```

Then:

```python
tool = create_retriever_tool(
    SourceCollectingRetriever(retriever, source_collector),
    "policy_search",
    "Search policy documents.",
)
```

Final web response:

```python
raw = agent_executor.invoke({"input": question})

response = {
    "answer_markdown": raw["output"],
    "sources": source_collector.to_list(),
    "intermediate_steps": serialize_steps(raw.get("intermediate_steps", [])),
}
```

## Deprecated VectorStore Agent Path

The codebase also has older vectorstore agents:

- `VectorStoreToolkit`
- `VectorStoreRouterToolkit`
- `create_vectorstore_agent`
- `create_vectorstore_router_agent`

Source:

`libs/langchain/langchain_classic/agents/agent_toolkits/vectorstore/base.py`

Flow:

```python
tools = toolkit.get_tools()
prompt = ZeroShotAgent.create_prompt(tools, prefix=prefix)
llm_chain = LLMChain(llm=llm, prompt=prompt)
agent = ZeroShotAgent(llm_chain=llm_chain, allowed_tools=tool_names)
executor = AgentExecutor.from_agent_and_tools(agent=agent, tools=tools)
```

Toolkit creates:

- `VectorStoreQATool`;
- `VectorStoreQAWithSourcesTool`;
- or one `VectorStoreQATool` per vector store for router toolkit.

These are deprecated. For new code, prefer:

```python
create_retriever_tool(vector_store.as_retriever(), name, description)
```

with a modern tool-calling agent.

## Async RAG Flow

Async execution starts from:

```python
await agent_executor.ainvoke({"input": question})
```

Internally:

```python
AgentExecutor._acall(...)
```

Important differences:

- uses `asyncio_timeout(self.max_execution_time)`;
- calls `await self._atake_next_step(...)`;
- calls `await self._action_agent.aplan(...)`;
- calls `await tool.arun(...)`;
- if multiple actions are returned, tool calls run with `asyncio.gather(...)`.

For RAG, make sure:

- retriever supports `ainvoke`;
- vector store client supports async if needed;
- source collector is safe for concurrent tool calls.

## Streaming RAG Flow

Streaming starts from:

```python
for chunk in agent_executor.stream({"input": question}):
    ...
```

`AgentExecutor.stream(...)` creates:

```python
AgentExecutorIterator(..., yield_actions=True)
```

### Streaming Chunks

When model chooses retriever:

```python
{"actions": [AgentAction(tool="policy_search", ...)]}
```

When retriever returns:

```python
{"steps": [AgentStep(action=..., observation="retrieved context")]}
```

When model finishes:

```python
{"output": "final markdown answer", "messages": [...]}
```

### Web Event Mapping

```python
if "actions" in chunk:
    emit({
        "type": "agent_action",
        "tool": chunk["actions"][0].tool,
    })
elif "steps" in chunk:
    emit({
        "type": "tool_result",
        "tool": chunk["steps"][0].action.tool,
        "summary": summarize_observation(chunk["steps"][0].observation),
    })
elif "output" in chunk:
    emit({
        "type": "final",
        "answer_markdown": chunk["output"],
        "sources": source_collector.to_list(),
    })
```

Do not stream raw hidden reasoning.

## End-To-End Pseudocode

This is the full feature in simplified form.

```python
def answer_question(question: str, chat_history: list[BaseMessage]) -> dict:
    source_collector = SourceCollector()

    retriever = vector_store.as_retriever(search_kwargs={"k": 5})
    collecting_retriever = SourceCollectingRetriever(retriever, source_collector)

    policy_tool = create_retriever_tool(
        collecting_retriever,
        "policy_search",
        "Search internal policy documents.",
    )

    tools = [policy_tool, web_search_tool]

    prompt = ChatPromptTemplate.from_messages(
        [
            (
                "system",
                (
                    "Answer as Markdown. Use tools when needed. "
                    "Cite sources when source URLs are available."
                ),
            ),
            MessagesPlaceholder("chat_history", optional=True),
            ("human", "{input}"),
            MessagesPlaceholder("agent_scratchpad"),
        ]
    )

    agent = create_tool_calling_agent(model, tools, prompt)

    executor = AgentExecutor(
        agent=agent,
        tools=tools,
        return_intermediate_steps=True,
        handle_parsing_errors=True,
        max_iterations=10,
        max_execution_time=60,
    )

    raw = executor.invoke(
        {
            "input": question,
            "chat_history": chat_history,
        }
    )

    return {
        "answer_markdown": raw["output"],
        "sources": source_collector.to_list(),
        "intermediate_steps": serialize_steps(raw.get("intermediate_steps", [])),
    }
```

## Concrete Example Trace

Question:

```text
What is the reimbursement limit for remote work equipment?
```

### Initial Inputs

```python
inputs = {
    "input": "What is the reimbursement limit for remote work equipment?",
    "chat_history": [],
}
```

### Initial State

```python
intermediate_steps = []
iterations = 0
```

### First Plan

Model tool call:

```json
{
  "name": "policy_search",
  "args": {
    "query": "remote work equipment reimbursement limit"
  }
}
```

Parser output:

```python
AgentAction(
    tool="policy_search",
    tool_input={"query": "remote work equipment reimbursement limit"},
    log="Invoking policy_search..."
)
```

### First Tool Result

Retriever documents:

```python
[
    Document(
        page_content="Approved ergonomic equipment may be reimbursed up to 300 USD.",
        metadata={
            "source_id": "remote-work-policy",
            "title": "Remote Work Policy",
            "url": "https://example.internal/policies/remote-work",
            "section": "Equipment",
        },
    )
]
```

Tool observation:

```text
Approved ergonomic equipment may be reimbursed up to 300 USD.
```

Intermediate steps:

```python
[
    (policy_search_action, "Approved ergonomic equipment may be reimbursed up to 300 USD.")
]
```

### Second Plan

Scratchpad now includes the tool observation.

Model final answer:

```markdown
## Remote Work Equipment Reimbursement

The reimbursement limit is **300 USD** for approved ergonomic equipment.

Source: [Remote Work Policy](https://example.internal/policies/remote-work)
```

Parser output:

```python
AgentFinish(
    return_values={
        "output": "## Remote Work Equipment Reimbursement\n\n..."
    },
    log="## Remote Work Equipment Reimbursement\n\n...",
)
```

### Final Raw Executor Output

```python
{
    "output": "## Remote Work Equipment Reimbursement\n\n...",
    "intermediate_steps": [
        (policy_search_action, "Approved ergonomic equipment may be reimbursed up to 300 USD.")
    ],
}
```

### Final Web Output

```json
{
  "answer_markdown": "## Remote Work Equipment Reimbursement\n\nThe reimbursement limit is **300 USD**...",
  "sources": [
    {
      "id": "remote-work-policy",
      "title": "Remote Work Policy",
      "url": "https://example.internal/policies/remote-work",
      "section": "Equipment"
    }
  ],
  "metadata": {
    "iteration_count": 2,
    "stop_reason": "agent_finish"
  }
}
```

## Common RAG Bugs In Agent Loops

### Bug 1: Retriever Tool Description Is Too Vague

Bad:

```text
Search documents.
```

Better:

```text
Search internal HR policy documents for benefits, leave, payroll, remote work,
reimbursement, and approval questions.
```

The model chooses tools based on name and description.

### Bug 2: Retrieved Documents Have No Source Metadata

If documents only have `page_content`, the model can answer but the web UI
cannot show reliable sources.

Fix:

```python
Document(
    page_content="...",
    metadata={"source_id": "...", "title": "...", "url": "..."},
)
```

### Bug 3: Tool Observation Too Large

Large observations can exceed context or distract the model.

Fixes:

- reduce `k`;
- rerank;
- compress;
- use shorter document prompts;
- trim intermediate steps.

### Bug 4: No Permission Filter

If retriever searches all tenant documents, the model may receive unauthorized
context.

Fix:

```python
vector_store.as_retriever(
    search_kwargs={"filter": {"tenant_id": current_tenant_id}}
)
```

### Bug 5: Final Answer Does Not Cite Sources

The model may omit citations even if retrieval worked.

Fix:

- include source metadata in document prompt;
- instruct model to cite sources;
- return structured `sources` separately;
- optionally post-process answer to attach source cards.

### Bug 6: Direct Return Used For RAG Tool

If a retriever tool has `return_direct=True`, the user may see raw retrieved
chunks instead of a synthesized answer.

For most RAG agents:

```python
return_direct=False
```

### Bug 7: Assuming Retrieval Means Usage

The agent can retrieve documents and still ignore them.

Fixes:

- improve system prompt;
- include clear source formatting;
- use answer validation;
- use a deterministic retrieval-then-answer chain for high-stakes questions.

## Implementation Checklist

- [ ] Build tool map from allowed tools.
- [ ] Initialize empty `intermediate_steps` per run.
- [ ] Call agent planner with inputs and intermediate steps.
- [ ] Parse model output into action or finish.
- [ ] Execute valid tools by name.
- [ ] Return invalid-tool observation when tool does not exist.
- [ ] Append tool observations to intermediate steps.
- [ ] Feed intermediate steps into scratchpad on next model call.
- [ ] Wrap retriever as a tool.
- [ ] Collect retrieved document metadata separately.
- [ ] Return Markdown answer.
- [ ] Return structured sources.
- [ ] Enforce max iterations and timeout.
- [ ] Support sync, async, and streaming if required.

