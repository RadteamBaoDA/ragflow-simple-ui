export type DriveAction = {
  id: number;
  runId: string;
  kind: "durable_write" | "provider" | "tool" | "hook" | "timer";
};
type PendingAction = {
  action: DriveAction;
  execute: () => Promise<unknown>;
  resolve: (value: unknown) => void;
  reject: (error: unknown) => void;
};
/** Gates the same production actions for either automatic or deterministic manual drive. */
export class ActionDriver {
  readonly #mode: "automatic" | "manual";
  #sequence = 0;
  #pending: PendingAction[] = [];
  #waiters: Array<() => void> = [];
  /**
   * Creates a driver without creating a second orchestration state machine.
   * @param mode - Requested activation or execution-isolation mode.
   */
  constructor(mode: "automatic" | "manual" = "automatic") {
    // Mode changes admission timing only; action implementations remain identical.
    this.#mode = mode;
  }
  /**
   * Executes immediately in automatic mode or exposes one pending manual action.
   * @param runId - Stable identifier of the agent run.
   * @param kind - Action or external-effect category used for scheduling.
   * @param execute - Callback that performs the gated external effect.
   * @returns A promise that resolves with the operation result.
   */
  run<T>(
    runId: string,
    kind: DriveAction["kind"],
    execute: () => Promise<T>
  ): Promise<T> {
    // Admission order is the deterministic execution order, including parallel tool batches.
    if (this.#mode === "automatic") return execute();
    return new Promise<T>((resolve, reject) => {
      this.#pending.push({
        action: { id: ++this.#sequence, runId, kind },
        execute,
        /**
         * Settles a queued manual-drive action.
         * @param value - Value to validate, transform, or persist.
         * @returns The resolve result produced for the current operation.
         */
        resolve: (value) => resolve(value as T),
        reject,
      });
      this.#notify();
    });
  }
  /**
   * Gates one streaming effect while preserving live iteration in automatic mode.
   * @param runId - Stable identifier of the agent run.
   * @param kind - Action or external-effect category used for scheduling.
   * @param source - Factory that creates the asynchronous value stream.
   * @returns An asynchronous stream of provider or action values.
   */
  async *runStream<T>(
    runId: string,
    kind: DriveAction["kind"],
    source: () => AsyncIterable<T>
  ): AsyncIterable<T> {
    // Manual mode buffers one finite provider action; automatic mode forwards chunks immediately.
    if (this.#mode === "automatic") {
      for await (const value of source()) yield value;
      return;
    }
    const values = await this.run(runId, kind, async () => {
      const buffered: T[] = [];
      for await (const value of source()) buffered.push(value);
      return buffered;
    });
    for (const value of values) yield value;
  }
  /**
   * Returns the next action without executing it.
   * @returns The peekAction result produced for the current operation.
   */
  peekAction(): DriveAction | null {
    // Return a copy so callers cannot mutate driver state.
    return this.#pending[0] ? { ...this.#pending[0].action } : null;
  }
  /**
   * Executes exactly one pending action and resolves its blocked workflow continuation.
   * @returns A promise that resolves with the operation result.
   */
  async executeAction(): Promise<DriveAction | null> {
    // Remove the action before execution so the resumed workflow can enqueue its successor.
    const pending = this.#pending.shift();
    if (!pending) return null;
    try {
      pending.resolve(await pending.execute());
    } catch (error) {
      pending.reject(error);
    }
    await Promise.resolve();
    return pending.action;
  }
  /**
   * Waits until a manual action becomes observable.
   * @returns A promise that resolves when the operation completes.
   */
  waitForAction(): Promise<void> {
    // Resolve synchronously when an action is already queued; otherwise register a one-shot waiter.
    if (this.#pending.length) return Promise.resolve();
    return new Promise((resolve) => this.#waiters.push(resolve));
  }
  /**
   * Wakes all observers after publishing a new pending action.
   * @returns Nothing; completion indicates that the operation finished.
   */
  #notify(): void {
    // Swap the waiter list before callbacks to avoid re-entrant notification loss.
    const waiters = this.#waiters.splice(0);
    for (const resolve of waiters) resolve();
  }
}
