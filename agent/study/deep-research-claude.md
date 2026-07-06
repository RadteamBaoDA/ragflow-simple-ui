# A from-scratch TypeScript agent: plan, retrieve, generate, validate

**Build a workflow, not an agent.** For a system that takes a configured persona, a task with keywords, and a Markdown output spec — then enhances quality via RAG — the right architecture is Anthropic's **Plan-and-Execute workflow** (orchestrator-workers variant) implemented as a **plain async pipeline on top of Vercel AI SDK v6**, not a graph framework. This recommendation rests on three convergent findings: (1) Anthropic's *Building Effective Agents* (Dec 2024) explicitly tells builders to choose deterministic workflows over autonomous agents when the task decomposes cleanly into fixed subtasks — which sectioned Markdown does; (2) the canonical 2025–2026 system-prompt skeleton from OpenAI's GPT-4.1/5 prompting guides and Anthropic's prompting best practices converges on a 10-section template that maps directly onto our config inputs; (3) the TypeScript ecosystem has stabilized around Vercel AI SDK v6 as the LLM-call substrate that Mastra and VoltAgent both build *on top of* — using it directly removes a layer of indirection while keeping `generateObject`, `tool()`, and provider portability. The result is roughly 200–400 lines of code you fully own, instrumented with OpenTelemetry GenAI semantic conventions, with no framework lock-in.

The rest of this report delivers: the recommended system-prompt template (§2), the planning flow with retrieval gates (§3), the framework comparison and stack choice (§4), the TypeScript architecture and code patterns (§5–§7), and practical guardrails for production (§8).

---

## 1. What the research changed about the design

Four independent research streams converged on a sharper architecture than typical "agent framework" tutorials. The most consequential discoveries:

**Workflow beats agent for this scope.** Anthropic's official position is direct: *"Workflows offer predictability and consistency for well-defined tasks, whereas agents are the better option when flexibility and model-driven decision-making are needed at scale."* With a single tool (RAG retrieval) and a predictable output shape (Markdown sections), full ReAct is not just unnecessary — it's worse. LangChain's own write-up notes ReAct *"plans for only one sub-problem at a time… may lead to sub-optimal trajectories, since it isn't forced to reason about the whole task."*

**The "agentic reminders" are non-optional.** OpenAI's GPT-4.1 guide reports a **+20% lift on SWE-bench Verified** from three lines of system-prompt language — persistence, tool-calling honesty, and explicit planning. These belong at the top of every agent prompt.

**Markdown enforcement is a prompt-engineering problem, not a structured-outputs problem.** Neither OpenAI Structured Outputs nor Anthropic's `output_config.format` constrain freeform Markdown — they only constrain JSON. The reliable techniques are an inline Markdown *skeleton* in the system prompt, AST validation with `remark`/`unified`, and a bounded retry loop with validator errors fed back into the prompt. Assistant-message prefill is now **deprecated on Claude 4.6+** (returns HTTP 400), so do not depend on it.

**Retrieve twice.** The highest-leverage retrieval pattern is one *broad seed retrieval* to ground the planner, then *focused per-section retrievals* using queries derived from the section's intent plus its assigned keywords. A single up-front retrieval dilutes precision; per-section retrieval lifts recall@k where it matters.

**Vercel AI SDK v6 is the right substrate.** Mastra (v1.0, Jan 2026) and VoltAgent are both built on top of Vercel AI SDK. Using `ai` directly costs ~200KB of bundle vs. ~450–520KB for those frameworks, and gives identical primitives (`generateObject`, `tool()`, `ToolLoopAgent`, MCP, provider strings like `'anthropic/claude-sonnet-4.6'`) without the framework's memory store, Studio, or workflow engine that this scope doesn't need.

## 2. The recommended agent system prompt template

