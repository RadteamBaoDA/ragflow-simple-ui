import { AgenticError } from "./errors.ts";
import { assertSafeRelativeReference } from "./security.ts";
import type { ExecutionContext } from "./types.ts";
/**
 * Validates an artifact reference and delegates owner-scope authorization to the host.
 * @param storageRef - Opaque relative reference owned by host storage.
 * @param context - Authenticated execution context for the operation.
 * @param authorize - Host authorization callback for the requested resource.
 * @returns A promise that resolves with the operation result.
 * @throws When validation, persistence, policy, or the delegated operation fails.
 */
export async function authorizeArtifactAccess(
  storageRef: string,
  context: ExecutionContext,
  authorize: (
    storageRef: string,
    context: ExecutionContext
  ) => boolean | Promise<boolean>
): Promise<string> {
  // Reject path traversal before any host storage lookup or authorization effect.
  const safe = assertSafeRelativeReference(storageRef);
  if (!(await authorize(safe, context)))
    throw new AgenticError("TOOL_DENIED", "Artifact access denied.");
  return safe;
}
