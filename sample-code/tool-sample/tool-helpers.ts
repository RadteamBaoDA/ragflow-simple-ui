import type {
  AgentRuntime,
  DocumentFormat,
  JsonObject,
  ToolContext,
  ToolErrorCode,
} from "./types.js";

/** Expected tool failure carrying a stable model-visible error code. */
export class ToolFailure extends Error {
  /**
   * Creates a failure that can safely cross the tool boundary.
   * @param code Stable model-visible error code.
   * @param message Safe human/model-visible error description.
   * @param details Optional bounded validation details.
   * @returns Constructed `ToolFailure` instance.
   */
  constructor(
    readonly code: ToolErrorCode,
    message: string,
    readonly details?: string[]
  ) {
    super(message);
  }
}

/**
 * Extracts authorization, tracing, and cancellation data from the runtime.
 * @param runtime Host runtime for the active tool invocation.
 * @returns Normalized context passed to every host dependency.
 */
export function toolContext(runtime: AgentRuntime): ToolContext {
  // Normalize absent host metadata to empty strings without inventing identity.
  const invocation = runtime.handlerProps?.invocation ?? {};
  return {
    runId: String(invocation.uuid ?? invocation.id ?? ""),
    userId: String(invocation.user_id ?? ""),
    workspaceId: String(invocation.workspace_id ?? ""),
    signal: runtime.abortController?.signal,
  };
}

/**
 * Parses a model-provided JSON string and requires an object root.
 * @param value Untrusted `data_json` argument supplied by the model.
 * @returns Parsed JSON object.
 * @throws {ToolFailure} When the value is not a JSON object string.
 */
export function parseDataJson(value: unknown): JsonObject {
  if (typeof value !== "string")
    throw new ToolFailure(
      "INVALID_ARGUMENTS",
      "data_json must contain a JSON object string."
    );
  try {
    const parsed: unknown = JSON.parse(value);
    // Arrays and scalar roots cannot satisfy named template placeholders.
    if (!isObject(parsed)) throw new Error();
    return parsed;
  } catch {
    throw new ToolFailure(
      "INVALID_ARGUMENTS",
      "data_json must contain a JSON object string."
    );
  }
}

/**
 * Produces a safe filename with an extension matching the template format.
 * @param requested Optional user/model requested filename.
 * @param templateName Trusted template display name for the fallback filename.
 * @param format Required Office format and extension.
 * @returns Validated display filename.
 * @throws {ToolFailure} When the filename is unsafe or has a mismatched extension.
 */
export function normalizeFilename(
  requested: string | null | undefined,
  templateName: string,
  format: DocumentFormat
): string {
  // Default names are deterministic and derived only from trusted metadata.
  const filename =
    requested?.trim() || `${slug(templateName) || "document"}.${format}`;
  if (
    filename.length > 180 ||
    /[<>:"/\\|?*\x00-\x1f]/.test(filename) ||
    /[. ]$/.test(filename)
  )
    throw new ToolFailure(
      "INVALID_FILENAME",
      "filename must not contain a path or reserved characters."
    );
  const extension = filename.match(/\.([^.]+)$/)?.[1]?.toLowerCase();
  if (extension && extension !== format)
    throw new ToolFailure(
      "INVALID_FILENAME",
      `filename extension must be .${format}.`
    );
  return extension ? filename : `${filename}.${format}`;
}

/**
 * Converts unknown exceptions into a stable JSON tool result.
 * @param error Caught execution error.
 * @returns Serialized safe error response for the language model.
 */
export function errorResult(error: unknown): string {
  // Unexpected internals never expose their original stack or message to the model.
  const failure =
    error instanceof ToolFailure
      ? error
      : new ToolFailure(
          "INTERNAL_ERROR",
          "Document creation failed unexpectedly."
        );
  return JSON.stringify({
    ok: false,
    error: {
      code: failure.code,
      message: failure.message,
      details: failure.details,
    },
  });
}

/**
 * Fails immediately when the invocation cancellation signal is set.
 * @param signal Optional signal propagated by the host runtime.
 * @returns Nothing when execution may continue.
 * @throws {ToolFailure} When the signal is aborted.
 */
export function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted)
    throw new ToolFailure("ABORTED", "Document creation was aborted.");
}

/**
 * Narrows a value to a non-array JSON object.
 * @param value Value to inspect.
 * @returns Whether the value is a JSON object.
 */
export function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Creates a bounded ASCII slug for generated default filenames.
 * @param value Template display name to normalize.
 * @returns Lowercase filename-safe slug.
 */
function slug(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}
