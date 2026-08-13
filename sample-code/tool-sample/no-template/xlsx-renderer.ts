import {
  detectDelimiter,
  inferCellType,
  parseCSV,
  validateCSV,
} from "./xlsx-utils.js";

/** Normalized worksheet input consumed by the ExcelJS renderer. */
export interface SheetDefinition {
  name: string;
  csvData: string;
  options?: {
    headerStyle?: boolean;
    autoFit?: boolean;
    freezeHeader?: boolean;
    zebraStripes?: boolean;
    delimiter?: "comma" | "semicolon" | "tab" | "pipe";
  };
}

/**
 * Renders validated CSV-backed worksheets into one XLSX buffer.
 * @param sheets Normalized worksheets and optional per-sheet presentation options.
 * @param defaults Workbook-level defaults overridden by each sheet.
 * @returns XLSX binary and non-fatal CSV structure warnings.
 */
export async function renderXlsx(
  sheets: SheetDefinition[],
  defaults: SheetDefinition["options"] = {}
): Promise<{ buffer: Buffer; warnings: string[] }> {
  // Dynamic import keeps renderer packages optional until this tool is called.
  const packageName = "exceljs";
  const module = await import(packageName);
  const ExcelJS: any = module.default ?? module;
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Document Tool";
  const warnings: string[] = [];
  const delimiters = { comma: ",", semicolon: ";", tab: "\t", pipe: "|" };
  for (const definition of sheets) {
    // Per-sheet options override workbook-level defaults.
    const options = { ...defaults, ...definition.options };
    const delimiter = options.delimiter
      ? delimiters[options.delimiter]
      : detectDelimiter(definition.csvData);
    const data = parseCSV(definition.csvData, delimiter);
    warnings.push(
      ...validateCSV(data).map(
        /** Prefixes a structural warning with its worksheet name. */
        (warning) => `${definition.name}: ${warning}`
      )
    );
    // ExcelJS requires legal, unique-enough worksheet display names.
    const name = (definition.name || "Sheet")
      .slice(0, 31)
      .replace(/[*?:\\/\[\]]/g, "_");
    const sheet = workbook.addWorksheet(name);
    data.forEach(
      /** Writes one parsed CSV row into the worksheet. */
      (values, rowIndex) => {
        const row = sheet.getRow(rowIndex + 1);
        values.forEach(
          /** Infers and assigns one cell value and number format. */
          (raw, columnIndex) => {
            const cell = row.getCell(columnIndex + 1);
            // The first row remains text; data rows receive conservative inference.
            cell.value = rowIndex === 0 ? raw : inferCellType(raw);
            if (cell.value instanceof Date) cell.numFmt = "yyyy-mm-dd";
            else if (typeof cell.value === "number" && raw.includes("%"))
              cell.numFmt = "0.00%";
          }
        );
      }
    );
    // Default presentation behavior matches the existing create-file tool.
    if (options.headerStyle !== false && data.length) {
      sheet.getRow(1).eachCell(
        /** Applies the standard header font and fill to one cell. */
        (cell: any) => {
          cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FF1E40AF" },
          };
        }
      );
    }
    if (options.zebraStripes)
      for (let row = 2; row <= data.length; row++)
        if (row % 2 === 0)
          sheet.getRow(row).eachCell(
            /** Applies zebra-striping fill to one even-row cell. */
            (cell: any) => {
              cell.fill = {
                type: "pattern",
                pattern: "solid",
                fgColor: { argb: "FFF1F5F9" },
              };
            }
          );
    if (options.freezeHeader !== false)
      sheet.views = [{ state: "frozen", ySplit: 1 }];
    // Cap widths to prevent one long cell from producing an unusable sheet.
    if (options.autoFit !== false)
      sheet.columns.forEach(
        /** Measures and bounds one worksheet column. */
        (column: any) => {
          let width = 10;
          column.eachCell?.(
            { includeEmpty: true },
            /** Expands the candidate width for one cell value. */
            (cell: any) => {
              width = Math.max(width, String(cell.value ?? "").length + 2);
            }
          );
          column.width = Math.min(width, 60);
        }
      );
  }
  return { buffer: Buffer.from(await workbook.xlsx.writeBuffer()), warnings };
}
