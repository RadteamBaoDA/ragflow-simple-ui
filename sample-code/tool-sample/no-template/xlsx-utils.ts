/**
 * Parses RFC-4180-style CSV, including escaped quotes and quoted newlines.
 * @param csv CSV text to parse.
 * @param delimiter Single-character field delimiter.
 * @returns Non-empty rows of decoded field values.
 */
export function parseCSV(csv: string, delimiter = ","): string[][] {
  const rows: string[][] = [];
  let row: string[] = [],
    field = "",
    quoted = false;
  for (let i = 0; i < csv.length; i++) {
    const char = csv[i],
      next = csv[i + 1];
    if (quoted) {
      // A doubled quote inside a quoted field represents one literal quote.
      if (char === '"' && next === '"') {
        field += '"';
        i++;
      } else if (char === '"') quoted = false;
      else field += char;
    } else if (char === '"') quoted = true;
    else if (char === delimiter) {
      // CRLF is one row delimiter, so consume both characters together.
      row.push(field.trim());
      field = "";
    } else if (char === "\r" && next === "\n") {
      row.push(field.trim());
      rows.push(row);
      row = [];
      field = "";
      i++;
    } else if (char === "\n" || char === "\r") {
      row.push(field.trim());
      rows.push(row);
      row = [];
      field = "";
    } else field += char;
  }
  // Preserve the final row when input does not end with a newline.
  if (field || row.length) {
    row.push(field.trim());
    rows.push(row);
  }
  return rows.filter(
    /** Removes rows whose parsed fields are all empty. */
    (values) => values.some(Boolean)
  );
}

/**
 * Detects the most frequent supported delimiter on the first CSV row.
 * @param csv CSV text whose first row is inspected.
 * @returns One of comma, semicolon, tab, or pipe.
 */
export function detectDelimiter(csv: string): string {
  const firstLine = csv.split(/\r?\n/, 1)[0] ?? "";
  return [
    [",", count(firstLine, ",")],
    [";", count(firstLine, ";")],
    ["\t", count(firstLine, "\t")],
    ["|", count(firstLine, "|")],
  ].sort(
    /** Orders candidate delimiters by descending first-row frequency. */
    (a, b) => Number(b[1]) - Number(a[1])
  )[0][0] as string;
}

/**
 * Enforces Excel dimensions and returns non-fatal structural warnings.
 * @param data Parsed CSV rows.
 * @returns Warnings for inconsistent row widths.
 * @throws {Error} When Excel row or column limits are exceeded.
 */
export function validateCSV(data: string[][]): string[] {
  if (!data.length) throw new Error("CSV data is empty.");
  const widths = data.map(
    /** Measures one row for limit and consistency checks. */
    (row) => row.length
  );
  if (Math.max(...widths) > 16_384)
    throw new Error("CSV exceeds Excel's 16,384-column limit.");
  if (data.length > 1_048_576)
    throw new Error("CSV exceeds Excel's 1,048,576-row limit.");
  return Math.min(...widths) !== Math.max(...widths)
    ? ["Inconsistent column count; missing cells remain empty."]
    : [];
}

/**
 * Converts common scalar strings into native spreadsheet cell values.
 * @param value Raw CSV field value.
 * @returns String, number, boolean, or Date suitable for ExcelJS.
 */
export function inferCellType(value: string): string | number | boolean | Date {
  const trimmed = value.trim();
  if (/^(true|false)$/i.test(trimmed)) return trimmed.toLowerCase() === "true";
  // Percentages are stored as fractions so Excel number formatting works.
  if (/^-?\d+(\.\d+)?%$/.test(trimmed))
    return Number(trimmed.slice(0, -1)) / 100;
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) return Number(trimmed);
  if (/^-?\d{1,3}(,\d{3})+(\.\d+)?$/.test(trimmed))
    return Number(trimmed.replace(/,/g, ""));
  const currency = trimmed.match(/^[$€£¥₹]\s*(-?[\d,]+(?:\.\d+)?)$/);
  if (currency) return Number(currency[1].replace(/,/g, ""));
  if (/^(\d{4}[-/]\d{2}[-/]\d{2}|\d{2}[-/]\d{2}[-/]\d{4})$/.test(trimmed)) {
    const date = new Date(trimmed.replace(/-/g, "/"));
    if (!Number.isNaN(date.valueOf())) return date;
  }
  // Keep unrecognized values verbatim instead of guessing destructively.
  return value;
}

/**
 * Counts non-overlapping occurrences of a one-character delimiter.
 * @param text Text to inspect.
 * @param character Character to count.
 * @returns Number of occurrences.
 */
function count(text: string, character: string): number {
  return text.split(character).length - 1;
}
