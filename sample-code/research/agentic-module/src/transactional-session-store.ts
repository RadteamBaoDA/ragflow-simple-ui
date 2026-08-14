import { AgenticError } from "./errors.ts";
import {
  projectSession,
  type SessionMutation,
  type SessionMutationInput,
  type SessionRecord,
  type SessionStore,
} from "./durable-session.ts";
export type SessionDocument = {
  record: SessionRecord;
  mutations: SessionMutation[];
};
export interface TransactionalDocumentAdapter {
  /**
   * Reads one authorized value.
   * @param key - Stable transactional document key.
   * @returns A promise that resolves with the operation result.
   */
  read(key: string): Promise<SessionDocument | undefined>;
  /**
   * Runs one atomic update against the transactional document adapter.
   * @param key - Stable transactional document key.
   * @param update - Transactional callback that returns the next document value.
   * @returns A promise that resolves with the operation result.
   */
  transact<T>(
    key: string,
    update: (current: SessionDocument | undefined) => {
      next: SessionDocument;
      value: T;
    }
  ): Promise<T>;
}
/** Maps the session contract onto a host database's serializable document transaction. */
export class TransactionalSessionStore implements SessionStore {
  readonly #adapter: TransactionalDocumentAdapter;
  readonly #now: () => number;
  /**
   * Creates a database-backed store from an atomic document adapter.
   * @param adapter - Host adapter that supplies the external capability.
   * @param now - Injectable clock used for deterministic timestamps.
   */
  constructor(
    adapter: TransactionalDocumentAdapter,
    now: () => number = Date.now
  ) {
    // Keep transaction mechanics host-owned while sharing projection validation in core.
    this.#adapter = adapter;
    this.#now = now;
  }
  /**
   * Creates one unique session inside a host database transaction.
   * @param input - Validated input required by the operation.
   * @returns A promise that resolves when the operation completes.
   * @throws When validation, persistence, policy, or the delegated operation fails.
   */
  async create(input: {
    sessionId: string;
    seedConfiguration: SessionRecord["seedConfiguration"];
    parentSessionId?: string;
  }): Promise<void> {
    // Duplicate detection and insertion occur in the same serializable transaction callback.
    await this.#adapter.transact(input.sessionId, (current) => {
      if (current)
        throw new AgenticError(
          "INVALID_REQUEST",
          `Duplicate session: ${input.sessionId}`
        );
      return {
        next: {
          record: {
            sessionId: input.sessionId,
            createdAt: this.#now(),
            parentSessionId: input.parentSessionId,
            version: 0,
            seedConfiguration: structuredClone(input.seedConfiguration),
          },
          mutations: [],
        },
        value: undefined,
      };
    });
  }
  /**
   * Reads and validates a detached transactional session document.
   * @param sessionId - Stable identifier of the durable session.
   * @returns A promise that resolves with the operation result.
   */
  async load(sessionId: string): Promise<SessionDocument | undefined> {
    // Reproject every read so malformed database state is rejected rather than trusted.
    const document = await this.#adapter.read(sessionId);
    if (!document) return undefined;
    const copy = structuredClone(document);
    projectSession(copy.record, copy.mutations);
    return copy;
  }
  /**
   * Atomically performs optimistic version validation and appends a mutation batch.
   * @param sessionId - Stable identifier of the durable session.
   * @param expectedVersion - Optimistic version required for the write.
   * @param inputs - Ordered inputs required by the operation.
   * @returns A promise that resolves with the operation result.
   * @throws When validation, persistence, policy, or the delegated operation fails.
   */
  async append(
    sessionId: string,
    expectedVersion: number,
    inputs: SessionMutationInput[]
  ): Promise<{
    version: number;
  }> {
    // The adapter must serialize this pure read-validate-replace callback with competing writers.
    if (!inputs.length)
      throw new AgenticError(
        "INVALID_REQUEST",
        "Mutation batch must not be empty."
      );
    return this.#adapter.transact(sessionId, (current) => {
      if (!current)
        throw new AgenticError(
          "INVOCATION_NOT_FOUND",
          `Session not found: ${sessionId}`
        );
      if (current.record.version !== expectedVersion)
        throw new AgenticError(
          "VERSION_CONFLICT",
          "Session version changed.",
          true
        );
      const mutations = inputs.map((input, index) => ({
        ...structuredClone(input),
        sequence: expectedVersion + index + 1,
        timestamp: this.#now(),
      })) as SessionMutation[];
      const next: SessionDocument = {
        record: {
          ...structuredClone(current.record),
          version: expectedVersion + mutations.length,
        },
        mutations: [...structuredClone(current.mutations), ...mutations],
      };
      projectSession(next.record, next.mutations);
      return { next, value: { version: next.record.version } };
    });
  }
}
