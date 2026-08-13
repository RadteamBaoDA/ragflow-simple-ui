import type { JsonObject } from "./types.js";
import { isObject, ToolFailure } from "./tool-helpers.js";

/**
 * Renders `{path}` cells and one-row loops:
 * `{#items}`, prototype row, `{/items}`.
 * @param templateBuffer Original registered XLSX template bytes.
 * @param data Complete validated template substitution data.
 * @returns Rendered XLSX binary.
 * @throws {ToolFailure} When loops, markers, or ExcelJS rendering fail.
 */
export async function renderXlsx(
  templateBuffer: Buffer,
  data: JsonObject
): Promise<Buffer> {
  try {
    // Load ExcelJS only when XLSX rendering is actually requested.
    const packageName = "exceljs";
    const module = await import(packageName);
    const ExcelJS = (module.default ?? module) as {
      Workbook: new () => any;
    };
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(templateBuffer);

    for (const worksheet of workbook.worksheets) {
      // Bottom-up expansion prevents inserted rows from shifting later loops.
      const loops = findRowLoops(worksheet).sort(
        /** Sorts loop starts descending so row insertion cannot shift later loops. */
        (a, b) => b.start - a.start
      );
      for (const loop of loops) {
        const items = resolvePath(data, loop.path);
        if (!Array.isArray(items))
          throw new ToolFailure(
            "RENDER_FAILED",
            `XLSX loop "${loop.path}" must resolve to an array.`
          );
        // Capture the prototype before deleting the marker and body rows.
        const prototype = worksheet.getRow(loop.start + 1);
        const cells = Array.from(
          { length: prototype.cellCount },
          /** Copies one prototype cell's value and formatting. */
          (_, index) => {
            const cell = prototype.getCell(index + 1);
            return {
              value: clone(cell.value),
              style: clone(cell.style),
              numFmt: cell.numFmt,
            };
          }
        );
        worksheet.spliceRows(loop.start, 3);
        items.forEach(
          /** Expands one source item into a styled worksheet row. */
          (item, itemIndex) => {
            // Scalars remain addressable through the conventional `value` key.
            const scope = isObject(item) ? item : { value: item };
            const rowNumber = loop.start + itemIndex;
            worksheet.spliceRows(rowNumber, 0, []);
            const row = worksheet.getRow(rowNumber);
            cells.forEach(
              /** Transfers one prototype cell into the generated row. */
              (source, cellIndex) => {
                const cell = row.getCell(cellIndex + 1);
                cell.value = replaceCell(source.value, scope, data);
                cell.style = clone(source.style);
                cell.numFmt = source.numFmt;
              }
            );
          }
        );
      }

      worksheet.eachRow(
        /** Resolves root-level markers after all loop rows are expanded. */
        (row: any) =>
          row.eachCell(
            /** Replaces markers in one remaining worksheet cell. */
            (cell: any) => {
              cell.value = replaceCell(cell.value, data, data);
            }
          )
      );
    }

    // No unresolved marker may leave the generated workbook boundary.
    rejectUnresolvedMarkers(workbook);
    return Buffer.from(await workbook.xlsx.writeBuffer());
  } catch (error) {
    // Preserve expected codes while hiding ExcelJS-specific internals.
    if (error instanceof ToolFailure) throw error;
    throw new ToolFailure(
      "RENDER_FAILED",
      "The XLSX template could not be rendered."
    );
  }
}

/**
 * Finds valid three-row loop blocks and returns their starts and data paths.
 * @param worksheet ExcelJS worksheet to inspect.
 * @returns Validated loop start rows and data paths.
 * @throws {ToolFailure} When loop markers do not surround exactly one prototype row.
 */
