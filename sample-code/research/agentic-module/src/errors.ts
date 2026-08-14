export class AgenticError extends Error {
  readonly code: string;
  readonly retryable: boolean;
  /**
   * Creates a typed operational error with explicit retry semantics.
   * @param code - Machine-readable error code for the failure.
   * @param message - Human-readable error or transcript message.
   * @param retryable - Whether the caller may safely retry the failure.
   */
  constructor(code: string, message: string, retryable = false) {
    // Preserve the native Error message while attaching stable machine-readable fields.
    super(message);
    this.code = code;
    this.retryable = retryable;
  }
}
