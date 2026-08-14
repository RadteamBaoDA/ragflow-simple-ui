import test from "node:test";
import assert from "node:assert/strict";
import {
  InMemoryHarnessStore,
  InMemorySessionStore,
  runHarnessStoreConformance,
  runHarnessRecoveryPrefixConformance,
  runSessionRecoveryPrefixConformance,
  runSessionStoreConformance,
  type HarnessStore,
} from "../src/index.ts";

test("in-memory reference store passes reusable database conformance", async () => {
  assert.deepEqual(await runHarnessStoreConformance(() => new InMemoryHarnessStore()), []);
});

test("in-memory harness store reprojects provider, tool, queue, and abort prefixes", async () => {
  const store = new InMemoryHarnessStore();
  assert.deepEqual(await runHarnessRecoveryPrefixConformance({ writer: store, reopen: () => store }), []);
});

test("conformance reports a store that permits duplicate claims", async () => {
  class BrokenStore extends InMemoryHarnessStore implements HarnessStore {
    override async claim(): Promise<boolean> { return true; }
  }
  const createBrokenStore = (): HarnessStore => new BrokenStore();
  const failures = await runHarnessStoreConformance(createBrokenStore);
  assert.equal(failures.some((failure) => failure.includes("atomic claim")), true);
});

test("conformance reports a store that tears terminal event from status", async () => {
  class TornSettlementStore extends InMemoryHarnessStore implements HarnessStore {
    override async settle(runId: string, expectedVersion: number, events: Parameters<HarnessStore["settle"]>[2]) {
      await this.append(runId, expectedVersion, events);
      throw new Error("torn terminal transition");
    }
  }
  const store = new TornSettlementStore();
  const failures = await runHarnessStoreConformance(() => store);
  assert.equal(failures.some((failure) => failure.includes("terminal atomicity")), true);
});

test("in-memory session store passes reusable HFS session conformance", async () => {
  assert.deepEqual(await runSessionStoreConformance(() => new InMemorySessionStore()), []);
});

test("in-memory store reprojects every durable operation prefix", async () => {
  const store = new InMemorySessionStore();
  assert.deepEqual(await runSessionRecoveryPrefixConformance({ writer: store, reopen: () => store }), []);
});

test("session conformance detects non-atomic append", async () => {
  class TornStore extends InMemorySessionStore {
    override async append(sessionId: string, expectedVersion: number, mutations: Parameters<InMemorySessionStore["append"]>[2]) {
      if (mutations.length > 1) {
        await super.append(sessionId, expectedVersion, [mutations[0]]);
        throw new Error("torn");
      }
      return super.append(sessionId, expectedVersion, mutations);
    }
  }
  const failures = await runSessionStoreConformance(() => new TornStore());
  assert.equal(failures.some((failure) => failure.includes("atomic append")), true);
});
