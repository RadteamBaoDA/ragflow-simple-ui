import type {
  AgentMessage,
  AgentResult,
  ExecutionContext,
  SkillReference,
} from "./types.ts";
export type HarnessStatus =
  | "pending"
  | "running"
  | "idle"
  | "needs_input"
  | "suspended"
  | "completed"
  | "failed"
  | "aborted"
  | "closed";
export type HarnessEventType =
  | "run_started"
  | "turn_started"
  | "checkpoint_saved"
  | "skills_selected"
  | "compaction_planned"
  | "compaction_started"
  | "compaction_settled"
  | "context_compacted"
  | "provider_planned"
  | "provider_started"
  | "provider_settled"
  | "provider_uncertain"
  | "usage_recorded"
  | "tool_planned"
  | "tool_started"
  | "tool_settled"
  | "tool_uncertain"
  | "tool_finished"
  | "approval_requested"
  | "approval_responded"
  | "clarification_requested"
  | "clarification_responded"
  | "citation_added"
  | "artifact_added"
  | "queue_enqueued"
  | "queue_consumed"
  | "queue_cancelled"
  | "turn_completed"
  | "run_suspended"
  | "run_completed"
  | "run_failed"
  | "run_aborted"
  | "run_closed";
export type HarnessEventInput = {
  type: HarnessEventType;
  data: Record<string, unknown>;
  idempotencyKey?: string;
};
export type HarnessEvent = HarnessEventInput & {
  runId: string;
  sequence: number;
  timestamp: number;
};
export type RunRecord = {
  runId: string;
  input: string;
  context: ExecutionContext;
  status: HarnessStatus;
  version: number;
  lease?: {
    workerId: string;
    expiresAt: number;
  };
};
export type HarnessCheckpoint = {
  history: AgentMessage[];
  turns: number;
  toolCalls: number;
  result?: AgentResult;
  pendingExecution?: {
    kind: "approval" | "clarification";
    call: Extract<
      import("./types.ts").ProviderResponse,
      {
        type: "tool_call";
      }
    >;
    interaction?: Extract<
      import("./types.ts").ToolResult,
      {
        type: "needs_input";
      }
    >["interaction"];
  };
};
export type HarnessState = HarnessCheckpoint & {
  runId: string;
  status: HarnessStatus;
  skillSnapshot: SkillReference[];
  pending?: {
    kind: "approval" | "clarification";
    requestId: string;
    data: Record<string, unknown>;
  };
  toolEffects: Record<
    string,
    {
      effectId: string;
      callId: string;
      toolName: string;
      replay: "safe" | "never";
      plannedResultId: string;
      protectedArguments?: unknown;
      status: "planned" | "started" | "settled" | "uncertain";
    }
  >;
  providerEffects: Record<
    string,
    {
      stepId: string;
      attempts: Record<
        number,
        {
          responseId: string;
          status: "started" | "settled" | "uncertain";
        }
      >;
    }
  >;
  compactionEffects: Record<
    string,
    {
      stepId: string;
      status: "planned" | "started" | "settled";
    }
  >;
  queues: Record<
    string,
    {
      queueId: string;
      queue: "steer" | "followUp" | "nextRun";
      input: string;
      status: "enqueued" | "consumed" | "cancelled";
      sequence: number;
    }
  >;
  usage: Record<
    string,
    {
      stepId: string;
      attempt: number;
      values: Record<string, number>;
    }
  >;
};
