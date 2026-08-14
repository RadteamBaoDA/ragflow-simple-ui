export type FlowStep = {
  type: "start" | "apiCall" | "llmInstruction" | "webScraping";
  config: Record<string, unknown>;
};
export type FlowDefinition = {
  id: string;
  name: string;
  steps: FlowStep[];
};
export type FlowExecutor = (
  config: Record<string, unknown>,
  context: {
    variables: Record<string, unknown>;
    signal: AbortSignal;
  }
) => Promise<unknown>;
/**
 * Validates the portable four-block flow structure before any executor runs.
 * @param value - Value to validate, transform, or persist.
 * @returns Whether the requested condition is satisfied.
 */
export function validateFlow(value: unknown):
  | {
      ok: true;
      value: FlowDefinition;
    }
  | {
      ok: false;
      errors: string[];
    } {
  // Collect structural errors so malformed flows never produce partial effects.
  const flow = value as Partial<FlowDefinition> & {
    active?: unknown;
  };
  const errors: string[] = [];
  if (!flow || typeof flow !== "object")
    return { ok: false, errors: ["Flow must be an object."] };
  if (typeof flow.id !== "string" || !flow.id) errors.push("id is required.");
  if (typeof flow.name !== "string" || !flow.name)
    errors.push("name is required.");
  if (!Array.isArray(flow.steps) || !flow.steps.length)
    errors.push("steps are required.");
  else {
    const supported = new Set([
      "start",
      "apiCall",
      "llmInstruction",
      "webScraping",
    ]);
    if (flow.steps[0]?.type !== "start")
      errors.push("first step must be start.");
    for (const step of flow.steps)
      if (!supported.has(step.type))
        errors.push(`unsupported step: ${step.type}`);
  }
  return errors.length
    ? { ok: false, errors }
    : { ok: true, value: flow as FlowDefinition };
}
/**
 * Reads a dotted or indexed variable path without evaluating code.
 * @param value - Value to validate, transform, or persist.
 * @param path - Filesystem path of the source or durable file.
 * @returns The atPath result produced for the current operation.
 */
function atPath(value: unknown, path: string): unknown {
  // Reject prototype keys while walking data-only objects.
  let current = value;
  for (const key of path.match(/[^.[\]]+/g) ?? []) {
    if (["__proto__", "prototype", "constructor"].includes(key))
      return undefined;
    if (!current || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}
/**
 * Recursively substitutes flow variables in JSON-compatible configuration.
 * @param value - Value to validate, transform, or persist.
 * @param variables - Template variables available to flow expansion.
 * @returns The expand result produced for the current operation.
 */
function expand(value: unknown, variables: Record<string, unknown>): unknown {
  // Expand strings, arrays, and objects while preserving unsupported primitive values.
  if (typeof value === "string") {
    return value.replace(/\$\{([^}]+)\}/g, (token, path) => {
      const found = atPath(variables, path);
      if (found === undefined) return token;
      return typeof found === "object" ? JSON.stringify(found) : String(found);
    });
  }
  if (Array.isArray(value)) return value.map((item) => expand(item, variables));
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, expand(item, variables)])
    );
  }
  return value;
}
/**
 * Executes validated flow blocks sequentially with deterministic variable propagation.
 * @param flow - Validated flow definition to execute.
 * @param options - Optional controls for the operation.
 * @returns A promise that resolves with the operation result.
 */
export async function executeFlow(
  flow: FlowDefinition,
  options: {
    input?: Record<string, unknown>;
    signal: AbortSignal;
    executors: Partial<
      Record<Exclude<FlowStep["type"], "start">, FlowExecutor>
    >;
  }
): Promise<{
  success: boolean;
  variables: Record<string, unknown>;
  directOutput?: unknown;
  error?: string;
}> {
  // Initialize defaults before host input so explicit input values take precedence.
  const variables: Record<string, unknown> = {};
  const start = flow.steps.find(({ type }) => type === "start");
  const defaults = Array.isArray(start?.config.variables)
    ? (start.config.variables as Array<{
        name?: string;
        value?: unknown;
      }>)
    : [];
  for (const item of defaults)
    if (item.name) variables[item.name] = item.value ?? "";
  Object.assign(variables, options.input ?? {});
  for (const step of flow.steps) {
    if (options.signal.aborted)
      return { success: false, variables, error: "ABORTED" };
    if (step.type === "start") continue;
    const executor = options.executors[step.type];
    if (!executor)
      return {
        success: false,
        variables,
        error: `Unsupported flow step: ${step.type}`,
      };
    try {
      const config = expand(step.config, variables) as Record<string, unknown>;
      const result = await executor(config, {
        variables,
        signal: options.signal,
      });
      const resultVariable = config.resultVariable ?? config.responseVariable;
      if (typeof resultVariable === "string")
        variables[resultVariable] = result;
      if (config.directOutput === true)
        return { success: true, variables, directOutput: result };
    } catch (error) {
      return {
        success: false,
        variables,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
  return { success: true, variables };
}
