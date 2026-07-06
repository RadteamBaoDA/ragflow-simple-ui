# Workflow 11: Testing And Rollout

This workflow explains how to test and release an agent feature safely.

## Objective

Verify the agent behaves correctly before exposing it to users.

## Test Pyramid

```text
Many unit tests
Some integration tests
Few end-to-end tests
Manual evaluation for answer quality
```

## Unit Tests

### Prompt Tests

Test prompt variables:

```python
def test_tool_calling_prompt_has_scratchpad() -> None:
    assert "agent_scratchpad" in prompt.input_variables
```

Test system instructions contain key policies:

- use tools when needed;
- return Markdown;
- cite sources;
- do not reveal hidden reasoning.

### Tool Tests

Test tool schema and output:

```python
def test_policy_search_formats_documents(fake_retriever) -> None:
    tool = create_policy_search_tool(fake_retriever)
    output = tool.invoke({"query": "remote work"})
    assert "Remote Work Policy" in output
```

Test expected failures:

- timeout;
- no results;
- permission denied;
- malformed external response.

### Serializer Tests

Test converting executor result to web response:

```python
def test_serializer_returns_markdown_and_sources() -> None:
    response = serialize_agent_result(raw_result, source_collector)
    assert "answer_markdown" in response
    assert isinstance(response["sources"], list)
```

## Fake Model Tests

Use a fake model or fake agent to force specific plans:

1. return final answer directly;
2. call retriever tool;
3. call invalid tool;
4. return malformed ReAct output;
5. loop until max iterations.

This makes executor behavior deterministic.

## Retrieval Tests

Use fake documents:

```python
docs = [
    Document(
        page_content="The reimbursement limit is 300 USD.",
        metadata={"source_id": "remote-work-policy", "title": "Remote Work Policy"},
    )
]
```

Verify:

- correct documents are returned;
- metadata is preserved;
- tenant filters are applied;
- no-result cases are handled.

## Web Rendering Tests

Test Markdown cases:

- code blocks;
- tables;
- links;
- Mermaid;
- Vega-Lite;
- unsafe HTML;
- unsafe URLs.

Expected:

- rich content renders;
- unsafe content is blocked or escaped.

## Integration Tests

Use integration tests for:

- real vector store;
- real embedding model;
- real external APIs;
- real model provider.

Do not run network integration tests as unit tests.

## Evaluation Dataset

Create a small set of representative questions:

| Category | Example |
|---|---|
| Direct answer | "What can you help with?" |
| Retrieval | "What is the remote work reimbursement limit?" |
| Follow-up | "Does that include monitors?" |
| No answer | "What is the policy for something undocumented?" |
| External | "What recent issue mentions agent streaming?" |
| Table output | "Compare reimbursement limits." |
| Chart output | "Chart tickets by month." |

For each question, define expected behavior:

- should call tool or not;
- expected source;
- answer quality notes;
- unsafe behavior to avoid.

## Rollout Plan

1. Run locally with fake tools.
2. Enable internal test users.
3. Log all tool calls and stop reasons.
4. Review failures and bad answers.
5. Add missing tests.
6. Enable more users gradually.
7. Monitor cost, latency, error rate, and user feedback.

## Metrics

Track:

- success rate;
- tool error rate;
- parser error rate;
- average iterations;
- average latency;
- retrieval no-result rate;
- user retry rate;
- thumbs up/down if available;
- cost per run.

## Junior Developer Mental Model

Testing agents is different from testing normal deterministic code.

Split tests into two groups:

```text
Deterministic tests:
  no real model
  fake agent/model/retriever
  exact assertions

Quality tests:
  real or realistic model
  evaluation dataset
  scoring/rubric
```

Do not rely only on manual chat testing.

## End-To-End Test Plan

### 1. Unit Test Pure Functions

Test:

- input validation;
- prompt variable checks;
- tool output formatting;
- source collector;
- serializer;
- markdown sanitizer.

These should be fast and deterministic.

### 2. Unit Test Executor Paths With Fakes

Use fake agents/tools to force:

- direct final answer;
- one tool call then final answer;
- invalid tool;
- parser error;
- max iteration stop.

No network. No real LLM.

### 3. Unit Test Retrieval With Fake Documents

Use a fake retriever returning known `Document` objects.

Verify:

- formatted tool observation;
- collected sources;
- no-result behavior.

### 4. Integration Test Real Services Separately

Run separately from unit tests:

- real vector store;
- real embeddings;
- real model;
- real external tools.

These tests can be slower and may need credentials.

### 5. Evaluation Test Answer Quality

Create a dataset of representative questions and expected behavior.

Run it before releases and compare:

- answer correctness;
- source correctness;
- tool usage;
- latency;
- cost.

## Fake Agent Examples

### Direct Finish Agent

