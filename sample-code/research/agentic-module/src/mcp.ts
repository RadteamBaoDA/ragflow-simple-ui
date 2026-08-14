import { AgenticError } from "./errors.ts";
import type { ExecutionContext, JsonSchema, ToolDefinition } from "./types.ts";
export interface McpClientAdapter {
  /**
   * Lists normalized tools exposed by the MCP server.
   * @returns A promise that resolves with the operation result.
   */
  listTools(): Promise<
    Array<{
      name: string;
      description?: string;
      inputSchema: JsonSchema;
    }>
  >;
  /**
   * Calls one normalized MCP tool through the connected client.
   * @param input - Validated input required by the operation.
   * @returns A promise that resolves with the operation result.
   */
  callTool(input: {
    name: string;
    arguments: unknown;
    signal: AbortSignal;
  }): Promise<unknown>;
}
export interface McpManagerAdapter {
  /**
   * Starts the configured MCP server connection.
   * @param server - MCP server identifier or descriptor.
   * @param context - Authenticated execution context for the operation.
   * @returns A promise that resolves when the operation completes.
   */
  start(server: string, context?: ExecutionContext): Promise<void>;
  /**
   * Stops the configured MCP server connection.
   * @param server - MCP server identifier or descriptor.
   * @returns A promise that resolves when the operation completes.
   */
  stop(server: string): Promise<void>;
  /**
   * Reloads the configured MCP server connection.
   * @param server - MCP server identifier or descriptor.
   * @param context - Authenticated execution context for the operation.
   * @returns A promise that resolves when the operation completes.
   */
  reload(server: string, context?: ExecutionContext): Promise<void>;
  /**
   * Reads the current MCP server health state.
   * @param server - MCP server identifier or descriptor.
   * @returns A promise that resolves with the operation result.
   */
  health(server: string): Promise<"healthy" | "unhealthy">;
  /**
   * Lists normalized tools exposed by the MCP server.
   * @param server - MCP server identifier or descriptor.
   * @param context - Authenticated execution context for the operation.
   * @returns A promise that resolves with the operation result.
   */
  listTools(
    server: string,
    context: ExecutionContext
  ): Promise<
    Array<{
      name: string;
      description?: string;
      inputSchema: JsonSchema;
    }>
  >;
  /**
   * Calls one normalized MCP tool through the connected client.
   * @param input - Validated input required by the operation.
   * @returns A promise that resolves with the operation result.
   */
  callTool(input: {
    server: string;
    name: string;
    arguments: unknown;
    context: ExecutionContext;
    signal: AbortSignal;
  }): Promise<unknown>;
}
/**
 * Bounds one MCP operation by host timeout policy.
 * @param operation - MCP or durable operation callback to execute.
 * @param timeoutMs - Maximum operation duration in milliseconds.
 * @returns A promise that resolves with the operation result.
 */
