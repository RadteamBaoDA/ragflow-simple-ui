import type { Citation, ToolDefinition } from "./types.ts";
/**
 * Creates a synchronous host-backed clarification tool.
 * @param adapter - Host adapter that supplies the external capability.
 * @returns The created or normalized operation result.
 */
export function createClarificationTool(adapter: {
  maxQuestions?: number;
  /**
   * Submits bounded clarification questions through the host adapter.
   * @param input - Validated input required by the operation.
   * @returns A promise that resolves with the operation result.
   */
  ask(input: {
    runId: string;
    questions: unknown[];
    signal: AbortSignal;
  }): Promise<unknown>;
}): ToolDefinition {
  // Bound questions before invoking the host UI adapter.
  return {
    name: "request-user-input",
    description: "Ask the user structured clarifying questions.",
    parameters: { type: "object", required: ["questions"] },
    risk: "read",
    /**
     * Validates questions and returns the serialized host response.
     * @param input - Validated input required by the operation.
     * @param context - Authenticated execution context for the operation.
     * @returns The execute result produced for the current operation.
     * @throws When validation, persistence, policy, or the delegated operation fails.
     */
    async execute(input, context) {
      // Normalize malformed inputs to an empty list and fail before UI display.
      const questions = Array.isArray(
        (
          input as {
            questions?: unknown[];
          }
        )?.questions
      )
        ? (
            input as {
              questions: unknown[];
            }
          ).questions.slice(0, adapter.maxQuestions ?? 3)
        : [];
      if (questions.length === 0)
        throw new Error("At least one question is required.");
      const answer = await adapter.ask({
        runId: context.runId,
        questions,
        signal: context.signal,
      });
      return { type: "continue", content: JSON.stringify(answer) };
    },
  };
}
/**
 * Creates a clarification tool that suspends through durable interaction state.
 * @param input - Validated input required by the operation.
 * @returns The created or normalized operation result.
 */
export function createDurableClarificationTool(
  input: {
    maxQuestions?: number;
    timeoutMs?: number;
    allowSkip?: boolean;
  } = {}
): ToolDefinition {
  // Return declarative needs-input data instead of holding an in-process Promise.
  return {
    name: "request-user-input",
    description: "Pause the run and ask structured clarifying questions.",
    parameters: { type: "object", required: ["questions"] },
    risk: "read",
    /**
     * Produces a bounded durable clarification request.
     * @param value - Value to validate, transform, or persist.
     * @returns The execute result produced for the current operation.
     * @throws When validation, persistence, policy, or the delegated operation fails.
     */
    async execute(value) {
      // Enforce at least one question before suspending the run.
      const questions = Array.isArray(
        (
          value as {
            questions?: unknown[];
          }
        )?.questions
      )
        ? (
            value as {
              questions: import("./types.ts").ClarificationQuestion[];
            }
          ).questions.slice(0, input.maxQuestions ?? 3)
        : [];
      if (!questions.length)
        throw new Error("At least one question is required.");
      return {
        type: "needs_input",
        interaction: {
          kind: "clarification",
          questions,
          allowSkip: input.allowSkip ?? true,
          timeoutMs: input.timeoutMs ?? 300000,
        },
      };
    },
  };
}
/**
 * Creates a read-only retrieval tool with current-run provenance registration.
 * @param adapter - Host adapter that supplies the external capability.
 * @returns The created or normalized operation result.
 */
export function createRetrievalTool(adapter: {
  /**
   * Searches authorized host evidence for the current run.
   * @param input - Validated input required by the operation.
   * @returns A promise that resolves with the operation result.
   */
  search(input: {
    query: string;
    context: Record<string, unknown>;
    signal: AbortSignal;
  }): Promise<
    Array<{
      content: string;
      citation: Citation;
    }>
  >;
}): ToolDefinition {
  // Retrieval remains host-scoped while citations remain runtime-validated.
  return {
    name: "knowledge-search",
    description: "Search authorized knowledge and return grounded context.",
    parameters: {
      type: "object",
      properties: { query: { type: "string" } },
      required: ["query"],
    },
    risk: "read",
    /**
     * Searches authorized knowledge and returns joined evidence content.
     * @param input - Validated input required by the operation.
     * @param context - Authenticated execution context for the operation.
     * @returns The execute result produced for the current operation.
     * @throws When validation, persistence, policy, or the delegated operation fails.
     */
    async execute(input, context) {
      // Reject empty queries before invoking retrieval infrastructure.
      const query = (
        input as {
          query?: unknown;
        }
      )?.query;
      if (typeof query !== "string" || !query.trim())
        throw new Error("A query is required.");
      const chunks = await adapter.search({
        query,
        context: context.execution,
        signal: context.signal,
      });
      for (const { citation } of chunks) context.addCitation(citation);
      return {
        type: "continue",
        content: chunks.map(({ content }) => content).join("\n\n"),
      };
    },
  };
}
/**
 * Creates an artifact-producing tool using the host renderer or storage adapter.
 * @param input - Validated input required by the operation.
 * @returns The created or normalized operation result.
 */
export function createArtifactTool(input: {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  risk?: ToolDefinition["risk"];
  /**
   * Creates a new durable resource.
   * @param value - Value to validate, transform, or persist.
   * @param signal - Abort signal propagated to external work.
   * @returns A promise that resolves with the operation result.
   */
  create(
    value: unknown,
    signal: AbortSignal
  ): Promise<import("./types.ts").Artifact>;
}): ToolDefinition {
  // Declared risk feeds the normal policy and approval boundary.
  return {
    name: input.name,
    description: input.description,
    parameters: input.parameters,
    risk: input.risk ?? "write",
    /**
     * Creates and registers one artifact before exposing its result.
     * @param value - Value to validate, transform, or persist.
     * @param context - Authenticated execution context for the operation.
     * @returns The execute result produced for the current operation.
     */
    async execute(value, context) {
      // Register the artifact in the current run before returning direct output.
      const artifact = await input.create(value, context.signal);
      context.addArtifact(artifact);
      return {
        type: "direct_output",
        content: artifact.displayName ?? artifact.id,
      };
    },
  };
}
