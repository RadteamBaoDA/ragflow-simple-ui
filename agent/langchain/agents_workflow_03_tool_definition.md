# Workflow 03: Tool Definition

This workflow explains how to define tools that the agent can call.

## Objective

Expose backend capabilities to the model safely through typed, named tools.

Tools are the only way the model should access:

- vector stores;
- external search;
- databases;
- internal APIs;
- calculations;
- file operations;
- chart/table generation.

## Current Codebase Reference

Key files:

- `libs/langchain/langchain_classic/agents/agent.py`
- `libs/core/langchain_core/tools/retriever.py`
- `libs/langchain/langchain_classic/agents/tools.py`
- `libs/langchain/langchain_classic/agents/output_parsers/tools.py`

## Tool Requirements

Every tool needs:

| Field | Purpose |
|---|---|
| `name` | Identifier the model uses when calling the tool. |
| `description` | Explains when and why to use the tool. |
| input schema | Defines valid arguments. |
| function/coroutine | Executes the actual work. |
| output | Returns text or structured data for the observation. |

## Naming Rules

Good names:

- `policy_search`
- `engineering_docs_search`
- `issue_tracker_search`
- `calculate_total_cost`

Bad names:

- `search`
- `tool1`
- `data`
- `api`

Tool names must be unique within one agent executor.

## Description Rules

Weak:

```text
Search documents.
```

Good:

```text
Search internal HR policy documents. Use this for questions about benefits,
leave, payroll, remote work, reimbursements, employee policies, and approvals.
```

The model uses the description to decide which tool to call.

## Simple Tool Example

```python
from langchain_core.tools import tool

@tool
def calculate_reimbursement(quantity: int, unit_price: float) -> str:
    """Calculate total reimbursement amount from quantity and unit price."""
    total = quantity * unit_price
    return f"Total reimbursement amount: {total:.2f}"
```

## External API Tool Example

```python
from pydantic import BaseModel, Field
from langchain_core.tools import StructuredTool

class IssueSearchInput(BaseModel):
    query: str = Field(description="Search query for issue tracker")
    limit: int = Field(default=5, ge=1, le=10)

def issue_search(query: str, limit: int = 5) -> str:
    results = issue_client.search(query=query, limit=limit)
    return format_issues_as_markdown(results)

issue_search_tool = StructuredTool.from_function(
    func=issue_search,
    name="issue_tracker_search",
    description=(
        "Search issue tracker tickets. Use this for recent bugs, incidents, "
        "implementation discussions, and project status."
    ),
    args_schema=IssueSearchInput,
)
```

## Retrieval Tool Example

```python
from langchain_core.tools import create_retriever_tool

policy_search_tool = create_retriever_tool(
    retriever=policy_vector_store.as_retriever(search_kwargs={"k": 5}),
    name="policy_search",
    description="Search internal policy documents.",
)
```

## Tool Output Rules

Tool output should be:

- concise;
- directly useful to the model;
- formatted predictably;
- free of secrets;
- safe to log after sanitization.

Good output:

```markdown
Title: Remote Work Policy
Section: Reimbursement
Content: Approved ergonomic equipment may be reimbursed up to 300 USD.
URL: https://example.internal/policies/remote-work
```

Bad output:

```json
{"very_large_raw_api_response": "... thousands of lines ..."}
```

## Returning Structured Artifacts

Classic `AgentExecutor` mainly feeds text observations back to the model. For
web artifacts, collect structured data outside the model answer.

Pattern:

```python
def chart_tool(query: str) -> str:
    chart = build_chart(query)
    artifact_collector.add(chart)
    return f"Created chart artifact {chart.id}: {chart.title}"
```

The final web response includes:

```json
{
  "artifacts": [
    {
      "id": "chart_1",
      "type": "vega-lite",
      "title": "Ticket volume",
      "data": {}
    }
  ]
}
```

## Tool Error Handling

Expected external error:

```python
def issue_search(query: str) -> str:
    try:
        return issue_client.search_as_markdown(query)
    except TimeoutError:
        return "Issue tracker search timed out. Try a narrower query."
```

Programming or permission error:

```python
if not current_user.can_search_issues:
    msg = "User is not allowed to search issues."
    raise PermissionError(msg)
```

## Tool Selection By Permission

Do not give all tools to every user.

```python
tools = []
if user.can_read_policies:
    tools.append(policy_search_tool)
if user.can_read_issues:
    tools.append(issue_search_tool)
```

The executor only knows about the tools you pass to it.

## Junior Developer Mental Model

A tool is a safe doorway from the model to backend code.

The model can say:

```json
{
  "tool": "policy_search",
  "tool_input": {
    "query": "remote work reimbursement"
  }
}
```

The executor decides whether that tool exists and then runs Python code:

```python
policy_search_tool.run({"query": "remote work reimbursement"})
```

The model should never directly access:

- database clients;
- API keys;
- file systems;
- vector store clients;
- user permission objects.

Tools expose a controlled, logged, validated interface.

## End-To-End Tool Implementation Recipe

### 1. Pick One Clear Capability

One tool should do one job.

Good:

```text
policy_search: Search policy documents.
```

Bad:

```text
company_tool: Search policies, update employee profile, create tickets, and send emails.
```

If a tool does too many things, the model will call it incorrectly and security
review becomes harder.

### 2. Define Input Schema

Use a Pydantic schema for multi-field tools:

```python
class PolicySearchInput(BaseModel):
    query: str = Field(description="Search query for policy documents")
    document_type: str | None = Field(
        default=None,
        description="Optional document type filter, such as policy or handbook",
    )
```

Schema descriptions are model-facing. Write them clearly.

### 3. Implement Function

```python
def policy_search(query: str, document_type: str | None = None) -> str:
    docs = retriever.invoke(
        query,
        config={"metadata": {"document_type": document_type}},
    )
    return format_docs_for_model(docs)
```

Function rules:

- validate inputs;
- enforce timeout;
- return concise observations;
- raise or return safe messages for expected failures;
- do not return secrets.

### 4. Create Tool

```python
policy_search_tool = StructuredTool.from_function(
    func=policy_search,
    name="policy_search",
    description=(
        "Search internal policy documents. Use this for questions about "
        "employee policies, remote work, reimbursements, benefits, and approvals."
    ),
    args_schema=PolicySearchInput,
)
```

### 5. Add Permission Filter

```python
def build_tools_for_user(user) -> list[BaseTool]:
    tools = []
    if user.can_read_policies:
        tools.append(create_policy_search_tool(user))
    if user.can_search_issues:
        tools.append(create_issue_search_tool(user))
    return tools
```

### 6. Add Tool To Agent

```python
tools = build_tools_for_user(user)
agent = create_tool_calling_agent(model, tools, prompt)
executor = AgentExecutor(agent=agent, tools=tools)
```

### 7. Test Tool Alone Before Testing Agent

```python
def test_policy_search_tool() -> None:
    output = policy_search_tool.invoke(
        {"query": "remote work reimbursement", "document_type": "policy"}
    )
    assert "reimbursement" in output.lower()
```

If the tool does not work alone, it will not work inside the agent.

## Tool Types

| Tool type | Example | Notes |
|---|---|---|
| Retrieval tool | `policy_search` | Returns source text for RAG. |
| External search tool | `web_search` | Needs timeout/rate-limit handling. |
| API read tool | `get_ticket_status` | Usually safe if permission-filtered. |
| API write tool | `create_ticket` | Should require confirmation or strong policy checks. |
| Calculation tool | `calculate_total_cost` | Good for deterministic math. |
| Artifact tool | `create_chart` | Should collect artifacts separately from model text. |

## Tool Output Design

The tool output becomes the model's observation.

Good observation:

```text
Title: Remote Work Policy
Section: Reimbursement
Content: Approved ergonomic equipment may be reimbursed up to 300 USD.
```

Bad observation:

```text
{"status":200,"headers":{"x-trace":"..."},"body":{"items":[...10000 rows...]}}
```

If the raw API response is large, convert it:

```python
def format_issues_as_markdown(issues: list[Issue]) -> str:
    lines = []
    for issue in issues[:5]:
        lines.append(
            f"- {issue.key}: {issue.title} "
            f"(status: {issue.status}, url: {issue.url})"
        )
    return "\n".join(lines)
```

