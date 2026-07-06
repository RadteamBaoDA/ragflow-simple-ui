# Workflow 04: Retrieval And Vector DB

This workflow explains how an agent retrieves information from a vector database
or other retriever and uses it as answer context.

## Objective

Implement retrieval-augmented generation:

```text
user question -> retriever tool -> relevant documents -> model answer
```

The agent decides when to retrieve. The retriever returns documents. The final
answer should use the retrieved context and cite sources when available.

## Current Codebase Reference

Key files:

- `libs/core/langchain_core/tools/retriever.py`
- `libs/langchain/langchain_classic/agents/agent_toolkits/vectorstore/toolkit.py`
- `libs/langchain/langchain_classic/agents/agent_toolkits/vectorstore/base.py`
- `libs/langchain/langchain_classic/agents/agent_toolkits/conversational_retrieval/openai_functions.py`

## Step 1: Ingest Documents

Documents should become `Document` objects:

```python
Document(
    page_content="Approved ergonomic equipment may be reimbursed up to 300 USD.",
    metadata={
        "source_id": "remote-work-policy",
        "title": "Remote Work Policy",
        "url": "https://example.internal/policies/remote-work",
        "section": "Reimbursement",
        "tenant_id": "tenant_a",
    },
)
```

Minimum metadata:

- `source_id`
- `title`
- `url` if available
- `section` if available
- authorization fields such as `tenant_id` or `access_level`

## Step 2: Split Documents

Chunk documents before embedding.

Guidelines:

- keep chunks focused;
- preserve section headings;
- keep metadata on every chunk;
- avoid chunks so large they waste context;
- avoid chunks so small they lose meaning.

## Step 3: Embed And Store

Store chunks in a vector store with embeddings.

Conceptual flow:

```python
chunks = text_splitter.split_documents(documents)
vector_store.add_documents(chunks)
```

## Step 4: Create Retriever

Start with similarity search:

```python
retriever = vector_store.as_retriever(search_kwargs={"k": 5})
```

Add metadata filters:

```python
retriever = vector_store.as_retriever(
    search_kwargs={
        "k": 5,
        "filter": {
            "tenant_id": user_context["tenant_id"],
            "access_level": "employee",
        },
    }
)
```

Use MMR or reranking when results are repetitive or noisy.

## Step 5: Wrap Retriever As Tool

```python
from langchain_core.tools import create_retriever_tool

tool = create_retriever_tool(
    retriever,
    "policy_search",
    (
        "Search internal policy documents. Use this for questions about "
        "benefits, leave, payroll, remote work, reimbursements, and approvals."
    ),
)
```

The generated tool has one input:

```json
{"query": "query to look up in retriever"}
```

## Step 6: Customize Document Formatting

Default document formatting uses only:

```text
{page_content}
```

For better answers and citations, include metadata:

```python
document_prompt = PromptTemplate.from_template(
    "Title: {title}\nSection: {section}\nURL: {url}\nContent: {page_content}"
)
```

Then:

```python
tool = create_retriever_tool(
    retriever,
    "policy_search",
    "Search internal policy documents.",
    document_prompt=document_prompt,
    document_separator="\n\n---\n\n",
)
```

Make sure the prompt variables match fields available from document formatting.

## Step 7: Agent Calls Retrieval

The model emits an action:

```json
{
  "tool": "policy_search",
  "tool_input": {
    "query": "remote work equipment reimbursement limit"
  }
}
```

The executor calls:

```python
observation = tool.run(agent_action.tool_input)
```

The observation is formatted document content.

## Step 8: Feed Context Back To Model

The executor appends:

```python
(agent_action, observation)
```

to `intermediate_steps`.

On the next model call, the scratchpad includes the retrieved observation. The
model can then answer:

```markdown
The reimbursement limit is **300 USD** for approved ergonomic equipment.

Source: [Remote Work Policy](https://example.internal/policies/remote-work)
```

## Multiple Vector Stores

Use one tool per data source:

```python
tools = [
    create_retriever_tool(hr_retriever, "hr_policy_search", "..."),
    create_retriever_tool(eng_retriever, "engineering_docs_search", "..."),
    create_retriever_tool(support_retriever, "support_kb_search", "..."),
]
```

The model chooses based on tool names and descriptions.

If selection must be deterministic, route before building the agent:

```text
question -> classify domain -> choose allowed retriever tools -> run agent
```

## Source Collection

Do not rely only on Markdown citations. Collect sources in code.

Pattern:

```python
class CollectingRetriever:
    def __init__(self, retriever, source_collector):
        self.retriever = retriever
        self.source_collector = source_collector

    def invoke(self, query: str, config: dict | None = None):
        docs = self.retriever.invoke(query, config=config)
        self.source_collector.add_documents(docs)
        return docs
```

