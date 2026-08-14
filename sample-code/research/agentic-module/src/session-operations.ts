import { AgenticError } from "./errors.ts";
import {
  projectSession,
  type SessionConfiguration,
  type SessionProjection,
  type SessionStore,
} from "./durable-session.ts";
export type SessionOperationEnvelope<T> =
  | {
      ok: true;
      value: T;
    }
  | {
      ok: false;
      error: {
        code: string;
        message: string;
        retryable: boolean;
      };
    };
type IdFactory = () => string;
/**
 * Validates every referenced identity before atomically replacing a lane's total configuration.
 * @param input - Validated input required by the operation.
 * @returns A promise that resolves with the operation result.
 */
export async function setSessionConfiguration(input: {
  store: SessionStore;
  sessionId: string;
  lane: string;
  configuration: SessionConfiguration;
  resolveModel: (model: SessionConfiguration["model"]) => Promise<boolean>;
  resolveTool: (name: string) => Promise<boolean>;
}): Promise<
  SessionOperationEnvelope<{
    configuration: SessionConfiguration;
  }>
> {
  // Reject malformed or unresolved identities before the single durable append.
  const loaded = await input.store.load(input.sessionId);
  if (!loaded)
    return rejected("not_found", `Session not found: ${input.sessionId}`);
  let state: SessionProjection;
  try {
    state = projectSession(loaded.record, loaded.mutations);
  } catch (error) {
    return rejectedError(error);
  }
  const lane = state.lanes[input.lane];
  if (!lane) return rejected("not_found", `Lane not found: ${input.lane}`);
  if (lane.openOperationId)
    return rejected("lane_busy", `Lane is busy: ${input.lane}`);
  const { model, activeToolNames } = input.configuration;
  if (
    !model.provider.trim() ||
    !model.model.trim() ||
    activeToolNames.some((name) => !name.trim()) ||
    new Set(activeToolNames).size !== activeToolNames.length
  ) {
    return rejected(
      "invalid_input",
      "Configuration requires a model and unique non-empty tool names."
    );
  }
  try {
    const [modelExists, ...toolExists] = await Promise.all([
      input.resolveModel(model),
      ...activeToolNames.map((name) => input.resolveTool(name)),
    ]);
    if (!modelExists || toolExists.some((exists) => !exists)) {
      return rejected(
        "missing_identity",
        "Configuration references a missing model or tool."
      );
    }
    await input.store.append(input.sessionId, loaded.record.version, [
      {
        type: "configuration_set",
        lane: input.lane,
        configuration: structuredClone(input.configuration),
      },
    ]);
    return {
      ok: true,
      value: { configuration: structuredClone(input.configuration) },
    };
  } catch (error) {
    return rejectedError(error);
  }
}
/**
 * Returns the root-to-leaf path and rejects malformed parent cycles.
 * @param state - Current projected state used by the operation.
 * @param leafId - Transcript leaf whose ancestry is requested.
 * @returns The resulting serialized string.
 * @throws When validation, persistence, policy, or the delegated operation fails.
 */
export function sessionBranchPath(
  state: SessionProjection,
  leafId: string | null
): string[] {
  // Walk immutable parent links backwards, then reverse once for deterministic source order.
  const reversed: string[] = [];
  const visited = new Set<string>();
  let current = leafId;
  while (current !== null) {
    if (visited.has(current))
      throw new AgenticError(
        "STORAGE_CORRUPTION",
        "Transcript contains a parent cycle."
      );
    const entry = state.entries[current];
    if (!entry)
      throw new AgenticError(
        "STORAGE_CORRUPTION",
        `Missing branch entry: ${current}`
      );
    visited.add(current);
    reversed.push(current);
    current = entry.parentId;
  }
  return reversed.reverse();
}
/**
 * Finds the nearest shared ancestor of two transcript leaves.
 * @param state - Current projected state used by the operation.
 * @param leftId - Leaf identifier for the left branch.
 * @param rightId - Leaf identifier for the right branch.
 * @returns The resulting serialized string.
 */
export function sessionCommonAncestor(
  state: SessionProjection,
  leftId: string | null,
  rightId: string | null
): string | null {
  // Compare root-first paths until the branches diverge.
  const left = sessionBranchPath(state, leftId);
  const right = sessionBranchPath(state, rightId);
  let common: string | null = null;
  for (
    let index = 0;
    index < Math.min(left.length, right.length) && left[index] === right[index];
    index += 1
  )
    common = left[index];
  return common;
}
/**
 * Forks immutable anchor ancestry into a newly identified child session.
 * @param input - Validated input required by the operation.
 * @returns A promise that resolves with the operation result.
 */
