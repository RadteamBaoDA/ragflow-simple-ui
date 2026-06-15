# Automatic Retrieval & Generation Config Selector — Specification

### For coding-agent plan mode — behavior contracts, architecture decisions, and integration hints only; no implementation code

> **Purpose.** Replace hard-coded retrieval and generation parameters (the static `top_n`, `top_k`, `similarity_threshold`, `vector_similarity_weight`, `rerank_id`, `temperature` that a chat/search app normally persists once and reuses for every question) with values **chosen automatically per question**, from the user's question and the retrieved chunks. This document is **input for plan mode**: it defines what to build and how it behaves. It contains **no implementation code** — the coding agent discovers the host codebase first (see §0), maps this spec onto it, then produces a file-by-file plan.
>
> **Scope note.** This spec is written **generically**, not against any specific framework. RAGFlow is referenced only as the motivating example of the "hard-coded config" anti-pattern. Wherever the spec needs a host-specific fact (where retrieval is called, how config is stored, how the LLM client works), it uses a **`〔CONTEXT: …〕` placeholder** that you fill in for your project — §12 lists every placeholder in one table.

---

## 0. How to use this document (instructions for the coding agent)

1. **Discover the host codebase first.** Before writing any plan, locate and read the integration points listed in §12 and replace each `〔CONTEXT: …〕` placeholder with the real module, function, signature, and storage location. Specifically find:
   - The function that performs **retrieval** (query → scored chunks) and its exact signature, sync/async nature, and the names of the knobs it accepts.
   - The function that performs **reranking** (query + chunks → reordered chunks) and how it is enabled/disabled.
   - Where retrieval/generation **config is persisted** (the chat/search record, a settings object, env) and the field names.
   - The **LLM client** abstraction used for answer generation, and whether it supports schema/grammar-constrained JSON decoding (needed for the Tier-1 classifier).
   - The existing **multi-turn / history-condensation** step (if any) that produces a standalone question — the selector runs **after** it.
   - The request flow where the answer is generated, so the selector can be inserted as an override layer.
2. **Map this spec onto what exists.** For each component below, decide reuse vs. new module. The selector itself is **new and self-contained**; the retriever, reranker, and LLM client are **reused as-is** (thin adapters only — never reimplemented).
3. **Produce the detailed implementation plan** — file-by-file change list, the new module, the call-site edits, config/flag additions, and the test list of §11 — then implement.
4. **Treat every "MUST / MUST NOT" as an acceptance criterion.** §11 consolidates them into a verification checklist.

---

## 1. Goals and binding constraints

**Optimization goals (jointly):** retrieval effectiveness (recall + precision per question), answer quality, cost efficiency, low latency on the common case, and **zero regression** — when disabled or on error, behavior is byte-identical to the current hard-coded path.

| Constraint | Value | Consequence for design |
|---|---|---|
| Non-invasive | Persisted config stays the source of truth | The selector is an **override layer with persisted fallback** (§3); never deletes or replaces stored config |
| Bounded autonomy | Admin-pinned config expresses intent | Every auto-chosen knob is **clamped** to a range derived from the persisted value (§5.3); auto-config can never exceed an admin's bounds |
| Common case is free | Most questions are simple lookups | **Tiered** decision engine: deterministic heuristics decide common cases with zero LLM calls; the LLM classifier runs only on ambiguous/complex questions (§4) |
| React to evidence | Some signals exist only after retrieval | **Two-stage timing**: pre-retrieval guess → probe retrieval → post-retrieval adjust (§6) |
| Runs after history condensation | Multi-turn handled upstream | The selector always receives a **single standalone question**; it does not re-implement history rewriting (§7) |
| Reusable | Multiple callers (chat, search, generative orchestrator) | Exposed as one **pure function** with an explicit contract (§9); all mode/host differences live at the call site, not inside the selector |
| Local-model friendly | Optimize for a small/local LLM | The Tier-1 classifier is one short, schema-constrained, low-token call; default mode keeps LLM usage minimal |

---

