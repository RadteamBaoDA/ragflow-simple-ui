export type JsonSchema = Record<string, unknown>;
export type ExecutionContext = Record<string, unknown> & {
  agentId?: string;
  principalId?: string;
  tenantId?: string;
  workspaceId?: string;
  conversationId?: string;
};
export type Attachment = {
  id: string;
  mediaType: string;
  name?: string;
  data?: unknown;
  storageRef?: string;
};
export type AgentMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  toolCallId?: string;
  toolCalls?: Array<{
    callId: string;
    name: string;
    arguments: unknown;
  }>;
  attachments?: Attachment[];
};
export type ProviderResponse =
  | {
      type: "text";
      text: string;
      usage?: Record<string, number>;
      citationIds?: string[];
    }
  | {
      type: "tool_call";
      callId: string;
      name: string;
      arguments: unknown;
    }
  | {
      type: "tool_calls";
      calls: Array<{
        callId: string;
        name: string;
        arguments: unknown;
      }>;
    }
  | {
      type: "deferred";
      handle: DeferredHandle;
      usage?: Record<string, number>;
    };
export type DeferredHandle = {
  provider: string;
  id: string;
  pollAfterMs: number;
  metadata?: Record<string, unknown>;
};
export type ProviderChunk =
  | {
      type: "text_delta";
      text: string;
    }
  | {
      type: "thinking_summary_delta";
      text: string;
    }
  | {
      type: "usage";
      usage: Record<string, number>;
    }
  | {
      type: "tool_call";
      callId: string;
      name: string;
      arguments: unknown;
    };
export interface ProviderAdapter {
  /**
   * Determines whether native tool calling is supported.
   * @param model - Optional model identifier used for capability detection.
   * @returns A promise that resolves with the operation result.
   */
  supportsNativeToolCalling(model?: string): boolean | Promise<boolean>;
  /**
   * Completes one provider request.
   * @param request - Request values required by the operation.
   * @returns A promise that resolves with the operation result.
   */
  complete(request: ProviderRequest): Promise<ProviderResponse>;
  /**
   * Streams one provider request.
   * @param request - Request values required by the operation.
   * @returns An asynchronous stream of provider or action values.
   */
  stream?(request: ProviderRequest): AsyncIterable<ProviderChunk>;
  /**
   * Polls one persisted deferred-provider handle.
   * @param handle - Persisted deferred-provider handle to poll.
   * @param signal - Abort signal propagated to external work.
   * @returns A promise that resolves with the operation result.
   */
  fetchDeferred?(
    handle: DeferredHandle,
    signal: AbortSignal
  ): Promise<ProviderResponse>;
}
export type ProviderRequest = {
  messages: AgentMessage[];
  tools: Array<{
    name: string;
    description: string;
    parameters: JsonSchema;
  }>;
  signal: AbortSignal;
};
export type Citation = {
  id: string;
  title: string;
  sourceRef: string;
  excerpt?: string;
  score?: number;
};
export type Artifact = {
  id: string;
  kind: "file" | "chart" | "image" | "custom";
  mediaType: string;
  displayName?: string;
  payload: unknown;
  storageRef?: string;
};
export type ToolResult =
  | {
      type: "continue";
      content: string;
    }
  | {
      type: "direct_output";
      content: string;
    }
  | {
      type: "needs_input";
      interaction: {
        kind: "clarification";
        questions: ClarificationQuestion[];
        allowSkip: boolean;
        timeoutMs: number;
      };
    };