function findRowLoops(worksheet: any): Array<{ start: number; path: string }> {
  const markers: Array<{ row: number; kind: "start" | "end"; path: string }> =
    [];
  worksheet.eachRow(
    /** Identifies loop start/end markers in one worksheet row. */
    (row: any, rowNumber: number) => {
      const text = firstTextCell(row);
      const start = text.match(/^\{#([A-Za-z0-9_.]+)\}$/);
      const end = text.match(/^\{\/([A-Za-z0-9_.]+)\}$/);
      if (start)
        markers.push({ row: rowNumber, kind: "start", path: start[1] });
      if (end) markers.push({ row: rowNumber, kind: "end", path: end[1] });
    }
  );

  // Markers must pair around exactly one prototype row.
  const loops: Array<{ start: number; path: string }> = [];
  for (let index = 0; index < markers.length; index += 2) {
    const start = markers[index];
    const end = markers[index + 1];
    if (
      !start ||
      !end ||
      start.kind !== "start" ||
      end.kind !== "end" ||
      start.path !== end.path ||
      end.row !== start.row + 2
    )
      throw new ToolFailure(
        "RENDER_FAILED",
        "Each XLSX loop must contain exactly one prototype row."
      );
    loops.push({ start: start.row, path: start.path });
  }
  return loops;
}

/**
 * Returns the first non-empty string cell used as a row marker.
 * @param row ExcelJS row to inspect.
 * @returns Trimmed marker text or an empty string.
 */
function firstTextCell(row: any): string {
  let value = "";
  row.eachCell(
    /** Selects the first string cell that can carry a loop marker. */
    (cell: any) => {
      if (!value && typeof cell.value === "string") value = cell.value.trim();
    }
  );
  return value;
}

/**
 * Replaces markers in scalar string cells and Excel formula objects.
 * @param value Cell value or formula object.
 * @param localData Current loop-item data.
 * @param rootData Root document data.
 * @returns Original or marker-substituted cell value.
 */
function replaceCell(
  value: unknown,
  localData: JsonObject,
  rootData: JsonObject
): unknown {
  if (typeof value === "string")
    return replaceMarkers(value, localData, rootData);
  if (isObject(value) && typeof value.formula === "string")
    return {
      ...value,
      formula: replaceMarkers(value.formula, localData, rootData),
    };
  return value;
}

/**
 * Resolves and substitutes every `{path}` marker in a string.
 * @param text Template text or formula.
 * @param localData Current loop-item data.
 * @param rootData Root document data.
 * @returns Text with all markers replaced.
 * @throws {ToolFailure} When a marker is missing or resolves to a non-scalar.
 */
function replaceMarkers(
  text: string,
  localData: JsonObject,
  rootData: JsonObject
): string {
  return text.replace(
    /\{([A-Za-z0-9_.]+)\}/g,
    /** Resolves one template marker against local then root data. */
    (_match, path: string) => {
      // Row-local loop data shadows root document data.
      const local = resolvePath(localData, path);
      const value = local === undefined ? resolvePath(rootData, path) : local;
      if (value === undefined)
        throw new ToolFailure(
          "RENDER_FAILED",
          `No value was provided for template marker "${path}".`
        );
      if (value === null) return "";
      if (["string", "number", "boolean"].includes(typeof value))
        return String(value);
      throw new ToolFailure(
        "RENDER_FAILED",
        `Template marker "${path}" must resolve to a scalar value.`
      );
    }
  );
}

/**
 * Resolves a dot-delimited path without traversing non-object values.
 * @param value Root value for traversal.
 * @param path Dot-delimited property path.
 * @returns Resolved value or `undefined`.
 */
function resolvePath(value: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>(
    /** Advances one segment only when the current value is an object. */
    (current, key) => (isObject(current) ? current[key] : undefined),
    value
  );
}

/**
 * Rejects markers left in text cells or formula expressions.
 * @param workbook ExcelJS workbook to inspect.
 * @returns Nothing when no unresolved markers remain.
 * @throws {ToolFailure} When marker syntax remains in output.
 */
function rejectUnresolvedMarkers(workbook: any): void {
  let unresolved = false;
  workbook.eachSheet(
    /** Inspects every worksheet for unresolved markers. */
    (worksheet: any) =>
      worksheet.eachRow(
        /** Inspects every row in the current worksheet. */
        (row: any) =>
          row.eachCell(
            /** Flags one cell if text or formula still contains marker syntax. */
            (cell: any) => {
              const text =
                typeof cell.value === "string"
                  ? cell.value
                  : isObject(cell.value) &&
                      typeof cell.value.formula === "string"
                    ? cell.value.formula
                    : "";
              if (/\{[#/]?[A-Za-z0-9_.]+\}/.test(text)) unresolved = true;
            }
          )
      )
  );
  if (unresolved)
    throw new ToolFailure(
      "RENDER_FAILED",
      "The generated workbook contains unresolved template markers."
    );
}

/**
 * Deep-clones ExcelJS values/styles while preserving nullish values.
 * @template T Cell value/style type.
 * @param value Value to clone.
 * @returns Cloned value, or the original nullish value.
 */
function clone<T>(value: T): T {
  if (value === undefined || value === null) return value;
  return structuredClone(value);
}