The 2025–2026 consensus order — derived directly from OpenAI's GPT-4.1 Prompting Guide canonical structure and Anthropic's XML-tag and best-practices documentation — is **Role → Capabilities → Agentic Rules → Tools → Reasoning Steps → Context → Output Format → Examples → Safety → Final Instructions**. Markdown `#` headers serve as primary delimiters (both vendors handle them well); XML tags wrap content blocks that contain user-injected data, examples, or retrieved documents (Anthropic's preference, and OpenAI explicitly notes XML "performed well in our long context testing… JSON performed particularly poorly").

Below is the skeleton your prompt-builder should produce. Variable substitutions are shown as `{{name}}`.

```markdown
# Role and Objective
You are {{persona_name}}, {{persona_description}}.
Your objective: produce a high-quality Markdown document that fulfills the
user's task using retrieved context and a structured plan.

# Capabilities and Skills
<skills>
- {{user_configured_skill_1}}
- {{user_configured_skill_2}}
</skills>

# Agentic Behavior Rules
- You are an agent — keep going until the task is fully resolved before ending
  your turn. Only terminate when the Markdown output meets every constraint.
- If you are uncertain about facts in the corpus, use the retrieve tool.
  Do NOT guess or fabricate.
- You MUST plan before each tool call and reflect on previous tool results.
  Do not chain tool calls silently.

# Tools
- `plan(task, keywords)` — call once at start.
- `retrieve(query, k)` — RAG over the corpus. Use for any factual claim.
- `finalize(markdown)` — return the final document.
## Tool-use rules
- Run independent retrievals in parallel.
- If `retrieve` returns nothing relevant, state the gap in output.

# Reasoning Steps
1. Restate the task in one sentence.
2. Call `plan` to produce 3–7 numbered subtasks.
3. For each subtask: identify required context → retrieve if needed → draft.
4. Self-review against `<quality_rubric>`.
5. Assemble and call `finalize`.

# Context
<keywords>{{user_keywords}}</keywords>
<user_instructions>{{user_custom_instructions}}</user_instructions>
<retrieved_documents>
  <document index="1">
    <source>{{title}}</source>
    <content>{{chunk}}</content>
  </document>
</retrieved_documents>

# Output Format
Return ONLY valid GitHub-Flavored Markdown.
- Begin with a single `#` H1 derived from the task.
- Use `##` for primary sections, `###` for subsections (max depth `####`).
- Use ```fenced code blocks``` for code; backticks for `identifiers`.
- Use Markdown tables for tabular data.
- Cite sources inline as `[source-title](source-id)` after supported claims.
- Use Markdown only where semantically correct.
- Do NOT wrap the entire response in a code fence.
- Do NOT include preamble like "Here is your document:".

<quality_rubric>
- Completeness: every plan subtask addressed.
- Grounding: every factual claim cited or marked as inference.
- Structure: hierarchical headings match section logic.
- Keywords: every input keyword appears at least once, naturally.
</quality_rubric>

# Examples
<examples>
  <example>
    <input><task>...</task><keywords>...</keywords></input>
    <output># Example Title

## Section 1
Body with [Source A](src-a) inline citation.
    </output>
  </example>
</examples>

# Safety and Refusals
- Refuse content that violates the configured persona constraints or platform
  policy. On ambiguity in high-stakes domains, ask one clarifying question.

# Final Instructions
Restate the task in your own words, then think step-by-step using the Reasoning
Steps above. Confirm each subtask is complete and Output Format constraints
are met before calling `finalize`.
```

**Why this ordering.** The first three sections set identity and behavior; the GPT-4.1 guide explicitly recommends placing persistence + tool-calling + planning reminders "at the START of any agent prompt." Tools come before reasoning so the model knows what's available before being told how to think. Context (per-request variables) lives in the middle so stable instructions surround it — OpenAI's long-context guidance: *"above the provided context works better than below."* Output Format precedes Examples so the model sees the rule then the demonstration. Final Instructions go last because, per GPT-4.1, *"if there are conflicting instructions, the model tends to follow the one closer to the end."*

**Three sourced anti-patterns to design out.** First, **never inline JSON tool schemas in the prompt** — OpenAI measured a 2% SWE-bench regression vs. using the API `tools` field. Second, **drop "CRITICAL!" / all-caps coercion** — both Anthropic and OpenAI document that current models over-trigger tools when prompted aggressively. Third, **do not rely on assistant-message prefill on Claude 4.6+** — it now returns HTTP 400; this regression broke several agent frameworks in early 2026 (LiveKit issue #4907, Microsoft Agent Framework #5008). Use a strong Output Format section instead.

**Markdown enforcement, specifically.** OpenAI's GPT-5 guide reveals that *"by default, GPT-5 in the API does not format final answers in Markdown."* You must explicitly prompt for it, and **re-inject the Markdown instruction every 3–5 turns** in long conversations because adherence decays. Frame instructions positively ("Use `##` headings, tables, and fenced code blocks") rather than negatively ("Don't use HTML") — Anthropic's tutorial demonstrates positive framing materially outperforms negative.

## 3. The planning flow: how task + keywords become enhanced Markdown

The pipeline runs six steps. Steps 1–3 set up; step 4 fans out per section in parallel; step 5 assembles; step 6 is an optional, gated single-pass critic.

**Step 1 — Query expansion.** A small LLM call expands `task + keywords` into 3–6 retrieval-friendly queries, optionally including a HyDE-style hypothetical answer paragraph for dense embedding. Raw keywords feed BM25; expanded queries feed dense retrieval.

**Step 2 — Seed retrieval.** One broad RAG call grounds the planner in what the corpus actually contains. This prevents the planner from inventing sections the corpus can't support.

**Step 3 — Planner LLM call.** Returns a structured JSON plan via `generateObject` with a Zod schema. Every input keyword must be assigned to at least one section; the planner emits per-section retrieval queries scoped to that section's intent. This is the single highest-leverage step for output quality — the per-section queries you produce here drive retrieval precision later.

```ts
const PlanSchema = z.object({
  title: z.string(),
  summary: z.string(),
  sections: z.array(z.object({
    id: z.string(),
    heading: z.string(),
    intent: z.string(),
    keywords_covered: z.array(z.string()),
    needs_retrieval: z.boolean(),
    retrieval_queries: z.array(z.string()),
    expected_length_tokens: z.number().int(),
  })).min(2).max(8),
  validation_checklist: z.array(z.string()),
});
```

**Step 4 — Per-section execution, parallelized.** For each section that needs retrieval, call `retrieve()` with the section's scoped queries. Optionally apply a CRAG-style relevance grader; if average score falls below threshold, rewrite the query and retrieve once more. Then call `generateText` to draft the section using the section's intent, retrieved chunks, assigned keywords, and a one-sentence summary of prior sections. This is Anthropic's **parallelization (sectioning)** pattern verbatim.

**Step 5 — Assembly.** Concatenate section outputs, prepend the H1 title from the plan, optionally insert a table of contents. No LLM call here.

**Step 6 — Validate and (gated) critique.** Run `remark`/`unified` to validate AST shape (correct H1/H2 counts, required sections present, ends with the spec-mandated list, etc.), then run keyword coverage (regex first, embedding similarity as fallback for "LLM" vs. "large language model" misses), then a stuffing check (no term >3× per 500 words). If validation fails, run **one** repair pass that takes only the failing sections plus the validator's structured issue list — not a wholesale regenerate. Hard-cap iterations at 1; Anthropic's evaluator-optimizer guidance and our latency table both show diminishing returns past one critique pass.

**Keywords flow through three places.** They become retrieval queries in Step 1, become per-section coverage constraints in Step 3, and become a validation checklist in Step 6. Surfer SEO's published methodology — which is the most public production blueprint — does exactly this: section-level keyword targets, generation with those targets injected, then an auto-optimize repair pass that inserts missing terms. Target 70–85% NLP-term coverage, not 100%; pushing to 100% causes keyword stuffing.

**When to retrieve vs. not.** The planner sets `needs_retrieval: false` for sections that are pure synthesis (intro, conclusion, "key takeaways"). All factual sections retrieve. This per-section decision is what makes the workflow smarter than a static "retrieve once" pipeline without paying the latency tax of true Self-RAG or FLARE token-confidence triggers — both of which are research-grade and don't yet ship cleanly in production TS stacks.

## 4. Framework comparison and stack choice

The TypeScript agent-framework landscape consolidated significantly in 2025–2026. The honest comparison:

| Framework | Right-sized? | Why |
|---|---|---|
| **Vercel AI SDK v6 + custom orchestrator** | ✅ Best fit | ~200 LOC you own; primitives (`generateObject`, `tool()`, `ToolLoopAgent`) cover everything; provider-portable |
| **Mastra v1.0** | ⚠️ Overshoots | Excellent if you'll use Memory, Studio, Evals, and Workflows — but built *on* Vercel AI SDK, so you pay for indirection you don't need |
| **VoltAgent** | ⚠️ Overshoots | Like Mastra; choose only if you want supervisor agents or hosted trace console without configuring Langfuse |
| **LangGraph.js v1.0** | ❌ Overkill | StateGraph + reducers + checkpointers are designed for cyclic durable graphs; this pipeline is acyclic |
| **LlamaIndex.TS** | ❌ Skip | Framework era explicitly being de-prioritized (Jerry Liu, Mar 2026); their value is RAG ingestion, which you already own |
| **Inngest AgentKit** | ⚠️ Only if durable | Right answer if a single run must survive process crashes mid-generation; overkill for synchronous request/response |
| **OpenAI Agents SDK TS (v0.11)** | ⚠️ OK alternative | OpenAI-centric defaults; Vercel AI SDK is more universal |
| **Anthropic Claude Agent SDK** | ❌ Wrong fit | Optimized for file-editing/shell agents; Claude-only; bundles CLI binary |

The recommended stack is concretely: **`ai` (Vercel AI SDK v6) + `@ai-sdk/anthropic` + `@ai-sdk/openai` + `zod@4` + `p-retry` + `remark` / `remark-gfm` / `unified` / `unist-util-visit` + `pino` + OpenTelemetry SDK + OpenLLMetry instrumentation packages, exporting to Langfuse Cloud**. The full dependency footprint is under 1MB, every layer is MIT/Apache 2.0, and provider swap is a one-string change (`'anthropic/claude-sonnet-4.6'` → `'openai/gpt-5.2'`).

**The one situation that changes this recommendation:** if the agent must produce hour-long durable workflows (long video transcription with checkpoints, multi-day research tasks with human approvals), drop the custom orchestrator and adopt **Inngest AgentKit** or **LangGraph.js** for their checkpointing primitives. For synchronous "generate a Markdown document" requests measured in single-digit seconds to a minute, the custom build wins on simplicity, performance, and team comprehension.

## 5. Project structure and core interfaces

The folder layout below treats every step as a pure async function. Prompts are pure functions of inputs. Schemas live in one place. Observability is cross-cutting via OpenTelemetry context.

```
src/
├── agent/
│   ├── orchestrator.ts          # runAgent() — the pipeline
│   ├── steps/
│   │   ├── plan.ts              # generateObject → Plan
│   │   ├── retrieve.ts          # parallel RAG calls + optional CRAG grader
│   │   ├── generate.ts          # streamText per section
│   │   └── validate.ts          # remark AST + keyword coverage
│   ├── prompts/
│   │   ├── persona.ts           # buildPersonaSystemPrompt()
│   │   ├── planner.ts
│   │   └── generator.ts
│   └── types.ts
├── llm/
│   ├── provider.ts              # model registry; one-string ids
│   └── retry.ts                 # p-retry wrapper
├── rag/
│   └── retriever.ts             # thin wrapper around your existing RAG fn
├── obs/
│   ├── tracer.ts                # OTel + Langfuse setup
│   └── logger.ts                # pino
├── schemas/
│   ├── plan.ts
│   ├── task.ts
│   └── output.ts
└── index.ts
```

The core interfaces are Zod schemas — they double as runtime validators, JSON Schema generators for `generateObject`, and TypeScript types via `z.infer`. The critical shapes:

```ts
// src/agent/types.ts
import { z } from "zod";

export const AgentConfigSchema = z.object({
  id: z.string(),
  persona: z.object({
    name: z.string(),
    role: z.string(),               // e.g. "Senior technical writer"
    voice: z.string(),              // tone description
    constraints: z.array(z.string()),
    skills: z.array(z.string()),
  }),
  model: z.object({
    planner: z.string().default("anthropic/claude-opus-4.6"),
    generator: z.string().default("anthropic/claude-sonnet-4.6"),
    critic: z.string().default("anthropic/claude-haiku-4.5"),
    temperature: z.number().min(0).max(2).default(0.4),
  }),
  limits: z.object({
    maxPlanSteps: z.number().int().min(1).max(20).default(6),
    maxRetrievalChunks: z.number().int().default(12),
    maxOutputTokens: z.number().int().default(4000),
    maxRepairIterations: z.number().int().default(1),
  }),
});
export type AgentConfig = z.infer<typeof AgentConfigSchema>;

export const TaskSchema = z.object({
  id: z.string(),
  description: z.string(),
  keywords: z.array(z.string()).default([]),
  outputSpec: z.object({
    format: z.literal("markdown"),
    sections: z.array(z.object({
      heading: z.string(),
      required: z.boolean().default(true),
      hint: z.string().optional(),
    })).optional(),                 // optional structural hints from the user
    maxWords: z.number().int().optional(),
  }),
});
export type Task = z.infer<typeof TaskSchema>;
```

The `Plan` schema is the planner's structured output (shown above in §3). `MarkdownOutput` carries the final string plus citations, metrics, and warnings. Note that `AgentConfig` lets the orchestrator route different steps to different models — a frontier model for planning, a fast model for the critic — which is a 2× cost win with no quality loss.

## 6. The orchestrator in 35 lines

The full pipeline fits in a single function. Each LLM call is wrapped in `p-retry` with exponential backoff; each major phase opens an OpenTelemetry span with GenAI semantic-convention attributes (`gen_ai.operation.name`, `gen_ai.request.model`, token counts) so the trace shows up in Langfuse with cost attribution per step.

```ts
// src/agent/orchestrator.ts
import { generateObject, generateText } from "ai";
import pRetry from "p-retry";
import { trace } from "@opentelemetry/api";
import { PlanSchema, type AgentConfig, type Task, type AgentRunResult } from "./types";
import { buildPersonaSystemPrompt } from "./prompts/persona";
import { plannerPrompt, generatorPrompt } from "./prompts";
import { retrieve } from "../rag/retriever";
import { validateMarkdown, repairSections } from "./steps/validate";

const tracer = trace.getTracer("agent");

export async function runAgent(cfg: AgentConfig, task: Task): Promise<AgentRunResult> {
  return tracer.startActiveSpan("invoke_agent", async (span) => {
    const system = buildPersonaSystemPrompt(cfg.persona);

    // 1) PLAN — structured output via Zod
    const { object: plan, usage: planUsage } = await pRetry(
      () => generateObject({
        model: cfg.model.planner, system, schema: PlanSchema,
        prompt: plannerPrompt(task),
      }),
      { retries: 3, minTimeout: 500, factor: 2 },
    );

    // 2) PER-SECTION: retrieve + generate in parallel
    const sectionDrafts = await Promise.all(plan.sections.map(async (section) => {
      const chunks = section.needs_retrieval
        ? (await Promise.all(section.retrieval_queries.map((q) =>
            pRetry(() => retrieve({ query: q, topK: 6 }), { retries: 2 })
          ))).flatMap((r) => r.chunks)
        : [];
      const { text } = await pRetry(() => generateText({
        model: cfg.model.generator, system,
        prompt: generatorPrompt(task, plan, section, chunks),
        temperature: cfg.model.temperature,
        maxOutputTokens: section.expected_length_tokens + 200,
      }), { retries: 2 });
      return { section, markdown: text, chunks };
    }));

    // 3) ASSEMBLE
    let assembled = `# ${plan.title}\n\n${plan.summary}\n\n` +
      sectionDrafts.map((s) => s.markdown).join("\n\n");

    // 4) VALIDATE + (gated) REPAIR — one iteration max
    let validation = validateMarkdown(assembled, task, plan);
    if (!validation.pass && cfg.limits.maxRepairIterations > 0) {
      assembled = await repairSections(assembled, validation.issues, cfg, system);
      validation = validateMarkdown(assembled, task, plan);
    }

    span.setAttribute("gen_ai.usage.input_tokens", planUsage.inputTokens);
    span.end();
    return { taskId: task.id, plan, markdown: assembled, validation };
  });
}
```

The validation step uses `remark` + `remark-gfm` to parse the document into an mdast AST, then traverses it with `unist-util-visit` to verify required headings exist, the document begins with exactly one H1, and (if specified) ends with a bullet list. Keyword coverage runs as a word-boundary regex over the lowercased text; for keywords flagged missing, an embedding-similarity fallback catches paraphrases. The repair function passes only the failing sections plus structured issue list to the generator with a "fix only these issues" instruction — never a full regenerate.

## 7. The validator and repair pattern

The validator is what makes the output reliable. Its job is to detect three classes of problem: structural (wrong heading hierarchy, missing required sections, malformed tables), coverage (missing keywords, missing citations), and style (excessive density, banned patterns). A skeleton:

```ts
import { remark } from "remark";
import remarkGfm from "remark-gfm";
import { visit } from "unist-util-visit";
import type { Root, Heading, List } from "mdast";