export interface ToolContext {
  runId: string;
  execution: ExecutionContext;
  signal: AbortSignal;
  /**
   * Registers a citation produced by the current tool execution.
   * @param citation - Current-run citation to register or validate.
   * @returns Nothing; completion indicates that the operation finished.
   */
  addCitation(citation: Citation): void;
  /**
   * Registers an artifact produced by the current tool execution.
   * @param artifact - Artifact metadata and payload to register or persist.
   * @returns Nothing; completion indicates that the operation finished.
   */
  addArtifact(artifact: Artifact): void;
}
export interface ToolDefinition {
  name: string;
  description: string;
  parameters: JsonSchema;
  risk: "read" | "write" | "external";
  replay?: "safe" | "never";
  /**
   * Executes the configured operation.
   * @param input - Validated input required by the operation.
   * @param context - Authenticated execution context for the operation.
   * @returns A promise that resolves with the operation result.
   */
  execute(input: unknown, context: ToolContext): Promise<ToolResult>;
}
export type SkillReference = {
  id: string;
  name: string;
  version: string;
  digest: string;
};
export type SkillCatalogEntry = SkillReference & {
  description: string;
  triggers?: string[];
  allowImplicitInvocation?: boolean;
};
export type SkillDefinition = SkillReference & {
  instructions: string;
  tools: ToolDefinition[];
};
export interface SkillRuntimeAdapter {
  /**
   * Lists only enabled skill metadata bound to the authenticated agent.
   * @param input - Agent-scoped catalog request.
   * @returns Skill metadata that the current agent is authorized to use.
   */
  listCatalog(input: {
    agentId: string;
    runId: string;
    context: ExecutionContext;
    signal: AbortSignal;
  }): Promise<SkillCatalogEntry[]>;
  /**
   * Loads exact immutable skill versions after request-level selection.
   * @param input - Selected skill identities and authenticated execution context.
   * @returns Full instructions and tools for every selected identity.
   */
  load(input: {
    agentId: string;
    runId: string;
    skills: SkillReference[];
    context: ExecutionContext;
    signal: AbortSignal;
  }): Promise<SkillDefinition[]>;
  /**
   * Optionally replaces deterministic local matching with host full-text or semantic ranking.
   * @param input - User request and the already authorized agent catalog.
   * @returns A bounded subset containing identities from the supplied catalog.
   */
  select?(input: {
    agentId: string;
    runId: string;
    input: string;
    catalog: SkillCatalogEntry[];
    context: ExecutionContext;
    signal: AbortSignal;
  }): Promise<SkillReference[]>;
  maxSelected?: number;
}
export type ToolEffectLifecycleEvent = {
  phase: "planned" | "started" | "settled";
  runId: string;
  call: Extract<
    ProviderResponse,
    {
      type: "tool_call";
    }
  >;
  tool: ToolDefinition;
  history: AgentMessage[];
  outcome?: "completed" | "needs_input" | "failed";
};
export type CompactionEffectLifecycleEvent = {
  phase: "planned" | "started" | "settled";
  runId: string;
  history: AgentMessage[];
  beforeTokens: number;
  afterTokens?: number;
  outcome?: "completed" | "failed";
};
export interface PolicyAdapter {
  /**
   * Determines whether policy permits the requested operation.
   * @param tool - Tool definition subject to policy or execution.
   * @param context - Authenticated execution context for the operation.
   * @returns A promise that resolves with the operation result.
   */
  authorize(
    tool: ToolDefinition,
    context: ExecutionContext
  ): boolean | Promise<boolean>;
  /**
   * Determines whether the tool already has approval.
   * @param tool - Tool definition subject to policy or execution.
   * @param context - Authenticated execution context for the operation.
   * @returns A promise that resolves with the operation result.
   */
  isApproved?(
    tool: ToolDefinition,
    context: ExecutionContext
  ): boolean | Promise<boolean>;
  /**
   * Determines whether the caller may manage tool activation.
   * @param context - Authenticated execution context for the operation.
   * @returns A promise that resolves with the operation result.
   */
  canManageTools?(context: ExecutionContext): boolean | Promise<boolean>;
}
export interface ApprovalAdapter {
  /**
   * Requests a host-mediated interaction.
   * @param input - Validated input required by the operation.
   * @returns A promise that resolves with the operation result.
   */
  request(input: {
    runId: string;
    tool: ToolDefinition;
    arguments: unknown;
    context: ExecutionContext;
    signal: AbortSignal;
  }): Promise<
    | boolean
    | {
        pending: true;
        timeoutMs?: number;
        displayPayload?: Record<string, unknown>;
      }
  >;
}
export type ApprovalRequest = {
  requestId: string;
  toolName: string;
  description?: string;
  displayPayload?: Record<string, unknown>;
  timeoutMs: number;
  expiresAt: number;
};
export type ApprovalResponse = {
  requestId: string;
  approved: boolean;
  alwaysAllow?: boolean;
};
export type ClarificationQuestion =
  | {
      kind: "input";
      question: string;
      inputType?: string;
    }
  | {
      kind: "choice";
      question: string;
      choices: string[];
      multiple?: boolean;
    };
