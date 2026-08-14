import type { ToolDefinition } from "./types.ts";
export class ToolRegistry {
  readonly #tools = new Map<string, ToolDefinition>();
  /**
   * Registers one uniquely named tool after validating provider-safe identity syntax.
   * @param tool - Tool definition subject to policy or execution.
   * @returns The register result produced for the current operation.
   * @throws When validation, persistence, policy, or the delegated operation fails.
   */
  register(tool: ToolDefinition): this {
    // Reject malformed or duplicate names before changing the registry.
    if (!/^[a-zA-Z0-9_-]{1,64}$/.test(tool.name)) {
      throw new Error(`Invalid tool name: ${tool.name}`);
    }
    if (this.#tools.has(tool.name))
      throw new Error(`Duplicate tool: ${tool.name}`);
    this.#tools.set(tool.name, tool);
    return this;
  }
  /**
   * Registers tools in source order and returns the same registry for fluent setup.
   * @param tools - Tool definitions available to the operation.
   * @returns The registerAll result produced for the current operation.
   */
  registerAll(tools: ToolDefinition[]): this {
    // Reuse the single-tool validation path so batch registration cannot bypass invariants.
    for (const tool of tools) this.register(tool);
    return this;
  }
  /**
   * Resolves one tool by its stable provider-visible name.
   * @param name - Canonical tool, server, or resource name.
   * @returns The get result produced for the current operation.
   */
  get(name: string): ToolDefinition | undefined {
    // Return the registered definition without inventing fallback behavior.
    return this.#tools.get(name);
  }
  /**
   * Returns the tools in deterministic insertion order.
   * @returns The ordered values produced by the operation.
   */
  list(): ToolDefinition[] {
    // Copy the map values so consumers cannot mutate registry membership.
    return [...this.#tools.values()];
  }
}
export type ToolIdentifierLoaders = {
  /**
   * Loads a built-in tool by identifier.
   * @param name - Canonical tool, server, or resource name.
   * @returns A promise that resolves with the operation result.
   */
  builtIn(name: string): Promise<ToolDefinition | undefined>;
  /**
   * Loads a child-agent tool by identifier.
   * @param parent - Parent tool or transcript identifier.
   * @param child - Child path segment or transcript entry identifier.
   * @returns A promise that resolves with the operation result.
   */
  child(parent: string, child: string): Promise<ToolDefinition | undefined>;
  /**
   * Loads a flow-backed tool by identifier.
   * @param id - Stable identifier of the requested value.
   * @returns A promise that resolves with the operation result.
   */
  flow(id: string): Promise<ToolDefinition | undefined>;
  /**
   * Loads an imported-skill tool by identifier.
   * @param id - Stable identifier of the requested value.
   * @returns A promise that resolves with the operation result.
   */
  imported(id: string): Promise<ToolDefinition | undefined>;
  /**
   * Loads an MCP-backed tool by identifier.
   * @param server - MCP server identifier or descriptor.
   * @returns A promise that resolves with the operation result.
   */
  mcp(server: string): Promise<ToolDefinition[]>;
};
/**
 * Resolves portable built-in, child, flow, imported-skill, and MCP identifiers.
 * @param identifiers - Value supplied as identifiers to this operation.
 * @param loaders - Authorized loaders used to resolve external capabilities.
 * @returns A promise that resolves with the operation result.
 */
export async function resolveToolIdentifiers(
  identifiers: string[],
  loaders: ToolIdentifierLoaders
): Promise<ToolDefinition[]> {
  // Preserve source order while routing every identifier to its owning host loader.
  const resolved: ToolDefinition[] = [];
  for (const identifier of identifiers) {
    if (identifier.startsWith("@@flow_")) {
      const tool = await loaders.flow(identifier.slice("@@flow_".length));
      if (tool) resolved.push(tool);
      continue;
    }
    if (identifier.startsWith("@@mcp_")) {
      resolved.push(...(await loaders.mcp(identifier.slice("@@mcp_".length))));
      continue;
    }
    if (identifier.startsWith("@@")) {
      const tool = await loaders.imported(identifier.slice(2));
      if (tool) resolved.push(tool);
      continue;
    }
    if (identifier.includes("#")) {
      const [parent, child] = identifier.split("#", 2);
      const tool = await loaders.child(parent, child);
      if (tool) resolved.push(tool);
      continue;
    }
    const tool = await loaders.builtIn(identifier);
    if (tool) resolved.push(tool);
  }
  return resolved;
}
