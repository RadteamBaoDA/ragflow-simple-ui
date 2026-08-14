import { AgenticError } from "./errors.ts";
import type { HarnessEvent, HarnessState, RunRecord } from "./harness-types.ts";
/**
 * Throws the typed failure used for malformed durable run logs.
 * @param message - Human-readable error or transcript message.
 * @returns The corrupt result produced for the current operation.
 * @throws When validation, persistence, policy, or the delegated operation fails.
 */
const corrupt = (message: string): never => {
  // Invalid effect history is never silently repaired or skipped.
  throw new AgenticError("STORAGE_CORRUPTION", message);
};
/**
 * Reconstructs recoverable run state solely from the durable event stream.
 * @param record - Durable record used as the replay base.
 * @param events - Ordered durable events to append atomically.
 * @returns The created or normalized operation result.
 */
export function reduceHarnessEvents(
  record: RunRecord,
  events: readonly HarnessEvent[]
): HarnessState {
  // Sort a copy by sequence so caller array order cannot change the projection.
  const state: HarnessState = {
    runId: record.runId,
    status: record.status,
    history: [],
    turns: 0,
    toolCalls: 0,
    skillSnapshot: [],
    toolEffects: {},
    providerEffects: {},
    compactionEffects: {},
    queues: {},
    usage: {},
  };
  let expectedSequence = 1;
  for (const event of [...events].sort((a, b) => a.sequence - b.sequence)) {
    if (event.sequence !== expectedSequence++)
      corrupt("Run event sequence is not contiguous.");
    if (event.type === "turn_started") state.turns += 1;
    if (event.type === "skills_selected") {
      const skills = event.data.skills;
      if (!Array.isArray(skills)) corrupt("Invalid durable skill snapshot.");
      const snapshot = skills as unknown[];
      const identities = snapshot.map((skill: unknown) => {
        if (!skill || typeof skill !== "object")
          corrupt("Invalid durable skill snapshot.");
        const value = skill as Record<string, unknown>;
        const fields = [value.id, value.name, value.version, value.digest];
        if (fields.some((field) => typeof field !== "string" || !field.trim()))
          corrupt("Invalid durable skill snapshot.");
        return fields.join("\u0000");
      });
      if (new Set(identities).size !== identities.length)
        corrupt("Duplicate durable skill identity.");
      state.skillSnapshot = structuredClone(snapshot) as HarnessState["skillSnapshot"];
    }
    if (event.type === "tool_finished" || event.type === "tool_settled")
      state.toolCalls += 1;
    if (event.type === "provider_planned") {
      const stepId = String(event.data.stepId);
      if (!stepId || state.providerEffects[stepId])
        corrupt(`Invalid or duplicate provider step: ${stepId}`);
      state.providerEffects[stepId] = { stepId, attempts: {} };
    }
    if (event.type === "provider_started") {
      const stepId = String(event.data.stepId);
      const attempt = Number(event.data.attempt);
      const provider = state.providerEffects[stepId];
      if (
        !provider ||
        !Number.isInteger(attempt) ||
        attempt < 1 ||
        provider.attempts[attempt]
      )
        corrupt(`Provider attempt was not planned: ${stepId}:${attempt}`);
      provider.attempts[attempt] = {
        responseId: String(event.data.responseId),
        status: "started",
      };
    }
    if (
      event.type === "provider_settled" ||
      event.type === "provider_uncertain"
    ) {
      const stepId = String(event.data.stepId);
      const attempt = Number(event.data.attempt);
      const value = state.providerEffects[stepId]?.attempts[attempt];
      if (
        !value ||
        value.status !== "started" ||
        value.responseId !== String(event.data.responseId)
      )
        corrupt(`Provider attempt cannot settle: ${stepId}:${attempt}`);
      value.status =
        event.type === "provider_settled" ? "settled" : "uncertain";
    }
    if (event.type === "compaction_planned") {
      const stepId = String(event.data.stepId);
      if (!stepId || state.compactionEffects[stepId])
        corrupt(`Invalid or duplicate compaction step: ${stepId}`);
      state.compactionEffects[stepId] = { stepId, status: "planned" };
    }
    if (
      event.type === "compaction_started" ||
      event.type === "compaction_settled"
    ) {
      const effect = state.compactionEffects[String(event.data.stepId)];
      if (
        !effect ||
        (event.type === "compaction_started" && effect.status !== "planned") ||
        (event.type === "compaction_settled" && effect.status !== "started")
      ) {
        corrupt(
          `Compaction step cannot transition: ${String(event.data.stepId)}`
        );
      }
      effect.status =
        event.type === "compaction_started" ? "started" : "settled";
    }
    if (event.type === "tool_planned") {
      const effectId = String(event.data.effectId);
      if (!effectId || state.toolEffects[effectId])
        corrupt(`Invalid or duplicate tool effect: ${effectId}`);
      state.toolEffects[effectId] = {
        effectId,
        callId: String(event.data.callId),
        toolName: String(event.data.toolName),
        replay: event.data.replay === "safe" ? "safe" : "never",
        plannedResultId: String(event.data.plannedResultId),
        protectedArguments: event.data.protectedArguments,
        status: "planned",
      };
    }
    if (
      event.type === "tool_started" ||
      event.type === "tool_settled" ||
      event.type === "tool_uncertain"
    ) {
      const effect = state.toolEffects[String(event.data.effectId)];
      if (!effect)
        corrupt(`Tool effect was not planned: ${String(event.data.effectId)}`);
      if (event.type === "tool_started" && effect.status !== "planned")
        corrupt(`Tool effect cannot start: ${effect.effectId}`);
      if (event.type !== "tool_started" && effect.status !== "started")
        corrupt(`Tool effect cannot settle: ${effect.effectId}`);
      if (
        event.type === "tool_settled" &&
        String(event.data.resultId) !== effect.plannedResultId
      )
        corrupt(`Tool result ID changed: ${effect.effectId}`);
      effect.status =
        event.type === "tool_started"
          ? "started"
          : event.type === "tool_settled"
            ? "settled"
            : "uncertain";
    }
    if (
      event.type === "checkpoint_saved" ||
      event.type === "context_compacted"
    ) {
      const checkpoint = event.data.checkpoint as Partial<
        Pick<
          HarnessState,
          "history" | "turns" | "toolCalls" | "result" | "pendingExecution"
        >
      >;
      if (checkpoint.history) state.history = checkpoint.history;
      if (checkpoint.turns !== undefined) state.turns = checkpoint.turns;
      if (checkpoint.toolCalls !== undefined)
        state.toolCalls = checkpoint.toolCalls;
      if (checkpoint.result) state.result = checkpoint.result;
      state.pendingExecution = checkpoint.pendingExecution;
    }
    if (
      event.type === "approval_requested" ||
      event.type === "clarification_requested"
    ) {
      state.status = "needs_input";
      state.pending = {
        kind:
          event.type === "approval_requested" ? "approval" : "clarification",
        requestId: String(event.data.requestId),
        data: event.data,
      };
    }
    if (
      event.type === "approval_responded" ||
      event.type === "clarification_responded"
    ) {
      state.pending = undefined;
      state.status = "running";
    }
    if (event.type === "queue_enqueued") {
      const queueId = String(event.data.queueId);
      if (!queueId || state.queues[queueId] || !String(event.data.input).trim())
        corrupt(`Invalid queue item: ${queueId}`);
      state.queues[queueId] = {
        queueId,
        queue:
          event.data.queue === "steer" || event.data.queue === "followUp"
            ? event.data.queue
            : "nextRun",
        input: String(event.data.input),
        status: "enqueued",
        sequence: event.sequence,
      };
    }
    if (event.type === "queue_consumed" || event.type === "queue_cancelled") {
      const item = state.queues[String(event.data.queueId)];
      if (!item || item.status !== "enqueued")
        corrupt(`Queue item is not pending: ${String(event.data.queueId)}`);
      item.status = event.type === "queue_consumed" ? "consumed" : "cancelled";
    }
    if (event.type === "usage_recorded") {
      const usageId = String(event.data.usageId);
      const values = event.data.usage as Record<string, number>;
      const stepId = String(event.data.stepId);
      const attempt = Number(event.data.attempt);
      if (
        !usageId ||
        state.usage[usageId] ||
        state.providerEffects[stepId]?.attempts[attempt]?.status !==
          "settled" ||
        !values ||
        Object.values(values).some(
          (value) => !Number.isFinite(value) || value < 0
        )
      ) {
        corrupt(`Invalid usage record: ${usageId}`);
      }
      state.usage[usageId] = {
        stepId,
        attempt,
        values: structuredClone(values),
      };
    }
    if (event.type === "turn_completed") state.status = "idle";
    if (event.type === "run_suspended") state.status = "suspended";
    if (event.type === "run_completed") state.status = "completed";
    if (event.type === "run_failed") state.status = "failed";
    if (event.type === "run_aborted") state.status = "aborted";
    if (event.type === "run_closed") state.status = "closed";
  }
  return state;
}
