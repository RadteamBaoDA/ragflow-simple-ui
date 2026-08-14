import test from "node:test";
import assert from "node:assert/strict";
import {
  TransactionalSessionStore,
  runSessionRecoveryPrefixConformance,
  runSessionStoreConformance,
  type SessionDocument,
  type TransactionalDocumentAdapter,
} from "../src/index.ts";

class MemoryTransactionAdapter implements TransactionalDocumentAdapter {
  readonly values = new Map<string, SessionDocument>();

  /** Reads a detached document from the fake transactional database. */
  async read(key: string): Promise<SessionDocument | undefined> {
    // Clone reads so store validation cannot mutate database state.
    const value = this.values.get(key);
    return value ? structuredClone(value) : undefined;
  }

  /** Serializes one compare-and-replace transaction against the fake database. */
  async transact<T>(key: string, update: (current: SessionDocument | undefined) => { next: SessionDocument; value: T }): Promise<T> {
    // Apply the callback and replacement synchronously to model a database transaction.
    const result = update(await this.read(key));
    this.values.set(key, structuredClone(result.next));
    return result.value;
  }
}

test("transactional adapter store passes the reusable session conformance suite", async () => {
  assert.deepEqual(await runSessionStoreConformance(() => new TransactionalSessionStore(new MemoryTransactionAdapter())), []);
});

test("transactional adapter reprojects every durable operation prefix", async () => {
  const adapter = new MemoryTransactionAdapter();
  assert.deepEqual(await runSessionRecoveryPrefixConformance({
    writer: new TransactionalSessionStore(adapter),
    reopen: () => new TransactionalSessionStore(adapter),
  }), []);
});
