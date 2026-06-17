# Waterfall traceability chain (reference)

Loaded by `plan.md` (Phase 2) or `write.md` (Phase 3) **only when the request uses a
waterfall / phase-gate / V-model methodology**. Supplies the lifecycle chain, node
types, link types, and ID conventions for that methodology. It is reference data, not
a skill, and **carries no outline** — section structure still comes solely from the
resolved `# Output format`.

## The chain (each node links backward to its source and forward to its consumers)

| Node | Typical ID | Backward link (derives from) | Forward link (consumed by) |
|---|---|---|---|
| Business need / business case | BR-*, BC-* | — (chain root) | SRS requirements |
| Requirement (SRS) | REQ-`<MODULE>`-`<NN>` | business need it realizes | HLD components, test cases |
| Basic Design / HLD component | CMP-`<NN>` | the REQ-* it realizes | LLD detail items |
| Detail Design / LLD item | DLD-`<MODULE>`-`<NN>` | the CMP-* it elaborates | code units, test specs |
| Code / unit | file/module/function or commit ref | the DLD-* it implements | unit/integration tests |
| Test case | TC-`<MODULE>`-`<NNN>` | the REQ-* / DLD-* it verifies | test specs, defects |
| Test specification | TS-`<MODULE>`-`<NNN>` | the TC-* it executes | test runs, defects |
| Defect | defect/bug ID from sources | the TC-* or REQ-* it failed against | fix commit / re-test |

The forward direction is the **V-model right side** (design → build → verify); the
backward direction is **provenance** (every test, line of code, and design item must
trace up to a requirement, and every requirement down to a business need).

## Link types to look for in retrieved chunks
- A requirement table or SRS section naming the business need it satisfies.
- An HLD/LLD section that names the `REQ-*` / `CMP-*` it realizes ("realizes REQ-CRM-12").
- A test case or test spec that cites the `REQ-*` / `DLD-*` under test.
- A commit message, code comment, or build manifest referencing a `DLD-*` or `REQ-*`.
- A defect record referencing the `TC-*` that found it or the `REQ-*` it violates.

## Tracing rules specific to waterfall
- The chain is **phase-gated**: a link should not skip a phase silently. If a test
  cites a requirement but no design item connects them, that is a **gap to report**
  (test traces to REQ, but the REQ→design→test path is broken), not a clean link.
- Coverage is expected to be **complete** at each gate — every requirement in scope
  should trace forward to at least one test, and every test backward to a requirement.
  Missing either side is "NOT TRACED", reported, never inferred.
- IDs follow the conventions above exactly; an ID not present in the sources is a
  **broken link** (orphan reference), never coined to bridge a gap.
