# Agents Feature Specification

This document is the product and engineering specification for implementing an
agent feature equivalent to `libs/langchain/langchain_classic/agents`.

Audience: junior developers who need to understand what to build before reading
the detailed design and workflows.

## Goal

Build an agent runtime that can:

1. Accept a user question and optional chat history.
2. Decide whether it can answer directly or needs tools.
3. Call tools such as vector database retrieval, external search, APIs, or
   calculators.
4. Feed tool results back into the model as context.
5. Repeat until it has enough information or reaches a stop limit.
6. Return a final answer formatted as web-renderable Markdown.
7. Optionally return intermediate steps, sources, artifacts, and streaming
   events.

The feature must support retrieval-augmented generation (RAG): the agent can
retrieve relevant documents from a vector store or external source before
answering.

## Non-Goals

- Do not expose hidden chain-of-thought to end users.
- Do not execute user-provided code from Markdown output.
- Do not rely on the model to enforce authorization. Tool selection must be
  filtered by application permissions before the agent runs.
- Do not make every response use retrieval. The model should call retrieval only
  when it needs source context.
- Do not couple the web renderer to LangChain object classes. Serialize outputs
  into plain JSON for the frontend.
- Do not implement every deprecated classic agent type unless compatibility is a
  requirement. The recommended base feature is the executor loop plus modern
  tool-calling and retriever tools.

## Current Codebase References

| Feature | Source |
|---|---|
| Agent loop | `libs/langchain/langchain_classic/agents/agent.py` |
| Streaming loop | `libs/langchain/langchain_classic/agents/agent_iterator.py` |
| Tool-calling agent factory | `libs/langchain/langchain_classic/agents/tool_calling_agent/base.py` |
| ReAct agent factory | `libs/langchain/langchain_classic/agents/react/agent.py` |
| OpenAI tools agent factory | `libs/langchain/langchain_classic/agents/openai_tools/base.py` |
| Tool-call output parser | `libs/langchain/langchain_classic/agents/output_parsers/tools.py` |
| ReAct output parser | `libs/langchain/langchain_classic/agents/output_parsers/react_single_input.py` |
| Retriever tool factory | `libs/core/langchain_core/tools/retriever.py` |
| Vectorstore toolkit | `libs/langchain/langchain_classic/agents/agent_toolkits/vectorstore/toolkit.py` |
| Conversational retrieval agent | `libs/langchain/langchain_classic/agents/agent_toolkits/conversational_retrieval/openai_functions.py` |

## Actors

| Actor | Description |
|---|---|
| User | Sends a question through a web UI or API client. |
| Web application | Displays the answer, sources, charts, tables, and streaming status. |
| Backend API | Authenticates the user, creates an agent run, and returns results. |
| Agent executor | Runs the agent loop and executes tools. |
| Model | Decides next action or final answer. |
| Tools | Retrieve or compute information. |
| Vector store | Stores embedded documents and returns relevant chunks. |
| External APIs | Search engines, issue trackers, databases, internal systems. |

## Required Inputs

The minimum input contract is:

```json
{
  "input": "What is the remote work reimbursement limit?",
  "chat_history": [],
  "user_context": {
    "user_id": "u_123",
    "tenant_id": "tenant_a",
    "roles": ["employee"],
    "locale": "en-US",
    "timezone": "America/New_York"
  }
}
```

`input` is required.

`chat_history` is optional. It should be an ordered list of previous user and AI
messages. If the selected agent prompt is text-only, convert history into a
plain string. If the selected agent prompt is chat-based, keep it as message
objects.

`user_context` is required in production even if the model does not see all of
it. It is used to filter tools, vector stores, metadata filters, and audit logs.

## Required Outputs

The backend must return a stable web response:

```json
{
  "run_id": "run_123",
  "answer_markdown": "## Answer\n\nThe limit is 300 USD...",
  "sources": [],
  "artifacts": [],
  "intermediate_steps": [],
  "metadata": {
    "stop_reason": "agent_finish",
    "iteration_count": 2,
    "duration_ms": 1430
  }
}
```

### Output Fields

| Field | Required | Description |
|---|---:|---|
| `run_id` | Yes | Unique ID for tracing one request. |
| `answer_markdown` | Yes | Final answer in GitHub-flavored Markdown. |
| `sources` | Yes | Structured source list from retrieval or external tools. Empty list if none. |
| `artifacts` | Yes | Structured charts, files, tables, or images. Empty list if none. |
| `intermediate_steps` | No | Sanitized debug trace for developers or admin users. |
| `metadata` | Yes | Runtime details such as duration, iteration count, model name, and stop reason. |

## Functional Requirements

### FR-1: Build Agent From Model, Prompt, and Tools

The system must build an agent using:

- one language model;
- one prompt template;
- zero or more tools;
- an output parser appropriate for the selected agent type.

For modern chat models, prefer a tool-calling agent. The current codebase uses:

```python
agent = create_tool_calling_agent(llm, tools, prompt)
agent_executor = AgentExecutor(agent=agent, tools=tools)
```

### FR-2: Validate Prompt Variables

Before the agent runs, validate that prompt variables exist.

Tool-calling prompts must include:

- `agent_scratchpad`

ReAct prompts must include:

- `tools`
- `tool_names`
- `agent_scratchpad`

If validation fails, fail at startup or request construction time, not halfway
through a user request.

### FR-3: Validate Tool Names

Tool names must be:

- unique in one executor;
- stable;
- descriptive;
- valid for the model provider if provider-specific restrictions exist.

If the agent declares allowed tools, the set of allowed tool names must exactly
match the provided tools. `AgentExecutor.validate_tools` performs this check in
the current codebase.