export async function forkSession(input: {
  store: SessionStore;
  sourceSessionId: string;
  targetSessionId: string;
  anchorId: string | null;
}): Promise<
  SessionOperationEnvelope<{
    sessionId: string;
    leafId: string | null;
  }>
> {
  // Validate the complete source projection and anchor before creating the target session.
  const source = await input.store.load(input.sourceSessionId);
  if (!source)
    return rejected("not_found", `Session not found: ${input.sourceSessionId}`);
  let state: SessionProjection;
  try {
    state = projectSession(source.record, source.mutations);
  } catch (error) {
    return rejectedError(error);
  }
  if (input.anchorId !== null && !state.entries[input.anchorId])
    return rejected("not_found", `Entry not found: ${input.anchorId}`);
  const path = sessionBranchPath(state, input.anchorId);
  try {
    // Create first, then append ancestry as one atomic target-session batch.
    await input.store.create({
      sessionId: input.targetSessionId,
      parentSessionId: input.sourceSessionId,
      seedConfiguration: source.record.seedConfiguration,
    });
    if (path.length)
      await input.store.append(input.targetSessionId, 0, [
        ...path.map((entryId) => ({
          type: "entry_added" as const,
          entry: {
            id: state.entries[entryId].id,
            parentId: state.entries[entryId].parentId,
            kind: state.entries[entryId].kind,
            data: structuredClone(state.entries[entryId].data),
          },
        })),
        { type: "lane_moved", lane: "main", leafId: input.anchorId },
      ]);
    return {
      ok: true,
      value: { sessionId: input.targetSessionId, leafId: input.anchorId },
    };
  } catch (error) {
    return rejectedError(error);
  }
}
/**
 * Navigates a lane with an optional branch-summary effect and atomic label settlement.
 * @param input - Validated input required by the operation.
 * @returns A promise that resolves with the operation result.
 * @throws When validation, persistence, policy, or the delegated operation fails.
 */
export async function navigateSession(input: {
  store: SessionStore;
  sessionId: string;
  lane: string;
  targetId: string | null;
  label?: string;
  summarize?: (input: {
    abandonedEntryIds: string[];
    commonAncestorId: string | null;
  }) => Promise<string>;
  ids?: IdFactory;
}): Promise<
  SessionOperationEnvelope<{
    operationId: string;
    newLeafId: string | null;
    summaryEntryId?: string;
  }>
