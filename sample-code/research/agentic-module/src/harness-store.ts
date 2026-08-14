import { AgenticError } from "./errors.ts";
import { reduceHarnessEvents } from "./reducer.ts";
import type { AgentRequest, AgentResult, ExecutionContext } from "./types.ts";
import type {
  HarnessEvent,
  HarnessEventInput,
  RunRecord,
} from "./harness-types.ts";
export interface HarnessStore {
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
   * @param workerId - Identifier of the worker requesting the lease.
   * @param leaseMs - Writer lease duration in milliseconds.
   * @returns A promise that resolves with the operation result.
   */
  claim(
    runId: string,
    context: ExecutionContext,
    workerId: string,
    leaseMs: number
  ): Promise<boolean>;
  /**
   * Renews a live writer lease for the current worker.
   * @param runId - Stable identifier of the agent run.
   * @param workerId - Identifier of the worker requesting the lease.
   * @param leaseMs - Writer lease duration in milliseconds.
   * @returns A promise that resolves with the operation result.
   */
  renewLease(
    runId: string,
    workerId: string,
    leaseMs: number
  ): Promise<boolean>;
  /**
   * Releases the writer lease owned by the current worker.
   * @param runId - Stable identifier of the agent run.
   * @param workerId - Identifier of the worker requesting the lease.
   * @returns A promise that resolves when the operation completes.
   */
  releaseLease(runId: string, workerId: string): Promise<void>;
  /**
   * Appends an optimistic batch to durable state.
   * @param runId - Stable identifier of the agent run.
   * @param expectedVersion - Optimistic version required for the write.
   * @param events - Ordered durable events to append atomically.
   * @returns A promise that resolves with the operation result.
   */
  append(
    runId: string,
    expectedVersion: number,
    events: HarnessEventInput[]
  ): Promise<{
    version: number;
  }>;
  /**
   * Atomically settles durable events and terminal state.
   * @param runId - Stable identifier of the agent run.
   * @param expectedVersion - Optimistic version required for the write.
   * @param events - Ordered durable events to append atomically.
   * @param status - Terminal or lifecycle status to persist.
   * @returns A promise that resolves with the operation result.
   */
  settle(
    runId: string,
    expectedVersion: number,
    events: HarnessEventInput[],
    status:
      | Exclude<
          AgentResult["status"],
          "completed" | "needs_input" | "suspended"
        >
      | "closed"
  ): Promise<{
    version: number;
  }>;
  /**
   * Loads the requested durable value.
   * @param runId - Stable identifier of the agent run.
   * @returns A promise that resolves with the operation result.
   */
  load(runId: string): Promise<
    | {
        record: RunRecord;
        events: HarnessEvent[];
      }
    | undefined
  >;
  /**
   * Closes the requested durable resource.
   * @param runId - Stable identifier of the agent run.
   * @param status - Terminal or lifecycle status to persist.
   * @returns A promise that resolves when the operation completes.
   */
  close(runId: string, status: AgentResult["status"] | "closed"): Promise<void>;
}
/**
 * Compares all durable owner scopes before allowing a run mutation.
 * @param record - Durable record used as the replay base.
 * @param context - Authenticated execution context for the operation.
 * @returns Whether the requested condition is satisfied.
 */