```python
class DirectFinishAgent:
    @property
    def input_keys(self) -> list[str]:
        return ["input"]

    @property
    def return_values(self) -> list[str]:
        return ["output"]

    def plan(self, intermediate_steps, callbacks=None, **kwargs):
        return AgentFinish({"output": "hello"}, "hello")
```

Test:

```python
def test_executor_direct_finish() -> None:
    executor = AgentExecutor(agent=DirectFinishAgent(), tools=[])
    result = executor.invoke({"input": "hi"})
    assert result["output"] == "hello"
```

### Tool Then Finish Agent

```python
class ToolThenFinishAgent:
    @property
    def input_keys(self) -> list[str]:
        return ["input"]

    @property
    def return_values(self) -> list[str]:
        return ["output"]

    def plan(self, intermediate_steps, callbacks=None, **kwargs):
        if not intermediate_steps:
            return AgentAction("search", "policy", "call search")
        return AgentFinish({"output": intermediate_steps[0][1]}, "done")
```

Test verifies the loop appends the tool observation and returns it.

## RAG Evaluation Dataset Format

Use a simple table or JSON file:

```json
[
  {
    "id": "policy_reimbursement_limit",
    "question": "What is the remote work reimbursement limit?",
    "expected_answer_contains": ["300 USD"],
    "expected_sources": ["remote-work-policy"],
    "should_call_tools": ["policy_search"]
  },
  {
    "id": "unknown_policy",
    "question": "What is the policy for teleportation expenses?",
    "expected_answer_contains": ["could not find"],
    "expected_sources": [],
    "should_call_tools": ["policy_search"]
  }
]
```

Evaluation runner:

```python
for case in cases:
    result = agent_service.answer(case["question"])
    assert_contains(result["answer_markdown"], case["expected_answer_contains"])
    assert_source_ids(result["sources"], case["expected_sources"])
```

## Rollout Stages

### Stage 0: Local Development

- fake model;
- fake retriever;
- no network;
- developer-only.

Exit criteria:

- unit tests pass;
- basic UI renders final answer;
- no unsafe Markdown rendering.

### Stage 1: Internal Test

- real model;
- small internal corpus;
- limited internal users.

Exit criteria:

- acceptable latency;
- sources are correct;
- no permission leaks;
- failures are understandable.

### Stage 2: Private Beta

- selected real users;
- monitoring enabled;
- feedback controls enabled.

Exit criteria:

- success rate target met;
- tool error rate acceptable;
- cost within budget;
- no critical security findings.

### Stage 3: General Availability

- broader users;
- run history and audit logs retained;
- support playbook ready.

## Release Gates

Do not release if:

- unauthorized tools can be called;
- tenant filters are missing;
- Markdown sanitizer is disabled;
- no stop limits are configured;
- source metadata is missing for RAG answers;
- error responses expose stack traces;
- integration costs are unbounded.

## Manual Review Checklist

Before rollout, manually test:

- simple greeting;
- direct question with no tools;
- policy RAG question;
- follow-up question;
- question with no matching documents;
- invalid/ambiguous question;
- chart/table answer;
- unsafe prompt injection in retrieved document;
- unauthorized user access;
- long conversation.

## Monitoring During Rollout

Dashboard should show:

```text
total runs
success rate
p50/p95 latency
tool calls by tool
tool error rate
parser error rate
max-iteration stops
retrieval no-result rate
top error types
cost estimate
```

Alert on:

- sudden error spike;
- high permission-denied spike;
- high max-iteration stop rate;
- high model rate-limit errors;
- tool latency above threshold.

## Feedback Loop

Collect user feedback:

```json
{
  "run_id": "run_123",
  "rating": "down",
  "reason": "wrong_source",
  "comment": "The answer cited the old policy."
}
```

Use feedback to improve:

- document freshness;
- chunking;
- tool descriptions;
- prompt instructions;
- evaluation dataset.

## Debugging Failed Evaluations

For each failed case, inspect:

1. Did the agent call the expected tool?
2. Was the retrieval query good?
3. Did retriever return expected source?
4. Was source text included in observation?
5. Did model ignore the observation?
6. Did serializer drop sources?
7. Did frontend render incorrectly?

Fix the failing layer. Do not blindly change the prompt for every failure.

## Done Checklist

- [ ] Prompt tests exist.
- [ ] Tool tests exist.
- [ ] Serializer tests exist.
- [ ] Fake model tests cover executor paths.
- [ ] Retrieval tests verify metadata and filters.
- [ ] Web renderer tests block unsafe content.
- [ ] Integration tests are separated from unit tests.
- [ ] Evaluation questions exist.
- [ ] Rollout metrics are defined.
- [ ] Fake-agent tests cover executor control flow.
- [ ] RAG evaluation cases include expected sources.
- [ ] Security tests are release gates.
- [ ] Rollout stages and rollback criteria are documented.
- [ ] Monitoring dashboard and alerts are defined before broad release.
