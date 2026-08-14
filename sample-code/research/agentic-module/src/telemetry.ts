const SENSITIVE_KEY =
  /^(prompt|output|content|authorization|cookie|password|passphrase|token|api[-_]?key|private[-_]?key|secret)$/i;
export type TelemetrySpan = {
  kind: "provider" | "tool" | "compaction" | "navigation";
  runId: string;
  operationId: string;
  lane: string;
  stepId: string;
  attempt: number;
  durationMs: number;
  outcome: "completed" | "failed" | "retryable_error" | "aborted" | "suspended";
  usage?: Record<string, number>;
};
/**
 * Removes message bodies and credential-shaped fields before telemetry leaves the harness.
 * @param value - Value to validate, transform, or persist.
 * @returns The redactTelemetry result produced for the current operation.
 */
export function redactTelemetry(value: unknown): unknown {
  // Track object identity so malformed cyclic host metadata cannot recurse forever.
  return redactValue(value, new WeakSet<object>());
}
/**
 * Recursively copies telemetry metadata while replacing prohibited values.
 * @param value - Value to validate, transform, or persist.
 * @param seen - Value supplied as seen to this operation.
 * @returns The redactValue result produced for the current operation.
 */
function redactValue(value: unknown, seen: WeakSet<object>): unknown {
  // Primitives are safe unless their owning key was classified by the caller frame.
  if (value === null || typeof value !== "object") return value;
  if (seen.has(value)) return "[REDACTED]";
  seen.add(value);
  if (Array.isArray(value)) return value.map((item) => redactValue(item, seen));
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [
      key,
      SENSITIVE_KEY.test(key) ? "[REDACTED]" : redactValue(item, seen),
    ])
  );
}
