import { AgenticError } from "./errors.ts";
import { ActionDriver } from "./drive.ts";
import { reduceHarnessEvents } from "./reducer.ts";
import { createAgenticModule } from "./runtime.ts";
import { SKILL_INSTRUCTIONS_PREFIX } from "./skill-loading.ts";
import type { DurableInteractionManager } from "./interaction.ts";
import type { HarnessStore } from "./harness-store.ts";
import type { HarnessCheckpoint, HarnessEventInput } from "./harness-types.ts";
import { redactTelemetry, type TelemetrySpan } from "./telemetry.ts";
import type {
  AgentMessage,
  AgentRequest,
  AgentResult,
  AgenticModuleConfig,
  ApprovalResponse,
  ClarificationResponse,
  ExecutionContext,
  ProviderResponse,
} from "./types.ts";
export type AgentHarnessConfig = AgenticModuleConfig & {
  store: HarnessStore;
  workerId: string;
  leaseMs?: number;
  maxTurns?: number;
  maxAttempts?: number;
  modelIdentity?: {
    provider: string;
    model: string;
  };
  thinkingLevel?: "off" | "low" | "medium" | "high" | "max";
  interactionTimeoutMs?: number;
  interactions?: DurableInteractionManager;
  protectToolArguments?: (
    argumentsValue: unknown,
    context: ExecutionContext
  ) => unknown | Promise<unknown>;
  restoreToolArguments?: (
    protectedValue: unknown,
    context: ExecutionContext
  ) => unknown | Promise<unknown>;
  id?: () => string;
  driveMode?: "automatic" | "manual";
  now?: () => number;
  telemetry?: (span: TelemetrySpan) => void | Promise<void>;
};
/**
 * Creates a typed failed agent result.
 * @param runId - Stable identifier of the agent run.
 * @param code - Machine-readable error code for the failure.
 * @param message - Human-readable error or transcript message.
 * @returns The failure result produced for the current operation.
 */
const failure = (
  runId: string,
  code: string,
  message: string
): AgentResult => ({
  runId,
  status: "failed",
  citations: [],
  artifacts: [],
  error: { code, message, retryable: code === "VERSION_CONFLICT" },
});
/**
 * Compares the durable ownership dimensions used by every run mutation.
 * @param expected - Expected ownership context or state.
 * @param actual - Actual ownership context supplied by the caller.
 * @returns Whether the requested condition is satisfied.
 */
function ownsContext(
  expected: ExecutionContext,
  actual: ExecutionContext
): boolean {
  // UUID possession is never authorization; every populated scope must match.
  return (["agentId", "principalId", "tenantId", "workspaceId"] as const).every(
    (key) => expected[key] === actual[key]
  );
}
/**
 * Replaces raw tool arguments with their protected durable representation.
 * @param history - Ordered agent transcript used by the operation.
 * @param protectedArguments - Protected tool arguments indexed by call identifier.
 * @returns The protectCheckpointHistory result produced for the current operation.
 */
function protectCheckpointHistory(
  history: AgentMessage[],
  protectedArguments: ReadonlyMap<string, unknown>
): AgentMessage[] {
  // Clone every message so durable sanitization never mutates the active provider transcript.
  return history
    .filter(
      ({ role, content }) =>
        role !== "system" || !content.startsWith(SKILL_INSTRUCTIONS_PREFIX)
    )
    .map((message) => ({
      ...structuredClone(message),
      attachments: message.attachments?.map(({ data, ...attachment }) =>
        data === undefined
          ? structuredClone(attachment)
          : { ...structuredClone(attachment), data: "[REDACTED]" }
      ),
      toolCalls: message.toolCalls?.map((call) => ({
        ...call,
        arguments: structuredClone(
          protectedArguments.get(call.callId) ?? "[REDACTED]"
        ),
      })),
    }));
}
/**
 * Protects the suspended tool call embedded in a durable interaction checkpoint.
 * @param pending - Pending execution state to protect or resume.
 * @param protectedArguments - Protected tool arguments indexed by call identifier.
 * @returns The protectPendingExecution result produced for the current operation.
 */
function protectPendingExecution(
  pending: HarnessCheckpoint["pendingExecution"],
  protectedArguments: ReadonlyMap<string, unknown>
): HarnessCheckpoint["pendingExecution"] {
  // Preserve correlation metadata while replacing the raw call arguments.
  return pending
    ? {
        ...structuredClone(pending),
        call: {
          ...structuredClone(pending.call),
          arguments: structuredClone(
            protectedArguments.get(pending.call.callId) ?? "[REDACTED]"
          ),
        },
      }
    : undefined;
}
/**
 * Creates a durable, recoverable harness around the portable agent runtime.
 * @param config - Configuration for the created component.
 * @returns The created or normalized operation result.
 */
