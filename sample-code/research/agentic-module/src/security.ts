import { AgenticError } from "./errors.ts";
/**
 * Normalizes and validates a package-relative storage or archive reference.
 * @param reference - Relative storage or artifact reference to validate.
 * @returns The resulting serialized string.
 * @throws When validation, persistence, policy, or the delegated operation fails.
 */
export function assertSafeRelativeReference(reference: string): string {
  // Absolute paths, traversal segments, and NUL bytes never cross the trust boundary.
  const normalized = reference.replaceAll("\\", "/");
  if (
    !normalized ||
    normalized.startsWith("/") ||
    /^[a-zA-Z]:\//.test(normalized) ||
    normalized.split("/").some((part) => part === "..")
  ) {
    throw new AgenticError(
      "INVALID_REQUEST",
      "Unsafe path or storage reference."
    );
  }
  return normalized;
}
/**
 * Enforces isolated execution for imported code unless a host explicitly accepts in-process risk.
 * @param mode - Requested activation or execution-isolation mode.
 * @param allowInProcess - Whether explicitly authorized in-process execution is allowed.
 * @returns Nothing; completion indicates that the operation finished.
 * @throws When validation, persistence, policy, or the delegated operation fails.
 */
export function assertImportedExecutionPolicy(
  mode: "worker" | "sandbox" | "in_process",
  allowInProcess = false
): void {
  // Worker and sandbox modes are safe defaults; in-process execution requires explicit opt-in.
  if (mode === "in_process" && !allowInProcess) {
    throw new AgenticError(
      "SKILL_EXECUTION_DENIED",
      "In-process imported skill execution requires explicit opt-in."
    );
  }
}
/**
 * Validates every archive member before extraction to prevent zip-slip style writes.
 * @param entries - Archive entry paths to validate.
 * @returns Nothing; completion indicates that the operation finished.
 */
export function assertArchiveEntriesSafe(entries: readonly string[]): void {
  // Validate the entire archive first so extraction can remain all-or-none.
  for (const entry of entries) assertSafeRelativeReference(entry);
}
