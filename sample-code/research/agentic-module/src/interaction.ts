import { AgenticError } from "./errors.ts";
import { reduceHarnessEvents } from "./reducer.ts";
import type { HarnessStore } from "./harness-store.ts";
import type {
  ApprovalRequest,
  ApprovalResponse,
  ClarificationQuestion,
  ClarificationRequest,
  ClarificationResponse,
  ExecutionContext,
} from "./types.ts";
type InteractionRequest = ApprovalRequest | ClarificationRequest;
export class DurableInteractionManager {
  readonly #store: HarnessStore;
  readonly #id: () => string;
  readonly #now: () => number;
  /**
   * Creates a durable interaction manager with injectable ID and clock sources.
   * @param input - Validated input required by the operation.
   */
  constructor(input: {
    store: HarnessStore;
    id?: () => string;
    now?: () => number;
  }) {
    // Capture deterministic dependencies once for restart-safe request construction.
    this.#store = input.store;
    this.#id = input.id ?? (() => crypto.randomUUID());
    this.#now = input.now ?? Date.now;
  }
  /**
   * Loads a run and enforces every ownership dimension.
   * @param runId - Stable identifier of the agent run.
   * @param context - Authenticated execution context for the operation.
   * @returns The #owned result produced for the current operation.
   * @throws When validation, persistence, policy, or the delegated operation fails.
   */
  async #owned(runId: string, context: ExecutionContext) {
    // Possession of a run or request ID never grants interaction access.
    const loaded = await this.#store.load(runId);
    if (!loaded)
      throw new AgenticError("INVOCATION_NOT_FOUND", `Run not found: ${runId}`);
    for (const key of ["principalId", "tenantId", "workspaceId"] as const) {
      if (loaded.record.context[key] !== context[key])
        throw new AgenticError("TOOL_DENIED", "Interaction ownership denied.");
    }
    return loaded;
  }
  /**
   * Appends one idempotent interaction lifecycle event after ownership validation.
   * @param runId - Stable identifier of the agent run.
   * @param context - Authenticated execution context for the operation.
   * @param type - Durable interaction event type to append.
   * @param data - Durable interaction payload to append.
   * @returns The #append result produced for the current operation.
   */
  async #append(
    runId: string,
    context: ExecutionContext,
    type:
      | "approval_requested"
      | "approval_responded"
      | "clarification_requested"
      | "clarification_responded",
    data: Record<string, unknown>
  ) {
    // Reload immediately before optimistic append so responses cannot overwrite concurrent state.
    const loaded = await this.#owned(runId, context);
    await this.#store.append(runId, loaded.record.version, [
      { type, data, idempotencyKey: `${type}:${String(data.requestId)}` },
    ]);
  }
  /**
   * Replays and returns the currently pending interaction, if any.
   * @param runId - Stable identifier of the agent run.
   * @param context - Authenticated execution context for the operation.
   * @returns A promise that resolves with the operation result.
   */
  async pending(
    runId: string,
    context: ExecutionContext
  ): Promise<InteractionRequest | undefined> {
    // Projection, rather than an in-process Promise, is the restart-safe source of truth.
    const loaded = await this.#owned(runId, context);
    return reduceHarnessEvents(loaded.record, loaded.events).pending?.data as
      | InteractionRequest
      | undefined;
  }
  /**
   * Persists one approval request and rejects overlapping interactions.
   * @param runId - Stable identifier of the agent run.
   * @param context - Authenticated execution context for the operation.
   * @param input - Validated input required by the operation.
   * @returns A promise that resolves with the operation result.
   * @throws When validation, persistence, policy, or the delegated operation fails.
   */
  async beginApproval(
    runId: string,
    context: ExecutionContext,
    input: Omit<ApprovalRequest, "requestId" | "expiresAt">
  ): Promise<ApprovalRequest> {
    // Allocate request identity only after confirming the lane has no pending prompt.
    if (await this.pending(runId, context))
      throw new AgenticError(
        "INVALID_REQUEST",
        "An interaction is already pending."
      );
    const request = {
      ...input,
      requestId: this.#id(),
      expiresAt: this.#now() + Math.max(1, input.timeoutMs),
    };
    await this.#append(runId, context, "approval_requested", request);
    return request;
  }
  /**
   * Validates and persists a bounded clarification request.
   * @param runId - Stable identifier of the agent run.
   * @param context - Authenticated execution context for the operation.
   * @param input - Validated input required by the operation.
   * @returns A promise that resolves with the operation result.
   * @throws When validation, persistence, policy, or the delegated operation fails.
   */
  async beginClarification(
    runId: string,
    context: ExecutionContext,
    input: Omit<ClarificationRequest, "requestId" | "expiresAt">
  ): Promise<ClarificationRequest> {
    // Limit UI questions and validate the entire list before durable admission.
    if (await this.pending(runId, context))
      throw new AgenticError(
        "INVALID_REQUEST",
        "An interaction is already pending."
      );
    const questions = input.questions.slice(0, 3);
    if (!questions.length || !questions.every(validQuestion))
      throw new AgenticError(
        "INVALID_REQUEST",
        "Invalid clarification questions."
      );
    const request = {
      ...input,
      questions,
      requestId: this.#id(),
      expiresAt: this.#now() + Math.max(1, input.timeoutMs),
    };
    await this.#append(runId, context, "clarification_requested", request);
    return request;
  }
  /**
   * Settles the matching pending approval exactly once.
   * @param runId - Stable identifier of the agent run.
   * @param context - Authenticated execution context for the operation.
   * @param response - Response value to validate or persist.
   * @returns A promise that resolves when the operation completes.
   * @throws When validation, persistence, policy, or the delegated operation fails.
   */
  async respondApproval(
    runId: string,
    context: ExecutionContext,
    response: ApprovalResponse
  ): Promise<void> {
    // Correlate by request ID and interaction kind before appending a response.
    const pending = await this.pending(runId, context);
    if (
      !pending ||
      !("toolName" in pending) ||
      pending.requestId !== response.requestId
    ) {
      throw new AgenticError(
        "INVALID_REQUEST",
        "Approval request is not pending."
      );
    }
    await this.#append(runId, context, "approval_responded", response);
  }
  /**
   * Settles the matching pending clarification exactly once.
   * @param runId - Stable identifier of the agent run.
   * @param context - Authenticated execution context for the operation.
   * @param response - Response value to validate or persist.
   * @returns A promise that resolves when the operation completes.
   * @throws When validation, persistence, policy, or the delegated operation fails.
   */
  async respondClarification(
    runId: string,
    context: ExecutionContext,
    response: ClarificationResponse
  ): Promise<void> {
    // Wrong-kind, stale, or duplicate responses fail closed.
    const pending = await this.pending(runId, context);
    if (
      !pending ||
      !("questions" in pending) ||
      pending.requestId !== response.requestId
    ) {
      throw new AgenticError(
        "INVALID_REQUEST",
        "Clarification request is not pending."
      );
    }
    await this.#append(runId, context, "clarification_responded", response);
  }
  /**
   * Finds the durable response for one approval request.
   * @param runId - Stable identifier of the agent run.
   * @param context - Authenticated execution context for the operation.
   * @param requestId - Stable identifier of the pending request.
   * @returns A promise that resolves with the operation result.
   */
  async approvalResponse(
    runId: string,
    context: ExecutionContext,
    requestId: string
  ): Promise<ApprovalResponse | undefined> {
    // Scan newest-first because request IDs are unique and responses are append-only.
    const loaded = await this.#owned(runId, context);
    for (let index = loaded.events.length - 1; index >= 0; index -= 1) {
      const event = loaded.events[index];
      if (
        event.type === "approval_responded" &&
        event.data.requestId === requestId
      )
        return event.data as ApprovalResponse;
    }
    return undefined;
  }
  /**
   * Converts an expired pending interaction into a deterministic fail-closed response.
   * @param runId - Stable identifier of the agent run.
   * @param context - Authenticated execution context for the operation.
   * @returns A promise that resolves with the operation result.
   */
  async expire(
    runId: string,
    context: ExecutionContext
  ): Promise<ApprovalResponse | ClarificationResponse | undefined> {
    // Do nothing before expiry; after expiry use the normal response methods for identical logs.
    const pending = await this.pending(runId, context);
    if (!pending || pending.expiresAt > this.#now()) return undefined;
    if ("toolName" in pending) {
      const response = { requestId: pending.requestId, approved: false };
      await this.respondApproval(runId, context, response);
      return response;
    }
    const response = {
      requestId: pending.requestId,
      skipped: true,
      timedOut: true,
      answers: [],
    };
    await this.respondClarification(runId, context, response);
    return response;
  }
}
/**
 * Validates one input or non-empty choice clarification question.
 * @param question - Clarification question to validate.
 * @returns Whether the requested condition is satisfied.
 */
function validQuestion(question: ClarificationQuestion): boolean {
  // Empty prompts and choice questions without choices are never presented to users.
  if (!question.question.trim()) return false;
  return (
    question.kind === "input" ||
    (Array.isArray(question.choices) && question.choices.length > 0)
  );
}