export function createAgentHarness(config: AgentHarnessConfig) {
  // One action driver gates the same mutations/effects in automatic and manual modes.
  const active = new Map<string, ReturnType<typeof createAgenticModule>>();
  const leaseMs = Math.max(1, config.leaseMs ?? 30000);
  const id = config.id ?? (() => crypto.randomUUID());
  const driver = new ActionDriver(config.driveMode);
  const executions = new Map<string, Promise<AgentResult>>();
  const closing = new Set<string>();
  const now = config.now ?? Date.now;
  /**
   * Publishes a sanitized span without allowing an observer failure to alter the run.
   * @param span - Telemetry span to sanitize and publish.
   * @returns A promise that resolves when the operation completes.
   */
  async function emitTelemetry(span: TelemetrySpan): Promise<void> {
    // Telemetry is passive and receives no prompt, output, or tool-argument fields.
    if (!config.telemetry) return;
    try {
      await driver.run(span.runId, "hook", () =>
        Promise.resolve(
          config.telemetry!(redactTelemetry(span) as TelemetrySpan)
        )
      );
    } catch {
      // A telemetry backend outage must not change durable agent behavior.
    }
  }
  /**
   * Publishes one host event through the same automatic/manual effect boundary.
   * @param event - Event or lifecycle value to process.
   * @returns A promise that resolves when the operation completes.
   */
  async function emitHostEvent(
    event: Parameters<NonNullable<AgenticModuleConfig["emit"]>>[0]
  ): Promise<void> {
    // Skip absent observers; configured observers remain deterministic manual actions.
    if (config.emit)
      await driver.run(event.runId, "hook", () =>
        Promise.resolve(config.emit!(event))
      );
  }
  /**
   * Appends one optimistic event batch through the configured drive mode.
   * @param runId - Stable identifier of the agent run.
   * @param events - Ordered durable events to append atomically.
   * @returns A promise that resolves when the operation completes.
   * @throws When validation, persistence, policy, or the delegated operation fails.
   */
  async function append(
    runId: string,
    events: HarnessEventInput[]
  ): Promise<void> {
    // Reload version inside the driven boundary to prevent stale preflight snapshots.
    await driver.run(runId, "durable_write", async () => {
      // Load and append inside one driven action so manual mode cannot split the optimistic write boundary.
      const loaded = await config.store.load(runId);
      if (!loaded)
        throw new AgenticError(
          "INVOCATION_NOT_FOUND",
          `Run not found: ${runId}`
        );
      await config.store.append(runId, loaded.record.version, events);
    });
  }
  /**
   * Atomically appends terminal events and releases the durable writer lease.
   * @param runId - Stable identifier of the agent run.
   * @param events - Ordered durable events to append atomically.
   * @param status - Terminal or lifecycle status to persist.
   * @returns A promise that resolves when the operation completes.
   * @throws When validation, persistence, policy, or the delegated operation fails.
   */
  async function settle(
    runId: string,
    events: HarnessEventInput[],
    status: "failed" | "aborted" | "closed"
  ): Promise<void> {
    // Load the optimistic version inside the same driven terminal action.
    await driver.run(runId, "durable_write", async () => {
      const loaded = await config.store.load(runId);
      if (!loaded)
        throw new AgenticError(
          "INVOCATION_NOT_FOUND",
          `Run not found: ${runId}`
        );
      await config.store.settle(runId, loaded.record.version, events, status);
    });
  }
  /**
   * Releases only this worker's lease through the configured drive mode.
   * @param runId - Stable identifier of the agent run.
   * @returns A promise that resolves when the operation completes.
   */
  async function release(runId: string): Promise<void> {
    // Lease release is a durable mutation and therefore a manual-drive action.
    await driver.run(runId, "durable_write", () =>
      config.store.releaseLease(runId, config.workerId)
    );
  }
  /**
   * Atomically cancels interrupt queues and settles one run as aborted.
   * @param runId - Stable identifier of the agent run.
   * @param events - Ordered durable events to append atomically.
   * @returns A promise that resolves when the operation completes.
   */
  async function settleAbort(
    runId: string,
    events: HarnessEventInput[]
  ): Promise<void> {
    // Derive pending queues inside the terminal write to avoid a cancellation race.
    await driver.run(runId, "durable_write", async () => {
      const loaded = await config.store.load(runId);
      if (
        !loaded ||
        loaded.record.status === "aborted" ||
        loaded.record.status === "closed"
      )
        return;
      const state = reduceHarnessEvents(loaded.record, loaded.events);
      const cancelled = Object.values(state.queues)
        .filter(
          ({ queue, status }) => status === "enqueued" && queue !== "nextRun"
        )
        .map(({ queueId }) => ({
          type: "queue_cancelled" as const,
          data: { queueId },
          idempotencyKey: `queue:${queueId}:cancelled`,
        }));
      await config.store.settle(
        runId,
        loaded.record.version,
        [...cancelled, ...events],
        "aborted"
      );
    });
  }
  /**
   * Admits and executes one new, continued, interaction, or deferred turn.
   * @param request - Request values required by the operation.
   * @param create - Whether the durable run must be created before execution.
   * @returns A promise that resolves with the operation result.
   * @throws When validation, persistence, policy, or the delegated operation fails.
   */
  async function execute(
    request: AgentRequest,
    create: boolean
  ): Promise<AgentResult> {
    // Durable create and scoped lease claim happen before any provider or tool effect.
    if (create)
      await driver.run(request.runId, "durable_write", () =>
        config.store.create(request)
      );
    if (
      !(await driver.run(request.runId, "durable_write", () =>
        config.store.claim(
          request.runId,
          request.context,
          config.workerId,
          leaseMs
        )
      ))
    ) {
      return failure(
        request.runId,
        "INVOCATION_ALREADY_CLAIMED",
        "Invocation cannot be claimed."
      );
    }
    const loaded = await config.store.load(request.runId);
    if (!loaded)
      return failure(
        request.runId,
        "INVOCATION_NOT_FOUND",
        "Invocation not found."
      );
    const state = reduceHarnessEvents(loaded.record, loaded.events);
    const protectedToolArguments = new Map<string, unknown>(
      Object.values(state.toolEffects).map(
        ({ callId, protectedArguments }) =>
          [callId, protectedArguments ?? "[REDACTED]"] as const
      )
    );
    const resuming = Boolean(request.resume);
    if (
      !resuming &&
      state.turns >= Math.max(1, config.maxTurns ?? Number.MAX_SAFE_INTEGER)
    ) {
      await release(request.runId);
      return failure(
        request.runId,
        "BUDGET_EXHAUSTED",
        "Turn budget exhausted."
      );
    }
    const nextRun = !resuming
      ? Object.values(state.queues)
          .filter(
            ({ queue, status }) => queue === "nextRun" && status === "enqueued"
          )
          .sort((a, b) => a.sequence - b.sequence)
      : [];
    if (!resuming) {
      const turn = state.turns + 1;
      const durableTurnHistory = protectCheckpointHistory(
        [
          ...(request.history ?? state.history),
          ...nextRun.map(({ input }) => ({
            role: "user" as const,
            content: input,
          })),
          {
            role: "user",
            content: request.input,
            attachments: request.attachments,
          },
        ],
        protectedToolArguments
      );
      await append(request.runId, [
        {
          type: "turn_started",
          data: {},
          idempotencyKey: `turn:${turn}:started`,
        },
        ...nextRun.map(({ queueId }) => ({
          type: "queue_consumed" as const,
          data: { queueId },
          idempotencyKey: `queue:${queueId}:consumed`,
        })),
        {
          type: "checkpoint_saved",
          data: {
            checkpoint: {
              history: durableTurnHistory,
              turns: turn,
              toolCalls: state.toolCalls,
            },
          },
          idempotencyKey: `turn:${turn}:checkpoint`,
        },
      ]);
    }
    let checkpoint: HarnessCheckpoint | undefined;
    const maxAttempts = Math.max(1, config.maxAttempts ?? 1);
    let providerStep = loaded.events.filter(
      ({ type }) => type === "provider_planned"
    ).length;
    let recoveryProviderStepId =
      request.resume && "providerStepId" in request.resume
        ? request.resume.providerStepId
        : undefined;
    let compactionStep = loaded.events.filter(
      ({ type }) => type === "context_compacted"
    ).length;
    /**
     * Converts a provider response into its safe durable representation.
     * @param response - Response value to validate or persist.
     * @returns A promise that resolves with the operation result.
     */
    async function protectProviderResponse(
      response: ProviderResponse
    ): Promise<ProviderResponse> {
      // Tool arguments cross the same protection boundary as checkpointed transcript calls.
      if (response.type === "tool_call") {
        const protectedValue = config.protectToolArguments
          ? await driver.run(request.runId, "hook", () =>
              Promise.resolve(
                config.protectToolArguments!(
                  response.arguments,
                  request.context
                )
              )
            )
          : redactTelemetry(response.arguments);
        protectedToolArguments.set(response.callId, protectedValue);
        return {
          ...structuredClone(response),
          arguments: structuredClone(protectedValue),
        };
      }
      if (response.type === "tool_calls") {
        const calls = [] as typeof response.calls;
        for (const call of response.calls) {
          const protectedValue = config.protectToolArguments
            ? await driver.run(request.runId, "hook", () =>
                Promise.resolve(
                  config.protectToolArguments!(call.arguments, request.context)
                )
              )
            : redactTelemetry(call.arguments);
          protectedToolArguments.set(call.callId, protectedValue);
          calls.push({
            ...structuredClone(call),
            arguments: structuredClone(protectedValue),
          });
        }
        return { type: "tool_calls", calls };
      }
      return structuredClone(response);
    }
    const provider = {
      ...config.provider,
      /**
       * Persists a logical provider step and every retry attempt around completion calls.
       * @param providerRequest - Normalized request sent to the provider adapter.
       * @returns The complete result produced for the current operation.
       * @throws When validation, persistence, policy, or the delegated operation fails.
       */
      async complete(
        providerRequest: Parameters<
          AgenticModuleConfig["provider"]["complete"]
        >[0]
      ) {
        // Keep one step ID across retries while allocating a response ID per attempt.
        const stepId =
          recoveryProviderStepId ??
          `${request.runId}:provider:${++providerStep}`;
        recoveryProviderStepId = undefined;
        const configuration = {
          model: structuredClone(
            config.modelIdentity ?? {
              provider: "unspecified",
              model: "unspecified",
            }
          ),
          thinkingLevel: config.thinkingLevel ?? "off",
          activeToolNames: providerRequest.tools.map(({ name }) => name),
        };
        await append(request.runId, [
          {
            type: "provider_planned",
            data: {
              stepId,
              configuration,
              toolNames: configuration.activeToolNames,
              messageCount: providerRequest.messages.length,
            },
            idempotencyKey: `${stepId}:planned`,
          },
        ]);
        for (let attempt = 1; ; attempt += 1) {
          const startedAt = now();
          const responseId = `${stepId}:attempt:${attempt}:response`;
          await append(request.runId, [
            {
              type: "provider_started",
              data: { stepId, attempt, responseId },
              idempotencyKey: `${stepId}:attempt:${attempt}:started`,
            },
          ]);
          try {
            const response = await driver.run(request.runId, "provider", () =>
              config.provider.complete(providerRequest)
            );
            const durableResponse = await protectProviderResponse(response);
            const settledEvents: HarnessEventInput[] = [
              {
                type: "provider_settled",
                data: {
                  stepId,
                  attempt,
                  responseId,
                  outcome: "completed",
                  responseType: response.type,
                  response: durableResponse,
                },
                idempotencyKey: `${stepId}:attempt:${attempt}:settled`,
              },
            ];
            const usage =
              response.type === "text" || response.type === "deferred"
                ? response.usage
                : undefined;
            if (usage)
              settledEvents.push({
                type: "usage_recorded",
                data: {
                  usageId: `${stepId}:attempt:${attempt}:usage`,
                  stepId,
                  attempt,
                  usage: structuredClone(usage),
                },
                idempotencyKey: `${stepId}:attempt:${attempt}:usage`,
              });
            await append(request.runId, settledEvents);
            await emitTelemetry({
              kind: "provider",
              runId: request.runId,
              operationId: request.runId,
              lane: "main",
              stepId,
              attempt,
              durationMs: Math.max(0, now() - startedAt),
              outcome: response.type === "deferred" ? "suspended" : "completed",
              usage,
            });
            return response;
          } catch (error) {
            const retryable =
              error instanceof AgenticError &&
              error.retryable &&
              attempt < maxAttempts;
            await append(request.runId, [
              {
                type: "provider_settled",
                data: {
                  stepId,
                  attempt,
                  responseId,
                  outcome: retryable ? "retryable_error" : "failed",
                },
                idempotencyKey: `${stepId}:attempt:${attempt}:settled`,
              },
            ]);
            await emitTelemetry({
              kind: "provider",
              runId: request.runId,
              operationId: request.runId,
              lane: "main",
              stepId,
              attempt,
              durationMs: Math.max(0, now() - startedAt),
              outcome: retryable
                ? "retryable_error"
                : error instanceof AgenticError && error.code === "ABORTED"
                  ? "aborted"
                  : "failed",
            });
            if (!retryable) throw error;
          }
        }
      },
      stream: config.provider.stream
        ? async function* (
            providerRequest: Parameters<
              NonNullable<AgenticModuleConfig["provider"]["stream"]>
            >[0]
          ) {
            const stepId =
              recoveryProviderStepId ??
              `${request.runId}:provider:${++providerStep}`;
            recoveryProviderStepId = undefined;
            const responseId = `${stepId}:attempt:1:response`;
            const startedAt = now();
            const configuration = {
              model: structuredClone(
                config.modelIdentity ?? {
                  provider: "unspecified",
                  model: "unspecified",
                }
              ),
              thinkingLevel: config.thinkingLevel ?? "off",
              activeToolNames: providerRequest.tools.map(({ name }) => name),
            };
            await append(request.runId, [
              {
                type: "provider_planned",
                data: {
                  stepId,
                  configuration,
                  toolNames: configuration.activeToolNames,
                  messageCount: providerRequest.messages.length,
                },
                idempotencyKey: `${stepId}:planned`,
              },
              {
                type: "provider_started",
                data: { stepId, attempt: 1, responseId },
                idempotencyKey: `${stepId}:attempt:1:started`,
              },
            ]);
            try {
              let usage: Record<string, number> | undefined;
              let response: ProviderResponse = { type: "text", text: "" };
              for await (const chunk of driver.runStream(
                request.runId,
                "provider",
                () => config.provider.stream!(providerRequest)
              )) {
                if (chunk.type === "usage")
                  usage = { ...usage, ...chunk.usage };
                if (chunk.type === "text_delta" && response.type === "text")
                  response.text += chunk.text;
                if (chunk.type === "tool_call") response = chunk;
                yield chunk;
              }
              const durableResponse = await protectProviderResponse(response);
              const settledEvents: HarnessEventInput[] = [
                {
                  type: "provider_settled",
                  data: {
                    stepId,
                    attempt: 1,
                    responseId,
                    outcome: "completed",
                    responseType: "stream",
                    response: durableResponse,
                  },
                  idempotencyKey: `${stepId}:attempt:1:settled`,
                },
              ];
              if (usage)
                settledEvents.push({
                  type: "usage_recorded",
                  data: {
                    usageId: `${stepId}:attempt:1:usage`,
                    stepId,
                    attempt: 1,
                    usage,
                  },
                  idempotencyKey: `${stepId}:attempt:1:usage`,
                });
              await append(request.runId, settledEvents);
              await emitTelemetry({
                kind: "provider",
                runId: request.runId,
                operationId: request.runId,
                lane: "main",
                stepId,
                attempt: 1,
                durationMs: Math.max(0, now() - startedAt),
                outcome: "completed",
                usage,
              });
            } catch (error) {
              await append(request.runId, [
                {
                  type: "provider_settled",
                  data: { stepId, attempt: 1, responseId, outcome: "failed" },
                  idempotencyKey: `${stepId}:attempt:1:settled`,
                },
              ]);
              await emitTelemetry({
                kind: "provider",
                runId: request.runId,
                operationId: request.runId,
                lane: "main",
                stepId,
                attempt: 1,
                durationMs: Math.max(0, now() - startedAt),
                outcome:
                  error instanceof AgenticError && error.code === "ABORTED"
                    ? "aborted"
                    : "failed",
              });
              throw error;
            }
          }
        : undefined,
      fetchDeferred: config.provider.fetchDeferred
        ? async (
            handle: Parameters<
              NonNullable<AgenticModuleConfig["provider"]["fetchDeferred"]>
            >[0],
            signal: AbortSignal
          ) => {
            const stepId = `${request.runId}:provider:${++providerStep}`;
            const responseId = `${stepId}:attempt:1:response`;
            const startedAt = now();
            const configuration = {
              model: structuredClone(
                config.modelIdentity ?? {
                  provider: handle.provider,
                  model: "deferred",
                }
              ),
              thinkingLevel: config.thinkingLevel ?? "off",
              activeToolNames: [] as string[],
            };
            await append(request.runId, [
              {
                type: "provider_planned",
                data: {
                  stepId,
                  effectKind: "deferred_poll",
                  provider: handle.provider,
                  configuration,
                },
                idempotencyKey: `${stepId}:planned`,
              },
              {
                type: "provider_started",
                data: { stepId, attempt: 1, responseId },
                idempotencyKey: `${stepId}:attempt:1:started`,
              },
            ]);
            try {
              const response = await driver.run(request.runId, "provider", () =>
                config.provider.fetchDeferred!(handle, signal)
              );
              const durableResponse = await protectProviderResponse(response);
              const settledEvents: HarnessEventInput[] = [
                {
                  type: "provider_settled",
                  data: {
                    stepId,
                    attempt: 1,
                    responseId,
                    outcome: "completed",
                    responseType: response.type,
                    response: durableResponse,
                  },
                  idempotencyKey: `${stepId}:attempt:1:settled`,
                },
              ];
              const usage =
                response.type === "text" || response.type === "deferred"
                  ? response.usage
                  : undefined;
              if (usage)
                settledEvents.push({
                  type: "usage_recorded",
                  data: {
                    usageId: `${stepId}:attempt:1:usage`,
                    stepId,
                    attempt: 1,
                    usage: structuredClone(usage),
                  },
                  idempotencyKey: `${stepId}:attempt:1:usage`,
                });
              await append(request.runId, settledEvents);
              await emitTelemetry({
                kind: "provider",
                runId: request.runId,
                operationId: request.runId,
                lane: "main",
                stepId,
                attempt: 1,
                durationMs: Math.max(0, now() - startedAt),
                outcome:
                  response.type === "deferred" ? "suspended" : "completed",
                usage,
              });
              return response;
            } catch (error) {
              await append(request.runId, [
                {
                  type: "provider_settled",
                  data: { stepId, attempt: 1, responseId, outcome: "failed" },
                  idempotencyKey: `${stepId}:attempt:1:settled`,
                },
              ]);
              await emitTelemetry({
                kind: "provider",
                runId: request.runId,
                operationId: request.runId,
                lane: "main",
                stepId,
                attempt: 1,
                durationMs: Math.max(0, now() - startedAt),
                outcome:
                  error instanceof AgenticError && error.code === "ABORTED"
                    ? "aborted"
                    : "failed",
              });
              throw error;
            }
          }
        : undefined,
    };
    const toolStartedAt = new Map<string, number>();
    let compactionEffect:
      | {
          stepId: string;
          startedAt: number;
        }
      | undefined;
    const runtime = createAgenticModule({
      ...config,
      provider,
      contextWindow: config.contextWindow
        ? {
            ...config.contextWindow,
            /**
             * Compacts transcript history within the configured budget.
             * @param input - Validated input required by the operation.
             * @returns The compact result produced for the current operation.
             */
            compact: (input) =>
              driver.run(request.runId, "provider", () =>
                config.contextWindow!.compact(input)
              ),
          }
        : undefined,
      /**
       * Persists skill selection and forwards public runtime events.
       * @param event - Runtime event to persist or publish.
       * @returns A promise that resolves after durable and host handling.
       */
      emit: async (event) => {
        // Persist the immutable selection before any provider or tool effect.
        if (event.type === "skills_selected")
          await append(request.runId, [
            {
              type: "skills_selected",
              data: { skills: structuredClone(event.skills) },
            },
          ]);
        await emitHostEvent(event);
      },
      policy: {
        /**
         * Determines whether policy permits the requested operation.
         * @param tool - Tool definition subject to policy or execution.
         * @param context - Authenticated execution context for the operation.
         * @returns Whether the requested condition is satisfied.
         */
        authorize: (tool, context) =>
          driver.run(request.runId, "hook", () =>
            Promise.resolve(config.policy.authorize(tool, context))
          ),
        isApproved: config.policy.isApproved
          ? (tool, context) =>
              driver.run(request.runId, "hook", () =>
                Promise.resolve(config.policy.isApproved!(tool, context))
              )
          : undefined,
        canManageTools: config.policy.canManageTools
          ? (context) =>
              driver.run(request.runId, "hook", () =>
                Promise.resolve(config.policy.canManageTools!(context))
              )
          : undefined,
      },
      loadContext: config.loadContext
        ? (context, signal) =>
            driver.run(request.runId, "hook", () =>
              config.loadContext!(context, signal)
            )
        : undefined,
      loadSkills: config.loadSkills
        ? (input) =>
            driver.run(request.runId, "hook", () => config.loadSkills!(input))
        : undefined,
      skills: config.skills
          ? {
            ...config.skills,
            /**
             * Lists authorized skill metadata through the driven host boundary.
             * @param input - Agent-scoped catalog request.
             * @returns Authorized skill catalog metadata.
             */
            listCatalog: (input) =>
              driver.run(request.runId, "hook", () =>
                config.skills!.listCatalog(input)
              ),
            /**
             * Loads exact selected skills through the driven host boundary.
             * @param input - Immutable selected skill identities.
             * @returns Full selected skill definitions.
             */
            load: (input) =>
              driver.run(request.runId, "hook", () => config.skills!.load(input)),
            select: config.skills.select
              ? (input) =>
                  driver.run(request.runId, "hook", () =>
                    config.skills!.select!(input)
                  )
              : undefined,
          }
        : undefined,
      validateFinalOutput: config.validateFinalOutput
        ? (candidate) =>
            driver.run(request.runId, "hook", () =>
              Promise.resolve(config.validateFinalOutput!(candidate))
            )
        : undefined,
      redactToolArguments: config.redactToolArguments
        ? (argumentsValue, context) =>
            driver.run(request.runId, "hook", () =>
              Promise.resolve(
                config.redactToolArguments!(argumentsValue, context)
              )
            )
        : undefined,
      redactToolOutput: config.redactToolOutput
        ? (content, context) =>
            driver.run(request.runId, "hook", () =>
              Promise.resolve(config.redactToolOutput!(content, context))
            )
        : undefined,
      approval: config.interactions
        ? {
            /**
             * Requests a host-mediated interaction.
             * @returns The request result produced for the current operation.
             */
            request: async () => ({ pending: true as const }),
          }
        : config.approval
          ? {
              /**
               * Requests a host-mediated interaction.
               * @param input - Validated input required by the operation.
               * @returns The request result produced for the current operation.
               */
              request: (input) =>
                driver.run(request.runId, "hook", () =>
                  config.approval!.request(input)
                ),
            }
          : undefined,
      saveResult: undefined,
      /**
       * Captures the latest recoverable runtime checkpoint.
       * @param value - Value to validate, transform, or persist.
       * @returns The onCheckpoint result produced for the current operation.
       */
      onCheckpoint: (value) => {
        // Retain the latest runtime snapshot for post-effect settlement and recovery.
        checkpoint = {
          history: protectCheckpointHistory(
            value.history,
            protectedToolArguments
          ),
          turns: state.turns + (resuming ? 0 : 1),
          toolCalls: value.toolCalls,
          result: value.result,
          pendingExecution: protectPendingExecution(
            value.pending,
            protectedToolArguments
          ),
        };
      },
      /**
       * Forwards a completed compaction to the host hook.
       * @param value - Value to validate, transform, or persist.
       * @returns The onContextCompacted result produced for the current operation.
       */
      onContextCompacted: async (value) => {
        // Keep host notification inside the same driven hook boundary.
        if (config.onContextCompacted) {
          await driver.run(request.runId, "hook", () =>
            Promise.resolve(config.onContextCompacted!(value))
          );
        }
      },
      /**
       * Persists one compaction-effect lifecycle transition.
       * @param event - Event or lifecycle value to process.
       * @returns The onCompactionEffect result produced for the current operation.
       * @throws When validation, persistence, policy, or the delegated operation fails.
       */
      onCompactionEffect: async (event) => {
        // Project each lifecycle phase into one durable compaction effect.
        if (event.phase === "planned") {
          compactionEffect = {
            stepId: `${request.runId}:compaction:${++compactionStep}`,
            startedAt: now(),
          };
          await append(request.runId, [
            {
              type: "compaction_planned",
              data: {
                stepId: compactionEffect.stepId,
                beforeTokens: event.beforeTokens,
              },
              idempotencyKey: `${compactionEffect.stepId}:planned`,
            },
          ]);
        } else if (event.phase === "started") {
          if (!compactionEffect)
            throw new AgenticError(
              "STORAGE_CORRUPTION",
              "Compaction started without a durable plan."
            );
          await append(request.runId, [
            {
              type: "compaction_started",
              data: { stepId: compactionEffect.stepId },
              idempotencyKey: `${compactionEffect.stepId}:started`,
            },
          ]);
        } else {
          if (!compactionEffect)
            throw new AgenticError(
              "STORAGE_CORRUPTION",
              "Compaction settled without a durable plan."
            );
          const { stepId, startedAt } = compactionEffect;
          const events: HarnessEventInput[] = [
            {
              type: "compaction_settled",
              data: { stepId, outcome: event.outcome },
              idempotencyKey: `${stepId}:settled`,
            },
          ];
          if (event.outcome === "completed") {
            const compactedCheckpoint: HarnessCheckpoint = {
              history: protectCheckpointHistory(
                event.history,
                protectedToolArguments
              ),
              turns: state.turns + (resuming ? 0 : 1),
              toolCalls: event.history.filter(({ role }) => role === "tool")
                .length,
            };
            events.push({
              type: "context_compacted",
              data: {
                beforeTokens: event.beforeTokens,
                afterTokens: event.afterTokens,
                checkpoint: compactedCheckpoint,
              },
              idempotencyKey: `${stepId}:checkpoint`,
            });
          }
          await append(request.runId, events);
          await emitTelemetry({
            kind: "compaction",
            runId: request.runId,
            operationId: request.runId,
            lane: "main",
            stepId,
            attempt: 1,
            durationMs: Math.max(0, now() - startedAt),
            outcome: event.outcome === "completed" ? "completed" : "failed",
          });
          compactionEffect = undefined;
        }
        if (config.onCompactionEffect) {
          await driver.run(request.runId, "hook", () =>
            Promise.resolve(config.onCompactionEffect!(event))
          );
        }
      },
      /**
       * Persists one tool-effect lifecycle transition.
       * @param event - Event or lifecycle value to process.
       * @returns The onToolEffect result produced for the current operation.
       */
      onToolEffect: async (event) => {
        // Correlate every runtime tool phase with one durable effect identity.
        const toolStep = state.turns + (resuming ? 0 : 1);
        const effectId = `${request.runId}:turn:${toolStep}:tool:${event.call.callId}`;
        if (event.phase === "planned") {
          if (
            request.resume &&
            "call" in request.resume &&
            request.resume.recoveryEffectId === effectId
          )
            return;
          const replay =
            event.tool.replay === "safe" && config.protectToolArguments
              ? "safe"
              : "never";
          const protectedArguments = config.protectToolArguments
            ? await driver.run(request.runId, "hook", () =>
                Promise.resolve(
                  config.protectToolArguments!(
                    event.call.arguments,
                    request.context
                  )
                )
              )
            : redactTelemetry(event.call.arguments);
          protectedToolArguments.set(event.call.callId, protectedArguments);
          await append(request.runId, [
            {
              type: "tool_planned",
              data: {
                effectId,
                callId: event.call.callId,
                toolName: event.tool.name,
                replay,
                plannedResultId: `${effectId}:result`,
                protectedArguments,
              },
              idempotencyKey: `${effectId}:planned`,
            },
            {
              type: "checkpoint_saved",
              data: {
                checkpoint: {
                  history: protectCheckpointHistory(
                    event.history,
                    protectedToolArguments
                  ),
                  turns: toolStep,
                  toolCalls: state.toolCalls,
                },
              },
              idempotencyKey: `${effectId}:checkpoint`,
            },
          ]);
        } else if (event.phase === "started") {
          if (
            request.resume &&
            "call" in request.resume &&
            request.resume.recoveryEffectId === effectId
          ) {
            toolStartedAt.set(effectId, now());
            return;
          }
          toolStartedAt.set(effectId, now());
          await append(request.runId, [
            {
              type: "tool_started",
              data: {
                effectId,
                callId: event.call.callId,
                toolName: event.tool.name,
              },
              idempotencyKey: `${effectId}:started`,
            },
          ]);
        } else {
          const mutations: HarnessEventInput[] = [
            {
              type: "tool_settled",
              data: {
                effectId,
                callId: event.call.callId,
                toolName: event.tool.name,
                outcome: event.outcome,
                resultId: `${effectId}:result`,
              },
              idempotencyKey: `${effectId}:settled`,
            },
          ];
          if (event.outcome === "completed")
            mutations.push({
              type: "checkpoint_saved",
              data: {
                checkpoint: {
                  history: protectCheckpointHistory(
                    event.history,
                    protectedToolArguments
                  ),
                  turns: toolStep,
                  toolCalls: state.toolCalls + 1,
                },
              },
              idempotencyKey: `${effectId}:settled:checkpoint`,
            });
          await append(request.runId, mutations);
          await emitTelemetry({
            kind: "tool",
            runId: request.runId,
            operationId: request.runId,
            lane: "main",
            stepId: effectId,
            attempt: 1,
            durationMs: Math.max(
              0,
              now() - (toolStartedAt.get(effectId) ?? now())
            ),
            outcome:
              event.outcome === "completed"
                ? "completed"
                : event.outcome === "needs_input"
                  ? "suspended"
                  : "failed",
          });
          toolStartedAt.delete(effectId);
        }
        if (config.onToolEffect) {
          await driver.run(request.runId, "hook", () =>
            Promise.resolve(config.onToolEffect!(event))
          );
        }
      },
      /**
       * Merges host and durable steer inputs at a safe loop boundary.
       * @param value - Value to validate, transform, or persist.
       * @returns The takeSteer result produced for the current operation.
       */
      takeSteer: async (value) => {
        // Merge host and durable steer inputs exactly once at this safe boundary.
        const queued = config.takeSteer
          ? await driver.run(request.runId, "hook", () =>
              config.takeSteer!(value)
            )
          : [];
        const latest = await config.store.load(request.runId);
        if (!latest) return queued;
        const latestState = reduceHarnessEvents(latest.record, latest.events);
        const pending = Object.values(latestState.queues)
          .filter(
            ({ queue, status }) => queue === "steer" && status === "enqueued"
          )
          .sort((a, b) => a.sequence - b.sequence);
        if (!pending.length) return queued;
        const inputs = [...pending.map(({ input }) => input), ...queued];
        await append(request.runId, [
          ...pending.map(({ queueId }) => ({
            type: "queue_consumed" as const,
            data: { queueId },
            idempotencyKey: `queue:${queueId}:consumed`,
          })),
          {
            type: "checkpoint_saved",
            data: {
              checkpoint: {
                history: protectCheckpointHistory(
                  [
                    ...value.history,
                    ...inputs.map((content) => ({
                      role: "user" as const,
                      content,
                    })),
                  ],
                  protectedToolArguments
                ),
                turns: state.turns + (resuming ? 0 : 1),
                toolCalls: state.toolCalls + 1,
              },
            },
            idempotencyKey: `steer:${pending.map(({ queueId }) => queueId).join(":")}:checkpoint`,
          },
        ]);
        return inputs;
      },
      /**
       * Executes one effect through the configured action driver.
       * @param input - Validated input required by the operation.
       * @param effect - External effect callback to execute.
       * @returns The executeEffect result produced for the current operation.
       */
      executeEffect: (input, effect) =>
        driver.run(input.runId, input.kind, () =>
          config.executeEffect ? config.executeEffect(input, effect) : effect()
        ),
    });
    active.set(request.runId, runtime);
    const history = request.history ?? state.history;
    const result = await runtime.start({
      ...request,
      skillSnapshot:
        request.skillSnapshot ?? (resuming ? state.skillSnapshot : undefined),
      history: nextRun.length
        ? [
            ...history,
            ...nextRun.map(({ input }) => ({
              role: "user" as const,
              content: input,
            })),
          ]
        : history,
    });
    active.delete(request.runId);
    if (closing.has(request.runId)) return result;
    const afterRun = await config.store.load(request.runId);
    if (afterRun?.record.status === "closed") return result;
    const events: HarnessEventInput[] = [];
    if (result.status === "needs_input") {
      if (!config.interactions || !checkpoint?.pendingExecution) {
        const unavailable = failure(
          request.runId,
          "CAPABILITY_UNAVAILABLE",
          "Durable interaction manager is required."
        );
        await settle(
          request.runId,
          [{ type: "run_failed", data: { result: unavailable } }],
          "failed"
        );
        return unavailable;
      }
      const pendingExecution = checkpoint.pendingExecution;
      let pending: NonNullable<AgentResult["pending"]>;
      if (pendingExecution.kind === "approval") {
        pending = await driver.run(request.runId, "durable_write", () =>
          config.interactions!.beginApproval(request.runId, request.context, {
            toolName: pendingExecution.call.name,
            description: config.tools?.get(pendingExecution.call.name)
              ?.description,
            displayPayload: redactTelemetry(
              pendingExecution.call.arguments
            ) as Record<string, unknown>,
            timeoutMs: config.interactionTimeoutMs ?? 300000,
          })
        );
      } else {
        pending = await driver.run(request.runId, "durable_write", () =>
          config.interactions!.beginClarification(
            request.runId,
            request.context,
            {
              questions: pendingExecution.interaction?.questions ?? [],
              allowSkip: pendingExecution.interaction?.allowSkip ?? true,
              timeoutMs:
                config.interactionTimeoutMs ??
                pendingExecution.interaction?.timeoutMs ??
                300000,
            }
          )
        );
      }
      result.pending = pending;
      if (
        checkpoint.pendingExecution.kind === "approval" &&
        "toolName" in pending
      ) {
        await emitHostEvent({
          type: "approval_requested",
          runId: request.runId,
          requestId: pending.requestId,
          toolName: pending.toolName,
          displayPayload: pending.displayPayload,
        });
      } else if (
        checkpoint.pendingExecution.kind === "clarification" &&
        "questions" in pending
      ) {
        await emitHostEvent({
          type: "clarification_requested",
          runId: request.runId,
          requestId: pending.requestId,
          questions: pending.questions,
          allowSkip: pending.allowSkip,
        });
      }
      checkpoint.result = result;
      events.push({ type: "checkpoint_saved", data: { checkpoint } });
      await append(request.runId, events);
      await release(request.runId);
      return result;
    }
    if (result.status === "suspended") {
      if (checkpoint)
        events.push({ type: "checkpoint_saved", data: { checkpoint } });
      events.push({ type: "run_suspended", data: { result } });
      await append(request.runId, events);
      await release(request.runId);
      return result;
    }
    if (checkpoint)
      events.push({ type: "checkpoint_saved", data: { checkpoint } });
    events.push(
      result.status === "completed"
        ? { type: "turn_completed", data: { result } }
        : result.status === "aborted"
          ? { type: "run_aborted", data: { result } }
          : { type: "run_failed", data: { result } }
    );
    if (result.status === "completed") {
      await append(request.runId, events);
      await release(request.runId);
    } else if (result.status === "aborted") {
      await settleAbort(request.runId, events);
    } else {
      await settle(request.runId, events, "failed");
    }
    if (result.status === "completed" && config.saveResult) {
      try {
        await driver.run(request.runId, "hook", () =>
          Promise.resolve(config.saveResult!(result, request.context))
        );
      } catch {
        return failure(
          request.runId,
          "PERSISTENCE_FAILED",
          "Failed to persist run result."
        );
      }
    }
    if (result.status === "completed") {
      const latest = await config.store.load(request.runId);
      if (latest) {
        const latestState = reduceHarnessEvents(latest.record, latest.events);
        const followUp = Object.values(latestState.queues)
          .filter(
            ({ queue, status }) => queue === "followUp" && status === "enqueued"
          )
          .sort((a, b) => a.sequence - b.sequence)[0];
        if (followUp) {
          await append(request.runId, [
            {
              type: "queue_consumed",
              data: { queueId: followUp.queueId },
              idempotencyKey: `queue:${followUp.queueId}:consumed`,
            },
          ]);
          return execute(
            {
              runId: request.runId,
              input: followUp.input,
              context: request.context,
            },
            false
          );
        }
      }
    }
    return result;
  }
  return {
    /**
     * Starts and tracks one newly created durable run.
     * @param request - Request values required by the operation.
     * @returns A promise that resolves with the operation result.
     */
    start(request: AgentRequest): Promise<AgentResult> {
      // Keep the execution promise addressable for manual drive until settlement.
      const execution = execute(request, true);
      executions.set(request.runId, execution);
      void execution.finally(() => {
        if (executions.get(request.runId) === execution)
          executions.delete(request.runId);
      });
      return execution;
    },
    /**
     * Continues an existing durable run with one new user turn.
     * @param runId - Stable identifier of the agent run.
     * @param input - Validated input required by the operation.
     * @param context - Authenticated execution context for the operation.
     * @returns A promise that resolves with the operation result.
     */
    async continue(
      runId: string,
      input: string,
      context: ExecutionContext
    ): Promise<AgentResult> {
      // Verify durable existence before scheduling the shared execution state machine.
      const loaded = await config.store.load(runId);
      if (!loaded)
        return failure(
          runId,
          "INVOCATION_NOT_FOUND",
          `Run not found: ${runId}`
        );
      const execution = execute({ runId, input, context }, false);
      executions.set(runId, execution);
      void execution.finally(() => {
        if (executions.get(runId) === execution) executions.delete(runId);
      });
      return execution;
    },
    /**
     * Returns the next manual-drive action without executing it.
     * @returns The peekAction result produced for the current operation.
     */
    peekAction() {
      // Expose only the driver's immutable action descriptor.
      return driver.peekAction();
    },
    /**
     * Executes exactly one pending manual-drive action.
     * @returns The executeAction result produced for the current operation.
     */
    executeAction() {
      // Delegate action settlement to the shared driver.
      return driver.executeAction();
    },
    /**
     * Drives one active manual run until completion, suspension, or failure.
     * @param runId - Stable identifier of the agent run.
     * @returns A promise that resolves with the operation result.
     */
    async runToCompletion(runId: string): Promise<AgentResult> {
      // Alternate action execution and wait notification without busy polling.
      const execution = executions.get(runId);
      if (!execution)
        return failure(runId, "INVALID_REQUEST", "Run is not active.");
      let settled = false;
      const completed = execution.finally(() => {
        settled = true;
      });
      while (!settled) {
        if (driver.peekAction()) await driver.executeAction();
        else
          await Promise.race([
            driver.waitForAction(),
            completed.then(() => undefined),
          ]);
      }
      return completed;
    },
    /**
     * Reopens a run and deterministically classifies pending interactions or uncertain effects.
     * @param runId - Stable identifier of the agent run.
     * @param context - Authenticated execution context for the operation.
     * @returns A promise that resolves with the operation result.
     */
    async recover(
      runId: string,
      context: ExecutionContext
    ): Promise<AgentResult> {
      // Claim and release first to prove ownership and single-writer admission.
      const loaded = await config.store.load(runId);
      if (!loaded)
        return failure(
          runId,
          "INVOCATION_NOT_FOUND",
          `Run not found: ${runId}`
        );
      if (
        !(await driver.run(runId, "durable_write", () =>
          config.store.claim(runId, context, config.workerId, leaseMs)
        ))
      ) {
        return failure(
          runId,
          "INVOCATION_ALREADY_CLAIMED",
          "Invocation cannot be claimed."
        );
      }
      await release(runId);
      const state = reduceHarnessEvents(loaded.record, loaded.events);
      const settledCompactions = new Set(
        loaded.events
          .filter(({ type }) => type === "compaction_settled")
          .map(({ data }) => String(data.stepId))
      );
      const openCompaction = [...loaded.events]
        .reverse()
        .find(
          ({ type, data }) =>
            type === "compaction_started" &&
            !settledCompactions.has(String(data.stepId))
        );
      if (openCompaction) {
        if (!config.contextWindow)
          return failure(
            runId,
            "CAPABILITY_UNAVAILABLE",
            "Compaction recovery requires contextWindow."
          );
        return execute(
          {
            runId,
            input: "",
            context,
            history: state.history,
            resume: { compaction: true },
          },
          false
        );
      }
      const settledProviderAttempts = new Set(
        loaded.events
          .filter(
            ({ type }) =>
              type === "provider_settled" || type === "provider_uncertain"
          )
          .map(({ data }) => `${String(data.stepId)}:${String(data.attempt)}`)
      );
      const openProviderAttempt = [...loaded.events]
        .reverse()
        .find(
          ({ type, data }) =>
            type === "provider_started" &&
            !settledProviderAttempts.has(
              `${String(data.stepId)}:${String(data.attempt)}`
            )
        );
      if (openProviderAttempt) {
        const stepId = String(openProviderAttempt.data.stepId);
        const attempt = Number(openProviderAttempt.data.attempt);
        const result = failure(
          runId,
          "EFFECT_UNCERTAIN",
          "Provider attempt may have completed before the crash."
        );
        await settle(
          runId,
          [
            {
              type: "provider_uncertain",
              data: {
                stepId,
                attempt,
                responseId: openProviderAttempt.data.responseId,
              },
              idempotencyKey: `${stepId}:attempt:${attempt}:uncertain`,
            },
            {
              type: "run_failed",
              data: { result },
              idempotencyKey: `${stepId}:attempt:${attempt}:uncertain:failed`,
            },
          ],
          "failed"
        );
        return result;
      }
      const plannedProvider = Object.values(state.providerEffects).find(
        ({ attempts }) => !Object.keys(attempts).length
      );
      if (plannedProvider) {
        return execute(
          {
            runId,
            input: "",
            context,
            history: state.history,
            resume: { providerStepId: plannedProvider.stepId },
          },
          false
        );
      }
      const settledProviderResponse = [...loaded.events]
        .reverse()
        .find(
          ({ type, data }) =>
            type === "provider_settled" &&
            data.outcome === "completed" &&
            data.response !== undefined
        );
      if (settledProviderResponse) {
        const hasDownstreamClassification = loaded.events.some(
          ({ sequence, type, data }) =>
            sequence > settledProviderResponse.sequence &&
            (type === "tool_planned" ||
              type === "run_suspended" ||
              type === "turn_completed" ||
              type === "run_failed" ||
              type === "run_aborted" ||
              (type === "checkpoint_saved" &&
                Boolean(
                  (data.checkpoint as HarnessCheckpoint | undefined)?.result
                )))
        );
        if (!hasDownstreamClassification) {
          let response = structuredClone(
            settledProviderResponse.data.response
          ) as ProviderResponse;
          if (
            (response.type === "tool_call" || response.type === "tool_calls") &&
            !config.restoreToolArguments
          ) {
            return failure(
              runId,
              "CAPABILITY_UNAVAILABLE",
              "Provider tool-call recovery requires restoreToolArguments."
            );
          }
          if (
            config.restoreToolArguments &&
            (response.type === "tool_call" || response.type === "tool_calls")
          ) {
            if (response.type === "tool_call") {
              response.arguments = await driver.run(runId, "hook", () =>
                Promise.resolve(
                  config.restoreToolArguments!(response.arguments, context)
                )
              );
            } else {
              for (const call of response.calls) {
                call.arguments = await driver.run(runId, "hook", () =>
                  Promise.resolve(
                    config.restoreToolArguments!(call.arguments, context)
                  )
                );
              }
            }
          }
          return execute(
            {
              runId,
              input: "",
              context,
              history: state.history,
              resume: { providerResponse: response },
            },
            false
          );
        }
      }
      const replayable = Object.values(state.toolEffects).find(
        ({ status, replay }) => status === "started" && replay === "safe"
      );
      if (replayable) {
        if (!config.restoreToolArguments) {
          return failure(
            runId,
            "CAPABILITY_UNAVAILABLE",
            "Safe tool recovery requires restoreToolArguments."
          );
        }
        const argumentsValue = await driver.run(runId, "hook", () =>
          Promise.resolve(
            config.restoreToolArguments!(replayable.protectedArguments, context)
          )
        );
        return execute(
          {
            runId,
            input: "",
            context,
            history: state.history,
            resume: {
              call: {
                type: "tool_call",
                callId: replayable.callId,
                name: replayable.toolName,
                arguments: argumentsValue,
              },
              approved: true,
              recoveryEffectId: replayable.effectId,
            },
          },
          false
        );
      }
      const uncertain = Object.values(state.toolEffects).find(
        ({ status, replay }) => status === "started" && replay === "never"
      );
      if (uncertain) {
        const result = failure(
          runId,
          "EFFECT_UNCERTAIN",
          `Tool effect may have executed: ${uncertain.toolName}`
        );
        await settle(
          runId,
          [
            {
              type: "tool_uncertain",
              data: {
                effectId: uncertain.effectId,
                callId: uncertain.callId,
                toolName: uncertain.toolName,
                resultId: uncertain.plannedResultId,
              },
              idempotencyKey: `${uncertain.effectId}:uncertain`,
            },
            {
              type: "run_failed",
              data: { result },
              idempotencyKey: `${uncertain.effectId}:uncertain:failed`,
            },
          ],
          "failed"
        );
        return result;
      }
      if (state.pending)
        return {
          runId,
          status: "needs_input",
          citations: [],
          artifacts: [],
          pending: state.pending.data as AgentResult["pending"],
        };
      return (
        state.result ??
        failure(runId, "INVALID_REQUEST", "Run has no recoverable checkpoint.")
      );
    },
    /**
     * Polls one persisted deferred handle exactly once and re-enters normal classification.
     * @param runId - Stable identifier of the agent run.
     * @param context - Authenticated execution context for the operation.
     * @returns A promise that resolves with the operation result.
     */
    async resumeDeferred(
      runId: string,
      context: ExecutionContext
    ): Promise<AgentResult> {
      // Resolve the handle only from replayed durable state, never caller input.
      const loaded = await config.store.load(runId);
      if (!loaded)
        return failure(
          runId,
          "INVOCATION_NOT_FOUND",
          `Run not found: ${runId}`
        );
      const state = reduceHarnessEvents(loaded.record, loaded.events);
      if (state.result?.status !== "suspended" || !state.result.deferred) {
        return failure(
          runId,
          "INVALID_REQUEST",
          "Run has no deferred provider response."
        );
      }
      return execute(
        {
          runId,
          input: "",
          context,
          history: state.history,
          resume: { deferred: state.result.deferred },
        },
        false
      );
    },
    /**
     * Settles a matching durable approval and resumes or fails the pending tool call.
     * @param runId - Stable identifier of the agent run.
     * @param context - Authenticated execution context for the operation.
     * @param response - Response value to validate or persist.
     * @returns A promise that resolves with the operation result.
     */
    async respondApproval(
      runId: string,
      context: ExecutionContext,
      response: ApprovalResponse
    ): Promise<AgentResult> {
      // Validate interaction capability and correlation before persisting the response.
      if (!config.interactions)
        return failure(
          runId,
          "CAPABILITY_UNAVAILABLE",
          "Durable interaction manager is required."
        );
      const loaded = await config.store.load(runId);
      if (!loaded)
        return failure(
          runId,
          "INVOCATION_NOT_FOUND",
          `Run not found: ${runId}`
        );
      const state = reduceHarnessEvents(loaded.record, loaded.events);
      if (
        state.pending?.requestId !== response.requestId ||
        state.pendingExecution?.kind !== "approval"
      ) {
        return failure(
          runId,
          "INVALID_REQUEST",
          "Approval request does not match pending execution."
        );
      }
      let resumedCall = state.pendingExecution.call;
      const effect = Object.values(state.toolEffects).find(
        ({ callId }) => callId === resumedCall.callId
      );
      if (
        config.restoreToolArguments &&
        effect?.protectedArguments !== undefined
      ) {
        const argumentsValue = await driver.run(runId, "hook", () =>
          Promise.resolve(
            config.restoreToolArguments!(effect.protectedArguments, context)
          )
        );
        resumedCall = { ...resumedCall, arguments: argumentsValue };
      }
      await driver.run(runId, "durable_write", () =>
        config.interactions!.respondApproval(runId, context, response)
      );
      await emitHostEvent({
        type: "approval_responded",
        runId,
        requestId: response.requestId,
        approved: response.approved,
      });
      if (!response.approved) {
        const denied = failure(runId, "TOOL_DENIED", "Tool approval rejected.");
        await settle(
          runId,
          [{ type: "run_failed", data: { result: denied } }],
          "failed"
        );
        return denied;
      }
      return execute(
        {
          runId,
          input: "",
          context,
          history: state.history,
          resume: { call: resumedCall, approved: true },
        },
        false
      );
    },
    /**
     * Settles a matching clarification and resumes the provider with structured answers.
     * @param runId - Stable identifier of the agent run.
     * @param context - Authenticated execution context for the operation.
     * @param response - Response value to validate or persist.
     * @returns A promise that resolves with the operation result.
     */
    async respondClarification(
      runId: string,
      context: ExecutionContext,
      response: ClarificationResponse
    ): Promise<AgentResult> {
      // Wrong-owner, wrong-kind, and stale request IDs fail without resuming effects.
      if (!config.interactions)
        return failure(
          runId,
          "CAPABILITY_UNAVAILABLE",
          "Durable interaction manager is required."
        );
      const loaded = await config.store.load(runId);
      if (!loaded)
        return failure(
          runId,
          "INVOCATION_NOT_FOUND",
          `Run not found: ${runId}`
        );
      const state = reduceHarnessEvents(loaded.record, loaded.events);
      if (
        state.pending?.requestId !== response.requestId ||
        state.pendingExecution?.kind !== "clarification"
      ) {
        return failure(
          runId,
          "INVALID_REQUEST",
          "Clarification request does not match pending execution."
        );
      }
      await driver.run(runId, "durable_write", () =>
        config.interactions!.respondClarification(runId, context, response)
      );
      await emitHostEvent({
        type: "clarification_responded",
        runId,
        requestId: response.requestId,
        skipped: response.skipped,
        timedOut: response.timedOut,
      });
      return execute(
        {
          runId,
          input: "",
          context,
          history: state.history,
          resume: {
            call: state.pendingExecution.call,
            toolContent: JSON.stringify(response),
          },
        },
        false
      );
    },
    /**
     * Enqueues steer, follow-up, or next-run input under durable ownership checks.
     * @param runId - Stable identifier of the agent run.
     * @param context - Authenticated execution context for the operation.
     * @param queue - Queue lane that receives the input.
     * @param input - Validated input required by the operation.
     * @returns The enqueue result produced for the current operation.
     */
    async enqueue(
      runId: string,
      context: ExecutionContext,
      queue: "steer" | "followUp" | "nextRun",
      input: string
    ) {
      // Validate and append inside one driven optimistic-write boundary.
      return driver.run(runId, "durable_write", async () => {
        const loaded = await config.store.load(runId);
        if (!loaded)
          return {
            ok: false as const,
            error: {
              code: "INVOCATION_NOT_FOUND",
              message: `Run not found: ${runId}`,
            },
          };
        if (!ownsContext(loaded.record.context, context))
          return {
            ok: false as const,
            error: { code: "TOOL_DENIED", message: "Queue ownership denied." },
          };
        if (!input.trim())
          return {
            ok: false as const,
            error: {
              code: "INVALID_REQUEST",
              message: "Queue input must not be empty.",
            },
          };
        if (queue !== "nextRun" && loaded.record.status !== "running") {
          return {
            ok: false as const,
            error: {
              code: "INVALID_REQUEST",
              message: `${queue} requires an active run.`,
            },
          };
        }
        const queueId = id();
        await config.store.append(runId, loaded.record.version, [
          {
            type: "queue_enqueued",
            data: { queueId, queue, input },
            idempotencyKey: `queue:${queueId}:enqueued`,
          },
        ]);
        return { ok: true as const, value: { queueId, queue } };
      });
    },
    /**
     * Cancels one still-pending queue item without rewriting consumed transcript history.
     * @param runId - Stable identifier of the agent run.
     * @param context - Authenticated execution context for the operation.
     * @param queueId - Stable identifier of the queued input.
     * @returns Whether the requested condition is satisfied.
     */
    async cancelQueue(
      runId: string,
      context: ExecutionContext,
      queueId: string
    ) {
      // Replay status and append inside one driven optimistic-write boundary.
      return driver.run(runId, "durable_write", async () => {
        const loaded = await config.store.load(runId);
        if (!loaded)
          return {
            ok: false as const,
            error: {
              code: "INVOCATION_NOT_FOUND",
              message: `Run not found: ${runId}`,
            },
          };
        if (!ownsContext(loaded.record.context, context))
          return {
            ok: false as const,
            error: { code: "TOOL_DENIED", message: "Queue ownership denied." },
          };
        const item = reduceHarnessEvents(loaded.record, loaded.events).queues[
          queueId
        ];
        if (!item)
          return {
            ok: false as const,
            error: {
              code: "INVOCATION_NOT_FOUND",
              message: `Queue item not found: ${queueId}`,
            },
          };
        if (item.status !== "enqueued")
          return {
            ok: false as const,
            error: {
              code: "ALREADY_CONSUMED",
              message: "Queue item is no longer pending.",
            },
          };
        await config.store.append(runId, loaded.record.version, [
          {
            type: "queue_cancelled",
            data: { queueId },
            idempotencyKey: `queue:${queueId}:cancelled`,
          },
        ]);
        return { ok: true as const, value: { queueId } };
      });
    },
    /**
     * Requests abort, clears steer/follow-up, preserves next-run, and closes the run.
     * @param runId - Stable identifier of the agent run.
     * @returns A promise that resolves when the operation completes.
     */
    async abort(runId: string): Promise<void> {
      // Signal local work, let planned effects settle, then atomically finish abort.
      active.get(runId)?.abort(runId);
      const execution = executions.get(runId);
      if (execution) {
        await execution;
        return;
      }
      await settleAbort(runId, [{ type: "run_aborted", data: {} }]);
    },
    /**
     * Stops admission and local effects without inventing a successful operation outcome.
     * @param runId - Stable identifier of the agent run.
     * @returns A promise that resolves when the operation completes.
     */
    async close(runId: string): Promise<void> {
      // Drain the active execution after signalling before committing the final close marker.
      closing.add(runId);
      active.get(runId)?.abort(runId);
      try {
        await executions.get(runId);
        await driver.run(runId, "durable_write", async () => {
          const loaded = await config.store.load(runId);
          if (
            !loaded ||
            loaded.record.status === "closed" ||
            loaded.record.status === "aborted" ||
            loaded.record.status === "failed"
          )
            return;
          await config.store.settle(
            runId,
            loaded.record.version,
            [{ type: "run_closed", data: {} }],
            "closed"
          );
        });
      } finally {
        closing.delete(runId);
      }
    },
    /**
     * Fails an expired durable interaction through the normal timeout settlement path.
     * @param runId - Stable identifier of the agent run.
     * @param context - Authenticated execution context for the operation.
     * @returns A promise that resolves with the operation result.
     */
    async expireInteraction(
      runId: string,
      context: ExecutionContext
    ): Promise<AgentResult> {
      // Only an actually expired pending request can transition the run to failed.
      if (!config.interactions)
        return failure(
          runId,
          "CAPABILITY_UNAVAILABLE",
          "Durable interaction manager is required."
        );
      const loaded = await config.store.load(runId);
      if (!loaded)
        return failure(
          runId,
          "INVOCATION_NOT_FOUND",
          `Run not found: ${runId}`
        );
      const state = reduceHarnessEvents(loaded.record, loaded.events);
      const kind = state.pending?.kind;
      const response = await driver.run(runId, "durable_write", () =>
        config.interactions!.expire(runId, context)
      );
      if (!response || !kind)
        return failure(runId, "INVALID_REQUEST", "No expired interaction.");
      const result = failure(
        runId,
        kind === "approval" ? "APPROVAL_TIMEOUT" : "CLARIFICATION_TIMEOUT",
        kind === "approval" ? "Approval timed out." : "Clarification timed out."
      );
      await settle(runId, [{ type: "run_failed", data: { result } }], "failed");
      return result;
    },
  };
}