## 2. Architecture decision summary — before / after

### Current (the hard-coded anti-pattern)

```
question ──► retrieval(question, kbIds,
                       top_n = STORED, top_k = STORED,
                       similarity_threshold = STORED,
                       vector_similarity_weight = STORED,
                       rerank = STORED) ──► generate(temperature = STORED)
```

Every question — a one-word lookup, a multi-document comparison, a "summarize everything" request — is retrieved and generated with the **same** parameters that were configured once and persisted on the chat/search record. Defects: simple questions over-retrieve (cost, lost-in-the-middle); broad questions under-retrieve (miss evidence); the threshold is wrong for half the queries; the reranker runs even when one strong match makes it pointless; temperature is fixed regardless of whether the question is factual or open-ended.

### Target (auto-config override layer)

```
standalone question (after upstream multi-turn condensation)
   │
   ▼
[ STAGE A: pre-retrieval ]  question-only → initial config  (heuristics, LLM fallback)
   │
   ▼
[ PROBE RETRIEVAL ]  reuse host retriever with the initial config
   │   (chunk-score distribution observed)
   ▼
[ STAGE B: post-retrieval adjust ]  deterministic tuning from score signals
   │   → may widen/tighten knobs, toggle rerank, or escalate to deep-research loop
   ▼
final resolved config ──► answer generation
```

The persisted config is read **once** at the start as the **bounds + fallback**. The selector emits a `ResolvedConfig` whose every field carries provenance (`stored | heuristic | llm | post_retrieval`) for auditability and debugging.

---

## 3. Integration model — override layer with persisted fallback

### Decision

The selector **does not own** the configuration. It reads the persisted config (`〔CONTEXT: where config is stored〕`) and produces per-question overrides at request time. Three operating states:

| State | Behavior |
|---|---|
| **Disabled** (`auto_config_enabled = false`, default in v1) | Selector is never called; the host path uses persisted values exactly as today. Guarantees zero regression. |
| **Enabled, success** | Selector returns a `ResolvedConfig`; the host path uses those values for retrieval and generation. |
| **Enabled, error/timeout** | Any exception inside the selector is caught; the host **falls back to persisted values** and logs a warning. The selector must never fail the request. |

### Requirements

- The selector is inserted at the host's answer-generation flow as a function call that returns overrides; the host call site swaps `STORED` knob values for `resolved.*` knob values. `〔CONTEXT: the request/answer flow where this is inserted〕`
- The selector MUST be **stateless and pure** apart from reading its inputs — no global mutation, no writing back to the persisted record.
- A failure in any LLM sub-call degrades to the deterministic path (heuristics + stored bounds), never to a request error.

### Rejected alternatives

- *Replace persisted config entirely* — removes the admin's ability to pin a config; most invasive; rejected.
- *Fold only into the generative orchestrator* — leaves the standard chat/search path hard-coded; rejected because the goal is to fix the common path.

---

## 4. The decision engine — tiered (heuristics first, LLM fallback)

### Decision

A two-tier engine. **Tier 0** is deterministic and always runs first (free, sub-millisecond). **Tier 1** is a single small LLM classification call that runs **only** when Tier 0 is inconclusive or flags the question as complex. Mode is configurable: `auto_config_mode ∈ { heuristic_first (default), always_llm }`. In `always_llm`, Tier 1 runs on every question (more consistent, higher latency); in `heuristic_first`, Tier 1 is the exception.

### 4.1 Tier 0 — deterministic question features (always run)

Derive a `QueryClass` from cheap signals on the standalone question:

| Signal | How measured | Influence |
|---|---|---|
| Length / token count | word/token count | very short → likely a tight lookup; very long → likely complex |
| Intent keywords | case-insensitive regex on leading verbs/markers: `compare`, `vs`, `difference`, `summari[sz]e`, `list`, `all`, `overview`, `define`, `what is`, `explain`, `why`, `how` | classifies into the taxonomy of §4.3 |
| Multi-entity | conjunction / "X vs Y" / enumerations | breadth ↑ (needs more chunks across entities) |
| Structured-ID references | ID patterns `〔CONTEXT: ID conventions in your domain, e.g. UC-, REQ-, API-, ticket keys〕` | exact-match intent → favor sparse/BM25 weight, tight threshold |
| Question vs. command | interrogative vs. imperative | affects grounding strictness and temperature band |

