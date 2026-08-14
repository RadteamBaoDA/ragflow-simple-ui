import type { SequencedAgentEvent } from "./event-stream.ts";
export type AgentUiState = {
  runId: string;
  lastSequence: number;
  thinking: string;
  output: string;
  finalText?: string;
  tools: Record<
    string,
    {
      name: string;
      arguments?: unknown;
      output: string;
      status: "ready" | "running" | "finished";
    }
  >;
  pending?: {
    kind: "approval" | "clarification";
    requestId: string;
  };
};
/**
 * Reduces one sequenced transport event into reconnect-safe framework-neutral UI state.
 * @param state - Current projected state used by the operation.
 * @param event - Event or lifecycle value to process.
 * @returns The created or normalized operation result.
 */
export function reduceAgentUiEvent(
  state: AgentUiState | undefined,
  event: SequencedAgentEvent
): AgentUiState {
  // Ignore duplicate or out-of-order envelopes before appending any visible text.
  const next: AgentUiState = state ?? {
    runId: event.runId,
    lastSequence: 0,
    thinking: "",
    output: "",
    tools: {},
  };
  if (event.sequence <= next.lastSequence) return next;
  const updated = {
    ...next,
    lastSequence: event.sequence,
    tools: { ...next.tools },
  };
  switch (event.type) {
    case "thinking_summary_delta":
      updated.thinking += event.text;
      break;
    case "output_delta":
      updated.output += event.text;
      break;
    case "tool_call_ready":
      updated.tools[event.callId] = {
        name: event.toolName,
        arguments: event.arguments,
        output: "",
        status: "ready",
      };
      break;
    case "tool_started":
      updated.tools[event.callId] = {
        ...(updated.tools[event.callId] ?? {
          name: event.toolName,
          output: "",
        }),
        status: "running",
      };
      break;
    case "tool_output_delta":
      updated.tools[event.callId] = {
        ...(updated.tools[event.callId] ?? {
          name: event.toolName,
          output: "",
        }),
        output: (updated.tools[event.callId]?.output ?? "") + event.text,
        status: "running",
      };
      break;
    case "tool_finished":
      updated.tools[event.callId] = {
        ...(updated.tools[event.callId] ?? {
          name: event.toolName,
          output: "",
        }),
        status: "finished",
      };
      break;
    case "approval_requested":
      updated.pending = { kind: "approval", requestId: event.requestId };
      break;
    case "clarification_requested":
      updated.pending = { kind: "clarification", requestId: event.requestId };
      break;
    case "approval_responded":
    case "clarification_responded":
      if (updated.pending?.requestId === event.requestId)
        updated.pending = undefined;
      break;
    case "final_output_validated":
      updated.finalText = event.text;
      break;
    case "run_finished":
      updated.pending = undefined;
      break;
  }
  return updated;
}