### FR-4: Execute Plan-Act-Observe Loop

The executor must repeat this sequence:

1. Send the user input and current scratchpad to the agent.
2. Receive either a tool action or final answer.
3. If it is a tool action, execute the tool.
4. Append `(action, observation)` to intermediate steps.
5. Continue until final answer or stop condition.

### FR-5: Support Retrieval Tools

The system must support a vector DB retriever wrapped as a tool.

Current codebase recommended path:

```python
from langchain_core.tools import create_retriever_tool

tool = create_retriever_tool(
    retriever=vector_store.as_retriever(search_kwargs={"k": 5}),
    name="policy_search",
    description="Search company policy documents.",
)
```

The tool receives:

```json
{"query": "remote work reimbursement"}
```

The tool returns formatted document content as the observation.

### FR-6: Support External Tools

External APIs must be wrapped as tools with typed input schemas and clear
descriptions.

Examples:

- public web search;
- issue tracker search;
- SQL query tool;
- internal user profile lookup;
- calculator;
- chart generation tool.

External tools must enforce timeouts and handle expected errors.

### FR-7: Support Sources

Retrieved documents must preserve metadata so the web application can show
sources.

Minimum source fields:

```json
{
  "id": "policy-remote-work",
  "title": "Remote Work Policy",
  "url": "https://example.internal/policies/remote-work",
  "section": "Reimbursement",
  "quote": "Approved ergonomic equipment may be reimbursed...",
  "metadata": {}
}
```

Do not depend only on model-generated citations. Collect sources from tool
results or callbacks.

### FR-8: Support Markdown Web Answers

The final answer must be Markdown, not HTML.

Allowed rich content:

- headings;
- paragraphs;
- lists;
- tables;
- code blocks;
- inline code;
- links;
- images from approved sources;
- fenced `mermaid` diagrams;
- fenced `vega-lite` charts;
- math if the frontend supports it.

### FR-9: Support Streaming

The runtime should support streaming events for:

- agent selected a tool;
- tool started;
- tool completed;
- source count updated;
- final answer completed.

Classic `AgentExecutor.stream(...)` emits action and step chunks. Token-level
model streaming may require model callbacks in addition to executor streaming.

### FR-10: Support Memory

The runtime must support chat history. It may also support memory that remembers
previous intermediate steps.

Use intermediate-step memory only when follow-up questions benefit from previous
tool observations. It uses more tokens and may introduce stale context.

### FR-11: Stop Safely

The executor must stop when:

- the agent returns a final answer;
- `max_iterations` is reached;
- `max_execution_time` is reached;
- a direct-return tool returns;
- an unrecoverable exception occurs.

Default stop response can be:

```text
Agent stopped due to iteration limit or time limit.
```

### FR-12: Handle Parser Errors

The runtime must define a parser error policy.

Recommended user-facing setting:

```python
handle_parsing_errors=True
```

This lets the model correct malformed tool-call output in the next loop step.

### FR-13: Support Legacy Compatibility Only When Needed

The current codebase includes legacy agent types and constructors:

- `initialize_agent`;
- `load_agent`;
- `AgentType`;
- ReAct docstore;
- conversational ReAct;
- chat ReAct;
- JSON chat;
- XML;
- structured chat;
- self-ask with search;
- OpenAI functions and multi-functions.

A new project may skip these unless it must support old imports, serialized
agent configs, or behavior migration. If compatibility is required, document the
exact supported subset and add tests for each supported prompt/parser protocol.

## Non-Functional Requirements

### Security

- Filter tools by user permissions before the run starts.
- Apply metadata filters to retrievers.
- Sanitize Markdown before rendering.
- Never execute generated code.
- Never expose raw system prompts, hidden scratchpad, secrets, or tokens.
- Log sanitized inputs only.

### Reliability

- Set max iteration limits.
- Set tool timeouts.
- Retry transient external API errors when safe.
- Return helpful failure messages for expected errors.
- Fail closed on permission errors.

### Observability

Log:

- run ID;
- user ID or tenant ID when allowed;
- selected tools;
- sanitized tool inputs;
- retriever result count;
- source IDs;
- iteration count;
- duration;
- stop reason;
- exceptions.

### Performance

- Keep retrieved chunks concise.
- Limit number of retrieved documents.
- Use reranking or compression when retrieval is noisy.
- Avoid loading all tools for every user if permissions or product area limit
  the possible tool set.
- Stream long-running runs.

## Acceptance Criteria

- A developer can create an agent with a prompt, model, and tools.
- The executor can answer a simple question without tools.
- The executor can call a retriever tool and answer using retrieved context.
- The executor can call an external tool and use the observation.
- The executor stops at max iterations.
- Parser errors can be sent back to the model when configured.
- The final output is Markdown.
- Sources are returned separately from the Markdown answer.
- Web rendering supports code, tables, diagrams, and chart blocks.
- Sensitive internal reasoning and raw tool logs are hidden from normal users.

## Example User Story

As an employee, I ask:

```text
What is the reimbursement limit for remote work equipment?
```

Expected behavior:

1. Backend authenticates me.
2. Backend creates an agent with tools I am allowed to use.
3. The model decides it needs policy information.
4. The agent calls `policy_search`.
5. The retriever returns relevant policy chunks.
6. The model answers using the retrieved context.
7. The web UI shows a Markdown answer and source links.

Expected answer:

```markdown
## Remote Work Equipment Reimbursement

The reimbursement limit is **300 USD** for approved ergonomic equipment.

Source: [Remote Work Policy](https://example.internal/policies/remote-work)
```
