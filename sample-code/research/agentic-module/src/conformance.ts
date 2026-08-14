import type { HarnessStore } from "./harness-store.ts";
import type { HarnessEventInput } from "./harness-types.ts";
import { reduceHarnessEvents } from "./reducer.ts";
import {
  projectSession,
  type SessionMutationInput,
  type SessionStore,
} from "./durable-session.ts";
/**
 * Runs reusable ownership, lease, idempotency, and optimistic-write checks on a run store.
 * @param createStore - Factory that returns an isolated store instance.
 * @returns A promise that resolves with the operation result.
 */
export async function runHarnessStoreConformance(
  createStore: () => HarnessStore
): Promise<string[]> {
  // Collect independent failures so host adapters receive one actionable report.
  const failures: string[] = [];
  const owner = {
    agentId: "conformance-agent",
    principalId: "conformance-owner",
    workspaceId: "conformance-workspace",
  };
  const wrong = { ...owner, principalId: "other" };
  const wrongAgent = { ...owner, agentId: "other-agent" };
  try {
    const store = createStore();
    await store.create({ runId: "claim", input: "test", context: owner });
    if (await store.claim("claim", wrong, "worker-a", 10000))
      failures.push("ownership: wrong principal claimed run");
    if (await store.claim("claim", wrongAgent, "worker-a", 10000))
      failures.push("ownership: wrong agent claimed run");
    if (!(await store.claim("claim", owner, "worker-a", 10000)))
      failures.push("atomic claim: first worker was denied");
    if (await store.claim("claim", owner, "worker-b", 10000))
      failures.push("atomic claim: second worker claimed active lease");
    await store.close("claim", "completed");
    if (await store.claim("claim", owner, "worker-b", 10000))
      failures.push("terminal close: closed run was reclaimed");
  } catch (error) {
    failures.push(
      `claim lifecycle threw: ${error instanceof Error ? error.message : String(error)}`
    );
  }
  try {
    const store = createStore();
    await store.create({ runId: "events", input: "test", context: owner });
    const event = {
      type: "turn_started" as const,
      data: { input: "test" },
      idempotencyKey: "turn-1",
    };
    if ((await store.append("events", 0, [event])).version !== 1)
      failures.push("append: first version is not 1");
    if ((await store.append("events", 1, [event])).version !== 1)
      failures.push("idempotency: duplicate event changed version");
    let conflicted = false;
    try {
      await store.append("events", 0, [{ type: "run_aborted", data: {} }]);
    } catch {
      conflicted = true;
    }
    if (!conflicted)
      failures.push("optimistic concurrency: stale version append succeeded");
    const loaded = await store.load("events");
    if (
      !loaded ||
      loaded.events.length !== 1 ||
      loaded.events[0].sequence !== 1
    )
      failures.push("event replay: stored sequence is invalid");
  } catch (error) {
    failures.push(
      `event lifecycle threw: ${error instanceof Error ? error.message : String(error)}`
    );
  }
  try {
    const store = createStore();
    await store.create({ runId: "settlement", input: "test", context: owner });
    await store.claim("settlement", owner, "worker-a", 10000);
    try {
      await store.settle(
        "settlement",
        0,
        [{ type: "run_failed", data: {}, idempotencyKey: "terminal" }],
        "failed"
      );
    } catch {
      // Inspect reopened state below to distinguish an atomic rejection from a torn transition.
    }
    const loaded = await store.load("settlement");
    const hasEvent =
      loaded?.events.some(
        ({ idempotencyKey }) => idempotencyKey === "terminal"
      ) ?? false;
    if (
      hasEvent !== (loaded?.record.status === "failed") ||
      (hasEvent && loaded?.record.lease)
    ) {
      failures.push("terminal atomicity: event, status, and lease were torn");
    } else if (!hasEvent) {
      failures.push("terminal settlement: valid terminal batch was rejected");
    }
    let terminalAppendAccepted = false;
    try {
      await store.append("settlement", loaded?.record.version ?? 0, [
        { type: "checkpoint_saved", data: {} },
      ]);
      terminalAppendAccepted = true;
    } catch {
      // Expected: terminal state cannot receive later non-idempotent events.
    }
    if (terminalAppendAccepted)
      failures.push("terminal settlement: post-terminal append succeeded");
  } catch (error) {
    failures.push(
      `terminal settlement lifecycle threw: ${error instanceof Error ? error.message : String(error)}`
    );
  }
  return failures;
}
/**
 * Reopens and validates provider, tool, queue, and abort state after every run-log prefix.
 * @param input - Validated input required by the operation.
 * @returns A promise that resolves with the operation result.
 */
