import { AgenticError } from "./errors.ts";
import { ProvenanceLedger } from "./grounding.ts";
import {
  resolveAgentSkills,
  SKILL_INSTRUCTIONS_PREFIX,
} from "./skill-loading.ts";
import { redactTelemetry } from "./telemetry.ts";
import { ToolRegistry } from "./tool-registry.ts";
import type {
  AgentEvent,
  AgentMessage,
  AgentRequest,
  AgentResult,
  AgenticModuleConfig,
  ProviderRequest,
  ProviderResponse,
  SkillDefinition,
  SkillReference,
} from "./types.ts";
type Session = {
  history: AgentMessage[];
  context: AgentRequest["context"];
  disabledTools: Set<string>;
};
/**
 * Validates that every assistant tool call is followed by exactly one matching tool result.
 * @param messages - Provider transcript messages to inspect.
 * @returns Whether the requested condition is satisfied.
 */
function hasCompleteToolProtocol(messages: readonly AgentMessage[]): boolean {
  // Track open call IDs in transcript order so orphaned or duplicate results fail closed.
  const open = new Set<string>();
  for (const message of messages) {
    for (const call of message.toolCalls ?? []) {
      if (open.has(call.callId)) return false;
      open.add(call.callId);
    }
    if (message.role === "tool") {
      if (!message.toolCallId || !open.delete(message.toolCallId)) return false;
    }
  }
  return open.size === 0;
}
class InteractionRequired extends Error {
  readonly pending: NonNullable<
    Parameters<NonNullable<AgenticModuleConfig["onCheckpoint"]>>[0]["pending"]
  >;
  readonly history: AgentMessage[];
  /**
   * Captures the exact pending tool call and pre-effect history for durable suspension.
   * @param pending - Pending execution state to protect or resume.
   * @param history - Ordered agent transcript used by the operation.
   */
  constructor(
    pending: NonNullable<
      Parameters<NonNullable<AgenticModuleConfig["onCheckpoint"]>>[0]["pending"]
    >,
    history: AgentMessage[]
  ) {
    // Preserve declarative interaction state instead of an in-process continuation closure.
    super("Interaction required.");
    this.pending = pending;
    this.history = history;
  }
}
/**
 * Creates the portable provider-tool-provider runtime with policy and validation boundaries.
 * @param config - Configuration for the created component.
 * @returns The created or normalized operation result.
 */
