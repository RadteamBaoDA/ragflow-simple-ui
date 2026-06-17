# Agile traceability chain (reference)

Loaded by `plan.md` (Phase 2) or `write.md` (Phase 3) **only when the request uses an
agile methodology** (Scrum / Kanban / SAFe — anything backlog- and increment-driven).
Supplies the lifecycle chain, node types, link types, and ID conventions for that
methodology. It is reference data, not a skill, and **carries no outline** — section
structure still comes solely from the resolved `# Output format`.

## The chain (each node links up to its parent and down to what satisfies it)

| Node | Typical ID | Backward link (parent / derives from) | Forward link (children / satisfied by) |
|---|---|---|---|
| Epic | epic name / EP-* | business objective / theme | features |
| Feature / capability | feature name / FE-* | the epic it belongs to | user stories |
| User story | US-`<NN>` | the feature/epic it belongs to | acceptance criteria, tasks |
| Acceptance criterion | AC-`<NN>` (often US-`<NN>`-AC-`<n>`) | the user story it qualifies | tests that verify it |
| Task / sub-task | task/ticket ID from sources | the story it implements | code / commits |
| Code / commit / PR | commit, PR, or branch ref | the story/task it implements (e.g. "US-14" in the message) | tests, the increment |
| Test case | TC-`<NN>` | the AC-* / US-* it verifies | defects, the Definition of Done |
| Defect / bug PBI | defect/PBI ID from sources | the test or story it failed against | fix story / re-test |
| Increment / release note | sprint or release ref | the stories marked done | shipped value |

The backward direction is **backlog provenance** (every test maps to an acceptance
criterion, every AC to a story, every story to a feature/epic); the forward direction
is **delivery** (a story is "done" only when its ACs are met and verified).

## Link types to look for in retrieved chunks
- A story description naming its epic/feature, or a backlog hierarchy listing them.
- Acceptance criteria written under a story ("AC-1: Given… When… Then…").
- A commit/PR message or task referencing a story ID ("Closes US-14").
- A test case mapped to an acceptance criterion or story ("verifies US-14 / AC-2").
- A defect/PBI referencing the failing test or the story whose AC it breaks.
- A sprint review / release note marking stories done and linking the increment.

## Tracing rules specific to agile
- Trace **story-centric**: the user story is the hub. A complete trace shows each
  in-scope story's epic/feature above it and its acceptance criteria + verifying tests
  below it. A story with no AC, or ACs with no test, is "NOT TRACED" on that side.
- "Done" is an **evidence** claim, not an assertion: only call a story traced-to-done
  when the sources show its ACs verified by tests (or a Definition-of-Done record).
  Never infer done-ness from a story merely existing.
- IDs and titles come from the sources exactly; if a commit names a story ID absent
  from the backlog chunks, that is a **broken link** (orphan reference) to report,
  never coined to bridge a gap.
- Agile artifacts are often lighter than waterfall's — absence of a formal design doc
  is normal and is **not** itself a gap; only a missing *link the sources imply should
  exist* (e.g. an AC with no test) is reported as "NOT TRACED".