The web response should include deduplicated sources.

## Junior Developer Mental Model

Think of RAG as two separate jobs:

```text
Job 1: Find useful text.
Job 2: Ask the model to answer using that text.
```

The vector DB only does Job 1. It does not write the final answer.

The language model does Job 2. It should receive retrieved text as context and
then write the final answer.

In LangChain classic agents, the bridge between these jobs is a tool:

```text
retriever -> retriever tool -> tool observation -> scratchpad -> model answer
```

If the final answer is wrong, debug these questions in order:

1. Did the agent call the retrieval tool?
2. Did the retrieval tool receive a good query?
3. Did the retriever return the right documents?
4. Did the tool format documents clearly?
5. Did the next model call receive the observation?
6. Did the model use the observation in the final answer?

## End-To-End RAG Implementation Recipe

Use this as the implementation order for another project.

### 1. Define A Source Document Shape

Every original source should have stable metadata before chunking:

```python
raw_document = Document(
    page_content=policy_text,
    metadata={
        "source_id": "remote-work-policy",
        "title": "Remote Work Policy",
        "url": "https://example.internal/policies/remote-work",
        "section": "Full document",
        "tenant_id": "tenant_a",
        "access_level": "employee",
        "updated_at": "2026-01-10",
    },
)
```

Why this matters:

- `source_id` lets the web UI deduplicate source cards.
- `title` makes citations readable.
- `url` lets users open the original.
- `tenant_id` and `access_level` protect data.
- `updated_at` helps the model and UI warn about stale content.

### 2. Chunk Documents Without Losing Metadata

After splitting, each chunk should still know where it came from.

Conceptual example:

```python
chunks = text_splitter.split_documents([raw_document])

for index, chunk in enumerate(chunks):
    chunk.metadata["chunk_index"] = index
    chunk.metadata["source_id"] = raw_document.metadata["source_id"]
```

Bad chunk:

```python
Document(page_content="Approved ergonomic equipment may be reimbursed...")
```

Good chunk:

```python
Document(
    page_content="Approved ergonomic equipment may be reimbursed...",
    metadata={
        "source_id": "remote-work-policy",
        "title": "Remote Work Policy",
        "url": "https://example.internal/policies/remote-work",
        "section": "Reimbursement",
        "chunk_index": 3,
    },
)
```

### 3. Add Chunks To Vector Store

Conceptual code:

```python
ids = vector_store.add_documents(chunks)
```

Implementation notes:

- Store the returned IDs if the vector store generates them.
- Use deterministic IDs if you need re-indexing or deletion.
- Keep a separate record of ingestion status so failed indexing can be retried.

### 4. Create A Permissioned Retriever

For a user-facing product, the retriever must search only allowed documents.

Conceptual code:

```python
def create_policy_retriever(user_context: dict):
    return vector_store.as_retriever(
        search_kwargs={
            "k": 5,
            "filter": {
                "tenant_id": user_context["tenant_id"],
                "access_level": {"$in": user_context["access_levels"]},
            },
        }
    )
```

The exact filter syntax depends on the vector store. Some stores use Mongo-style
operators, some use SQL-like filters, and some use provider-specific objects.

### 5. Wrap Retriever As A Tool

```python
retriever = create_policy_retriever(user_context)

policy_search_tool = create_retriever_tool(
    retriever,
    "policy_search",
    (
        "Search internal policy documents. Use this for questions about "
        "employee policy, remote work, reimbursements, benefits, leave, "
        "payroll, approvals, and HR procedures."
    ),
)
```

Tool description is not a comment for developers. It is model-facing routing
data. The model decides whether to call this tool from this text.

### 6. Add Tool To Agent Executor

```python
tools = [policy_search_tool, web_search_tool]

agent = create_tool_calling_agent(model, tools, prompt)
agent_executor = AgentExecutor(agent=agent, tools=tools)
```

At runtime, the executor builds:

```python
name_to_tool_map = {
    "policy_search": policy_search_tool,
    "web_search": web_search_tool,
}
```

### 7. Convert Executor Output To Web Response

```python
raw = agent_executor.invoke({"input": question})

response = {
    "answer_markdown": raw["output"],
    "sources": source_collector.to_list(),
}
```

Do not make the frontend parse raw `intermediate_steps` to discover sources.
Collect sources explicitly.

## What `create_retriever_tool` Actually Does

`create_retriever_tool(...)` creates a `StructuredTool`.

The tool has this input schema:

```python
class RetrieverInput(BaseModel):
    query: str
```