export type ClarificationRequest = {
  requestId: string;
  questions: ClarificationQuestion[];
  allowSkip: boolean;
  timeoutMs: number;
  expiresAt: number;
};
export type ClarificationResponse = {
  requestId: string;
  skipped: boolean;
  timedOut: boolean;
  answers: Array<{
    skipped: boolean;
    answer: unknown;
  }>;
};
export type AgentRequest = {
  runId: string;
  input: string;
  context: ExecutionContext;
  history?: AgentMessage[];
  attachments?: Attachment[];
  signal?: AbortSignal;
  skillSnapshot?: SkillReference[];
  resume?:
    | {
        call: Extract<
          ProviderResponse,
          {
            type: "tool_call";
          }
        >;
        approved?: boolean;
        toolContent?: string;
        recoveryEffectId?: string;
      }
    | {
        deferred: DeferredHandle;
      }
    | {
        compaction: true;
      }
    | {
        providerStepId: string;
      }
    | {
        providerResponse: ProviderResponse;
      };
};
export type AgentResult = {
  runId: string;
  status: "completed" | "needs_input" | "suspended" | "aborted" | "failed";
  text?: string;
  citations: Citation[];
  artifacts: Artifact[];
  pending?: ApprovalRequest | ClarificationRequest;
  deferred?: DeferredHandle;
  error?: {
    code: string;
    message: string;
    retryable: boolean;
  };
};
export type AgentEvent =
  | {
      type: "run_started";
      runId: string;
    }
  | {
      type: "thinking_summary_delta";
      runId: string;
      text: string;
    }
  | {
      type: "output_delta";
      runId: string;
      text: string;
    }
  | {
      type: "tool_call_ready";
      runId: string;
      toolName: string;
      callId: string;
      arguments: unknown;
    }
  | {
      type: "tool_started";
      runId: string;
      toolName: string;
      callId: string;
    }
  | {
      type: "tool_output_delta";
      runId: string;
      toolName: string;
      callId: string;
      text: string;
    }
  | {
      type: "tool_finished";
      runId: string;
      toolName: string;
      callId: string;
    }
  | {
      type: "usage";
      runId: string;
      usage: Record<string, number>;
    }
  | {
      type: "skills_selected";
      runId: string;
      skills: SkillReference[];
    }
  | {
      type: "skills_loaded";
      runId: string;
      skillNames: string[];
    }
  | {
      type: "context_compacted";
      runId: string;
      beforeTokens: number;
      afterTokens: number;
    }
  | {
      type: "approval_requested";
      runId: string;
      requestId: string;
      toolName: string;
      displayPayload?: Record<string, unknown>;
    }
  | {
      type: "approval_responded";
      runId: string;
      requestId: string;
      approved: boolean;
    }
  | {
      type: "clarification_requested";
      runId: string;
      requestId: string;
      questions: ClarificationQuestion[];
      allowSkip: boolean;
    }
  | {
      type: "clarification_responded";
      runId: string;
      requestId: string;
      skipped: boolean;
      timedOut: boolean;
    }
  | {
      type: "artifact_created";
      runId: string;
      artifact: Artifact;
    }
  | {
      type: "citations";
      runId: string;
      citations: Citation[];
    }
  | {
      type: "final_output_candidate";
      runId: string;
      text: string;
    }
  | {
      type: "final_output_validated";
      runId: string;
      text: string;
    }
  | {
      type: "run_suspended";
      runId: string;
      deferred: DeferredHandle;
    }
  | {
      type: "run_finished";
      runId: string;
      result: AgentResult;
    };
