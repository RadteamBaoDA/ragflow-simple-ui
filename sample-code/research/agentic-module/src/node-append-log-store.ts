import { createHash } from "node:crypto";
import {
  mkdir,
  open,
  readFile,
  unlink,
  type FileHandle,
} from "node:fs/promises";
import { resolve } from "node:path";
import { AgenticError } from "./errors.ts";
import {
  projectSession,
  type SessionMutation,
  type SessionMutationInput,
  type SessionRecord,
  type SessionStore,
} from "./durable-session.ts";
type HeaderRecord = {
  kind: "header";
  record: SessionRecord;
};
type BatchRecord = {
  kind: "batch";
  expectedVersion: number;
  version: number;
  mutations: SessionMutation[];
  checksum: string;
};
/**
 * Computes the integrity checksum for one committed journal batch.
 * @param batch - Validated append-log records written as one batch.
 * @returns The resulting serialized string.
 */
function checksum(batch: Omit<BatchRecord, "checksum">): string {
  // Hash the exact serialized payload that load will validate after reopen.
  return createHash("sha256").update(JSON.stringify(batch)).digest("hex");
}
/**
 * Sleeps briefly while another process owns the per-session lock file.
 * @param milliseconds - Maximum duration in milliseconds.
 * @returns A promise that resolves when the operation completes.
 */
function delay(milliseconds: number): Promise<void> {
  // A timer-based wait yields the event loop and keeps lock acquisition bounded.
  return new Promise((resolveDelay) => setTimeout(resolveDelay, milliseconds));
}
/**
 * Parses one complete JSONL record and reports corruption without silent repair.
 * @param line - Complete append-log line to decode.
 * @param lineNumber - One-based source line used in corruption diagnostics.
 * @returns The parseRecord result produced for the current operation.
 * @throws When validation, persistence, policy, or the delegated operation fails.
 */
function parseRecord(
  line: string,
  lineNumber: number
): HeaderRecord | BatchRecord {
  // A complete malformed line is interior corruption even when its JSON shape looks plausible.
  let value: unknown;
  try {
    value = JSON.parse(line);
  } catch {
    throw new AgenticError(
      "STORAGE_CORRUPTION",
      `Malformed journal record at line ${lineNumber}.`
    );
  }
  if (!value || typeof value !== "object" || !("kind" in value)) {
    throw new AgenticError(
      "STORAGE_CORRUPTION",
      `Invalid journal record at line ${lineNumber}.`
    );
  }
  return value as HeaderRecord | BatchRecord;
}
/**
 * Acquires a cross-process exclusive lock file with bounded retry.
 * @param path - Filesystem path of the source or durable file.
 * @returns A promise that resolves with the operation result.
 * @throws When validation, persistence, policy, or the delegated operation fails.
 */
