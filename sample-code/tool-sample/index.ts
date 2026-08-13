import assert from "node:assert/strict";
import { createDocxFromTemplateTool } from "./create-docx-from-template.js";
import { createXlsxFromTemplateTool } from "./create-xlsx-from-template.js";
import { createPptxFromTemplateTool } from "./create-pptx-from-template.js";
import type {
  AgentRuntime,
  RegisteredFunction,
  DocumentToolDependencies,
} from "./types.js";

export { createDocxFromTemplateTool } from "./create-docx-from-template.js";
export { createXlsxFromTemplateTool } from "./create-xlsx-from-template.js";
export { createPptxFromTemplateTool } from "./create-pptx-from-template.js";
export type * from "./types.js";

/**
 * Verifies registry metadata and fail-closed validation for all template tools.
 * @returns Resolves when all assertions pass.
 * @throws {AssertionError} When a registry or validation contract regresses.
 */
async function selfCheck(): Promise<void> {
  // The stub host stops at schema validation, before approval or persistence.
  let validationCalls = 0;
  const dependencies = {
    templates: {
      /**
       * Creates an active in-memory template fixture for the requested format.
       * @param templateId Fixture template identifier.
       * @returns Active template fixture matching the identifier prefix.
       */
      async load(templateId: string) {
        const format = templateId.split("-")[0] as "docx" | "xlsx" | "pptx";
        return {
          id: templateId,
          name: `${format} template`,
          format,
          status: "active" as const,
          buffer: Buffer.alloc(0),
        };
      },
    },
    /**
     * Counts validation calls and forces the incomplete-data path.
     * @returns Failed validation result for the test fixture.
     */
    async validateTemplateData() {
      validationCalls += 1;
      return { valid: false, errors: ["required content is missing"] };
    },
    /**
     * Guards against approval being reached by invalid fixture data.
     * @returns Never resolves; throws when validation ordering regresses.
     */
    async requestApproval() {
      throw new Error("approval must not run for incomplete data");
    },
    /**
     * Guards against persistence being reached by invalid fixture data.
     * @returns Never resolves; throws when validation ordering regresses.
     */
    async saveGeneratedFile() {
      throw new Error("save must not run for incomplete data");
    },
    /**
     * Guards against output registration for invalid fixture data.
     * @returns Never returns; throws when validation ordering regresses.
     */
    registerOutput() {
      throw new Error("output must not register for incomplete data");
    },
  } as DocumentToolDependencies;
  // Register through public plugins to exercise the real host-facing path.
  const tools = [
    createDocxFromTemplateTool(dependencies),
    createXlsxFromTemplateTool(dependencies),
    createPptxFromTemplateTool(dependencies),
  ];
  const registered: RegisteredFunction[] = [];
  const runtime = {
    /**
     * Captures each function registered by a sample plugin.
     * @param definition Registered function fixture.
     * @returns Nothing; appends to the test collection.
     */
    function(definition: RegisteredFunction) {
      registered.push(definition);
    },
  } as unknown as AgentRuntime;
  for (const tool of tools) tool.plugin().setup(runtime);
  assert.deepEqual(
    tools.map(
      /** Selects public names for deterministic export-order validation. */
      (tool) => tool.name
    ),
    [
      "create-docx-from-template",
      "create-xlsx-from-template",
      "create-pptx-from-template",
    ]
  );
  assert.equal(registered.length, 3);
  // Every format accepts the same template ID, data JSON, and filename contract.
  for (const definition of registered) {
    const parameters = definition.parameters as { required?: string[] };
    assert.deepEqual(parameters.required, [
      "template_id",
      "data_json",
      "filename",
    ]);
  }
  assert.equal(
    registered.every(
      /** Checks the model-facing metadata contract for one tool definition. */
      (definition) =>
        typeof definition.description === "string" &&
        definition.description.length > 40 &&
        Array.isArray(definition.examples) &&
        definition.examples.length > 0 &&
        typeof definition.parameters === "object" &&
        typeof definition.handler === "function"
    ),
    true
  );
  // Incomplete data must fail before approval, rendering, or storage.
  for (const definition of registered) {
    const format = definition.name.split("-")[1];
    const result = await definition.handler({
      template_id: `${format}-template`,
      data_json: "{}",
      filename: null,
    });
    assert.match(result, /INPUT_SCHEMA_INVALID/);
  }
  assert.equal(validationCalls, 3);
}

if (process.argv.includes("--self-check")) {
  selfCheck().catch(
    /** Reports a failed command-line self-check through the process exit code. */
    (error) => {
      console.error(error);
      process.exitCode = 1;
    }
  );
}