export function validateMarkdown(md: string, task: Task, plan: Plan) {
  const issues: string[] = [];
  const tree = remark().use(remarkGfm).parse(md) as Root;

  const h1s: Heading[] = [], h2s: Heading[] = [];
  visit(tree, "heading", (n: Heading) => {
    if (n.depth === 1) h1s.push(n);
    if (n.depth === 2) h2s.push(n);
  });

  if (h1s.length !== 1) issues.push(`expected 1 H1, got ${h1s.length}`);
  for (const expected of plan.sections) {
    const found = h2s.some((h) =>
      (h.children[0] as any)?.value?.includes(expected.heading));
    if (!found) issues.push(`missing required section: "${expected.heading}"`);
  }

  // keyword coverage
  const lower = md.toLowerCase();
  for (const kw of task.keywords) {
    const re = new RegExp(`\\b${escapeRegex(kw.toLowerCase())}\\b`, "g");
    const count = (lower.match(re) ?? []).length;
    if (count === 0) issues.push(`missing keyword: ${kw}`);
    if (count > Math.max(3, Math.floor(md.split(/\s+/).length / 500) * 2))
      issues.push(`keyword stuffing: "${kw}" appears ${count} times`);
  }

  return { pass: issues.length === 0, issues };
}
```

The repair prompt is structured: it receives the assembled document, the issue list, and the instruction *"Apply only these fixes. Preserve all other content verbatim. Return the full revised Markdown."* This avoids the well-documented failure mode where a "rewrite this" prompt regresses unrelated parts of the document.

## 8. Production guardrails

**Retries and rate limits.** Wrap every LLM call in `p-retry` with exponential backoff (`factor: 2`, `minTimeout: 500`, `retries: 3`). Treat `AbortError` and `400 Bad Request` as non-retryable. For provider rate limits (HTTP 429), inspect the `retry-after` header and respect it. Cap total wall-clock time per run with `AbortController` (suggested: 90s for synchronous requests).

**Observability via OTel GenAI conventions.** OpenTelemetry's GenAI Semantic Conventions v1.37 are now the industry standard; Datadog, New Relic, Langfuse, and Phoenix all consume them. Wrap the orchestrator in an `invoke_agent` span, each LLM call in a `chat {model}` span with `gen_ai.usage.input_tokens` / `gen_ai.usage.output_tokens`, and each retrieval in an `execute_tool retrieve` span. Use OpenLLMetry's `@traceloop/instrumentation-anthropic` and `@traceloop/instrumentation-openai` packages for automatic provider-SDK instrumentation. Export via OTLP to **Langfuse Cloud** (free tier 50K units/mo, MIT self-host available) for trace replay and cost attribution per step.

**Extensibility for future output formats.** The architecture supports new formats with two additions: a `format` discriminator on `TaskSchema.outputSpec`, and a `formatters` registry keyed on that discriminator. Each formatter provides a `buildOutputFormatPrompt(spec)` function and a `validate(output, spec)` function. The orchestrator core is format-agnostic — only the prompts and validator differ. JSON output, DOCX (via Pandoc post-step), or HTML can plug in without touching `runAgent`.

**Extensibility for multiple agents.** Promote `AgentConfig` to a registry (`Map<string, AgentConfig>`) and expose `runAgent(configId, task)`. Each agent's persona, model selection, limits, and (optionally) RAG corpus are independent. For multi-agent collaboration (one agent reviews another's output), wrap two `runAgent` calls in a supervisor function rather than reaching for a graph framework — the moment you genuinely need supervisor-with-handoffs is the moment to evaluate OpenAI Agents SDK or LangGraph.js, not before.

**The Markdown adherence decay problem.** OpenAI's GPT-5 guide documents that Markdown-format compliance degrades over long conversations and recommends re-injecting the Output Format block every 3–5 turns. If your agent ever becomes multi-turn, build this in: track turn count and re-emit the format constraints as a system message at the threshold.

## Conclusion: simplicity is the production answer

The strongest signal across all four research streams was convergence on simplicity. Anthropic, OpenAI, and the maintainers of every major TypeScript framework now publicly say the same thing: don't reach for agent autonomy when a workflow will do; don't reach for a framework when 200 lines of TypeScript and a provider SDK will do; don't reach for ReAct loops when one upfront plan plus parallel section execution will do. The 2025–2026 prompt engineering literature has stabilized around a single 10-section template that you can implement as a string-builder in an afternoon. The Markdown reliability story has stabilized around skeleton-in-prompt plus AST validation plus one repair pass. The TypeScript stack has stabilized around Vercel AI SDK v6 as the substrate everyone else builds on.

The novel insight worth carrying forward: **the highest-leverage decision in this architecture is not which framework to pick — it's the planner's per-section retrieval queries.** That single field in the plan JSON drives retrieval precision, keyword coverage, and section coherence simultaneously. Invest your prompt-engineering effort there before optimizing anything else. Everything downstream — generation, validation, repair — is mechanical once the plan is good.

Build the custom orchestrator. Instrument it with OTel from day one. Add framework features only when you can name the specific primitive (durable checkpointing, human approval gates, multi-tenant memory) that justifies the dependency. That discipline is what separates a 200-line system that works for two years from a 2,000-line framework integration that breaks every release.