When the agent calls:

```json
{
  "query": "remote work reimbursement"
}
```

the tool does this:

```python
docs = retriever.invoke(query, config={"callbacks": callbacks})
content = document_separator.join(
    format_document(doc, document_prompt_) for doc in docs
)
return content
```

So if the retriever returns three documents:

```python
[
    Document(page_content="Policy A text...", metadata={...}),
    Document(page_content="Policy B text...", metadata={...}),
    Document(page_content="Policy C text...", metadata={...}),
]
```

the tool observation becomes one string:

```text
Policy A text...

Policy B text...

Policy C text...
```

That string is what the model sees on the next loop iteration.

## Document Formatting Details

The default retriever tool only formats `page_content`.

For a web RAG assistant, prefer formatting with source metadata:

```python
document_prompt = PromptTemplate.from_template(
    (
        "Source ID: {source_id}\n"
        "Title: {title}\n"
        "Section: {section}\n"
        "URL: {url}\n"
        "Content:\n{page_content}"
    )
)
```

Expected observation:

```text
Source ID: remote-work-policy
Title: Remote Work Policy
Section: Reimbursement
URL: https://example.internal/policies/remote-work
Content:
Approved ergonomic equipment may be reimbursed up to 300 USD.
```

This makes it easier for the model to cite the correct document.

Important: the variables in `document_prompt` must exist on the document. In
LangChain document formatting, `page_content` is available, and metadata fields
can be used when the formatter receives them. If a metadata key is missing,
formatting may fail or produce incomplete context depending on the prompt and
formatter behavior. Keep metadata consistent.

## Choosing Retrieval Settings

### `k`

`k` is the number of documents returned.

Starter values:

| Use case | Suggested `k` |
|---|---:|
| FAQ or short policy answers | 3 |
| General document Q&A | 4-6 |
| Broad research question | 8-12 |
| High-latency or expensive model | 3-5 |

Too low:

- model misses relevant context.

Too high:

- model receives noisy context;
- prompt gets expensive;
- answer may cite irrelevant documents.

### Similarity Search

Use similarity search first:

```python
retriever = vector_store.as_retriever(search_kwargs={"k": 5})
```

Good default for simple semantic lookup.

### MMR Search

Use MMR when results are repetitive:

```python
retriever = vector_store.as_retriever(
    search_type="mmr",
    search_kwargs={"k": 5, "fetch_k": 20},
)
```

MMR tries to return diverse relevant chunks.

### Metadata Filters

Use filters for:

- tenant isolation;
- user permissions;
- document type;
- product area;
- language;
- freshness.

Example:

```python
search_kwargs = {
    "k": 5,
    "filter": {
        "tenant_id": "tenant_a",
        "document_type": "policy",
        "language": "en",
    },
}
```

## Query Rewriting

Sometimes the user question is bad for retrieval:

```text
Does that include monitors?
```

A retriever may not know what "that" means.

Options:

1. Let the agent produce a better tool query using chat history.
2. Add a query rewriting step before retrieval.
3. Use a history-aware retriever chain.

Agent-produced query example:

```json
{
  "query": "remote work equipment reimbursement monitors ergonomic equipment"
}
```

This is better than:

```json
{
  "query": "Does that include monitors?"
}
```

## Source Collector Implementation

A junior-friendly source collector:

```python
class SourceCollector:
    def __init__(self) -> None:
        self._sources: dict[str, dict] = {}

    def add_documents(self, docs: list[Document]) -> None:
        for doc in docs:
            source_id = str(
                doc.metadata.get("source_id")
                or doc.metadata.get("url")
                or doc.metadata.get("title")
                or ""
            )
            if not source_id:
                continue

            self._sources[source_id] = {
                "id": source_id,
                "title": str(doc.metadata.get("title", source_id)),
                "url": str(doc.metadata.get("url", "")),
                "section": str(doc.metadata.get("section", "")),
                "quote": doc.page_content[:500],
                "metadata": dict(doc.metadata),
            }

    def to_list(self) -> list[dict]:
        return list(self._sources.values())
```

Use it inside a collecting retriever:

```python
class CollectingRetriever:
    def __init__(self, retriever, source_collector: SourceCollector) -> None:
        self.retriever = retriever
        self.source_collector = source_collector

    def invoke(self, query: str, config: dict | None = None) -> list[Document]:
        docs = self.retriever.invoke(query, config=config)
        self.source_collector.add_documents(docs)
        return docs
```

## Concrete Runtime Trace

User asks:

```text
What is the remote work equipment reimbursement limit?
```

Agent first model call decides:

```json
{
  "tool": "policy_search",
  "tool_input": {
    "query": "remote work equipment reimbursement limit"
  }
}
```