## Tool Error Policy

Use this decision table:

| Error | Tool behavior |
|---|---|
| No results | Return `"No matching documents found."` |
| User lacks permission | Raise `PermissionError` or omit tool before agent construction. |
| External timeout | Return safe timeout observation or raise retriable error. |
| Invalid user input | Return validation message or raise `ValueError`. |
| Programming bug | Raise and log server-side. |

Expected user-facing failure:

```python
return "Policy search found no matching documents for that query."
```

Unexpected failure:

```python
logger.exception("policy_search failed")
raise
```

## Direct Return Decision

`return_direct=True` means the executor returns the tool output directly to the
user without another model call.

Use `return_direct=True` for:

- exact lookup tools;
- generated file links;
- already-rendered reports.

Avoid `return_direct=True` for:

- retriever tools;
- raw API tools;
- tools that return partial context.

For RAG, the model usually needs to synthesize the retrieved context into an
answer, so keep direct return off.

## Async Tool Implementation

If your app uses async endpoints, tools should support async:

```python
class PolicySearchTool(BaseTool):
    name = "policy_search"
    description = "Search policy documents."

    def _run(self, query: str) -> str:
        docs = retriever.invoke(query)
        return format_docs(docs)

    async def _arun(self, query: str) -> str:
        docs = await retriever.ainvoke(query)
        return format_docs(docs)
```

If `_arun` internally blocks on sync I/O, async performance will still be poor.

## Concrete Tool Trace

Model chooses:

```json
{
  "tool": "issue_tracker_search",
  "tool_input": {
    "query": "agent streaming bug",
    "limit": 3
  }
}
```

Executor runs:

```python
observation = issue_search_tool.run(
    {"query": "agent streaming bug", "limit": 3}
)
```

Tool returns:

```markdown
- PROJ-123: Streaming chunks missing final event (status: Open)
- PROJ-118: Tool result events duplicated (status: In Review)
- PROJ-101: SSE connection closes early (status: Done)
```

Executor appends:

```python
(agent_action, observation)
```

Next model call can answer with the issue context.

## Testing Tools

### Test Schema Validation

```python
def test_issue_search_limit_validation() -> None:
    with pytest.raises(ValueError):
        issue_search_tool.invoke({"query": "bug", "limit": 1000})
```

### Test Tool Output Is Concise

```python
def test_tool_output_is_not_too_large() -> None:
    output = issue_search_tool.invoke({"query": "agent", "limit": 5})
    assert len(output) < 4000
```

### Test Permission Filtering

```python
def test_user_without_issue_permission_has_no_issue_tool() -> None:
    tools = build_tools_for_user(user_without_issue_permission)
    assert "issue_tracker_search" not in {tool.name for tool in tools}
```

### Test Expected Error

```python
def test_timeout_returns_safe_message(fake_timeout_client) -> None:
    output = issue_search("agent")
    assert "timed out" in output.lower()
```

## Debugging Tools

Log safe fields:

```python
logger.info("tool_name=%s", tool.name)
logger.info("tool_input_preview=%s", preview(tool_input))
logger.info("tool_duration_ms=%s", duration_ms)
logger.info("tool_output_length=%s", len(observation))
```

Do not log:

- API keys;
- OAuth tokens;
- full private documents unless allowed;
- sensitive user records.

If the model chooses the wrong tool:

- improve tool names;
- improve tool descriptions;
- reduce overlapping tool descriptions;
- remove tools the user does not need.

## Done Checklist

- [ ] Tool names are unique.
- [ ] Descriptions explain when to use each tool.
- [ ] Inputs are typed and validated.
- [ ] Outputs are concise.
- [ ] Expected external failures are handled.
- [ ] Permission filtering happens before agent construction.
- [ ] Structured sources/artifacts are collected separately when needed.
- [ ] Tools are tested alone before being used inside an agent.
- [ ] Tool output size is bounded.
- [ ] Write/action tools have confirmation or strict policy checks.
- [ ] Async tools are implemented when used by async agent flows.
