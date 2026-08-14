import type { Citation, ExecutionContext, ToolDefinition } from "./types.ts";
export type Evidence = {
  content: string;
  citation: Citation;
  source?: "context" | "vector" | "document" | "external";
};
export type EvidenceLoader = (
  query: string,
  context: ExecutionContext,
  signal: AbortSignal
) => Promise<Evidence[]>;
/**
 * Retrieves evidence in deterministic local-to-external priority order.
 * @param query - Retrieval query evaluated within the current scope.
 * @param context - Authenticated execution context for the operation.
 * @param loaders - Authorized loaders used to resolve external capabilities.
 * @param options - Optional controls for the operation.
 * @returns A promise that resolves with the operation result.
 */
export async function retrieveGroundedEvidence(
  query: string,
  context: ExecutionContext,
  loaders: {
    context: EvidenceLoader;
    vector: EvidenceLoader;
    documents: EvidenceLoader;
    external?: EvidenceLoader;
  },
  options: {
    allowExternal?: boolean;
    signal?: AbortSignal;
  } = {}
): Promise<{
  status: "grounded" | "insufficient_evidence";
  evidence: Evidence[];
}> {
  // Stop at the first authorized tier with evidence to preserve source priority.
  const signal = options.signal ?? new AbortController().signal;
  for (const [source, load] of [
    ["context", loaders.context],
    ["vector", loaders.vector],
    ["document", loaders.documents],
  ] as const) {
    const evidence = await load(query, context, signal);
    if (evidence.length)
      return {
        status: "grounded",
        evidence: evidence.map((item) => ({ ...item, source })),
      };
  }
  if (options.allowExternal && loaders.external) {
    const evidence = await loaders.external(query, context, signal);
    if (evidence.length)
      return {
        status: "grounded",
        evidence: evidence.map((item) => ({ ...item, source: "external" })),
      };
  }
  return { status: "insufficient_evidence", evidence: [] };
}
/**
 * Creates a write-risk memory tool backed by host persistence.
 * @param adapter - Host adapter that supplies the external capability.
 * @returns The created or normalized operation result.
 */
export function createMemoryStoreTool(adapter: {
  /**
   * Persists one value through the host adapter.
   * @param input - Validated input required by the operation.
   * @returns A promise that resolves when the operation completes.
   */
  store(input: {
    content: string;
    context: ExecutionContext;
    signal: AbortSignal;
  }): Promise<void>;
}): ToolDefinition {
  // The module owns validation and policy classification; the host owns storage.
  return {
    name: "memory-store",
    description: "Store approved long-term memory.",
    parameters: {
      type: "object",
      properties: { content: { type: "string" } },
      required: ["content"],
    },
    risk: "write",
    /**
     * Stores one validated memory value through the host adapter.
     * @param input - Validated input required by the operation.
     * @param toolContext - Current tool execution context.
     * @returns The execute result produced for the current operation.
     * @throws When validation, persistence, policy, or the delegated operation fails.
     */
    async execute(input, toolContext) {
      // Reject empty memory before crossing the external write boundary.
      const content = (
        input as {
          content?: unknown;
        }
      )?.content;
      if (typeof content !== "string" || !content.trim())
        throw new Error("Memory content is required.");
      await adapter.store({
        content,
        context: toolContext.execution,
        signal: toolContext.signal,
      });
      return { type: "continue", content: "Memory stored." };
    },
  };
}
/**
 * Creates scoped document-list and document-read tools from one host adapter.
 * @param adapter - Host adapter that supplies the external capability.
 * @returns The created or normalized operation result.
 */
export function createDocumentTools(adapter: {
  /**
   * Lists values visible in the current scope.
   * @param context - Authenticated execution context for the operation.
   * @param signal - Abort signal propagated to external work.
   * @returns A promise that resolves with the operation result.
   */
  list(
    context: ExecutionContext,
    signal: AbortSignal
  ): Promise<
    Array<{
      id: string;
      title: string;
    }>
  >;
  /**
   * Reads one authorized value.
   * @param id - Stable identifier of the requested value.
   * @param context - Authenticated execution context for the operation.
   * @param signal - Abort signal propagated to external work.
   * @returns A promise that resolves with the operation result.
   */
  read(
    id: string,
    context: ExecutionContext,
    signal: AbortSignal
  ): Promise<Evidence>;
}): ToolDefinition[] {
  // Both definitions receive the same authorized execution scope and abort signal.
  return [
    {
      name: "document-list",
      description: "List authorized documents.",
      parameters: { type: "object" },
      risk: "read",
      /**
       * Executes the configured operation.
       * @param _input - Value supplied as input to this operation.
       * @param context - Authenticated execution context for the operation.
       * @returns The execute result produced for the current operation.
       */
      execute: async (_input, context) => ({
        type: "continue",
        content: JSON.stringify(
          await adapter.list(context.execution, context.signal)
        ),
      }),
    },
    {
      name: "document-read",
      description: "Read an authorized document.",
      parameters: {
        type: "object",
        properties: { id: { type: "string" } },
        required: ["id"],
      },
      risk: "read",
      /**
       * Reads one document and registers its citation in the current run.
       * @param input - Validated input required by the operation.
       * @param context - Authenticated execution context for the operation.
       * @returns The execute result produced for the current operation.
       * @throws When validation, persistence, policy, or the delegated operation fails.
       */
      async execute(input, context) {
        // Validate the identity before the host storage read.
        const id = (
          input as {
            id?: unknown;
          }
        )?.id;
        if (typeof id !== "string" || !id)
          throw new Error("Document id is required.");
        const evidence = await adapter.read(
          id,
          context.execution,
          context.signal
        );
        context.addCitation(evidence.citation);
        return { type: "continue", content: evidence.content };
      },
    },
  ];
}
