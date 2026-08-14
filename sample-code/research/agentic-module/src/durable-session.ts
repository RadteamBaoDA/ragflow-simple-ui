import { AgenticError } from "./errors.ts";
export type SessionConfiguration = {
  model: {
    provider: string;
    model: string;
  };
  thinkingLevel: "off" | "low" | "medium" | "high" | "max";
  activeToolNames: string[];
};
export type TranscriptEntryInput = {
  id: string;
  parentId: string | null;
  kind:
    | "user"
    | "assistant"
    | "tool"
    | "configuration"
    | "compaction"
    | "branch_summary"
    | "custom";
  data: Record<string, unknown>;
};
export type SessionMutationInput =
  | {
      type: "entry_added";
      entry: TranscriptEntryInput;
    }
  | {
      type: "lane_created";
      lane: string;
      anchorId: string | null;
    }
  | {
      type: "lane_moved";
      lane: string;
      leafId: string | null;
    }
  | {
      type: "operation_started";
      operationId: string;
      lane: string;
      kind: "run" | "compact" | "navigate";
      configuration: SessionConfiguration;
    }
  | {
      type: "operation_finished";
      operationId: string;
      outcome: "completed" | "failed" | "aborted" | "declined";
    }
  | {
      type: "effect_planned";
      operationId: string;
      stepId: string;
      effectId: string;
      effectKind: "provider" | "tool" | "hook" | "timer" | "deferred_poll";
      replay: "safe" | "never";
      plannedOutputId: string;
    }
  | {
      type: "effect_started";
      operationId: string;
      stepId: string;
      effectId: string;
      attempt: number;
    }
  | {
      type: "effect_settled";
      operationId: string;
      stepId: string;
      effectId: string;
      outputId: string;
    }
  | {
      type: "effect_uncertain";
      operationId: string;
      stepId: string;
      effectId: string;
      reason: string;
    }
  | {
      type: "queue_enqueued";
      queueId: string;
      lane: string;
      queue: "steer" | "followUp" | "nextRun";
      content: string;
    }
  | {
      type: "queue_consumed";
      queueId: string;
    }
  | {
      type: "queue_cancelled";
      queueId: string;
    }
  | {
      type: "configuration_set";
      lane: string;
      configuration: SessionConfiguration;
    }
  | {
      type: "fact_set";
      name: "session_name" | "label";
      value: string;
      entryId?: string;
    }
  | {
      type: "usage_recorded";
      usageId: string;
      operationId?: string;
      inputTokens: number;
      outputTokens: number;
      reasoningTokens?: number;
      cost?: number;
    }
  | {
      type: "session_closed";
    };
export type SessionMutation = SessionMutationInput & {
  sequence: number;
  timestamp: number;
};
export type SessionRecord = {
  sessionId: string;
  createdAt: number;
  parentSessionId?: string;
  version: number;
  seedConfiguration: SessionConfiguration;
};
export type SessionProjection = {
  entries: Record<
    string,
    TranscriptEntryInput & {
      sequence: number;
      timestamp: number;
    }
  >;
  lanes: Record<
    string,
    {
      leafId: string | null;
      openOperationId?: string;
      configuration: SessionConfiguration;
    }
  >;
  operations: Record<
    string,
    {
      lane: string;
      kind: "run" | "compact" | "navigate";
      outcome?: "completed" | "failed" | "aborted" | "declined";
    }
  >;
  effects: Record<
    string,
    {
      operationId: string;
      stepId: string;
      replay: "safe" | "never";
      plannedOutputId: string;
      status: "planned" | "started" | "settled" | "uncertain";
      attempt?: number;
    }
  >;
  queues: Record<
    string,
    {
      lane: string;
      queue: "steer" | "followUp" | "nextRun";
      content: string;
      status: "enqueued" | "consumed" | "cancelled";
    }
  >;
  facts: Record<
    string,
    {
      value: string;
      entryId?: string;
    }
  >;
  usage: Record<
    string,
    {
      operationId?: string;
      inputTokens: number;
      outputTokens: number;
      reasoningTokens: number;
      cost: number;
    }
  >;
  closed: boolean;
};
export interface SessionStore {
  /**
   * Creates a new durable resource.
   * @param input - Validated input required by the operation.
   * @returns A promise that resolves when the operation completes.
   */
  create(input: {
    sessionId: string;
    seedConfiguration: SessionConfiguration;
    parentSessionId?: string;
  }): Promise<void>;
  /**
   * Loads the requested durable value.
   * @param sessionId - Stable identifier of the durable session.
   * @returns A promise that resolves with the operation result.
   */
  load(sessionId: string): Promise<
    | {
        record: SessionRecord;
        mutations: SessionMutation[];
      }
    | undefined
  >;
  /**
   * Appends an optimistic batch to durable state.
   * @param sessionId - Stable identifier of the durable session.
   * @param expectedVersion - Optimistic version required for the write.
   * @param mutations - Ordered session mutations to validate or append.
   * @returns A promise that resolves with the operation result.
   */
  append(
    sessionId: string,
    expectedVersion: number,
    mutations: SessionMutationInput[]
  ): Promise<{
    version: number;
  }>;
}
/**
 * Throws the typed failure used for malformed durable logs.
 * @param message - Human-readable error or transcript message.
 * @returns The corrupt result produced for the current operation.
 * @throws When validation, persistence, policy, or the delegated operation fails.
 */
