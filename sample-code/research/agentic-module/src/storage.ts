import type { Artifact, Attachment, ExecutionContext } from "./types.ts";
export interface AttachmentStore {
  /**
   * Persists a scoped attachment or artifact value.
   * @param runId - Stable identifier of the agent run.
   * @param attachments - Attachments to persist for the current execution scope.
   * @param context - Authenticated execution context for the operation.
   * @param signal - Abort signal propagated to external work.
   * @returns A promise that resolves with the operation result.
   */
  save(
    runId: string,
    attachments: Attachment[],
    context: ExecutionContext,
    signal: AbortSignal
  ): Promise<Attachment[]>;
  /**
   * Consumes a scoped attachment from host storage.
   * @param runId - Stable identifier of the agent run.
   * @param context - Authenticated execution context for the operation.
   * @param signal - Abort signal propagated to external work.
   * @returns A promise that resolves with the operation result.
   */
  take(
    runId: string,
    context: ExecutionContext,
    signal: AbortSignal
  ): Promise<Attachment[]>;
}
export interface ArtifactStore {
  /**
   * Persists a scoped attachment or artifact value.
   * @param runId - Stable identifier of the agent run.
   * @param artifact - Artifact metadata and payload to register or persist.
   * @param context - Authenticated execution context for the operation.
   * @param signal - Abort signal propagated to external work.
   * @returns A promise that resolves with the operation result.
   */
  save(
    runId: string,
    artifact: Artifact,
    context: ExecutionContext,
    signal: AbortSignal
  ): Promise<Artifact>;
  /**
   * Determines whether policy permits the requested operation.
   * @param storageRef - Opaque relative reference owned by host storage.
   * @param context - Authenticated execution context for the operation.
   * @returns A promise that resolves with the operation result.
   */
  authorize(
    storageRef: string,
    context: ExecutionContext
  ): boolean | Promise<boolean>;
}