export type FinalOutputValidation =
  | {
      ok: true;
    }
  | {
      ok: false;
      errors: string[];
    };
export type AgenticModuleConfig = {
  provider: ProviderAdapter;
  tools?: import("./tool-registry.ts").ToolRegistry;
  policy: PolicyAdapter;
  approval?: ApprovalAdapter;
  maxToolCalls?: number;
  maxOutputCharacters?: number;
  toolExecution?: "sequential" | "parallel";
  validateToolInput?: (
    schema: JsonSchema,
    input: unknown
  ) => boolean | Promise<boolean>;
  saveResult?: (
    result: AgentResult,
    context: ExecutionContext
  ) => void | Promise<void>;
  onCheckpoint?: (checkpoint: {
    history: AgentMessage[];
    toolCalls: number;
    result: AgentResult;
    pending?: {
      kind: "approval" | "clarification";
      call: Extract<
        ProviderResponse,
        {
          type: "tool_call";
        }
      >;
      interaction?: Extract<
        ToolResult,
        {
          type: "needs_input";
        }
      >["interaction"];
    };
  }) => void | Promise<void>;
  loadContext?: (
    context: ExecutionContext,
    signal: AbortSignal
  ) => Promise<
    Array<{
      content: string;
      citation: Citation;
    }>
  >;
  loadSkills?: (input: {
    runId: string;
    input: string;
    context: ExecutionContext;
    signal: AbortSignal;
  }) => Promise<ToolDefinition[]>;
  skills?: SkillRuntimeAdapter;
  contextWindow?: {
    maxInputTokens: number;
    /**
     * Estimates token usage for the supplied transcript.
     * @param messages - Provider transcript messages to inspect.
     * @returns A promise that resolves with the operation result.
     */
    estimateTokens(messages: AgentMessage[]): number | Promise<number>;
    /**
     * Compacts transcript history within the configured budget.
     * @param input - Validated input required by the operation.
     * @returns A promise that resolves with the operation result.
     */
    compact(input: {
      messages: AgentMessage[];
      targetTokens: number;
      context: ExecutionContext;
      signal: AbortSignal;
    }): Promise<AgentMessage[]>;
  };
  onContextCompacted?: (value: {
    history: AgentMessage[];
    beforeTokens: number;
    afterTokens: number;
    context: ExecutionContext;
  }) => void | Promise<void>;
  onCompactionEffect?: (
    event: CompactionEffectLifecycleEvent
  ) => void | Promise<void>;
  onToolEffect?: (event: ToolEffectLifecycleEvent) => void | Promise<void>;
  takeSteer?: (input: {
    runId: string;
    context: ExecutionContext;
    history: AgentMessage[];
  }) => Promise<string[]>;
  executeEffect?: <T>(
    input: {
      runId: string;
      kind: "tool" | "hook" | "timer";
    },
    execute: () => Promise<T>
  ) => Promise<T>;
  validateFinalOutput?: (candidate: {
    text: string;
    citations: Citation[];
    artifacts: Artifact[];
    context: ExecutionContext;
  }) => FinalOutputValidation | Promise<FinalOutputValidation>;
  redactToolArguments?: (
    argumentsValue: unknown,
    context: ExecutionContext
  ) => unknown | Promise<unknown>;
  redactToolOutput?: (
    content: string,
    context: ExecutionContext
  ) => string | Promise<string>;
  emit?: (event: AgentEvent) => void | Promise<void>;
};
