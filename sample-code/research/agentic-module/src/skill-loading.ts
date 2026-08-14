import { AgenticError } from "./errors.ts";
import type {
  ExecutionContext,
  SkillCatalogEntry,
  SkillDefinition,
  SkillReference,
  SkillRuntimeAdapter,
} from "./types.ts";

const STOP_WORDS = new Set([
  "and",
  "cho",
  "cua",
  "for",
  "hay",
  "the",
  "this",
  "toi",
  "use",
  "voi",
]);
export const SKILL_INSTRUCTIONS_PREFIX = "<agentic-skills>";

/**
 * Selects a bounded skill subset from already authorized catalog metadata.
 * @param input - Current user request used for explicit and implicit matching.
 * @param catalog - Agent-scoped skill metadata eligible for selection.
 * @param limit - Maximum number of selected skills.
 * @returns Catalog entries ordered by match strength and catalog order.
 */
export function selectSkillCatalog(
  input: string,
  catalog: readonly SkillCatalogEntry[],
  limit = 5
): SkillCatalogEntry[] {
  // Explicit invocation is authoritative and prevents unrelated implicit matches.
  const boundedLimit = Math.max(0, Math.floor(limit));
  if (!boundedLimit) return [];
  const normalizedInput = normalize(input);
  const explicit = catalog.filter(({ name }) =>
    new RegExp(`(^|\\s)\\$${escapeRegExp(name)}(?=\\s|$|[.,!?;:])`, "iu").test(
      input
    )
  );
  if (explicit.length) return explicit.slice(0, boundedLimit);

  const inputTokens = tokens(normalizedInput);
  return catalog
    .map((entry, index) => ({ entry, index, score: score(entry) }))
    .filter(({ entry, score }) => entry.allowImplicitInvocation !== false && score > 0)
    .sort((left, right) => right.score - left.score || left.index - right.index)
    .slice(0, boundedLimit)
    .map(({ entry }) => entry);

  /**
   * Scores one catalog entry using exact phrases and meaningful token overlap.
   * @param entry - Authorized catalog metadata to score.
   * @returns Deterministic relevance score for the current request.
   */
  function score(entry: SkillCatalogEntry): number {
    // Exact names or triggers dominate weaker description-token overlap.
    const phrases = [entry.name, ...(entry.triggers ?? [])]
      .map(normalize)
      .filter(Boolean);
    const phraseScore = phrases.some((phrase) =>
      phrase.includes(" ")
        ? normalizedInput.includes(phrase)
        : inputTokens.has(phrase)
    )
      ? 100
      : 0;
    const metadataTokens = tokens(
      `${entry.name} ${entry.description} ${(entry.triggers ?? []).join(" ")}`
    );
    let overlap = 0;
    for (const token of inputTokens) if (metadataTokens.has(token)) overlap += 1;
    return phraseScore + overlap;
  }
}

/**
 * Resolves request-relevant skills while preserving exact recovery snapshots.
 * @param adapter - Host adapter backed by the codebase database and skill loader.
 * @param input - Agent identity, request text, context, and optional recovery snapshot.
 * @returns Validated immutable references and their hydrated definitions.
 * @throws When identities, catalog rows, selection, or loaded versions are invalid.
 */
export async function resolveAgentSkills(
  adapter: SkillRuntimeAdapter,
  input: {
    agentId: string;
    runId: string;
    request: string;
    context: ExecutionContext;
    signal: AbortSignal;
    snapshot?: SkillReference[];
  }
): Promise<{ snapshot: SkillReference[]; definitions: SkillDefinition[] }> {
  // Recovery bypasses selection so database edits cannot alter an in-flight turn.
  const selected = input.snapshot
    ? validateReferences(input.snapshot, "skill snapshot")
    : await selectFromCatalog(adapter, input);
  if (!selected.length) return { snapshot: [], definitions: [] };
  const definitions = await adapter.load({
    agentId: input.agentId,
    runId: input.runId,
    skills: structuredClone(selected),
    context: input.context,
    signal: input.signal,
  });
  validateDefinitions(selected, definitions);
  return {
    snapshot: structuredClone(selected),
    definitions: [...definitions],
  };
}

/**
 * Loads authorized metadata and validates a default or host-selected subset.
 * @param adapter - Host skill persistence and optional ranking adapter.
 * @param input - Authenticated request used to list and rank skills.
 * @returns Exact references selected from the authorized catalog.
 * @throws When catalog metadata or host selection is invalid.
 */
async function selectFromCatalog(
  adapter: SkillRuntimeAdapter,
  input: {
    agentId: string;
    runId: string;
    request: string;
    context: ExecutionContext;
    signal: AbortSignal;
  }
): Promise<SkillReference[]> {
  // Authorization is fixed by the catalog before any relevance selection runs.
  const catalog = await adapter.listCatalog({
    agentId: input.agentId,
    runId: input.runId,
    context: input.context,
    signal: input.signal,
  });
  validateCatalog(catalog);
  const limit = Math.max(0, Math.floor(adapter.maxSelected ?? 5));
  const selected = adapter.select
    ? await adapter.select({
        agentId: input.agentId,
        runId: input.runId,
        input: input.request,
        catalog: structuredClone(catalog),
        context: input.context,
        signal: input.signal,
      })
    : selectSkillCatalog(input.request, catalog, limit);
  const references = validateReferences(selected, "skill selection");
  if (references.length > limit)
    invalid(`Skill selection exceeded maxSelected (${limit}).`);
  const allowed = new Map(catalog.map((entry) => [key(entry), entry]));
  for (const reference of references)
    if (!allowed.has(key(reference)))
      invalid(`Selected skill is not in the agent catalog: ${reference.id}`);
  return references;
}

