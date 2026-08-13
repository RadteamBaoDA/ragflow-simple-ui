/** Office document formats supported by registered-template tools. */
export type DocumentFormat = "docx" | "xlsx" | "pptx";
/** JSON object accepted as complete template substitution data. */
export type JsonObject = Record<string, unknown>;

/** Minimal host agent runtime consumed by template-backed file tools. */
export interface AgentRuntime {
  /**
   * Registers one model-callable function.
   * @param definition Function metadata and handler.
   * @returns Host-specific registration result.
   */
  function(definition: RegisteredFunction): unknown;
  /** Invocation metadata and host logger. */
  handlerProps?: {
    invocation?: Record<string, unknown>;
    log?: (...args: unknown[]) => void;
  };
  /** Shared cancellation controller. */
  abortController?: { signal: AbortSignal };
  /** Event transport used to emit download cards. */
  socket?: { send(type: string, payload: unknown): void };
  /** Permits host-specific runtime fields without coupling the sample to them. */
  [key: string]: unknown;
}

/** Function definition registered with the host agent runtime. */
export interface RegisteredFunction {
  /** Runtime exposed to the handler as `this.super`. */
  super: AgentRuntime;
  /** Unique model-visible function name. */
  name: string;
  /** Tool-selection guidance provided to the model. */
  description: string;
  /** Example prompts and serialized tool calls. */
  examples?: Array<{ prompt: string; call: string }>;
  /** Closed JSON Schema for model-generated arguments. */
  parameters: Record<string, unknown>;
  /**
   * Executes the tool and returns a model-readable result.
   * @param args Schema-validated model arguments.
   * @returns Model-readable result text, synchronously or asynchronously.
   */
  handler(args: any): Promise<string> | string;
  /** Optional host caller identifier. */
  caller?: string;
}

/** Installable function tool compatible with the existing registry contract. */
export interface FunctionTool {
  /** Public function name used as the registry key. */
  name: string;
  /**
   * Creates the plugin wrapper that registers the function.
   * @returns Plugin metadata and setup callback.
   */
  plugin(): { name: string; setup(runtime: AgentRuntime): void };
}

/** Active or archived Office template loaded from host persistence. */
export interface StoredTemplate {
  /** Stable template identifier selected by the caller. */
  id: string;
  /** Human-readable template name used for default filenames. */
  name: string;
  /** Office format of the stored binary. */
  format: DocumentFormat;
  /** Lifecycle state controlling whether generation is allowed. */
  status: "active" | "archived";
  /** Original registered template bytes. */
  buffer: Buffer;
  /** Optional data contract validated by the host. */
  schema?: JsonObject;
}

/** Authorization and cancellation context derived from one agent invocation. */
export interface ToolContext {
  /** Invocation/run identifier used for tracing. */
  runId: string;
  /** Authenticated user identifier. */
  userId: string;
  /** Workspace authorization boundary. */
  workspaceId: string;
  /** Cancellation signal propagated through host dependencies. */
  signal?: AbortSignal;
}

/** Host-owned services required by all template-backed document tools. */
export interface DocumentToolDependencies {
  /** Template repository scoped by invocation context. */
  templates: {
    /**
     * Loads one registered template by stable ID.
     * @param templateId Registered template identifier.
     * @param context Invocation authorization context.
     * @returns Stored template or `null` when absent/inaccessible.
     */
    load(
      templateId: string,
      context: ToolContext
    ): Promise<StoredTemplate | null>;
  };
  /**
   * Validates complete data against the registered template contract.
   * @param templateId Registered template identifier.
   * @param data Complete object to substitute.
   * @param context Invocation authorization context.
   * @returns Validation result and optional field errors.
   */
  validateTemplateData(
    templateId: string,
    data: JsonObject,
    context: ToolContext
  ): Promise<{ valid: boolean; errors?: string[] }>;
  /**
   * Requests user/host approval before rendering and persistence.
   * @param input Approval summary and invocation context.
   * @returns Whether the operation is approved.
   */
  requestApproval(input: {
    toolName: string;
    templateId: string;
    templateName: string;
    filename: string;
    context: ToolContext;
  }): Promise<boolean>;
  /**
   * Persists a generated binary through the host's authorized file store.
   * @param input Office file bytes and storage metadata.
   * @returns Storage filename and byte size.
   */
  saveGeneratedFile(input: {
    format: DocumentFormat;
    filename: string;
    buffer: Buffer;
    context: ToolContext;
  }): Promise<{ storageFilename: string; fileSize: number }>;
  /**
   * Registers the stored file as a downloadable agent output.
   * @param input Download-card/output metadata.
   * @returns Resolves when output registration completes.
   */
  registerOutput(input: {
    type: "DocxFileDownload" | "ExcelFileDownload" | "PptxFileDownload";
    filename: string;
    storageFilename: string;
    fileSize: number;
    templateId: string;
    context: ToolContext;
  }): Promise<void> | void;
  /** Optional hard ceiling for generated output bytes. */
  maxOutputBytes?: number;
}

/** Stable error codes returned to the model by template-backed tools. */
export type ToolErrorCode =
  | "INVALID_ARGUMENTS"
  | "INVALID_FILENAME"
  | "TEMPLATE_NOT_FOUND"
  | "TEMPLATE_NOT_ACTIVE"
  | "TEMPLATE_FORMAT_MISMATCH"
  | "INPUT_SCHEMA_INVALID"
  | "APPROVAL_DENIED"
  | "ABORTED"
  | "RENDER_FAILED"
  | "OUTPUT_TOO_LARGE"
  | "INTERNAL_ERROR";