> {
  // Validate every target before writing intent or invoking a summary provider.
  const loaded = await input.store.load(input.sessionId);
  if (!loaded)
    return rejected("not_found", `Session not found: ${input.sessionId}`);
  let state: SessionProjection;
  try {
    state = projectSession(loaded.record, loaded.mutations);
  } catch (error) {
    return rejectedError(error);
  }
  const lane = state.lanes[input.lane];
  if (!lane) return rejected("not_found", `Lane not found: ${input.lane}`);
  if (lane.openOperationId)
    return rejected("lane_busy", `Lane is busy: ${input.lane}`);
  if (input.targetId !== null && !state.entries[input.targetId])
    return rejected("not_found", `Entry not found: ${input.targetId}`);
  if (lane.leafId === input.targetId)
    return rejected(
      "invalid_input",
      "Navigation target is already the lane leaf."
    );
  if (
    input.label &&
    (input.targetId === null || state.entries[input.targetId].parentId === null)
  ) {
    return rejected(
      "invalid_input",
      "A root navigation target cannot receive a label."
    );
  }
  const id = input.ids ?? (() => crypto.randomUUID());
  const operationId = id();
  const commonAncestorId = sessionCommonAncestor(
    state,
    lane.leafId,
    input.targetId
  );
  const currentPath = sessionBranchPath(state, lane.leafId);
  const commonIndex =
    commonAncestorId === null ? -1 : currentPath.indexOf(commonAncestorId);
  const abandonedEntryIds = currentPath.slice(commonIndex + 1);
  if (!input.summarize) {
    // A no-summary navigation has no external effect, so admission and settlement are one atomic batch.
    const mutations = [
      {
        type: "operation_started" as const,
        operationId,
        lane: input.lane,
        kind: "navigate" as const,
        configuration: lane.configuration,
      },
      { type: "lane_moved" as const, lane: input.lane, leafId: input.targetId },
      ...(input.label
        ? [
            {
              type: "fact_set" as const,
              name: "label" as const,
              entryId: input.targetId!,
              value: input.label,
            },
          ]
        : []),
      {
        type: "operation_finished" as const,
        operationId,
        outcome: "completed" as const,
      },
    ];
    try {
      await input.store.append(
        input.sessionId,
        loaded.record.version,
        mutations
      );
      return { ok: true, value: { operationId, newLeafId: input.targetId } };
    } catch (error) {
      return rejectedError(error);
    }
  }
  const stepId = id();
  const effectId = id();
  const resultId = id();
  let plannedVersion: number | undefined;
  let settlementStarted = false;
  try {
    // Persist the complete summary-effect intent before crossing the external boundary.
    const planned = await input.store.append(
      input.sessionId,
      loaded.record.version,
      [
        {
          type: "operation_started",
          operationId,
          lane: input.lane,
          kind: "navigate",
          configuration: lane.configuration,
        },
        {
          type: "effect_planned",
          operationId,
          stepId,
          effectId,
          effectKind: "provider",
          replay: "never",
          plannedOutputId: resultId,
        },
        { type: "effect_started", operationId, stepId, effectId, attempt: 1 },
      ]
    );
    plannedVersion = planned.version;
    const summary = await input.summarize({
      abandonedEntryIds,
      commonAncestorId,
    });
    if (!summary.trim())
      throw new AgenticError(
        "INVALID_REQUEST",
        "Branch summary must not be empty."
      );
    const summaryEntryId = id();
    const finalMutations = [
      {
        type: "effect_settled" as const,
        operationId,
        stepId,
        effectId,
        outputId: resultId,
      },
      {
        type: "entry_added" as const,
        entry: {
          id: summaryEntryId,
          parentId: input.targetId,
          kind: "branch_summary" as const,
          data: { summary, abandonedEntryIds, commonAncestorId },
        },
      },
      { type: "lane_moved" as const, lane: input.lane, leafId: summaryEntryId },
      ...(input.label
        ? [
            {
              type: "fact_set" as const,
              name: "label" as const,
              entryId: summaryEntryId,
              value: input.label,
            },
          ]
        : []),
      {
        type: "operation_finished" as const,
        operationId,
        outcome: "completed" as const,
      },
    ];
    settlementStarted = true;
    await input.store.append(input.sessionId, planned.version, finalMutations);
    return {
      ok: true,
      value: { operationId, newLeafId: summaryEntryId, summaryEntryId },
    };
  } catch (error) {
    if (plannedVersion !== undefined && !settlementStarted) {
      try {
        await input.store.append(input.sessionId, plannedVersion, [
          {
            type: "effect_settled",
            operationId,
            stepId,
            effectId,
            outputId: resultId,
          },
          { type: "operation_finished", operationId, outcome: "failed" },
        ]);
      } catch (settlementError) {
        return rejectedError(settlementError);
      }
    }
    return rejectedError(error);
  }
}
/**
 * Compacts a lane through a planned summary effect and retains the requested tail.
 * @param input - Validated input required by the operation.
 * @returns A promise that resolves with the operation result.
 * @throws When validation, persistence, policy, or the delegated operation fails.
 */
export async function compactSession(input: {
  store: SessionStore;
  sessionId: string;
  lane: string;
  retainedTailCount: number;
  tokensBefore: number;
  summarize: (input: {
    compactedEntryIds: string[];
    retainedEntryIds: string[];
  }) => Promise<string>;
  ids?: IdFactory;
}): Promise<
  SessionOperationEnvelope<{
    operationId: string;
    entryId: string;
  }>
