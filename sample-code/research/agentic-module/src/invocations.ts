import type { AgentRequest, AgentResult, ExecutionContext } from "./types.ts";
export type Invocation = AgentRequest & {
  status: "pending" | "running" | AgentResult["status"];
};
export interface InvocationStore {
  /**
   * Creates a new durable resource.
   * @param request - Request values required by the operation.
   * @returns A promise that resolves when the operation completes.
   */
  create(request: AgentRequest): Promise<void>;
  /**
   * Attempts to acquire the scoped writer lease.
   * @param runId - Stable identifier of the agent run.
   * @param context - Authenticated execution context for the operation.
   * @returns A promise that resolves with the operation result.
   */
  claim(runId: string, context: ExecutionContext): Promise<boolean>;
  /**
   * Closes the requested durable resource.
   * @param runId - Stable identifier of the agent run.
   * @param status - Terminal or lifecycle status to persist.
   * @returns A promise that resolves when the operation completes.
   */
  close(runId: string, status: AgentResult["status"]): Promise<void>;
}
/**
 * Checks invocation ownership across principal, tenant, and workspace scope.
 * @param invocation - Invocation record to persist or update.
 * @param context - Authenticated execution context for the operation.
 * @returns Whether the requested condition is satisfied.
 */
function owns(invocation: Invocation, context: ExecutionContext): boolean {
  // Every ownership dimension must match exactly before a claim succeeds.
  for (const key of ["principalId", "tenantId", "workspaceId"] as const) {
    if (invocation.context[key] !== context[key]) return false;
  }
  return true;
}
export class InMemoryInvocationStore implements InvocationStore {
  readonly #items = new Map<string, Invocation>();
  /**
   * Creates one unique pending invocation for the lightweight runtime.
   * @param request - Request values required by the operation.
   * @returns A promise that resolves when the operation completes.
   * @throws When validation, persistence, policy, or the delegated operation fails.
   */
  async create(request: AgentRequest): Promise<void> {
    // Reject duplicate IDs rather than replacing an existing invocation.
    if (this.#items.has(request.runId))
      throw new Error(`Duplicate run: ${request.runId}`);
    this.#items.set(request.runId, { ...request, status: "pending" });
  }
  /**
   * Claims a pending invocation only for its recorded owner.
   * @param runId - Stable identifier of the agent run.
   * @param context - Authenticated execution context for the operation.
   * @returns A promise that resolves with the operation result.
   */
  async claim(runId: string, context: ExecutionContext): Promise<boolean> {
    // The status transition is atomic within this in-memory reference store.
    const invocation = this.#items.get(runId);
    if (
      !invocation ||
      invocation.status !== "pending" ||
      !owns(invocation, context)
    )
      return false;
    invocation.status = "running";
    return true;
  }
  /**
   * Closes an invocation with the exact terminal result status.
   * @param runId - Stable identifier of the agent run.
   * @param status - Terminal or lifecycle status to persist.
   * @returns A promise that resolves when the operation completes.
   */
  async close(runId: string, status: AgentResult["status"]): Promise<void> {
    // Missing invocations are programmer errors, not silent no-ops.
    const invocation = this.#items.get(runId);
    if (invocation) invocation.status = status;
  }
}
