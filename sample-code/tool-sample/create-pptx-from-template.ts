import type {
  AgentRuntime,
  FunctionTool,
  DocumentToolDependencies,
} from "./types.js";
import {
  errorResult,
  normalizeFilename,
  parseDataJson,
  throwIfAborted,
  toolContext,
  ToolFailure,
} from "./tool-helpers.js";
import { renderDocxOrPptx } from "./docxtemplater-renderer.js";

/**
 * Creates the public tool for rendering registered PPTX templates.
 * @param dependencies Host template, approval, storage, and output adapters.
 * @returns Registry-compatible PPTX template tool.
 */
export function createPptxFromTemplateTool(
  dependencies: DocumentToolDependencies
): FunctionTool {
  const name = "create-pptx-from-template";
  return {
    name,
    /**
     * Returns the plugin wrapper consumed by the existing registry.
     * @returns Plugin metadata and its setup callback.
     */
    plugin: () => ({
      name,
      /**
       * Registers exactly one model-callable PPTX template function.
       * @param runtime Active host agent runtime.
       * @returns Nothing; registration mutates the runtime.
       */
      setup(runtime) {
        runtime.function({
          super: runtime,
          name,
          description:
            "Create a PowerPoint PPTX file from an active registered template ID and complete prebuilt data. Call only after every required slide and placeholder value is available in data_json; this tool does not generate or repair content.",
          examples: [
            {
              prompt:
                "Create the final Q2 board deck using template board-report and the completed presentation data",
              call: JSON.stringify({
                template_id: "board-report",
                data_json: JSON.stringify({
                  quarter: "Q2",
                  highlights: ["Revenue +18%"],
                }),
                filename: "board-report-q2.pptx",
              }),
            },
          ],
          parameters: {
            $schema: "http://json-schema.org/draft-07/schema#",
            type: "object",
            properties: {
              template_id: {
                type: "string",
                description:
                  "ID of the active PPTX template selected by the user.",
              },
              data_json: {
                type: "string",
                description:
                  "Complete JSON object string matching every required field in the registered PPTX template schema.",
              },
              filename: {
                type: ["string", "null"],
                description: "Optional output filename ending in .pptx.",
              },
            },
            required: ["template_id", "data_json", "filename"],
            additionalProperties: false,
          },
          /**
           * Delegates validation and rendering while normalizing failures.
           * @param args Model arguments containing template ID, JSON data, and filename.
           * @returns Creation success text or serialized safe error result.
           */
          async handler({ template_id, data_json, filename }) {
            try {
              return await createPptxFile({
                runtime: this.super,
                dependencies,
                templateId: template_id,
                dataJson: data_json,
                filename,
              });
            } catch (error) {
              return errorResult(error);
            }
          },
        });
      },
    }),
  };
}

/**
 * Validates, approves, renders, stores, and publishes one PPTX file.
 * @param input Runtime, host adapters, template ID, complete JSON data, and filename.
 * @returns Model-readable creation result.
 * @throws {ToolFailure} When validation, approval, rendering, or storage fails.
 */
async function createPptxFile(input: {
  runtime: AgentRuntime;
  dependencies: DocumentToolDependencies;
  templateId: unknown;
  dataJson: unknown;
  filename?: string | null;
}): Promise<string> {
  // Validate model arguments before reading host persistence.
  if (typeof input.templateId !== "string" || !input.templateId.trim())
    throw new ToolFailure(
      "INVALID_ARGUMENTS",
      "template_id is required for PPTX creation."
    );
  const data = parseDataJson(input.dataJson);
  const context = toolContext(input.runtime);
  throwIfAborted(context.signal);
  // Template lookup is scoped to the authenticated invocation context.
  const template = await input.dependencies.templates.load(
    input.templateId,
    context
  );
  if (!template)
    throw new ToolFailure("TEMPLATE_NOT_FOUND", "PPTX template not found.");
  if (template.status !== "active")
    throw new ToolFailure("TEMPLATE_NOT_ACTIVE", "PPTX template is archived.");
  if (template.format !== "pptx")
    throw new ToolFailure("TEMPLATE_FORMAT_MISMATCH", "Template is not PPTX.");
  // Host schema validation guarantees slide data is complete before rendering.
  const validation = await input.dependencies.validateTemplateData(
    template.id,
    data,
    context
  );
  if (!validation.valid)
    throw new ToolFailure(
      "INPUT_SCHEMA_INVALID",
      "PPTX data is incomplete or does not match the template schema.",
      validation.errors?.slice(0, 20)
    );
  // Approval is requested only after all cheap validation succeeds.
  const filename = normalizeFilename(input.filename, template.name, "pptx");
  if (
    !(await input.dependencies.requestApproval({
      toolName: "create-pptx-from-template",
      templateId: template.id,
      templateName: template.name,
      filename,
      context,
    }))
  )
    throw new ToolFailure("APPROVAL_DENIED", "The user denied PPTX creation.");
  // Re-check cancellation before loading the renderer and allocating output.
  throwIfAborted(context.signal);
  const output = await renderDocxOrPptx(Buffer.from(template.buffer), data);
  if (!output.length)
    throw new ToolFailure(
      "RENDER_FAILED",
      "PPTX renderer returned an empty presentation."
    );
  // Enforce the byte ceiling before any persistent side effect.
  if (output.length > (input.dependencies.maxOutputBytes ?? 50 * 1024 * 1024))
    throw new ToolFailure(
      "OUTPUT_TOO_LARGE",
      "Generated PPTX exceeds the size limit."
    );
  const saved = await input.dependencies.saveGeneratedFile({
    format: "pptx",
    filename,
    buffer: output,
    context,
  });
  // Download card and registered output reference the same stored artifact.
  input.runtime.socket?.send("fileDownloadCard", {
    filename,
    storageFilename: saved.storageFilename,
    fileSize: saved.fileSize,
  });
  await input.dependencies.registerOutput({
    type: "PptxFileDownload",
    filename,
    storageFilename: saved.storageFilename,
    fileSize: saved.fileSize,
    templateId: template.id,
    context,
  });
  return `Created ${filename} from PPTX template ${template.id}.`;
}
