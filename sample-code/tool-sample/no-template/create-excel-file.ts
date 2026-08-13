import type { FileToolDependencies, FunctionTool } from "./types.js";
import {
  approve,
  normalizeFilename,
  publishFile,
  safeError,
  stripInvalidXmlChars,
  throwIfAborted,
} from "./file-helpers.js";
import { renderXlsx, type SheetDefinition } from "./xlsx-renderer.js";

/**
 * Creates the public XLSX function tool bound to host-owned dependencies.
 * @param dependencies Approval, storage, and output adapters.
 * @returns Registry-compatible XLSX function tool.
 */
export function createExcelFileTool(
  dependencies: FileToolDependencies
): FunctionTool {
  const name = "create-excel-file";
  return {
    name,
    /**
     * Returns the registry plugin consumed by the host tool ecosystem.
     * @returns Plugin metadata and its setup callback.
     */
    plugin: () => ({
      name,
      /**
       * Registers exactly one model-callable XLSX function.
       * @param runtime Active host agent runtime.
       * @returns Nothing; registration mutates the runtime.
       */
      setup(runtime) {
        runtime.function({
          super: runtime,
          name,
          description:
            "Create an Excel XLSX spreadsheet from CSV data, supporting one or multiple sheets, delimiter detection, cell type inference, styled headers, auto-fit columns, zebra stripes, and frozen headers.",
          examples: [
            {
              prompt: "Create a sales workbook",
              call: JSON.stringify({
                filename: "sales.xlsx",
                csvData: "Product,Sales\nA,1200\nB,900",
                sheets: null,
                options: {
                  headerStyle: true,
                  autoFit: true,
                  freezeHeader: true,
                  zebraStripes: false,
                },
              }),
            },
            {
              prompt: "Create a multi-sheet employee workbook",
              call: JSON.stringify({
                filename: "employees.xlsx",
                csvData: null,
                sheets: [
                  {
                    name: "Employees",
                    csvData: "ID,Name\n1,Ada",
                    options: { zebraStripes: true },
                  },
                  {
                    name: "Teams",
                    csvData: "Team,Lead\nPlatform,Ada",
                    options: {},
                  },
                ],
                options: {
                  headerStyle: true,
                  autoFit: true,
                  freezeHeader: true,
                  zebraStripes: false,
                },
              }),
            },
          ],
          parameters: {
            $schema: "http://json-schema.org/draft-07/schema#",
            type: "object",
            properties: {
              filename: { type: "string" },
              csvData: { type: ["string", "null"] },
              sheets: {
                type: ["array", "null"],
                items: {
                  type: "object",
                  properties: {
                    name: { type: "string" },
                    csvData: { type: "string" },
                    options: sheetOptions(true),
                  },
                  required: ["name", "csvData"],
                  additionalProperties: false,
                },
              },
              options: sheetOptions(false),
            },
            required: ["filename", "csvData", "sheets", "options"],
            additionalProperties: false,
          },
          /**
           * Validates, approves, renders, and publishes an XLSX request.
           * @param args Model arguments matching this tool's closed JSON Schema.
           * @returns Creation success text, denial message, or safe error text.
           */
          async handler(args) {
            try {
              // Multi-sheet input intentionally takes precedence over csvData.
              const filename = normalizeFilename(
                args.filename,
                "xlsx",
                "spreadsheet.xlsx"
              );
              const sheets = stripInvalidXmlChars(args.sheets) as
                SheetDefinition[] | null;
              const csvData = stripInvalidXmlChars(args.csvData) as
                string | null;
              const definitions: SheetDefinition[] =
                Array.isArray(sheets) && sheets.length
                  ? sheets
                  : csvData?.trim()
                    ? [{ name: "Sheet1", csvData, options: {} }]
                    : [];
              // Reject missing data before approval or loading ExcelJS.
              if (
                !definitions.length ||
                definitions.some(
                  /** Detects worksheets that contain no usable CSV payload. */
                  (sheet) => !sheet.csvData?.trim()
                )
              )
                return "Error creating XLSX file: provide non-empty csvData or sheets.";
              // Approval describes the exact workbook shape the host will create.
              const denied = await approve(
                dependencies,
                name,
                {
                  filename,
                  sheetCount: definitions.length,
                  sheetNames: definitions.map(
                    /** Extracts worksheet names for the approval summary. */
                    (sheet) => sheet.name
                  ),
                },
                `Create Excel spreadsheet "${filename}" with ${definitions.length} sheet(s)`
              );
              if (denied) return denied;
              throwIfAborted(this.super);
              // Renderer returns warnings separately so creation can still succeed.
              const { buffer, warnings } = await renderXlsx(
                definitions,
                args.options ?? {}
              );
              await publishFile({
                runtime: this.super,
                dependencies,
                type: "xlsx",
                outputType: "ExcelFileDownload",
                filename,
                buffer,
              });
              return `Successfully created Excel spreadsheet "${filename}" (${(buffer.length / 1024).toFixed(2)}KB) with ${definitions.length} sheet(s).${warnings.length ? `\nWarnings:\n- ${warnings.join("\n- ")}` : ""}`;
            } catch (error) {
              return safeError("XLSX", error, this.super);
            }
          },
        });
      },
    }),
  };
}

/**
 * Builds the closed JSON Schema fragment shared by workbook option objects.
 * @param includeDelimiter Whether per-sheet delimiter selection is permitted.
 * @returns JSON Schema object for worksheet options.
 */
function sheetOptions(includeDelimiter: boolean): Record<string, unknown> {
  const properties: Record<string, unknown> = {
    headerStyle: { type: "boolean" },
    autoFit: { type: "boolean" },
    freezeHeader: { type: "boolean" },
    zebraStripes: { type: "boolean" },
  };
  // Delimiter is valid per sheet only; workbook defaults use auto-detection.
  if (includeDelimiter)
    properties.delimiter = {
      type: "string",
      enum: ["comma", "semicolon", "tab", "pipe"],
    };
  return { type: "object", properties, additionalProperties: false };
}