Tier 0 outputs an **initial `QueryClass` + an initial knob proposal** and a boolean `tier0_confident`. If `tier0_confident` is false (mixed/ambiguous signals) or the class is one of the inherently complex ones (compare/synthesize/summarize-all), escalate to Tier 1.

### 4.2 Tier 1 — small LLM classifier (only when escalated)

One **schema-constrained JSON** call (`〔CONTEXT: does your LLM client support grammar/JSON-constrained decoding?〕`; if not, use a strict "JSON only" prompt + one validation-error retry). It reads the standalone question (and, optionally, a one-line conversation summary) and returns:

```json
{
  "intent": "lookup | explain | compare | summarize | synthesize | enumerate | open_ended",
  "breadth": "narrow | medium | broad",
  "grounding": "strict | loose | none",
  "tempBand": "low | medium | high",
  "rationale": "string ≤160 chars"
}
```

Budget: ≤500 input / ≤120 output tokens, temperature ≤0.2. On parse failure after one retry, **discard** the LLM result and use Tier 0's proposal (never fail the request). Prompt: §10.1.

### 4.3 Query taxonomy → default knob bias (pre-retrieval)

A lookup table maps intent to an initial bias **before clamping** (§5.3) and **before post-retrieval adjustment** (§6):

| Intent | top_n bias | top_k bias | threshold bias | vector_weight bias | rerank | temp band |
|---|---|---|---|---|---|---|
| `lookup` (short, factual, ID match) | low (few chunks) | low | high (tight) | lower (favor BM25/sparse for exact terms) | off unless weak | low |
| `explain` | medium | medium | medium | balanced | on if scores flat | low–medium |
| `compare` | high | high | medium–low | balanced | **on** | low |
| `summarize` (one source) | medium–high | medium | low (gather broadly) | higher (semantic) | on | low |
| `synthesize` (multi-source) | high | high | low | higher | **on** | low |
| `enumerate` ("list all") | high | high | low | higher | on | low |
| `open_ended` / creative | low | low | n/a | n/a | off | high |

These are **biases**, not final values: §5.3 clamps them to the persisted bounds and §6 may move them again based on evidence.

---

## 5. Parameter scope and resolution

### 5.1 Parameters the selector decides

In scope (each maps to a host knob — fill names in §12):

1. **Retrieval knobs** — `top_n` (chunks returned to the writer), `top_k` (candidate pool size), `similarity_threshold`, `vector_similarity_weight` (vector vs. keyword/BM25 balance).
2. **Reranker on/off** — whether to invoke the rerank model for this question.
3. **Generation settings** — `temperature` (and any related `llm_setting` knob the host exposes), via the `tempBand`.
4. **Retrieval mode / grounding** — whether to retrieve at all and how strictly to ground the answer: `grounded_strict | loose | none`. `none` skips retrieval entirely (pure generation from model knowledge + provided context).

### 5.2 Deep-research escalation (auto-triggered)