function owns(record: RunRecord, context: ExecutionContext): boolean {
  // Undefined dimensions must also match so callers cannot widen scope by omission.
  return (["agentId", "principalId", "tenantId", "workspaceId"] as const).every(
    (key) => record.context[key] === context[key]
  );
}
const terminal = new Set(["completed", "failed", "aborted", "closed"]);
export class InMemoryHarnessStore implements HarnessStore {
  readonly #runs = new Map<
    string,
    {
      record: RunRecord;
      events: HarnessEvent[];
      keys: Set<string>;
    }
  >();
  readonly #now: () => number;
  /**
   * Creates the reference run store with an injectable deterministic clock.
   * @param now - Injectable clock used for deterministic timestamps.
   */
  constructor(now: () => number = Date.now) {
    // Use one clock for leases and event timestamps.
    this.#now = now;
  }
  /**
   * Inserts one unique pending run without claiming it.
   * @param request - Request values required by the operation.
   * @returns A promise that resolves when the operation completes.
   * @throws When validation, persistence, policy, or the delegated operation fails.
   */
  async create(request: AgentRequest): Promise<void> {
    // Duplicate run IDs are rejected before any state is replaced.
    if (this.#runs.has(request.runId))
      throw new AgenticError(
        "INVALID_REQUEST",
        `Duplicate run: ${request.runId}`
      );
    this.#runs.set(request.runId, {
      record: {
        runId: request.runId,
        input: request.input,
        context: request.context,
        status: "pending",
        version: 0,
      },
      events: [],
      keys: new Set(),
    });
  }
  /**
   * Atomically acquires or reclaims a scoped writer lease.
   * @param runId - Stable identifier of the agent run.
   * @param context - Authenticated execution context for the operation.
   * @param workerId - Identifier of the worker requesting the lease.
   * @param leaseMs - Writer lease duration in milliseconds.
   * @returns A promise that resolves with the operation result.
   */
  async claim(
    runId: string,
    context: ExecutionContext,
    workerId: string,
    leaseMs: number
  ): Promise<boolean> {
    // Terminal runs, wrong owners, and another live worker all fail closed.
    const item = this.#runs.get(runId);
    if (
      !item ||
      !owns(item.record, context) ||
      terminal.has(item.record.status)
    )
      return false;
    if (
      item.record.lease &&
      item.record.lease.workerId !== workerId &&
      item.record.lease.expiresAt > this.#now()
    )
      return false;
    item.record.lease = {
      workerId,
      expiresAt: this.#now() + Math.max(1, leaseMs),
    };
    item.record.status = "running";
    return true;
  }
  /**
   * Extends a lease only for its current worker and non-terminal run.
   * @param runId - Stable identifier of the agent run.
   * @param workerId - Identifier of the worker requesting the lease.
   * @param leaseMs - Writer lease duration in milliseconds.
   * @returns A promise that resolves with the operation result.
   */
  async renewLease(
    runId: string,
    workerId: string,
    leaseMs: number
  ): Promise<boolean> {
    // Renewal never changes ownership or revives terminal state.
    const item = this.#runs.get(runId);
    if (
      !item?.record.lease ||
      item.record.lease.workerId !== workerId ||
      terminal.has(item.record.status)
    )
      return false;
    item.record.lease.expiresAt = this.#now() + Math.max(1, leaseMs);
    return true;
  }
  /**
   * Releases a worker's lease and returns a running record to pending admission.
   * @param runId - Stable identifier of the agent run.
   * @param workerId - Identifier of the worker requesting the lease.
   * @returns A promise that resolves when the operation completes.
   */
  async releaseLease(runId: string, workerId: string): Promise<void> {
    // A stale worker cannot release a newer worker's lease.
    const item = this.#runs.get(runId);
    if (item?.record.lease?.workerId === workerId) {
      item.record.lease = undefined;
      if (item.record.status === "running") item.record.status = "pending";
    }
  }
  /**
   * Appends a batch with monotonic sequence, optimistic version, and idempotency keys.
   * @param runId - Stable identifier of the agent run.
   * @param expectedVersion - Optimistic version required for the write.
   * @param inputs - Ordered inputs required by the operation.
   * @returns A promise that resolves with the operation result.
   */
  async append(
    runId: string,
    expectedVersion: number,
    inputs: HarnessEventInput[]
  ): Promise<{
    version: number;
  }> {
    // Reuse the same commit path without changing terminal run state.
    return this.#commit(runId, expectedVersion, inputs);
  }
  /**
   * Atomically appends terminal events, changes status, and releases the writer lease.
   * @param runId - Stable identifier of the agent run.
   * @param expectedVersion - Optimistic version required for the write.
   * @param inputs - Ordered inputs required by the operation.
   * @param status - Terminal or lifecycle status to persist.
   * @returns A promise that resolves with the operation result.
   */
  async settle(
    runId: string,
    expectedVersion: number,
    inputs: HarnessEventInput[],
    status:
      | Exclude<
          AgentResult["status"],
          "completed" | "needs_input" | "suspended"
        >
      | "closed"
  ): Promise<{
    version: number;
  }> {
    // The reference store commits events and terminal state in one synchronous critical section.
    return this.#commit(runId, expectedVersion, inputs, status);
  }
  /**
   * Commits one validated event batch and optional terminal transition without an await boundary.
   * @param runId - Stable identifier of the agent run.
   * @param expectedVersion - Optimistic version required for the write.
   * @param inputs - Ordered inputs required by the operation.
   * @param status - Terminal or lifecycle status to persist.
   * @returns The #commit result produced for the current operation.
   * @throws When validation, persistence, policy, or the delegated operation fails.
   */
  #commit(
    runId: string,
    expectedVersion: number,
    inputs: HarnessEventInput[],
    status?:
      | Exclude<
          AgentResult["status"],
          "completed" | "needs_input" | "suspended"
        >
      | "closed"
  ): {
    version: number;
  } {
    // Remove previously committed logical events before checking the caller's expected version.
    const item = this.#runs.get(runId);
    if (!item)
      throw new AgenticError("INVOCATION_NOT_FOUND", `Run not found: ${runId}`);
    const pending = inputs.filter(
      ({ idempotencyKey }) => !idempotencyKey || !item.keys.has(idempotencyKey)
    );
    if (terminal.has(item.record.status)) {
      if (status === item.record.status && pending.length === 0)
        return { version: item.record.version };
      throw new AgenticError("CLOSED", `Run is terminal: ${runId}`);
    }
    if (pending.length === 0) return { version: item.record.version };
    if (item.record.version !== expectedVersion)
      throw new AgenticError("VERSION_CONFLICT", "Run version changed.", true);
    try {
      JSON.stringify(pending);
    } catch {
      throw new AgenticError(
        "INVALID_REQUEST",
        "Run events must contain JSON-serializable data."
      );
    }
    const next = pending.map((input, index) => ({
      ...structuredClone(input),
      runId,
      sequence: item.record.version + index + 1,
      timestamp: this.#now(),
    }));
    reduceHarnessEvents(item.record, [...item.events, ...next]);
    for (const event of next) {
      item.record.version = event.sequence;
      item.events.push(event);
      const input = event;
      if (input.idempotencyKey) item.keys.add(input.idempotencyKey);
    }
    if (status) {
      item.record.status = status;
      item.record.lease = undefined;
    }
    return { version: item.record.version };
  }
  /**
   * Returns detached run and event snapshots for deterministic replay.
   * @param runId - Stable identifier of the agent run.
   * @returns A promise that resolves with the operation result.
   */
  async load(runId: string): Promise<
    | {
        record: RunRecord;
        events: HarnessEvent[];
      }
    | undefined
  > {
    // Copy the projection inputs so test or host code cannot mutate stored history.
    const item = this.#runs.get(runId);
    return item
      ? {
          record: { ...item.record },
          events: item.events.map((event) => ({ ...event })),
        }
      : undefined;
  }
  /**
   * Marks a run terminal and clears its active writer lease.
   * @param runId - Stable identifier of the agent run.
   * @param status - Terminal or lifecycle status to persist.
   * @returns A promise that resolves when the operation completes.
   * @throws When validation, persistence, policy, or the delegated operation fails.
   */
  async close(
    runId: string,
    status: AgentResult["status"] | "closed"
  ): Promise<void> {
    // Closing never invents an event; callers persist lifecycle intent separately.
    const item = this.#runs.get(runId);
    if (!item)
      throw new AgenticError("INVOCATION_NOT_FOUND", `Run not found: ${runId}`);
    item.record.status = status;
    item.record.lease = undefined;
  }
}
