import type { JsonSchema, ToolDefinition } from "./types.ts";
import { AgenticError } from "./errors.ts";
import { assertImportedExecutionPolicy } from "./security.ts";
import type { ExecutionContext } from "./types.ts";
export type ImportedSkillManifest = {
  id: string;
  name: string;
  version: string;
  description: string;
  active: boolean;
  entrypoint: {
    parameters: JsonSchema;
  };
};
/**
 * Validates an imported-skill manifest without activating or executing code.
 * @param value - Value to validate, transform, or persist.
 * @returns Whether the requested condition is satisfied.
 */
export function validateImportedSkillManifest(value: unknown):
  | {
      ok: true;
      value: ImportedSkillManifest;
    }
  | {
      ok: false;
      errors: string[];
    } {
  // Accumulate field errors for one deterministic import response.
  const item = value as Partial<ImportedSkillManifest> | null;
  const errors: string[] = [];
  if (!item || typeof item !== "object")
    errors.push("Manifest must be an object.");
  for (const key of ["id", "name", "version", "description"] as const) {
    if (typeof item?.[key] !== "string" || !item[key])
      errors.push(`${key} is required.`);
  }
  if (typeof item?.active !== "boolean") errors.push("active must be boolean.");
  if (!item?.entrypoint || typeof item.entrypoint.parameters !== "object")
    errors.push("entrypoint.parameters is required.");
  return errors.length > 0
    ? { ok: false, errors }
    : { ok: true, value: item as ImportedSkillManifest };
}
/**
 * Converts an active imported manifest into a normal secured tool definition.
 * @param manifest - Validated imported-skill manifest.
 * @param execute - Callback that performs the gated external effect.
 * @param risk - Central policy risk classification for the tool.
 * @returns The importedSkillToDefinition result produced for the current operation.
 * @throws When validation, persistence, policy, or the delegated operation fails.
 */
export function importedSkillToDefinition(
  manifest: ImportedSkillManifest,
  execute: ToolDefinition["execute"],
  risk: ToolDefinition["risk"] = "external"
): ToolDefinition {
  // Inactive manifests never become callable provider tools.
  if (!manifest.active)
    throw new Error(`Imported skill is inactive: ${manifest.id}`);
  return {
    name: manifest.id,
    description: manifest.description,
    parameters: manifest.entrypoint.parameters,
    risk,
    execute,
  };
}
/**
 * Validates an imported manifest and forces inactive-first installation state.
 * @param value - Value to validate, transform, or persist.
 * @returns The created or normalized operation result.
 * @throws When validation, persistence, policy, or the delegated operation fails.
 */
export function normalizeImportedManifest(
  value: unknown
): ImportedSkillManifest {
  // Ignore supplied activation so import cannot grant execution authority.
  const validated = validateImportedSkillManifest(value);
  if (!validated.ok)
    throw new AgenticError(
      "SKILL_MANIFEST_INVALID",
      validated.errors.join(" ")
    );
  return { ...validated.value, active: false };
}
/**
 * Activates a skill only after management authorization and execution isolation checks.
 * @param manifest - Validated imported-skill manifest.
 * @param context - Authenticated execution context for the operation.
 * @param policy - Server-authoritative policy used for authorization.
 * @param execution - Imported-skill execution isolation policy.
 * @returns A promise that resolves with the operation result.
 * @throws When validation, persistence, policy, or the delegated operation fails.
 */
export async function activateImportedSkill(
  manifest: ImportedSkillManifest,
  context: ExecutionContext,
  policy: {
    /**
     * Determines whether the caller may manage tool activation.
     * @param context - Authenticated execution context for the operation.
     * @returns A promise that resolves with the operation result.
     */
    canManageTools(context: ExecutionContext): boolean | Promise<boolean>;
  },
  execution: {
    mode: "worker" | "sandbox" | "in_process";
    allowInProcess?: boolean;
  }
): Promise<ImportedSkillManifest> {
  // Both management policy and runtime isolation must pass before activation.
  if (!(await policy.canManageTools(context)))
    throw new AgenticError("TOOL_DENIED", "Imported skill activation denied.");
  assertImportedExecutionPolicy(execution.mode, execution.allowInProcess);
  return { ...manifest, active: true };
}