export function createAgenticModule(config: AgenticModuleConfig) {
  // Keep only active controllers and completed in-process continuation sessions in local memory.
  const tools = config.tools ?? new ToolRegistry();
  const controllers = new Map<string, AbortController>();
  const sessions = new Map<string, Session>();
  /**
   * Publishes one agent lifecycle event.
   * @param event - Event or lifecycle value to process.
   * @returns The emit result produced for the current operation.
   */
  const emit = (event: AgentEvent) => config.emit?.(event);
  /**
   * Normalizes streaming and non-streaming provider responses into one loop protocol.
   * @param request - Request values required by the operation.
   * @param runId - Stable identifier of the agent run.
   * @param context - Authenticated execution context for the operation.
   * @returns A promise that resolves with the operation result.
   * @throws When validation, persistence, policy, or the delegated operation fails.
   */
  async function callProvider(
    request: ProviderRequest,
    runId: string,
    context: AgentRequest["context"]
  ): Promise<ProviderResponse> {
    // Emit transport-neutral chunks while accumulating the same final response used by sync providers.
    if (!config.provider.stream) {
      const response = await config.provider.complete(request);
      if (
        response.type === "text" &&
        response.text.length >
          (config.maxOutputCharacters ?? Number.MAX_SAFE_INTEGER)
      ) {
        throw new AgenticError(
          "OUTPUT_LIMIT",
          "Provider output exceeded the configured character limit."
        );
      }
      if (response.type === "tool_call")
        await emit({
          type: "tool_call_ready",
          runId,
          toolName: response.name,
          callId: response.callId,
          arguments:
            (await config.redactToolArguments?.(response.arguments, context)) ??
            redactTelemetry(response.arguments),
        });
      if (response.type === "tool_calls") {
        for (const call of response.calls)
          await emit({
            type: "tool_call_ready",
            runId,
            toolName: call.name,
            callId: call.callId,
            arguments:
              (await config.redactToolArguments?.(call.arguments, context)) ??
              redactTelemetry(call.arguments),
          });
      }
      if (response.type === "text" && response.usage)
        await emit({ type: "usage", runId, usage: response.usage });
      return response;
    }
    let text = "";
    for await (const chunk of config.provider.stream(request)) {
      if (chunk.type === "tool_call") {
        await emit({
          type: "tool_call_ready",
          runId,
          toolName: chunk.name,
          callId: chunk.callId,
          arguments:
            (await config.redactToolArguments?.(chunk.arguments, context)) ??
            redactTelemetry(chunk.arguments),
        });
        return chunk;
      }
      if (chunk.type === "thinking_summary_delta") {
        await emit({ type: "thinking_summary_delta", runId, text: chunk.text });
      } else if (chunk.type === "usage") {
        await emit({ type: "usage", runId, usage: chunk.usage });
      } else {
        if (
          text.length + chunk.text.length >
          (config.maxOutputCharacters ?? Number.MAX_SAFE_INTEGER)
        ) {
          throw new AgenticError(
            "OUTPUT_LIMIT",
            "Provider output exceeded the configured character limit."
          );
        }
        text += chunk.text;
        await emit({ type: "output_delta", runId, text: chunk.text });
      }
    }
    return { type: "text", text };
  }
  /**
   * Runs or resumes one bounded agent turn and emits exactly one terminal result event.
   * @param request - Request values required by the operation.
   * @param disabledTools - Tool names excluded from this execution.
   * @returns A promise that resolves with the operation result.
   * @throws When validation, persistence, policy, or the delegated operation fails.
   */
  async function run(
    request: AgentRequest,
    disabledTools = new Set<string>()
  ): Promise<AgentResult> {
    // Create a child controller so host abort and module abort share one cancellation boundary.
    const controller = new AbortController();
    controllers.set(request.runId, controller);
    request.signal?.addEventListener("abort", () => controller.abort(), {
      once: true,
    });
    const citationLedger = new ProvenanceLedger();
    const artifacts: AgentResult["artifacts"] = [];
    await emit({ type: "run_started", runId: request.runId });
    let result: AgentResult;
    let finalHistory: AgentMessage[] | undefined;
    let pending: Parameters<
      NonNullable<AgenticModuleConfig["onCheckpoint"]>
    >[0]["pending"];
    try {
      if (controller.signal.aborted)
        throw new AgenticError("ABORTED", "Run aborted.");
      const freshContext = request.resume
        ? []
        : ((await config.loadContext?.(request.context, controller.signal)) ??
          []);
      for (const { citation } of freshContext) citationLedger.add(citation);
      const baseHistory = (request.history ?? []).filter(
        ({ role, content }) =>
          role !== "system" || !content.startsWith(SKILL_INSTRUCTIONS_PREFIX)
      );
      let skillSnapshot: SkillReference[] = [];
      let skillDefinitions: SkillDefinition[] = [];
      if (config.skills) {
        const agentId = request.context.agentId?.trim();
        if (!agentId)
          throw new AgenticError(
            "INVALID_REQUEST",
            "Agent-scoped skill loading requires context.agentId."
          );
        const resolved = await resolveAgentSkills(config.skills, {
          agentId,
          runId: request.runId,
          request: request.input,
          context: request.context,
          signal: controller.signal,
          snapshot: request.skillSnapshot,
        });
        skillSnapshot = resolved.snapshot;
        skillDefinitions = resolved.definitions;
        if (skillSnapshot.length && !request.skillSnapshot)
          await emit({
            type: "skills_selected",
            runId: request.runId,
            skills: structuredClone(skillSnapshot),
          });
      }
      const skillInstruction = skillDefinitions.length
        ? {
            role: "system" as const,
            content: `${SKILL_INSTRUCTIONS_PREFIX}\n${skillDefinitions
              .map(
                ({ name, version, instructions }) =>
                  `<skill name="${name}" version="${version}">\n${instructions}\n</skill>`
              )
              .join("\n")}\n</agentic-skills>`,
          }
        : undefined;
      const history: AgentMessage[] = [
        ...baseHistory,
        ...(freshContext.length
          ? [
              {
                role: "system" as const,
                content: `<untrusted-context>\n${freshContext.map(({ content }) => content).join("\n\n")}\n</untrusted-context>`,
              },
            ]
          : []),
        ...(skillInstruction ? [skillInstruction] : []),
        ...(!request.resume
          ? [
              {
                role: "user" as const,
                content: request.input,
                attachments: request.attachments,
              },
            ]
          : []),
      ];
      const loadedSkills =
        (await config.loadSkills?.({
          runId: request.runId,
          input: request.input,
          context: request.context,
          signal: controller.signal,
        })) ?? [];
      const definitions = [
        ...tools.list(),
        ...skillDefinitions.flatMap(({ tools: skillTools }) => skillTools),
        ...loadedSkills,
      ].filter(
        ({ name }) => !disabledTools.has(name)
      );
      if (
        new Set(definitions.map(({ name }) => name)).size !== definitions.length
      ) {
        throw new AgenticError(
          "INVALID_REQUEST",
          "Duplicate static tool or automatically loaded skill name."
        );
      }
      if (skillDefinitions.length || loadedSkills.length)
        await emit({
          type: "skills_loaded",
          runId: request.runId,
          skillNames: [
            ...skillDefinitions.map(({ name }) => name),
            ...loadedSkills.map(({ name }) => name),
          ],
        });
      const toolByName = new Map(definitions.map((tool) => [tool.name, tool]));
      const providerTools = definitions.map(
        ({ name, description, parameters }) => ({
          name,
          description,
          parameters,
        })
      );
      const maxToolCalls = Math.max(0, config.maxToolCalls ?? 10);
      let count = 0;
      let directOutput: string | undefined;
      let response: ProviderResponse;
      const resumedTool =
        request.resume && "call" in request.resume ? request.resume : undefined;
      /**
       * Compacts current history when threshold or provider overflow requires it.
       * @param force - Whether compaction must run below the normal threshold.
       * @returns The compactContext result produced for the current operation.
       * @throws When validation, persistence, policy, or the delegated operation fails.
       */
      const compactContext = async (force = false) => {
        // Validate the compacted size before replacing history or calling the provider.
        if (config.contextWindow) {
          const beforeTokens =
            await config.contextWindow.estimateTokens(history);
          if (force || beforeTokens > config.contextWindow.maxInputTokens) {
            await config.onCompactionEffect?.({
              phase: "planned",
              runId: request.runId,
              history: [...history],
              beforeTokens,
            });
            await config.onCompactionEffect?.({
              phase: "started",
              runId: request.runId,
              history: [...history],
              beforeTokens,
            });
            try {
              const compacted = await config.contextWindow.compact({
                messages: [...history],
                targetTokens: config.contextWindow.maxInputTokens,
                context: request.context,
                signal: controller.signal,
              });
              const afterTokens =
                await config.contextWindow.estimateTokens(compacted);
              if (afterTokens > config.contextWindow.maxInputTokens) {
                throw new AgenticError(
                  "BUDGET_EXHAUSTED",
                  "Compacted context still exceeds the input limit."
                );
              }
              if (!hasCompleteToolProtocol(compacted)) {
                throw new AgenticError(
                  "COMPACTION_INVALID",
                  "Compaction split or orphaned a tool-call protocol pair."
                );
              }
              history.splice(0, history.length, ...compacted);
              await config.onCompactionEffect?.({
                phase: "settled",
                runId: request.runId,
                history: [...history],
                beforeTokens,
                afterTokens,
                outcome: "completed",
              });
              await config.onContextCompacted?.({
                history: [...history],
                beforeTokens,
                afterTokens,
                context: request.context,
              });
              await emit({
                type: "context_compacted",
                runId: request.runId,
                beforeTokens,
                afterTokens,
              });
            } catch (error) {
              await config.onCompactionEffect?.({
                phase: "settled",
                runId: request.runId,
                history: [...history],
                beforeTokens,
                outcome: "failed",
              });
              throw error;
            }
          }
        }
      };
      /**
       * Calls the provider with preflight compaction and one overflow-compaction retry.
       * @param includeTools - Whether provider-visible tool definitions are included.
       * @returns The askProvider result produced for the current operation.
       * @throws When validation, persistence, policy, or the delegated operation fails.
       */
      const askProvider = async (includeTools = true) => {
        // Rebuild the request after forced compaction so stale messages are never retried.
        await compactContext();
        const providerRequest = {
          messages: [...history],
          tools: includeTools ? providerTools : [],
          signal: controller.signal,
        };
        try {
          return await callProvider(
            providerRequest,
            request.runId,
            request.context
          );
        } catch (error) {
          if (
            !(error instanceof AgenticError) ||
            error.code !== "CONTEXT_OVERFLOW" ||
            !config.contextWindow
          )
            throw error;
          await compactContext(true);
          return callProvider(
            { ...providerRequest, messages: [...history] },
            request.runId,
            request.context
          );
        }
      };
      if (request.resume && "providerResponse" in request.resume) {
        response = request.resume.providerResponse;
      } else if (request.resume && "deferred" in request.resume) {
        if (!config.provider.fetchDeferred)
          throw new AgenticError(
            "CAPABILITY_UNAVAILABLE",
            "Provider does not support deferred polling."
          );
        response = await config.provider.fetchDeferred(
          request.resume.deferred,
          controller.signal
        );
      } else if (resumedTool?.toolContent !== undefined) {
        history.push({
          role: "tool",
          content: resumedTool.toolContent,
          toolCallId: resumedTool.call.callId,
        });
        response = await askProvider();
      } else if (resumedTool) {
        response = resumedTool.call;
      } else {
        response = await askProvider(maxToolCalls > 0);
      }
      while (response.type === "tool_call" || response.type === "tool_calls") {
        if (response.type === "tool_calls") {
          const calls = response.calls.map((call) => ({
            type: "tool_call" as const,
            ...call,
          }));
          if (!calls.length)
            throw new AgenticError(
              "INVALID_REQUEST",
              "Tool batch must not be empty."
            );
          if (count + calls.length > maxToolCalls)
            throw new AgenticError(
              "BUDGET_EXHAUSTED",
              "Tool-call budget exhausted."
            );
          history.push({
            role: "assistant",
            content: "",
            toolCalls: calls.map(
              ({ callId, name, arguments: argumentsValue }) => ({
                callId,
                name,
                arguments: argumentsValue,
              })
            ),
          });
          const prepared = [] as Array<{
            call: Extract<
              ProviderResponse,
              {
                type: "tool_call";
              }
            >;
            tool: NonNullable<ReturnType<typeof tools.get>>;
          }>;
          for (const call of calls) {
            const tool = toolByName.get(call.name);
            if (!tool || disabledTools.has(call.name))
              throw new AgenticError(
                "TOOL_NOT_FOUND",
                `Tool not found: ${call.name}`
              );
            if (
              config.validateToolInput &&
              !(await config.validateToolInput(tool.parameters, call.arguments))
            ) {
              throw new AgenticError(
                "TOOL_ARGUMENTS_INVALID",
                `Invalid arguments for tool: ${tool.name}`
              );
            }
            if (!(await config.policy.authorize(tool, request.context)))
              throw new AgenticError(
                "TOOL_DENIED",
                `Tool denied: ${tool.name}`
              );
            await config.onToolEffect?.({
              phase: "planned",
              runId: request.runId,
              call,
              tool,
              history: [...history],
            });
            if (tool.risk !== "read") {
              const approved =
                (await config.policy.isApproved?.(tool, request.context)) ||
                (await config.approval?.request({
                  runId: request.runId,
                  tool,
                  arguments: call.arguments,
                  context: request.context,
                  signal: controller.signal,
                })) ||
                false;
              if (typeof approved === "object" && approved.pending)
                throw new InteractionRequired(
                  { kind: "approval", call },
                  history
                );
              if (!approved)
                throw new AgenticError(
                  "TOOL_DENIED",
                  `Approval required: ${tool.name}`
                );
            }
            prepared.push({ call, tool });
          }
          /**
           * Persists and emits one batch tool start before its external effect.
           * @param options - Optional controls for the operation.
           * @returns The markStarted result produced for the current operation.
           */
          const markStarted = async ({
            call,
            tool,
          }: (typeof prepared)[number]) => {
            // Source-order start markers make parallel recovery deterministic.
            await config.onToolEffect?.({
              phase: "started",
              runId: request.runId,
              call,
              tool,
              history: [...history],
            });
            await emit({
              type: "tool_started",
              runId: request.runId,
              toolName: tool.name,
              callId: call.callId,
            });
          };
          /**
           * Executes one already-validated batch call through the configured effect driver.
           * @param options - Optional controls for the operation.
           * @returns The executePrepared result produced for the current operation.
           */
          const executePrepared = async ({
            call,
            tool,
          }: (typeof prepared)[number]) => {
            // Preparation owns authorization; this function crosses only the tool effect boundary.
            /**
             * Executes one validated tool call.
             * @returns The executeTool result produced for the current operation.
             */
            const executeTool = () =>
              tool.execute(call.arguments, {
                runId: request.runId,
                execution: request.context,
                signal: controller.signal,
                /**
                 * Registers a citation produced by the current tool execution.
                 * @param citation - Current-run citation to register or validate.
                 * @returns The addCitation result produced for the current operation.
                 */
                addCitation: (citation) => citationLedger.add(citation),
                /**
                 * Registers an artifact produced by the current tool execution.
                 * @param artifact - Artifact metadata and payload to register or persist.
                 * @returns The addArtifact result produced for the current operation.
                 */
                addArtifact: (artifact) => artifacts.push(artifact),
              });
            return config.executeEffect
              ? config.executeEffect(
                  { runId: request.runId, kind: "tool" },
                  executeTool
                )
              : executeTool();
          };
          const outputs: Awaited<ReturnType<typeof executePrepared>>[] = [];
          if (config.toolExecution === "parallel") {
            for (const item of prepared) await markStarted(item);
            const settled = await Promise.allSettled(
              prepared.map(executePrepared)
            );
            let failure: unknown;
            for (let index = 0; index < settled.length; index += 1) {
              const outcome = settled[index];
              if (outcome.status === "fulfilled") outputs.push(outcome.value);
              else {
                const { call, tool } = prepared[index];
                await config.onToolEffect?.({
                  phase: "settled",
                  runId: request.runId,
                  call,
                  tool,
                  history: [...history],
                  outcome: "failed",
                });
                failure ??= outcome.reason;
              }
            }
            if (failure) throw failure;
          } else {
            for (const item of prepared) {
              await markStarted(item);
              try {
                outputs.push(await executePrepared(item));
              } catch (error) {
                await config.onToolEffect?.({
                  phase: "settled",
                  runId: request.runId,
                  call: item.call,
                  tool: item.tool,
                  history: [...history],
                  outcome: "failed",
                });
                throw error;
              }
            }
          }
          for (let index = 0; index < prepared.length; index += 1) {
            const { call, tool } = prepared[index];
            const output = outputs[index];
            count += 1;
            if (output.type === "needs_input") {
              await config.onToolEffect?.({
                phase: "settled",
                runId: request.runId,
                call,
                tool,
                history: [...history],
                outcome: "needs_input",
              });
              throw new InteractionRequired(
                {
                  kind: "clarification",
                  call,
                  interaction: output.interaction,
                },
                history
              );
            }
            history.push({
              role: "tool",
              content: output.content,
              toolCallId: call.callId,
            });
            await config.onToolEffect?.({
              phase: "settled",
              runId: request.runId,
              call,
              tool,
              history: [...history],
              outcome: "completed",
            });
            const visibleOutput =
              (await config.redactToolOutput?.(
                output.content,
                request.context
              )) ?? output.content;
            await emit({
              type: "tool_output_delta",
              runId: request.runId,
              toolName: tool.name,
              callId: call.callId,
              text: visibleOutput,
            });
            await emit({
              type: "tool_finished",
              runId: request.runId,
              toolName: tool.name,
              callId: call.callId,
            });
          }
          const steer =
            (await config.takeSteer?.({
              runId: request.runId,
              context: request.context,
              history: [...history],
            })) ?? [];
          history.push(
            ...steer.map((content) => ({ role: "user" as const, content }))
          );
          if (outputs.every(({ type }) => type === "direct_output")) {
            directOutput = outputs
              .map((output) =>
                output.type === "direct_output" ? output.content : ""
              )
              .join("\n");
            break;
          }
          response = await askProvider(count < maxToolCalls);
          continue;
        }
        const call = response;
        if (count >= maxToolCalls)
          throw new AgenticError(
            "BUDGET_EXHAUSTED",
            "Tool-call budget exhausted."
          );
        const tool = toolByName.get(call.name);
        if (!tool || disabledTools.has(call.name))
          throw new AgenticError(
            "TOOL_NOT_FOUND",
            `Tool not found: ${call.name}`
          );
        if (
          config.validateToolInput &&
          !(await config.validateToolInput(tool.parameters, call.arguments))
        ) {
          throw new AgenticError(
            "TOOL_ARGUMENTS_INVALID",
            `Invalid arguments for tool: ${tool.name}`
          );
        }
        if (!(await config.policy.authorize(tool, request.context))) {
          throw new AgenticError("TOOL_DENIED", `Tool denied: ${tool.name}`);
        }
        const previous = history.at(-1);
        if (
          !previous?.toolCalls?.some(({ callId }) => callId === call.callId)
        ) {
          history.push({
            role: "assistant",
            content: "",
            toolCalls: [
              {
                callId: call.callId,
                name: call.name,
                arguments: call.arguments,
              },
            ],
          });
        }
        await config.onToolEffect?.({
          phase: "planned",
          runId: request.runId,
          call,
          tool,
          history: [...history],
        });
        if (tool.risk !== "read") {
          let approved:
            | boolean
            | {
                pending: true;
                timeoutMs?: number;
                displayPayload?: Record<string, unknown>;
              } =
            resumedTool?.approved === true &&
            resumedTool.call.callId === call.callId;
          if (!approved)
            approved =
              (await config.policy.isApproved?.(tool, request.context)) ||
              (await config.approval?.request({
                runId: request.runId,
                tool,
                arguments: call.arguments,
                context: request.context,
                signal: controller.signal,
              })) ||
              false;
          if (typeof approved === "object" && approved.pending) {
            throw new InteractionRequired({ kind: "approval", call }, history);
          }
          if (!approved)
            throw new AgenticError(
              "TOOL_DENIED",
              `Approval required: ${tool.name}`
            );
        }
        await config.onToolEffect?.({
          phase: "started",
          runId: request.runId,
          call,
          tool,
          history: [...history],
        });
        await emit({
          type: "tool_started",
          runId: request.runId,
          toolName: tool.name,
          callId: call.callId,
        });
        let output: Awaited<ReturnType<typeof tool.execute>>;
        try {
          /**
           * Executes one validated tool call.
           * @returns The executeTool result produced for the current operation.
           */
          const executeTool = () =>
            tool.execute(call.arguments, {
              runId: request.runId,
              execution: request.context,
              signal: controller.signal,
              /**
               * Registers a citation produced by the current tool execution.
               * @param citation - Current-run citation to register or validate.
               * @returns The addCitation result produced for the current operation.
               */
              addCitation: (citation) => citationLedger.add(citation),
              /**
               * Registers an artifact produced by the current tool execution.
               * @param artifact - Artifact metadata and payload to register or persist.
               * @returns The addArtifact result produced for the current operation.
               */
              addArtifact: (artifact) => artifacts.push(artifact),
            });
          output = config.executeEffect
            ? await config.executeEffect(
                { runId: request.runId, kind: "tool" },
                executeTool
              )
            : await executeTool();
        } catch (error) {
          await config.onToolEffect?.({
            phase: "settled",
            runId: request.runId,
            call,
            tool,
            history: [...history],
            outcome: "failed",
          });
          throw error;
        }
        count += 1;
        if (output.type === "needs_input") {
          await config.onToolEffect?.({
            phase: "settled",
            runId: request.runId,
            call,
            tool,
            history: [...history],
            outcome: "needs_input",
          });
          throw new InteractionRequired(
            { kind: "clarification", call, interaction: output.interaction },
            history
          );
        }
        history.push({
          role: "tool",
          content: output.content,
          toolCallId: call.callId,
        });
        await config.onToolEffect?.({
          phase: "settled",
          runId: request.runId,
          call,
          tool,
          history: [...history],
          outcome: "completed",
        });
        const steer =
          (await config.takeSteer?.({
            runId: request.runId,
            context: request.context,
            history: [...history],
          })) ?? [];
        history.push(
          ...steer.map((content) => ({ role: "user" as const, content }))
        );
        const visibleOutput =
          (await config.redactToolOutput?.(output.content, request.context)) ??
          output.content;
        await emit({
          type: "tool_output_delta",
          runId: request.runId,
          toolName: tool.name,
          callId: call.callId,
          text: visibleOutput,
        });
        await emit({
          type: "tool_finished",
          runId: request.runId,
          toolName: tool.name,
          callId: call.callId,
        });
        if (output.type === "direct_output") {
          directOutput = output.content;
          break;
        }
        response = await askProvider(count < maxToolCalls);
      }
      if (response.type === "deferred") {
        finalHistory = history;
        result = {
          runId: request.runId,
          status: "suspended",
          deferred: response.handle,
          citations: citationLedger.list(),
          artifacts,
        };
        await emit({
          type: "run_suspended",
          runId: request.runId,
          deferred: response.handle,
        });
      } else {
        const text =
          directOutput ?? (response.type === "text" ? response.text : "");
        if (
          text.length > (config.maxOutputCharacters ?? Number.MAX_SAFE_INTEGER)
        ) {
          throw new AgenticError(
            "OUTPUT_LIMIT",
            "Final output exceeded the configured character limit."
          );
        }
        if (response.type === "text" && response.citationIds)
          citationLedger.requireKnown(response.citationIds);
        await emit({
          type: "final_output_candidate",
          runId: request.runId,
          text,
        });
        if (!text.trim())
          throw new AgenticError(
            "FINAL_OUTPUT_INVALID",
            "Final output must not be empty."
          );
        const validation = await config.validateFinalOutput?.({
          text,
          citations: citationLedger.list(),
          artifacts,
          context: request.context,
        });
        if (validation && !validation.ok) {
          throw new AgenticError(
            "FINAL_OUTPUT_INVALID",
            validation.errors.join("; ")
          );
        }
        await emit({
          type: "final_output_validated",
          runId: request.runId,
          text,
        });
        history.push({ role: "assistant", content: text });
        finalHistory = history;
        result = {
          runId: request.runId,
          status: "completed",
          text,
          citations: citationLedger.list(),
          artifacts,
        };
      }
    } catch (error) {
      if (error instanceof InteractionRequired) {
        pending = error.pending;
        finalHistory = error.history;
        result = {
          runId: request.runId,
          status: "needs_input",
          citations: citationLedger.list(),
          artifacts,
        };
      } else {
        const aborted =
          controller.signal.aborted ||
          (error instanceof AgenticError && error.code === "ABORTED");
        const known = error instanceof AgenticError ? error : undefined;
        result = {
          runId: request.runId,
          status: aborted ? "aborted" : "failed",
          citations: citationLedger.list(),
          artifacts,
          error: {
            code: aborted ? "ABORTED" : (known?.code ?? "RUN_FAILED"),
            message: aborted
              ? "Run aborted."
              : (known?.message ??
                (error instanceof Error ? error.message : String(error))),
            retryable: known?.retryable ?? false,
          },
        };
      }
    }
    if (finalHistory)
      await config.onCheckpoint?.({
        history: finalHistory,
        toolCalls: finalHistory.filter(({ role }) => role === "tool").length,
        result,
        pending,
      });
    if (result.status === "completed" && config.saveResult) {
      try {
        await config.saveResult(result, request.context);
      } catch {
        result = {
          ...result,
          status: "failed",
          text: undefined,
          error: {
            code: "PERSISTENCE_FAILED",
            message: "Failed to persist run result.",
            retryable: true,
          },
        };
      }
    }
    for (const artifact of artifacts)
      await emit({ type: "artifact_created", runId: request.runId, artifact });
    const citations = citationLedger.list();
    if (citations.length)
      await emit({ type: "citations", runId: request.runId, citations });
    await emit({ type: "run_finished", runId: request.runId, result });
    controllers.delete(request.runId);
    if (finalHistory)
      sessions.set(request.runId, {
        history: finalHistory,
        context: request.context,
        disabledTools,
      });
    return result;
  }
  const module = {
    /**
     * Starts a new in-process agent session.
     * @param request - Request values required by the operation.
     * @returns A promise that resolves with the operation result.
     */
    start(request: AgentRequest): Promise<AgentResult> {
      // Delegate to the single run state machine with all tools initially enabled.
      return run(request);
    },
    /**
     * Continues a completed in-process session with a new user message.
     * @param runId - Stable identifier of the agent run.
     * @param input - Validated input required by the operation.
     * @returns A promise that resolves with the operation result.
     */
    async continue(runId: string, input: string): Promise<AgentResult> {
      // Reuse stored history and context; missing sessions fail as typed results.
      const session = sessions.get(runId);
      if (!session)
        return {
          runId,
          status: "failed",
          citations: [],
          artifacts: [],
          error: {
            code: "INVOCATION_NOT_FOUND",
            message: `Run not found: ${runId}`,
            retryable: false,
          },
        };
      return run(
        { runId, input, context: session.context, history: session.history },
        session.disabledTools
      );
    },
    /**
     * Enables or disables a registered tool after management authorization.
     * @param runId - Stable identifier of the agent run.
     * @param toolName - Canonical name of the tool to update.
     * @param enabled - Whether the requested tool remains active.
     * @returns A promise that resolves when the operation completes.
     * @throws When validation, persistence, policy, or the delegated operation fails.
     */
    async setToolEnabled(
      runId: string,
      toolName: string,
      enabled: boolean
    ): Promise<void> {
      // Validate session, permission, and tool identity before mutating the disabled set.
      const session = sessions.get(runId);
      if (!session)
        throw new AgenticError(
          "INVOCATION_NOT_FOUND",
          `Run not found: ${runId}`
        );
      if (
        !config.policy.canManageTools ||
        !(await config.policy.canManageTools(session.context))
      ) {
        throw new AgenticError("TOOL_DENIED", "Tool management denied.");
      }
      if (!tools.get(toolName))
        throw new AgenticError("TOOL_NOT_FOUND", `Tool not found: ${toolName}`);
      enabled
        ? session.disabledTools.delete(toolName)
        : session.disabledTools.add(toolName);
    },
    /**
     * Aborts active provider/tool work and removes local continuation state.
     * @param runId - Stable identifier of the agent run.
     * @returns Nothing; completion indicates that the operation finished.
     */
    abort(runId: string): void {
      // Abort is best effort and idempotent for unknown or already-settled runs.
      controllers.get(runId)?.abort();
      sessions.delete(runId);
    },
  };
  return module;
}