> {
  // Select a reproducible root-to-leaf split before writing or summarizing.
  const loaded = await input.store.load(input.sessionId);
  if (!loaded)
    return rejected("not_found", `Session not found: ${input.sessionId}`);
  let state: SessionProjection;
  try {
    state = projectSession(loaded.record, loaded.mutations);
  } catch (error) {
    return rejectedError(error);
  }
  const lane = state.lanes[input.lane];
  if (!lane) return rejected("not_found", `Lane not found: ${input.lane}`);
  if (lane.openOperationId)
    return rejected("lane_busy", `Lane is busy: ${input.lane}`);
  const path = sessionBranchPath(state, lane.leafId);
  const tailCount = Math.max(0, Math.trunc(input.retainedTailCount));
  if (path.length <= tailCount)
    return rejected("nothing_to_compact", "Lane has no compactable history.");
  let split = path.length - tailCount;
  for (let index = split; index < path.length; index += 1) {
    const entry = state.entries[path[index]];
    if (entry.kind !== "tool") continue;
    const callId =
      typeof entry.data.toolCallId === "string"
        ? entry.data.toolCallId
        : undefined;
    if (!callId)
      return rejected(
        "invalid_input",
        `Tool entry has no call ID: ${entry.id}`
      );
    let callIndex = -1;
    for (
      let candidateIndex = index - 1;
      candidateIndex >= 0;
      candidateIndex -= 1
    ) {
      const candidate = state.entries[path[candidateIndex]];
      if (
        candidate.kind === "assistant" &&
        Array.isArray(candidate.data.toolCalls) &&
        (
          candidate.data.toolCalls as Array<{
            callId?: unknown;
          }>
        ).some((call) => call.callId === callId)
      ) {
        callIndex = candidateIndex;
        break;
      }
    }
    if (callIndex < 0)
      return rejected(
        "invalid_input",
        `Tool entry has no matching assistant call: ${entry.id}`
      );
    split = Math.min(split, callIndex);
  }
  if (split === 0)
    return rejected(
      "nothing_to_compact",
      "Tool protocol leaves no compactable history."
    );
  const compactedEntryIds = path.slice(0, split);
  const retainedEntryIds = path.slice(split);
  const id = input.ids ?? (() => crypto.randomUUID());
  const operationId = id();
  const stepId = id();
  const effectId = id();
  const resultId = id();
  let plannedVersion: number | undefined;
  let settlementStarted = false;
  try {
    // Commit structural intent and the started marker before calling the summarizer.
    const planned = await input.store.append(
      input.sessionId,
      loaded.record.version,
      [
        {
          type: "operation_started",
          operationId,
          lane: input.lane,
          kind: "compact",
          configuration: lane.configuration,
        },
        {
          type: "effect_planned",
          operationId,
          stepId,
          effectId,
          effectKind: "provider",
          replay: "never",
          plannedOutputId: resultId,
        },
        { type: "effect_started", operationId, stepId, effectId, attempt: 1 },
      ]
    );
    plannedVersion = planned.version;
    const summary = await input.summarize({
      compactedEntryIds,
      retainedEntryIds,
    });
    if (!summary.trim())
      throw new AgenticError(
        "INVALID_REQUEST",
        "Compaction summary must not be empty."
      );
    const entryId = id();
    settlementStarted = true;
    await input.store.append(input.sessionId, planned.version, [
      {
        type: "effect_settled",
        operationId,
        stepId,
        effectId,
        outputId: resultId,
      },
      {
        type: "entry_added",
        entry: {
          id: entryId,
          parentId: lane.leafId,
          kind: "compaction",
          data: {
            summary,
            compactedEntryIds,
            retainedEntryIds,
            tokensBefore: input.tokensBefore,
          },
        },
      },
      { type: "lane_moved", lane: input.lane, leafId: entryId },
      { type: "operation_finished", operationId, outcome: "completed" },
    ]);
    return { ok: true, value: { operationId, entryId } };
  } catch (error) {
    if (plannedVersion !== undefined && !settlementStarted) {
      try {
        await input.store.append(input.sessionId, plannedVersion, [
          {
            type: "effect_settled",
            operationId,
            stepId,
            effectId,
            outputId: resultId,
          },
          { type: "operation_finished", operationId, outcome: "failed" },
        ]);
      } catch (settlementError) {
        return rejectedError(settlementError);
      }
    }
    return rejectedError(error);
  }
}
/**
 * Creates a typed expected-rejection envelope without throwing.
 * @param code - Machine-readable error code for the failure.
 * @param message - Human-readable error or transcript message.
 * @param retryable - Whether the caller may safely retry the failure.
 * @returns The rejected result produced for the current operation.
 */
function rejected<T>(
  code: string,
  message: string,
  retryable = false
): SessionOperationEnvelope<T> {
  // Public workflow rejections are data; exceptions remain reserved for invariant bugs.
  return { ok: false, error: { code, message, retryable } };
}
/**
 * Normalizes storage and validation failures into the public operation contract.
 * @param error - Unknown failure value to normalize.
 * @returns The rejectedError result produced for the current operation.
 */
function rejectedError<T>(error: unknown): SessionOperationEnvelope<T> {
  // Preserve typed AgenticError details while hiding unexpected implementation internals.
  if (error instanceof AgenticError)
    return rejected(error.code.toLowerCase(), error.message, error.retryable);
  return rejected(
    "failed",
    error instanceof Error ? error.message : String(error)
  );
}
