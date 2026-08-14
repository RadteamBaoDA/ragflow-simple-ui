import type { AgentEvent } from "./types.ts";
export type SequencedAgentEvent = AgentEvent & {
  sequence: number;
  timestamp: number;
};
export class AgentEventJournal {
  readonly #events = new Map<string, SequencedAgentEvent[]>();
  readonly #watchers = new Map<
    string,
    Set<{
      listener: (event: SequencedAgentEvent) => void;
      buffering: boolean;
      buffer: SequencedAgentEvent[];
    }>
  >();
  readonly #now: () => number;
  /**
   * Creates an in-memory event journal with an injectable deterministic clock.
   * @param now - Injectable clock used for deterministic timestamps.
   */
  constructor(now: () => number = Date.now) {
    // Capture the clock once so every publication uses the same time source.
    this.#now = now;
  }
  /**
   * Assigns the next per-run cursor, stores the event, and notifies live watchers.
   * @param event - Event or lifecycle value to process.
   * @returns The publish result produced for the current operation.
   */
  publish(event: AgentEvent): SequencedAgentEvent {
    // Sequence derives from the committed in-memory list and is monotonic within one run.
    const events = this.#events.get(event.runId) ?? [];
    const published = {
      ...event,
      sequence: events.length + 1,
      timestamp: this.#now(),
    } as SequencedAgentEvent;
    events.push(published);
    this.#events.set(event.runId, events);
    // Deliver only after the event is visible to replay and isolate passive listener failures.
    for (const watcher of this.#watchers.get(event.runId) ?? []) {
      if (watcher.buffering) watcher.buffer.push(published);
      else safelyNotify(watcher.listener, published);
    }
    return published;
  }
  /**
   * Returns committed events strictly after the caller's accepted cursor.
   * @param runId - Stable identifier of the agent run.
   * @param afterSequence - Exclusive sequence cursor used to resume replay.
   * @returns The ordered values produced by the operation.
   */
  replay(runId: string, afterSequence = 0): SequencedAgentEvent[] {
    // Filtering by strict greater-than prevents duplicate delivery on reconnect.
    return (this.#events.get(runId) ?? []).filter(
      ({ sequence }) => sequence > afterSequence
    );
  }
  /**
   * Atomically replays a cursor snapshot, buffers concurrent publication, then follows live events.
   * @param runId - Stable identifier of the agent run.
   * @param afterSequence - Exclusive sequence cursor used to resume replay.
   * @param listener - Observer notified for each accepted event.
   * @returns Nothing; completion indicates that the operation finished.
   */
  watch(
    runId: string,
    afterSequence: number,
    listener: (event: SequencedAgentEvent) => void
  ): () => void {
    // Subscribe before replay so a re-entrant publish cannot fall between the snapshot and live watcher.
    const snapshot = this.replay(runId, afterSequence);
    const watcher = {
      listener,
      buffering: true,
      buffer: [] as SequencedAgentEvent[],
    };
    const watchers = this.#watchers.get(runId) ?? new Set();
    watchers.add(watcher);
    this.#watchers.set(runId, watchers);
    for (const event of snapshot) safelyNotify(listener, event);
    watcher.buffering = false;
    for (const event of watcher.buffer.splice(0)) safelyNotify(listener, event);
    return () => {
      // Unsubscribe idempotently and release empty per-run watcher collections.
      watchers.delete(watcher);
      if (!watchers.size) this.#watchers.delete(runId);
    };
  }
}
/**
 * Calls a passive observer without allowing it to affect execution or sibling observers.
 * @param listener - Observer notified for each accepted event.
 * @param event - Event or lifecycle value to process.
 * @returns Nothing; completion indicates that the operation finished.
 */
function safelyNotify(
  listener: (event: SequencedAgentEvent) => void,
  event: SequencedAgentEvent
): void {
  // Listener errors are intentionally isolated; applications report them through their own telemetry hook.
  try {
    listener(event);
  } catch {
    /* passive listener */
  }
}
/**
 * Serializes one sequenced event for an SSE response.
 * @param event - Event or lifecycle value to process.
 * @returns The resulting serialized string.
 */
export const serializeSseEvent = (event: SequencedAgentEvent): string =>
  `id: ${event.sequence}\nevent: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`;
/**
 * Serializes one sequenced event for a WebSocket frame.
 * @param event - Event or lifecycle value to process.
 * @returns The resulting serialized string.
 */
export const serializeWebSocketEvent = (event: SequencedAgentEvent): string =>
  JSON.stringify(event);