/**
 * Validates agent catalog identity, description, trigger, and name uniqueness.
 * @param catalog - Authorized catalog metadata returned by the host.
 * @returns Nothing after successful validation.
 * @throws When catalog metadata is malformed or ambiguous.
 */
function validateCatalog(catalog: readonly SkillCatalogEntry[]): void {
  // Duplicate names make explicit invocation ambiguous and therefore fail closed.
  const references = validateReferences(catalog, "skill catalog");
  if (new Set(references.map(({ name }) => name)).size !== references.length)
    invalid("Skill catalog contains duplicate names.");
  for (const entry of catalog) {
    if (!entry.description.trim()) invalid(`Skill description is empty: ${entry.id}`);
    if (entry.triggers?.some((trigger) => !trigger.trim()))
      invalid(`Skill trigger is empty: ${entry.id}`);
  }
}

/**
 * Verifies hydrated definitions exactly match the immutable selection.
 * @param selected - Selected immutable skill identities.
 * @param definitions - Full definitions returned by the host loader.
 * @returns Nothing after successful validation.
 * @throws When a selected skill is missing, changed, duplicated, or malformed.
 */
function validateDefinitions(
  selected: readonly SkillReference[],
  definitions: readonly SkillDefinition[]
): void {
  // Exact identity equality prevents a loader from silently substituting latest.
  const loaded = validateReferences(definitions, "loaded skills");
  if (loaded.length !== selected.length)
    invalid("Loaded skills do not match the selected snapshot.");
  const expected = new Set(selected.map(key));
  for (const definition of definitions) {
    if (!expected.has(key(definition)))
      invalid(`Loaded skill version does not match selection: ${definition.id}`);
    if (!Array.isArray(definition.tools))
      invalid(`Loaded skill tools are invalid: ${definition.id}`);
  }
}

/**
 * Normalizes and validates a collection of immutable skill identities.
 * @param values - Skill-like values containing identity fields.
 * @param label - Source label used in validation errors.
 * @returns Validated identity-only copies.
 * @throws When an identity field is empty or duplicated.
 */
function validateReferences(
  values: readonly SkillReference[],
  label: string
): SkillReference[] {
  // Strip non-identity fields before comparison or durable persistence.
  const references = values.map((value) => ({
    id: required(value.id, "id", label),
    name: required(value.name, "name", label),
    version: required(value.version, "version", label),
    digest: required(value.digest, "digest", label),
  }));
  if (new Set(references.map(key)).size !== references.length)
    invalid(`Duplicate identity in ${label}.`);
  return references;
}

/**
 * Requires one non-empty string identity field.
 * @param value - Candidate identity value.
 * @param field - Identity field name.
 * @param label - Source label used in validation errors.
 * @returns The validated value.
 * @throws When the value is not a non-empty string.
 */
function required(value: string, field: string, label: string): string {
  // Preserve the host value while rejecting empty or non-string identities.
  if (typeof value !== "string" || !value.trim())
    invalid(`Invalid ${field} in ${label}.`);
  return value;
}

/**
 * Builds a collision-resistant in-memory key for an immutable skill identity.
 * @param value - Skill identity to encode.
 * @returns Composite identity key.
 */
function key(value: SkillReference): string {
  // NUL separators cannot be confused with ordinary dotted or dashed identifiers.
  return `${value.id}\u0000${value.name}\u0000${value.version}\u0000${value.digest}`;
}

/**
 * Normalizes matching text without altering stored catalog metadata.
 * @param value - Text to normalize.
 * @returns Unicode-normalized lowercase text.
 */
function normalize(value: string): string {
  // NFKC makes visually equivalent compatibility forms match consistently.
  return value.normalize("NFKC").toLocaleLowerCase();
}

/**
 * Extracts meaningful Unicode tokens for deterministic metadata matching.
 * @param value - Request or catalog text to tokenize.
 * @returns Unique searchable tokens.
 */
function tokens(value: string): Set<string> {
  // Drop short/common tokens to limit broad accidental matches.
  return new Set(
    (normalize(value).match(/[\p{L}\p{N}_-]+/gu) ?? []).filter(
      (token) => token.length > 2 && !STOP_WORDS.has(token)
    )
  );
}

/**
 * Escapes a skill name before inserting it into an explicit-invocation pattern.
 * @param value - Literal skill name.
 * @returns Regular-expression-safe literal.
 */
function escapeRegExp(value: string): string {
  // Treat every catalog name character literally at the request boundary.
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Throws the public fail-closed error used by skill selection validation.
 * @param message - Safe validation failure message.
 * @returns Never returns.
 * @throws Always throws an invalid-request error.
 */
function invalid(message: string): never {
  // Keep malformed host data and unauthorized selection in one typed boundary.
  throw new AgenticError("INVALID_REQUEST", message);
}