async function within<T>(operation: Promise<T>, timeoutMs: number): Promise<T> {
  // Always clear the timer so completed operations retain no process resources.
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      operation,
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(
          () =>
            reject(
              new AgenticError(
                "MCP_UNAVAILABLE",
                "MCP operation timed out.",
                true
              )
            ),
          Math.max(1, timeoutMs)
        );
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
/**
 * Resolves a local JSON Pointer without allowing external schema references.
 * @param root - Root JSON Schema containing local definitions.
 * @param ref - Local JSON Schema reference to resolve.
 * @returns The pointer result produced for the current operation.
 */
function pointer(root: JsonSchema, ref: string): unknown {
  // Decode RFC 6901 escapes while traversing data-only objects.
  if (!ref.startsWith("#/")) return undefined;
  return ref
    .slice(2)
    .split("/")
    .reduce<unknown>((current, key) => {
      if (!current || typeof current !== "object") return undefined;
      return (current as Record<string, unknown>)[
        key.replace(/~1/g, "/").replace(/~0/g, "~")
      ];
    }, root);
}
/**
 * Resolves local schema refs and strips provider-incompatible definition tables.
 * @param schema - JSON Schema value to validate or normalize.
 * @returns The dereferenceSchema result produced for the current operation.
 */
export function dereferenceSchema(schema: JsonSchema): JsonSchema {
  // Track visited objects so cyclic schemas terminate safely.
  const seen = new Set<unknown>();
  /**
   * Recursively copies and normalizes one schema node.
   * @param value - Value to validate, transform, or persist.
   * @returns The visit result produced for the current operation.
   */
  const visit = (value: unknown): unknown => {
    // Primitives pass through; objects are copied and references are expanded.
    if (!value || typeof value !== "object") return value;
    if (seen.has(value)) return {};
    seen.add(value);
    const object = value as Record<string, unknown>;
    if (typeof object.$ref === "string") {
      const resolved = pointer(schema, object.$ref);
      return resolved
        ? visit({
            ...(resolved as object),
            ...Object.fromEntries(
              Object.entries(object).filter(([key]) => key !== "$ref")
            ),
          })
        : {};
    }
    if (Array.isArray(value)) return value.map(visit);
    return Object.fromEntries(
      Object.entries(object)
        .filter(([key]) => key !== "$defs" && key !== "definitions")
        .map(([key, item]) => [key, visit(item)])
    );
  };
  return visit(schema) as JsonSchema;
}
/**
 * Serializes MCP output with bigint and circular-reference handling.
 * @param value - Value to validate, transform, or persist.
 * @returns The resulting serialized string.
 */
export function safeStringify(value: unknown): string {
  // Preserve primitive display while protecting completed effects from JSON exceptions.
  if (typeof value !== "object" || value === null) return String(value);
  const seen = new WeakSet<object>();
  return JSON.stringify(value, (_key, item) => {
    if (typeof item === "bigint") return item.toString();
    if (item && typeof item === "object") {
      if (seen.has(item)) return "[Circular]";
      seen.add(item);
    }
    return item;
  });
}
/**
 * Maps discovered MCP tools into normal secured tool definitions.
 * @param serverName - Canonical MCP server name.
 * @param client - Connected MCP client used for server operations.
 * @param suppressed - Tool names suppressed from MCP exposure.
 * @returns A promise that resolves with the operation result.
 */
export async function mcpToolsToDefinitions(
  serverName: string,
  client: McpClientAdapter,
  suppressed: string[] = []
): Promise<ToolDefinition[]> {
  // Suppress host-disabled tools before exposing normalized schemas to the provider.
  const tools = await client.listTools();
  return tools
    .filter(({ name }) => !suppressed.includes(name))
    .map((tool) => ({
      name: `${serverName}-${tool.name}`
        .replace(/[^a-zA-Z0-9_-]/g, "_")
        .slice(0, 64),
      description: tool.description ?? `MCP tool ${serverName}:${tool.name}`,
      parameters: dereferenceSchema(tool.inputSchema),
      risk: "external" as const,
      /**
       * Executes the configured operation.
       * @param input - Validated input required by the operation.
       * @param context - Authenticated execution context for the operation.
       * @returns The execute result produced for the current operation.
       */
      execute: async (
        input: unknown,
        context: import("./types.ts").ToolContext
      ) => ({
        type: "continue" as const,
        content: safeStringify(
          await client.callTool({
            name: tool.name,
            arguments: input,
            signal: context.signal,
          })
        ),
      }),
    }));
}
/**
 * Starts, checks, discovers, and wraps tools from one managed MCP server.
 * @param server - MCP server identifier or descriptor.
 * @param manager - Host MCP manager used to control server lifecycle.
 * @param context - Authenticated execution context for the operation.
 * @param options - Optional controls for the operation.
 * @returns A promise that resolves with the operation result.
 * @throws When validation, persistence, policy, or the delegated operation fails.
 */
export async function mcpManagerTools(
  server: string,
  manager: McpManagerAdapter,
  context: ExecutionContext,
  options: {
    suppressed?: string[];
    timeoutMs?: number;
  } = {}
): Promise<ToolDefinition[]> {
  // Complete lifecycle checks before any server tool enters the agent registry.
  const timeoutMs = options.timeoutMs ?? 10000;
  await within(manager.start(server, context), timeoutMs);
  if ((await within(manager.health(server), timeoutMs)) !== "healthy") {
    throw new AgenticError(
      "MCP_UNAVAILABLE",
      `MCP server is unhealthy: ${server}`,
      true
    );
  }
  const listed = await within(manager.listTools(server, context), timeoutMs);
  return mcpToolsToDefinitions(
    server,
    {
      /**
       * Lists normalized tools exposed by the MCP server.
       * @returns The ordered values produced by the operation.
       */
      listTools: async () => listed,
      /**
       * Calls one normalized MCP tool through the connected client.
       * @param options - Optional controls for the operation.
       * @returns The callTool result produced for the current operation.
       */
      callTool: ({ name, arguments: args, signal }) =>
        manager.callTool({ server, name, arguments: args, context, signal }),
    },
    options.suppressed
  );
}
