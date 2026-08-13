/** Function definition registered with the host agent runtime. */
export interface RegisteredFunction {
  /** Runtime instance used as `this.super` inside a handler. */
  super: AgentRuntime;
  /** Unique model-visible function name. */
  name: string;
  /** Selection guidance supplied to the language model. */
  description: string;
  /** Representative natural-language prompts and serialized calls. */
  examples: Array<{ prompt: string; call: string }>;
  /** Closed JSON Schema for model-generated arguments. */
  parameters: Record<string, any>;
  /**
   * Executes the tool and returns a model-readable result.
   * @param args Schema-validated model arguments.
   * @returns Model-readable result text, synchronously or asynchronously.
   */
  handler(args: any): Promise<string> | string;
  /** Optional host caller identifier. */
  caller?: string;
}

/** Minimal host runtime surface consumed by the portable file tools. */
export interface AgentRuntime {
  /**
   * Registers one function definition with the active runtime.
   * @param definition Function metadata and handler.
   * @returns Host-specific registration result.
   */
  function(definition: RegisteredFunction): unknown;
  /** Host logging hooks. */
  handlerProps?: { log?: (...args: any[]) => void };
  /** Event transport used for download cards and progress. */
  socket?: { send(type: string, payload: unknown): void };
  /**
   * Emits section-building progress to the parent agent UI.
   * @param message Progress message.
   * @returns Nothing.
   */
  introspect?(message: string): void;
  /**
   * Attaches normalized child research citations to the parent response.
   * @param citations Citations accumulated by section child agents.
   * @returns Nothing.
   */
  addCitation?(citations: unknown[]): void;
  /** Shared cancellation signal propagated by the host. */
  abortController?: { signal: AbortSignal };
  /** Conversation history used to build bounded child context. */
  chats?: unknown[];
  /** Functions currently registered on a child runtime. */
  functions?: Map<string, RegisteredFunction>;
  /** Allows host-specific runtime fields without coupling this module to them. */
  [key: string]: any;
}

/** Installable tool wrapper compatible with the existing tool registry. */
export interface FunctionTool {
  /** Public function name used as the registry key. */
  name: string;
  /**
   * Creates the host plugin wrapper that performs registration.
   * @returns Plugin metadata and setup callback.
   */
  plugin(): { name: string; setup(runtime: AgentRuntime): void };
}

/**
 * Host-owned services required to approve, render, persist, and publish files.
 * The tools intentionally depend on these callbacks instead of application
 * singletons so the module can be mounted in another agent runtime.
 */
export interface FileToolDependencies {
  /**
   * Requests human/host approval before expensive work or persistence.
   * @param input Tool request summary for the host approval UI.
   * @returns Approval decision and host message.
   */
  requestApproval(input: {
    toolName: string;
    payload: Record<string, unknown>;
    description: string;
  }): Promise<{ approved: boolean; message: string }>;
  /**
   * Persists one generated binary through the host's authorized file store.
   * @param input Generated binary and display metadata.
   * @returns Stored filename, display filename, and byte size.
   */
  saveGeneratedFile(input: {
    fileType: "docx" | "xlsx" | "pptx";
    extension: "docx" | "xlsx" | "pptx";
    buffer: Buffer;
    displayFilename: string;
  }): Promise<{ filename: string; displayFilename: string; fileSize: number }>;
  /**
   * Registers a pending downloadable output on the parent runtime.
   * @param runtime Parent runtime owning the output.
   * @param type Download-card type.
   * @param payload Stored file metadata.
   * @returns Nothing; registration is synchronous in this portable contract.
   */
  registerOutput(
    runtime: AgentRuntime,
    type: "DocxFileDownload" | "ExcelFileDownload" | "PptxFileDownload",
    payload: { filename: string; storageFilename: string; fileSize: number }
  ): void;
  /**
   * Returns optional product branding in the renderer's requested format.
   * @param input Theme background and desired asset format.
   * @returns Logo data or `null` when branding is unavailable.
   */
  getLogo?(input: {
    forDarkBackground: boolean;
    format: "buffer" | "dataUri";
  }): Buffer | string | null;
  /**
   * Returns optional deployment metadata for Office document properties.
   * @returns Deployment version string.
   */
  getDeploymentVersion?(): string;
  /**
   * Creates a focused runtime that inherits provider and cancellation context.
   * @param input Parent runtime and child-execution limits.
   * @returns Configured isolated child runtime.
   */
  createChildRuntime?(input: {
    parent: AgentRuntime;
    maxToolCalls: number;
    suppressChatOutput: boolean;
  }): AgentRuntime;
  /**
   * Adds only host-approved research functions to a section child.
   * @param child Child runtime to augment.
   * @returns Nothing.
   */
  attachResearchTools?(child: AgentRuntime): void;
  /**
   * Executes a child through the host's real provider/runtime API.
   * @param input Child runtime, messages, tool functions, and trace name.
   * @returns Optional normalized citations from the child execution.
   */
  executeChildRuntime?(input: {
    child: AgentRuntime;
    messages: Array<{ role: string; content: string }>;
    functions: RegisteredFunction[];
    agentName: string;
  }): Promise<{ citations?: unknown[] } | void>;
  /**
   * Reads citations accumulated on a child when execution cannot return them.
   * @param child Child runtime to inspect.
   * @returns Child citations, if any.
   */
  getChildCitations?(child: AgentRuntime): unknown[];
  /**
   * Safely retrieves a bounded remote image after SSRF validation.
   * @param input URL, byte limit, timeout, and cancellation signal.
   * @returns Image bytes or `null` when retrieval is denied/unavailable.
   */
  fetchRemoteImage?(input: {
    url: string;
    maxBytes: number;
    timeoutMs: number;
    signal?: AbortSignal;
  }): Promise<Buffer | null>;
}