const corrupt = (message: string): never => {
  // Corruption is never auto-repaired because choosing a projection could hide data loss.
  throw new AgenticError("STORAGE_CORRUPTION", message);
};
/**
 * Replays an append-only session log while enforcing all tree, lane, and effect invariants.
 * @param record - Durable record used as the replay base.
 * @param mutations - Ordered session mutations to validate or append.
 * @returns The created or normalized operation result.
 * @throws When validation, persistence, policy, or the delegated operation fails.
 */
export function projectSession(
  record: SessionRecord,
  mutations: readonly SessionMutation[]
): SessionProjection {
  // Start only from immutable seed state; no mutable projection is trusted on reopen.
  const state: SessionProjection = {
    entries: {},
    lanes: {
      main: {
        leafId: null,
        configuration: structuredClone(record.seedConfiguration),
      },
    },
    operations: {},
    effects: {},
    queues: {},
    facts: {},
    usage: {},
    closed: false,
  };
  let expectedSequence = 1;
  for (const mutation of mutations) {
    if (mutation.sequence !== expectedSequence++)
      corrupt("Session sequence is not contiguous.");
    if (state.closed && mutation.type !== "session_closed")
      throw new AgenticError("CLOSED", "Session is closed.");
    switch (mutation.type) {
      case "entry_added":
        if (state.entries[mutation.entry.id])
          corrupt(`Duplicate entry: ${mutation.entry.id}`);
        if (
          mutation.entry.parentId !== null &&
          !state.entries[mutation.entry.parentId]
        )
          corrupt(`Missing parent: ${mutation.entry.parentId}`);
        state.entries[mutation.entry.id] = {
          ...structuredClone(mutation.entry),
          sequence: mutation.sequence,
          timestamp: mutation.timestamp,
        };
        break;
      case "lane_created":
        if (!mutation.lane.trim() || state.lanes[mutation.lane])
          corrupt(`Invalid or duplicate lane: ${mutation.lane}`);
        if (mutation.anchorId !== null && !state.entries[mutation.anchorId])
          corrupt(`Missing lane anchor: ${mutation.anchorId}`);
        state.lanes[mutation.lane] = {
          leafId: mutation.anchorId,
          configuration: structuredClone(record.seedConfiguration),
        };
        break;
      case "lane_moved": {
        const lane = state.lanes[mutation.lane];
        if (!lane) corrupt(`Missing lane: ${mutation.lane}`);
        if (mutation.leafId !== null && !state.entries[mutation.leafId])
          corrupt(`Missing lane target: ${mutation.leafId}`);
        lane.leafId = mutation.leafId;
        break;
      }
      case "operation_started": {
        const lane = state.lanes[mutation.lane];
        if (!lane) corrupt(`Missing lane: ${mutation.lane}`);
        if (lane.openOperationId)
          throw new AgenticError("LANE_BUSY", `Lane is busy: ${mutation.lane}`);
        if (state.operations[mutation.operationId])
          corrupt(`Duplicate operation: ${mutation.operationId}`);
        state.operations[mutation.operationId] = {
          lane: mutation.lane,
          kind: mutation.kind,
        };
        lane.openOperationId = mutation.operationId;
        lane.configuration = structuredClone(mutation.configuration);
        break;
      }
      case "operation_finished": {
        const operation = state.operations[mutation.operationId];
        if (!operation || operation.outcome)
          corrupt(`Operation is not open: ${mutation.operationId}`);
        operation.outcome = mutation.outcome;
        delete state.lanes[operation.lane].openOperationId;
        break;
      }
      case "effect_planned": {
        const operation = state.operations[mutation.operationId];
        if (!operation || operation.outcome)
          corrupt(`Effect operation is not open: ${mutation.operationId}`);
        if (state.effects[mutation.effectId])
          corrupt(`Duplicate effect: ${mutation.effectId}`);
        state.effects[mutation.effectId] = {
          operationId: mutation.operationId,
          stepId: mutation.stepId,
          replay: mutation.replay,
          plannedOutputId: mutation.plannedOutputId,
          status: "planned",
        };
        break;
      }
      case "effect_started": {
        const effect = state.effects[mutation.effectId];
        if (
          !effect ||
          effect.operationId !== mutation.operationId ||
          effect.stepId !== mutation.stepId ||
          effect.status !== "planned"
        ) {
          corrupt(`Effect was not planned: ${mutation.effectId}`);
        }
        if (!Number.isInteger(mutation.attempt) || mutation.attempt < 1)
          corrupt("Invalid effect attempt.");
        effect.status = "started";
        effect.attempt = mutation.attempt;
        break;
      }
      case "effect_settled": {
        const effect = state.effects[mutation.effectId];
        if (
          !effect ||
          effect.status !== "started" ||
          effect.plannedOutputId !== mutation.outputId
        )
          corrupt(`Invalid effect settlement: ${mutation.effectId}`);
        effect.status = "settled";
        break;
      }
      case "effect_uncertain": {
        const effect = state.effects[mutation.effectId];
        if (!effect || effect.status !== "started")
          corrupt(`Invalid uncertain effect: ${mutation.effectId}`);
        effect.status = "uncertain";
        break;
      }
      case "queue_enqueued": {
        const lane = state.lanes[mutation.lane];
        if (!lane || state.queues[mutation.queueId] || !mutation.content.trim())
          corrupt(`Invalid queue item: ${mutation.queueId}`);
        const operation = lane.openOperationId
          ? state.operations[lane.openOperationId]
          : undefined;
        if (mutation.queue !== "nextRun" && operation?.kind !== "run")
          corrupt(`${mutation.queue} requires an open run.`);
        state.queues[mutation.queueId] = {
          lane: mutation.lane,
          queue: mutation.queue,
          content: mutation.content,
          status: "enqueued",
        };
        break;
      }
      case "queue_consumed":
      case "queue_cancelled": {
        const item = state.queues[mutation.queueId];
        if (!item || item.status !== "enqueued")
          corrupt(`Queue item is not pending: ${mutation.queueId}`);
        item.status =
          mutation.type === "queue_consumed" ? "consumed" : "cancelled";
        break;
      }
      case "configuration_set": {
        const lane = state.lanes[mutation.lane];
        if (!lane) corrupt(`Missing lane: ${mutation.lane}`);
        if (
          !mutation.configuration.model.provider ||
          !mutation.configuration.model.model
        )
          corrupt("Invalid total configuration.");
        lane.configuration = structuredClone(mutation.configuration);
        break;
      }
      case "fact_set":
        if (!mutation.value.trim()) corrupt(`Invalid fact: ${mutation.name}`);
        if (
          mutation.name === "label" &&
          (!mutation.entryId || !state.entries[mutation.entryId])
        )
          corrupt("Label requires an existing non-root entry.");
        state.facts[
          mutation.name === "label"
            ? `label:${mutation.entryId}`
            : mutation.name
        ] = {
          value: mutation.value,
          entryId: mutation.entryId,
        };
        break;
      case "usage_recorded":
        if (
          state.usage[mutation.usageId] ||
          [
            mutation.inputTokens,
            mutation.outputTokens,
            mutation.reasoningTokens ?? 0,
            mutation.cost ?? 0,
          ].some((value) => value < 0)
        ) {
          corrupt(`Invalid usage: ${mutation.usageId}`);
        }
        state.usage[mutation.usageId] = {
          operationId: mutation.operationId,
          inputTokens: mutation.inputTokens,
          outputTokens: mutation.outputTokens,
          reasoningTokens: mutation.reasoningTokens ?? 0,
          cost: mutation.cost ?? 0,
        };
        break;
      case "session_closed":
        if (state.closed) corrupt("Session already closed.");
        state.closed = true;
        break;
    }
  }
  return state;
}
export class InMemorySessionStore implements SessionStore {
  readonly #sessions = new Map<
    string,
    {
      record: SessionRecord;
      mutations: SessionMutation[];
    }
  >();
  readonly #now: () => number;
  /**
   * Creates the deterministic memory backend used by tests and host-adapter conformance.
   * @param now - Injectable clock used for deterministic timestamps.
   */
  constructor(now: () => number = Date.now) {
    // Injecting time keeps sequence/timestamp assertions deterministic.
    this.#now = now;
  }
  /**
   * Creates a unique session with a main lane implied by its seed configuration.
   * @param input - Validated input required by the operation.
   * @returns A promise that resolves when the operation completes.
   * @throws When validation, persistence, policy, or the delegated operation fails.
   */
  async create(input: {
    sessionId: string;
    seedConfiguration: SessionConfiguration;
    parentSessionId?: string;
  }): Promise<void> {
    // Reject duplicate IDs before allocating durable state.
    if (this.#sessions.has(input.sessionId))
      throw new AgenticError(
        "INVALID_REQUEST",
        `Duplicate session: ${input.sessionId}`
      );
    this.#sessions.set(input.sessionId, {
      record: { ...structuredClone(input), createdAt: this.#now(), version: 0 },
      mutations: [],
    });
  }
  /**
   * Reopens a detached copy of the session record and its append-only mutations.
   * @param sessionId - Stable identifier of the durable session.
   * @returns A promise that resolves with the operation result.
   */
  async load(sessionId: string): Promise<
    | {
        record: SessionRecord;
        mutations: SessionMutation[];
      }
    | undefined
  > {
    // Structured cloning prevents consumers from mutating the stored source of truth.
    const value = this.#sessions.get(sessionId);
    return value ? structuredClone(value) : undefined;
  }
  /**
   * Atomically validates and appends a non-empty mutation batch under optimistic version control.
   * @param sessionId - Stable identifier of the durable session.
   * @param expectedVersion - Optimistic version required for the write.
   * @param inputs - Ordered inputs required by the operation.
   * @returns A promise that resolves with the operation result.
   * @throws When validation, persistence, policy, or the delegated operation fails.
   */
  async append(
    sessionId: string,
    expectedVersion: number,
    inputs: SessionMutationInput[]
  ): Promise<{
    version: number;
  }> {
    // Build and replay a prospective log before committing any item from the batch.
    const value = this.#sessions.get(sessionId);
    if (!value)
      throw new AgenticError(
        "INVOCATION_NOT_FOUND",
        `Session not found: ${sessionId}`
      );
    if (!inputs.length)
      throw new AgenticError(
        "INVALID_REQUEST",
        "Mutation batch must not be empty."
      );
    if (value.record.version !== expectedVersion)
      throw new AgenticError(
        "VERSION_CONFLICT",
        "Session version changed.",
        true
      );
    const next = inputs.map((input, index) => ({
      ...structuredClone(input),
      sequence: expectedVersion + index + 1,
      timestamp: this.#now(),
    })) as SessionMutation[];
    projectSession(value.record, [...value.mutations, ...next]);
    value.mutations.push(...next);
    value.record.version += next.length;
    return { version: value.record.version };
  }
}