When the probe retrieval (§6) returns near-empty or all-below-floor evidence for a question that Tier 0/1 judged answerable from the KB, the selector escalates to a **bounded iterative deep-research loop**: rewrite the query, re-retrieve, re-evaluate — repeated up to a hard cap (`deep_research_max_rounds`, default 2). This is **auto-triggered by evidence weakness**, never free-form, and never unbounded. If the loop still yields nothing, the selector returns `grounding = none` (or the host's existing insufficient-context behavior) — honest abstention over fabrication. `〔CONTEXT: does your app already have an iterative/CRAG-style loop to reuse?〕`

### 5.3 Bounds and clamping (normative)

The persisted config defines the **center and the allowed range** for every numeric knob. After Tier 0/1 propose biases and §6 adjusts, each knob is clamped:

```
top_n              ∈ [ max(1, stored_top_n // 2), stored_top_n * 2 ]
top_k              ∈ [ stored_top_k // 2,          stored_top_k * 2 ]
similarity_threshold ∈ [ max(0, stored_thr - 0.15), min(1, stored_thr + 0.15) ]
vector_similarity_weight ∈ [ 0, 1 ]   (clamped, centered near stored value)
temperature        ∈ [ stored_temp band per §4.3, clamped to host-allowed range ]
rerank             = boolean (only honored if a rerank model is configured at all)
```

Exact range multipliers/offsets are configurable (§11 config surface). The rule is the contract: **auto-config moves within an admin-defined envelope; it never escapes it.** If no persisted value exists for a knob, use the host's documented default as the center.

### 5.4 ResolvedConfig (output data contract)

| Field | Type | Notes |
|---|---|---|
| `topN`, `topK` | int | clamped per §5.3 |
| `similarityThreshold` | float | clamped per §5.3 |
| `vectorSimilarityWeight` | float | clamped per §5.3 |
| `useRerank` | bool | honored only if a rerank model exists |
| `temperature` | float | from `tempBand`, clamped |
| `grounding` | `"strict" \| "loose" \| "none"` | `none` ⇒ host may skip retrieval |
| `deepResearch` | `{ triggered: bool, rounds: int }` | filled by §6 / §5.2 |
| `provenance` | map field → `"stored" \| "heuristic" \| "llm" \| "post_retrieval"` | per-field audit trail |
| `warnings` | string[] | e.g. `llm_classifier_failed`, `clamped_top_k`, `deep_research_exhausted`; never fails the request |

---

## 6. Two-stage timing — probe retrieval and post-retrieval adjustment

### Decision

Some of the best signals — how strong the top chunk is, whether scores cluster or are flat, how many chunks clear the threshold — exist **only after a retrieval**. So the selector retrieves once with the pre-retrieval guess (the **probe**), reads the score distribution, then deterministically adjusts before the final answer is generated.

### Control flow (normative)

```
initial config (Stage A, clamped)
   │
   ▼
PROBE: retrieve(question, kbIds, initial knobs)        ← reuse host retriever as-is
   │
   ▼
read score signals:
   top1                = highest chunk score
   gap                 = top1 - top2
   n_above_threshold   = count(score ≥ similarityThreshold)
   mean_topk           = mean of returned scores
   │
   ├─ strong top1 AND clear gap AND n_above_threshold small
   │        → TIGHTEN: keep few chunks, raise threshold slightly,
   │          rerank OFF (one clear answer); grounding = strict
   │
   ├─ flat / clustered scores (small gap, several medium chunks)
   │        → rerank ON (precision needed to order them);
   │          keep medium breadth; grounding = strict
   │
   ├─ weak scores (top1 below a "decent" band) but non-empty
   │        → WIDEN: lower threshold, increase top_k (within bounds),
   │          rerank ON; grounding = loose
   │
   └─ near-empty OR all below floor
            → DEEP-RESEARCH escalation (§5.2), bounded;
              if still empty → grounding = none / host insufficient-context path
   │
   ▼
final ResolvedConfig  (provenance of changed fields = "post_retrieval")
```

### Requirements

- The probe retrieval **is** the first real retrieval — when no adjustment changes `top_k`/`threshold`/`vector_weight` in a way that requires re-querying, the probe results are **reused directly** (no wasted second retrieval). A re-retrieval happens only when an adjustment actually changes a retrieval-affecting knob, or during a deep-research round.
- All Stage-B logic is **deterministic** (no LLM call) except the query-rewrite inside the deep-research loop (which is one small LLM call per round, capped).
- Score-band thresholds ("strong", "decent", "floor") are **configurable** and host-tunable (the host's score scale must be inspected — `〔CONTEXT: what range do your retrieval scores fall in? normalized [0,1]?〕`).

### Rejected alternatives

- *Pre-retrieval only* — cannot react to weak/empty results, the single most valuable signal; rejected.
- *Always re-retrieve after Stage B* — wastes a retrieval when nothing changed; rejected in favor of reuse-when-unchanged.

---

## 7. Relationship to multi-turn history

The selector runs **after** the host's existing multi-turn/history-condensation step (e.g. a "rewrite the conversation into one standalone question" pass — `〔CONTEXT: name of your standalone-question step, if any〕`). Consequences:

- The selector's input is **always a single standalone question**; it does **not** re-implement history rewriting.
- "Multi-turn awareness" in config selection is therefore implicit: a follow-up like "and the second one?" has already been expanded upstream into a full question, which the heuristics and classifier then read normally.
- Optionally, a **one-line conversation summary** may be passed to the Tier-1 classifier (§4.2) as auxiliary context — but it MUST NOT be required, and the selector MUST work with the standalone question alone.

---

## 8. Order of operations (end-to-end, normative)

```
1. Host condenses history → standalone question            (existing, upstream)
2. Host reads persisted config → bounds + fallback         (§3)
3. If auto_config_enabled == false → use persisted; STOP   (§3)
4. Stage A — Tier 0 heuristics → QueryClass + initial knobs (§4.1)
5. If escalation condition → Tier 1 LLM classifier         (§4.2)
6. Apply taxonomy biases, then clamp to bounds             (§4.3, §5.3)
7. Probe retrieval with initial config                     (§6)
8. Stage B — deterministic post-retrieval adjustment       (§6)
9. If evidence near-empty → bounded deep-research loop      (§5.2)
10. Emit ResolvedConfig (with provenance + warnings)        (§5.4)
11. Host generates the answer using ResolvedConfig          (§3)
   Any exception in steps 4–10 → fall back to persisted config, log, continue (§3)
```

---

## 9. Component interface (language-neutral)

A single pure entry point that any caller reuses. Map types to the host's conventions.

**`selectConfig(input) → ResolvedConfig`**

Inputs:

| Field | Type | Notes |
|---|---|---|
| `question` | string | the standalone question (post history-condensation) |
| `bounds` | object | persisted config values = center + range source (§5.3) |
| `kbContext` | object | knowledge-base ids / ACL handle the host passes to retrieval; **opaque** to the selector, never derived from the question text |
| `retrieveFn` | function | host retriever adapter: `(question, kbContext, knobs) → scoredChunks` |
| `rerankAvailable` | bool | whether a rerank model is configured at all |
| `llmClassifyFn` | function \| null | host LLM adapter for Tier-1 (null ⇒ heuristics only) |
| `conversationSummary` | string \| optional | one-line summary for Tier-1 aux context (§7) |
| `options` | object | flags & tunables (§11 config surface) |

Output: `ResolvedConfig` (§5.4). The function performs the probe retrieval internally (so post-retrieval adjustment is possible) and returns both the resolved knobs **and** the probe chunks (so the host can reuse them and avoid a duplicate retrieval).

The selector MUST be unit-testable with **fake** `retrieveFn` / `llmClassifyFn` (no real models or stores) — see §11.

---

## 10. System prompts (production-ready)

Stored as versioned constants, not inline fragments. Schema-constrained where possible; one validation-error retry; then discard-and-fall-back.

### 10.1 Tier-1 query classifier (the only LLM call in the selector's default path)

**System:**
```text
You are a query classifier for a retrieval system. Read ONE user
question and classify how it should be retrieved and answered.

Return JSON only, matching exactly:
{"intent": "...", "breadth": "...", "grounding": "...",
 "tempBand": "...", "rationale": "..."}

Fields:
- intent: one of
    lookup       (short factual / exact fact / id reference)
    explain      (asks to explain a concept or how something works)
    compare      (contrast two or more things)
    summarize    (condense one source/topic)
    synthesize   (combine information across many sources)
    enumerate    (list all / enumerate items)
    open_ended   (creative or opinion; little or no factual grounding)
- breadth: narrow | medium | broad
    (how many sources the answer likely needs)
- grounding: strict | loose | none
    strict = answer only from retrieved sources;
    loose  = sources help but general knowledge is acceptable;
    none   = no retrieval needed.
- tempBand: low | medium | high
    low for factual/grounded, high for creative/open-ended.
- rationale: <= 160 chars, one short sentence.

Rules:
- Do NOT answer the question. Do NOT retrieve. Do NOT add fields.
- Judge from the question text only.
- Output JSON only. No prose, no markdown fences.

Example:
Q: "Compare the refund policy for plan A versus plan B."
-> {"intent":"compare","breadth":"broad","grounding":"strict",
    "tempBand":"low","rationale":"contrasts two named policies; needs both sources"}
```

**User message:** the standalone question in triple quotes, plus (optional) `Conversation summary: <one line>`. Budget ≤500 in / ≤120 out, temperature ≤0.2.

### 10.2 Deep-research query rewrite (only inside the bounded loop, §5.2)

**System:**
```text
The retrieved sources are too weak to answer the question. Write 1-2
alternative retrieval queries MORE LIKELY to surface the missing
information. Use different vocabulary; broaden or narrow scope as
appropriate. Do not repeat the original query.

Return JSON only: {"queries": ["...", "..."]}
```

**User message:** the original question and a one-line note of what the probe failed to find. Budget ≤300 in / ≤100 out, temperature ~0.4 (diversity helps). Capped at `deep_research_max_rounds` invocations.

---

## 11. Configuration surface, observability, and acceptance criteria

### 11.1 Config / flags

| Key | Default | Meaning |
|---|---|---|
| `auto_config_enabled` | `false` | master switch; off ⇒ pure persisted-config path (zero regression) |
| `auto_config_mode` | `heuristic_first` | `heuristic_first` \| `always_llm` |
| `top_n_range_factor` | `2` | clamp multiplier for `top_n` (§5.3) |
| `top_k_range_factor` | `2` | clamp multiplier for `top_k` |
| `threshold_range_delta` | `0.15` | ± clamp offset for `similarity_threshold` |
| `score_floor` | `〔CONTEXT: tune to your score scale〕` | "near-empty" boundary for deep-research trigger (§6) |
| `score_strong_band` | `〔CONTEXT: tune to your score scale〕` | "strong top1" boundary for the tighten branch |
| `deep_research_max_rounds` | `2` | hard cap on the iterative loop |
| `rerank_force_on_compare` | `true` | force rerank for compare/synthesize intents |

### 11.2 Observability

Structured log at the selector boundary: question class, whether Tier 1 ran, the probe score signals (`top1`, `gap`, `n_above_threshold`), every changed knob with its provenance, deep-research rounds used, and any `warnings`. The `provenance` map and `warnings` array are the user-/operator-facing audit surface; they never appear in the answer text. `〔CONTEXT: your logging stack / log format〕`

### 11.3 Acceptance criteria (the coding agent's verification checklist)

**Integration / fallback**
- [ ] `auto_config_enabled=false` → selector never invoked; retrieval & generation use persisted values byte-for-byte (regression test against current behavior).
- [ ] Any exception inside the selector → host falls back to persisted config, logs a warning, request still succeeds.
- [ ] Selector never writes back to the persisted config record; it is stateless/pure.

**Tier 0 / Tier 1 engine**
- [ ] Short factual question with clear intent → resolved by Tier 0; **zero LLM calls** in `heuristic_first` mode.
- [ ] Ambiguous or `compare`/`synthesize`/`summarize-all` question → escalates to Tier 1 (one LLM call) in `heuristic_first`.
- [ ] `always_llm` mode → exactly one classifier call per question.
- [ ] Tier-1 JSON parse failure after one retry → result discarded, Tier-0 proposal used, `llm_classifier_failed` warning; no request error.
- [ ] `llmClassifyFn = null` → engine works on heuristics alone.

**Bounds / clamping**
- [ ] Every numeric knob in `ResolvedConfig` is within the §5.3 range derived from the persisted value (assert in tests across extreme biases).
- [ ] `useRerank=true` is ignored (forced false) when no rerank model is configured.
- [ ] Missing persisted value for a knob → host default used as the clamp center.

**Two-stage timing**
- [ ] Strong top1 + clear gap → tighten branch: few chunks, rerank off, `grounding=strict`.
- [ ] Flat/clustered scores → rerank forced on.
- [ ] Weak non-empty scores → widen branch: lower threshold, larger top_k (within bounds), rerank on, `grounding=loose`.
- [ ] Near-empty / all-below-floor → deep-research loop triggers; capped at `deep_research_max_rounds`; on exhaustion → `grounding=none` / host insufficient-context path + `deep_research_exhausted` warning.
- [ ] No retrieval-affecting knob changed in Stage B → probe chunks reused; **no duplicate retrieval** issued.
- [ ] Every Stage-B-changed field has `provenance="post_retrieval"`.

**Reusability / purity**
- [ ] Selector unit-tested with fake `retrieveFn` and fake `llmClassifyFn` — no real model or store needed.
- [ ] Same selector function is callable from every host entry point (chat, search, generative orchestrator) with only the adapters differing.

**Suggested implementation order:** data contracts (`ResolvedConfig`, inputs) → Tier-0 heuristics + taxonomy table (unit tests with no I/O) → clamping (§5.3, unit tests) → Tier-1 classifier behind the LLM adapter (with retry + discard-on-fail) → probe + Stage-B adjustment (fake retriever tests) → deep-research loop (capped) → host call-site integration as override layer + disabled-fallback path → observability/logging → regression test vs. current hard-coded behavior.

---

## 12. Host-context placeholders (fill these in for YOUR project)

> Update this table first — the rest of the spec references these. Each `〔CONTEXT: …〕` elsewhere in the doc resolves to a row here.

| # | What to fill in | Where it's used | Your value |
|---|---|---|---|
| C1 | **Retrieval function** — module, name, signature, sync/async, knob argument names | §0, §6, §9 (`retrieveFn`) | _TBD_ |
| C2 | **Rerank function** — module, name, how it's enabled/disabled, how to know if a rerank model is configured | §0, §5.1, §5.4 (`useRerank`, `rerankAvailable`) | _TBD_ |
| C3 | **Config storage** — where `top_n`/`top_k`/`threshold`/`vector_weight`/`rerank`/`temperature` are persisted, and the exact field names | §0, §3, §5.3 (`bounds`) | _TBD_ |
| C4 | **LLM client** — the abstraction used for generation/classification; does it support schema/grammar-constrained JSON decoding? | §0, §4.2, §10 (`llmClassifyFn`) | _TBD_ |
| C5 | **Standalone-question step** — the multi-turn/history-condensation pass the selector runs after (if any) | §0, §7 | _TBD_ |
| C6 | **Answer-generation flow** — the request path where the selector is inserted as an override layer | §0, §3, §8 (step 11) | _TBD_ |
| C7 | **Retrieval score scale** — the numeric range your retriever's scores fall in (normalized [0,1]?), to tune `score_floor` / `score_strong_band` | §6, §11.1 | _TBD_ |
| C8 | **Domain ID conventions** — structured-ID patterns to detect for exact-match intent (e.g. `UC-`, `REQ-`, ticket keys) | §4.1 | _TBD_ |
| C9 | **Existing iterative/CRAG loop** (if any) the deep-research escalation can reuse instead of building new | §5.2 | _TBD_ |
| C10 | **Logging stack / format** for the observability log line | §11.2 | _TBD_ |

---

## 13. Out of scope (explicit non-goals for v1)

- Learning/optimizing the bias tables or clamp ranges from usage data (a future feedback-loop iteration; v1 ranges are static and configured).
- Per-knowledge-base or per-tenant bias profiles (the bounds already come from persisted per-record config; finer profiling is future work).
- Changing the retrieval or rerank algorithms themselves — the selector only chooses their **parameters** and reuses the host implementations as-is.
- Multi-turn history rewriting — owned by the existing upstream step (§7).
