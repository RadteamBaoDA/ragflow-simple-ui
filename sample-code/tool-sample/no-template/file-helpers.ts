import type { AgentRuntime, FileToolDependencies } from "./types.js";

/**
 * Recursively removes control characters that are illegal in Office XML.
 * @template T Input value type.
 * @param value String, array, object, or scalar to sanitize.
 * @returns Sanitized value preserving the input shape.
 */
export function stripInvalidXmlChars<T>(value: T): T {
  if (typeof value === "string")
    return value.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "") as T;
  if (Array.isArray(value)) return value.map(stripInvalidXmlChars) as T;
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value).map(
        /** Sanitizes each object property while preserving its key. */
        ([key, item]) => [key, stripInvalidXmlChars(item)]
      )
    ) as T;
  return value;
}

/**
 * Produces a display-safe filename with the requested Office extension.
 * Storage-level path traversal protection remains the host's responsibility.
 * @param filename Requested model filename.
 * @param extension Required Office file extension.
 * @param fallback Filename used when the request is empty.
 * @returns Validated display filename with the required extension.
 * @throws {Error} When reserved filename characters are present.
 */
export function normalizeFilename(
  filename: unknown,
  extension: "docx" | "xlsx" | "pptx",
  fallback: string
): string {
  if (typeof filename !== "string" || !filename.trim()) filename = fallback;
  const value = String(filename).trim();
  if (/[\r\n<>:"|?*]/.test(value)) throw new Error("Invalid filename.");
  const display = value.split(/[\\/]/).pop() || fallback;
  return display.toLowerCase().endsWith(`.${extension}`)
    ? display
    : `${display}.${extension}`;
}

/**
 * Stops work before expensive rendering or persistence when the host aborts.
 * @param runtime Runtime carrying the optional abort signal.
 * @returns Nothing when execution may continue.
 * @throws {Error} When the signal is aborted.
 */
export function throwIfAborted(runtime: AgentRuntime): void {
  if (runtime.abortController?.signal.aborted)
    throw new Error("File creation aborted.");
}

/**
 * Requests mandatory host approval and returns the denial message, if any.
 * @param dependencies Host approval adapter.
 * @param toolName Public function name shown by the host.
 * @param payload Safe request summary for approval UI.
 * @param description Human-readable operation description.
 * @returns `null` on approval or the host denial message.
 */
export async function approve(
  dependencies: FileToolDependencies,
  toolName: string,
  payload: Record<string, unknown>,
  description: string
): Promise<string | null> {
  const result = await dependencies.requestApproval({
    toolName,
    payload,
    description,
  });
  return result.approved ? null : result.message;
}

/**
 * Saves a generated buffer and emits the host's standard download artifacts.
 * @param input Rendered file, host dependencies, and download metadata.
 * @returns Resolves after persistence, socket event, and output registration.
 * @throws {Error} When aborted or the host persistence operation fails.
 */
export async function publishFile(input: {
  runtime: AgentRuntime;
  dependencies: FileToolDependencies;
  type: "docx" | "xlsx" | "pptx";
  outputType: "DocxFileDownload" | "ExcelFileDownload" | "PptxFileDownload";
  filename: string;
  buffer: Buffer;
}): Promise<void> {
  // Re-check abort immediately before the only state-changing operation.
  throwIfAborted(input.runtime);
  const saved = await input.dependencies.saveGeneratedFile({
    fileType: input.type,
    extension: input.type,
    buffer: input.buffer,
    displayFilename: input.filename,
  });
  // Keep websocket cards and pending outputs backed by the same stored file.
  input.runtime.socket?.send("fileDownloadCard", {
    filename: saved.displayFilename,
    storageFilename: saved.filename,
    fileSize: saved.fileSize,
  });
  input.dependencies.registerOutput(input.runtime, input.outputType, {
    filename: saved.displayFilename,
    storageFilename: saved.filename,
    fileSize: saved.fileSize,
  });
}

/**
 * Logs internal detail while returning a path- and stack-safe tool message.
 * @param format Office format label used in the response.
 * @param error Original caught error.
 * @param runtime Runtime whose logger receives internal detail.
 * @returns Model-safe error text.
 */
export function safeError(
  format: string,
  error: unknown,
  runtime: AgentRuntime
): string {
  // Full detail stays in server logs; the model sees only allowlisted errors.
  runtime.handlerProps?.log?.(
    `Failed to create ${format}:`,
    error instanceof Error ? error.message : error
  );
  if (error instanceof Error && error.message === "File creation aborted.")
    return `Error creating ${format} file: operation aborted.`;
  if (
    error instanceof Error &&
    /^(Invalid filename\.|Invalid |At least |Excel )/.test(error.message)
  )
    return `Error creating ${format} file: ${error.message}`;
  return `Error creating ${format} file: rendering failed.`;
}