async function acquireLock(path: string): Promise<FileHandle> {
  // `wx` provides atomic exclusion on the local filesystem; retries never steal a live lock.
  for (let attempt = 0; attempt < 200; attempt += 1) {
    try {
      return await open(path, "wx");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      await delay(5);
    }
  }
  throw new AgenticError(
    "VERSION_CONFLICT",
    "Timed out acquiring append-log writer lock.",
    true
  );
}
/** Durable Node JSONL backend with checksummed batches, fsync, CAS, and torn-tail recovery. */
export class NodeAppendLogSessionStore implements SessionStore {
  readonly #directory: string;
  readonly #now: () => number;
  /**
   * Creates a store rooted at one explicit directory.
   * @param directory - Directory that contains the append-log files.
   * @param now - Injectable clock used for deterministic timestamps.
   */
  constructor(directory: string, now: () => number = Date.now) {
    // Resolve once and validate session IDs separately so paths cannot escape this root.
    this.#directory = resolve(directory);
    this.#now = now;
  }
  /**
   * Maps a validated session ID to its journal path.
   * @param sessionId - Stable identifier of the durable session.
   * @returns The resulting serialized string.
   * @throws When validation, persistence, policy, or the delegated operation fails.
   */
  #path(sessionId: string): string {
    // A restricted filename alphabet removes traversal and alternate-stream ambiguity.
    if (!/^[a-zA-Z0-9_-]{1,128}$/.test(sessionId))
      throw new AgenticError("INVALID_REQUEST", "Invalid session id.");
    return resolve(this.#directory, `${sessionId}.jsonl`);
  }
  /**
   * Creates a unique journal and fsyncs its immutable header.
   * @param input - Validated input required by the operation.
   * @returns A promise that resolves when the operation completes.
   * @throws When validation, persistence, policy, or the delegated operation fails.
   */
  async create(input: {
    sessionId: string;
    seedConfiguration: SessionRecord["seedConfiguration"];
    parentSessionId?: string;
  }): Promise<void> {
    // Exclusive creation prevents replacement of an existing durable session.
    await mkdir(this.#directory, { recursive: true });
    const record: SessionRecord = {
      sessionId: input.sessionId,
      createdAt: this.#now(),
      parentSessionId: input.parentSessionId,
      version: 0,
      seedConfiguration: structuredClone(input.seedConfiguration),
    };
    let handle: FileHandle;
    try {
      handle = await open(this.#path(input.sessionId), "wx");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "EEXIST")
        throw new AgenticError(
          "INVALID_REQUEST",
          `Duplicate session: ${input.sessionId}`
        );
      throw error;
    }
    try {
      await handle.writeFile(
        `${JSON.stringify({ kind: "header", record } satisfies HeaderRecord)}\n`,
        "utf8"
      );
      await handle.sync();
    } finally {
      await handle.close();
    }
  }
  /**
   * Reopens and validates a journal, ignoring only an incomplete final line.
   * @param sessionId - Stable identifier of the durable session.
   * @returns A promise that resolves with the operation result.
   * @throws When validation, persistence, policy, or the delegated operation fails.
   */
  async load(sessionId: string): Promise<
    | {
        record: SessionRecord;
        mutations: SessionMutation[];
      }
    | undefined
  > {
    // A missing file is not corruption; every existing complete line must validate.
    let content: string;
    try {
      content = await readFile(this.#path(sessionId), "utf8");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
      throw error;
    }
    const complete = content.endsWith("\n")
      ? content.slice(0, -1)
      : content.slice(0, content.lastIndexOf("\n"));
    const lines = complete ? complete.split("\n") : [];
    const header = lines.length ? parseRecord(lines[0], 1) : undefined;
    if (
      !header ||
      header.kind !== "header" ||
      header.record.sessionId !== sessionId
    ) {
      throw new AgenticError(
        "STORAGE_CORRUPTION",
        "Journal header is missing or invalid."
      );
    }
    const mutations: SessionMutation[] = [];
    let version = 0;
    for (let index = 1; index < lines.length; index += 1) {
      const batch = parseRecord(lines[index], index + 1);
      if (batch.kind !== "batch")
        throw new AgenticError(
          "STORAGE_CORRUPTION",
          `Unexpected header at line ${index + 1}.`
        );
      const payload = {
        kind: batch.kind,
        expectedVersion: batch.expectedVersion,
        version: batch.version,
        mutations: batch.mutations,
      };
      if (
        checksum(payload) !== batch.checksum ||
        batch.expectedVersion !== version ||
        batch.version !== version + batch.mutations.length
      ) {
        throw new AgenticError(
          "STORAGE_CORRUPTION",
          `Invalid batch at line ${index + 1}.`
        );
      }
      mutations.push(...batch.mutations);
      version = batch.version;
    }
    const record = { ...structuredClone(header.record), version };
    projectSession(record, mutations);
    return { record, mutations };
  }
  /**
   * Appends one checksummed batch under lock and optimistic version control.
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
    // Validate the prospective projection before one append+fsync commit record.
    if (!inputs.length)
      throw new AgenticError(
        "INVALID_REQUEST",
        "Mutation batch must not be empty."
      );
    await mkdir(this.#directory, { recursive: true });
    const lockPath = `${this.#path(sessionId)}.lock`;
    const lock = await acquireLock(lockPath);
    try {
      const loaded = await this.load(sessionId);
      if (!loaded)
        throw new AgenticError(
          "INVOCATION_NOT_FOUND",
          `Session not found: ${sessionId}`
        );
      if (loaded.record.version !== expectedVersion)
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
      projectSession(loaded.record, [...loaded.mutations, ...mutations]);
      const payload = {
        kind: "batch" as const,
        expectedVersion,
        version: expectedVersion + mutations.length,
        mutations,
      };
      const handle = await open(this.#path(sessionId), "a");
      try {
        await handle.writeFile(
          `${JSON.stringify({ ...payload, checksum: checksum(payload) })}\n`,
          "utf8"
        );
        await handle.sync();
      } finally {
        await handle.close();
      }
      return { version: payload.version };
    } finally {
      // Close and remove only the exact lock acquired for this session.
      await lock.close();
      await unlink(lockPath).catch(() => undefined);
    }
  }
}