Retriever returns:

```python
[
    Document(
        page_content="Approved ergonomic equipment may be reimbursed up to 300 USD.",
        metadata={
            "source_id": "remote-work-policy",
            "title": "Remote Work Policy",
            "url": "https://example.internal/policies/remote-work",
            "section": "Reimbursement",
        },
    )
]
```

Tool observation:

```text
Title: Remote Work Policy
Section: Reimbursement
URL: https://example.internal/policies/remote-work
Content:
Approved ergonomic equipment may be reimbursed up to 300 USD.
```

Executor appends:

```python
(
    AgentAction(tool="policy_search", tool_input={"query": "..."}),
    "Title: Remote Work Policy\nSection: Reimbursement\n..."
)
```

Second model call sees the observation and returns:

```markdown
The remote work equipment reimbursement limit is **300 USD**.

Source: [Remote Work Policy](https://example.internal/policies/remote-work)
```

Web response:

```json
{
  "answer_markdown": "The remote work equipment reimbursement limit is **300 USD**.\n\nSource: [Remote Work Policy](https://example.internal/policies/remote-work)",
  "sources": [
    {
      "id": "remote-work-policy",
      "title": "Remote Work Policy",
      "url": "https://example.internal/policies/remote-work",
      "section": "Reimbursement"
    }
  ]
}
```

## Testing Retrieval

### Unit Test Retriever Tool Formatting

Use a fake retriever:

```python
class FakeRetriever:
    def invoke(self, query: str, config: dict | None = None) -> list[Document]:
        return [
            Document(
                page_content="The limit is 300 USD.",
                metadata={"title": "Remote Work Policy"},
            )
        ]
```

Test:

```python
def test_policy_search_tool_returns_document_text() -> None:
    tool = create_retriever_tool(
        FakeRetriever(),
        "policy_search",
        "Search policy documents.",
    )

    output = tool.invoke({"query": "reimbursement limit"})

    assert "300 USD" in output
```

### Unit Test Source Collection

```python
def test_source_collector_deduplicates_sources() -> None:
    collector = SourceCollector()
    docs = [
        Document("one", metadata={"source_id": "a", "title": "A"}),
        Document("two", metadata={"source_id": "a", "title": "A"}),
    ]

    collector.add_documents(docs)

    assert len(collector.to_list()) == 1
```

### Integration Test Retriever Quality

Use a small known corpus:

```text
Document A: reimbursement limit is 300 USD
Document B: vacation policy is 20 days
Document C: laptop refresh cycle is 3 years
```

Question:

```text
What is the remote work reimbursement limit?
```

Expected:

- retrieved documents include Document A;
- final answer mentions 300 USD;
- source list includes Document A.

## Debugging Retrieval

Add temporary debug logs:

```python
logger.info("retrieval_query=%s", query)
logger.info("retrieved_count=%s", len(docs))
logger.info("retrieved_sources=%s", [doc.metadata.get("source_id") for doc in docs])
```

If the agent does not call the retrieval tool:

- improve tool description;
- improve system prompt;
- check that the tool is included in `tools`;
- check the prompt includes tool schemas or tool descriptions.

If the retriever returns wrong documents:

- inspect the generated query;
- lower or raise `k`;
- add metadata filters;
- improve chunking;
- try MMR;
- add reranking.

If the model ignores retrieved context:

- include source titles and sections in document formatting;
- add prompt instruction to answer only from retrieved sources when needed;
- reduce noisy context;
- add answer validation for critical workflows.

## Common Mistakes

- Indexing documents without source metadata.
- Not applying tenant or permission filters.
- Returning too many documents.
- Returning full documents instead of focused chunks.
- Giving the model vague retriever tool descriptions.
- Trusting model citations without collecting real source objects.
- Forgetting that retrieval tool output is just text fed back to the next model
  call.
- Setting `return_direct=True` on a retriever tool and returning raw chunks to
  the user.
- Using a retriever without async support in an async agent flow.
- Letting follow-up questions retrieve vague terms like "that" without query
  rewriting or chat context.

## Done Checklist

- [ ] Documents are chunked.
- [ ] Metadata is preserved on every chunk.
- [ ] Retriever applies permission filters.
- [ ] Retriever tool has a clear name and description.
- [ ] Tool output is concise and source-aware.
- [ ] Sources are collected separately for the web response.
- [ ] The final prompt asks for citations when sources are available.
- [ ] Retrieval query is logged or traceable in development.
- [ ] Tests cover correct retrieval, no-result retrieval, and source collection.
- [ ] The frontend receives structured sources, not only model-written citations.