export async function runHarnessRecoveryPrefixConformance(input: {
  writer: HarnessStore;
  reopen: () => HarnessStore;
}): Promise<string[]> {
  // Continue writes through each reopened adapter so no in-process projection can hide missing durability.
  const failures: string[] = [];
  const runId = "harness-recovery-prefix";
  const owner = {
    agentId: "conformance-agent",
    principalId: "conformance-owner",
    workspaceId: "conformance-workspace",
  };
  const prefixes: HarnessEventInput[] = [
    {
      type: "skills_selected",
      data: {
        skills: [
          {
            id: "skill-id",
            name: "skill",
            version: "1.0.0",
            digest: "sha256:skill-v1",
          },
        ],
      },
      idempotencyKey: "skills",
    },
    { type: "turn_started", data: { input: "go" }, idempotencyKey: "turn" },
    {
      type: "checkpoint_saved",
      data: {
        checkpoint: {
          history: [{ role: "user", content: "go" }],
          turns: 1,
          toolCalls: 0,
        },
      },
      idempotencyKey: "checkpoint",
    },
    {
      type: "provider_planned",
      data: { stepId: "provider-1" },
      idempotencyKey: "provider-plan",
    },
    {
      type: "provider_started",
      data: { stepId: "provider-1", attempt: 1, responseId: "response-1" },
      idempotencyKey: "provider-start",
    },
    {
      type: "provider_settled",
      data: {
        stepId: "provider-1",
        attempt: 1,
        responseId: "response-1",
        outcome: "completed",
      },
      idempotencyKey: "provider-settle",
    },
    {
      type: "tool_planned",
      data: {
        effectId: "tool-1",
        callId: "call-1",
        toolName: "read",
        replay: "never",
        plannedResultId: "result-1",
      },
      idempotencyKey: "tool-plan",
    },
    {
      type: "tool_started",
      data: { effectId: "tool-1", callId: "call-1", toolName: "read" },
      idempotencyKey: "tool-start",
    },
    {
      type: "tool_settled",
      data: {
        effectId: "tool-1",
        callId: "call-1",
        toolName: "read",
        outcome: "completed",
        resultId: "result-1",
      },
      idempotencyKey: "tool-settle",
    },
    {
      type: "queue_enqueued",
      data: { queueId: "queue-1", queue: "nextRun", input: "later" },
      idempotencyKey: "queue-add",
    },
    {
      type: "queue_cancelled",
      data: { queueId: "queue-1" },
      idempotencyKey: "queue-cancel",
    },
  ];
  try {
    let store = input.writer;
    await store.create({ runId, input: "go", context: owner });
    if (!(await store.claim(runId, owner, "worker", 10000)))
      failures.push("recovery prefix: initial claim failed");
    for (let index = 0; index < prefixes.length; index += 1) {
      await store.append(runId, index, [prefixes[index]]);
      store = input.reopen();
      const loaded = await store.load(runId);
      if (
        !loaded ||
        loaded.record.version !== index + 1 ||
        loaded.events.some(
          (event, eventIndex) => event.sequence !== eventIndex + 1
        )
      ) {
        failures.push(
          `harness recovery prefix ${index + 1}: version or sequence changed after reopen`
        );
        continue;
      }
      try {
        reduceHarnessEvents(loaded.record, loaded.events);
      } catch (error) {
        failures.push(
          `harness recovery prefix ${index + 1}: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }
    await store.settle(
      runId,
      prefixes.length,
      [{ type: "run_aborted", data: {}, idempotencyKey: "abort" }],
      "aborted"
    );
    const terminal = await input.reopen().load(runId);
    if (
      terminal?.record.status !== "aborted" ||
      terminal.record.lease ||
      terminal.events.at(-1)?.type !== "run_aborted"
    ) {
      failures.push(
        "harness recovery prefix terminal: abort settlement was not atomic"
      );
    }
  } catch (error) {
    failures.push(
      `harness recovery prefix lifecycle threw: ${error instanceof Error ? error.message : String(error)}`
    );
  }
  return failures;
}
/**
 * Runs atomicity, sequencing, lane, and reopen checks on a durable session store.
 * @param createStore - Factory that returns an isolated store instance.
 * @returns A promise that resolves with the operation result.
 */
export async function runSessionStoreConformance(
  createStore: () => SessionStore
): Promise<string[]> {
  // Use fresh stores for each scenario so a failure cannot contaminate later evidence.
  const failures: string[] = [];
  const seed = {
    model: { provider: "conformance", model: "fake" },
    thinkingLevel: "off" as const,
    activeToolNames: ["read"],
  };
  const atomic = createStore();
  try {
    await atomic.create({ sessionId: "atomic", seedConfiguration: seed });
    try {
      await atomic.append("atomic", 0, [
        {
          type: "entry_added",
          entry: { id: "valid", parentId: null, kind: "user", data: {} },
        },
        {
          type: "entry_added",
          entry: {
            id: "invalid",
            parentId: "missing",
            kind: "assistant",
            data: {},
          },
        },
      ]);
    } catch {
      // The invalid batch must fail, then the reopened log proves all-or-none behavior.
    }
    if ((await atomic.load("atomic"))?.mutations.length !== 0)
      failures.push("atomic append: rejected batch left durable mutations");
  } catch (error) {
    const loaded = await atomic.load("atomic").catch(() => undefined);
    if (loaded?.mutations.length)
      failures.push("atomic append: thrown batch left durable mutations");
    else
      failures.push(
        `atomic append lifecycle threw: ${error instanceof Error ? error.message : String(error)}`
      );
  }
  try {
    const store = createStore();
    await store.create({ sessionId: "projection", seedConfiguration: seed });
    await store.append("projection", 0, [
      {
        type: "entry_added",
        entry: { id: "root", parentId: null, kind: "user", data: {} },
      },
      { type: "lane_moved", lane: "main", leafId: "root" },
      { type: "lane_created", lane: "review", anchorId: "root" },
      {
        type: "operation_started",
        operationId: "main-op",
        lane: "main",
        kind: "run",
        configuration: seed,
      },
      {
        type: "operation_started",
        operationId: "review-op",
        lane: "review",
        kind: "run",
        configuration: seed,
      },
    ]);
    const loaded = await store.load("projection");
    if (
      !loaded ||
      loaded.record.version !== 5 ||
      loaded.mutations.some((item, index) => item.sequence !== index + 1)
    ) {
      failures.push(
        "session projection: version or sequence is not contiguous after reopen"
      );
    }
    let staleAccepted = false;
    try {
      await store.append("projection", 0, [{ type: "session_closed" }]);
      staleAccepted = true;
    } catch {
      // Expected: stale optimistic version must be rejected.
    }
    if (staleAccepted)
      failures.push("session concurrency: stale append succeeded");
  } catch (error) {
    failures.push(
      `session projection lifecycle threw: ${error instanceof Error ? error.message : String(error)}`
    );
  }
  return failures;
}
/**
 * Reopens and validates the session projection after every durable effect prefix.
 * @param input - Validated input required by the operation.
 * @returns A promise that resolves with the operation result.
 */
export async function runSessionRecoveryPrefixConformance(input: {
  writer: SessionStore;
  reopen: () => SessionStore;
}): Promise<string[]> {
  // Exercise each externally meaningful boundary as an independently recoverable prefix.
  const failures: string[] = [];
  const sessionId = "recovery-prefix";
  const seed = {
    model: { provider: "conformance", model: "fake" },
    thinkingLevel: "off" as const,
    activeToolNames: ["read"],
  };
  const prefixes: SessionMutationInput[] = [
    {
      type: "entry_added",
      entry: { id: "root", parentId: null, kind: "user", data: { text: "go" } },
    },
    { type: "lane_moved", lane: "main", leafId: "root" },
    {
      type: "operation_started",
      operationId: "run",
      lane: "main",
      kind: "run",
      configuration: seed,
    },
    {
      type: "effect_planned",
      operationId: "run",
      stepId: "step",
      effectId: "effect",
      effectKind: "tool",
      replay: "never",
      plannedOutputId: "output",
    },
    {
      type: "effect_started",
      operationId: "run",
      stepId: "step",
      effectId: "effect",
      attempt: 1,
    },
    {
      type: "effect_settled",
      operationId: "run",
      stepId: "step",
      effectId: "effect",
      outputId: "output",
    },
    { type: "operation_finished", operationId: "run", outcome: "completed" },
    { type: "session_closed" },
  ];
  try {
    await input.writer.create({ sessionId, seedConfiguration: seed });
    for (let index = 0; index < prefixes.length; index += 1) {
      await input.writer.append(sessionId, index, [prefixes[index]]);
      const loaded = await input.reopen().load(sessionId);
      if (
        !loaded ||
        loaded.record.version !== index + 1 ||
        loaded.mutations.length !== index + 1
      ) {
        failures.push(
          `recovery prefix ${index + 1}: version or mutation count changed after reopen`
        );
        continue;
      }
      try {
        const state = projectSession(loaded.record, loaded.mutations);
        if (state.closed !== (index === prefixes.length - 1))
          failures.push(
            `recovery prefix ${index + 1}: terminal state is incorrect`
          );
      } catch (error) {
        failures.push(
          `recovery prefix ${index + 1}: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }
  } catch (error) {
    failures.push(
      `recovery prefix lifecycle threw: ${error instanceof Error ? error.message : String(error)}`
    );
  }
  return failures;
}
