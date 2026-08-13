import type { JsonObject } from "./types.js";
import { ToolFailure } from "./tool-helpers.js";

/**
 * Renders either DOCX or PPTX using the open-source Docxtemplater core.
 * @param templateBuffer Original registered Office template bytes.
 * @param data Complete validated template substitution data.
 * @returns Rendered DOCX or PPTX binary.
 * @throws {ToolFailure} When rendering fails or unresolved markers remain.
 */
export async function renderDocxOrPptx(
  templateBuffer: Buffer,
  data: JsonObject
): Promise<Buffer> {
  try {
    // Dynamic imports keep template renderers optional until a tool is called.
    const zipPackage = "pizzip";
    const templatePackage = "docxtemplater";
    const [
      { default: ZipDefault, ...zipNs },
      { default: DocDefault, ...docNs },
    ] = await Promise.all([import(zipPackage), import(templatePackage)]);
    const PizZip = (ZipDefault ?? zipNs) as new (input: Buffer) => unknown;
    const Docxtemplater = (DocDefault ?? docNs) as new (
      zip: unknown,
      options: { paragraphLoop: boolean; linebreaks: boolean }
    ) => {
      render(values: JsonObject): void;
      getFullText(): string;
      getZip(): { generate(options: { type: "nodebuffer" }): Buffer };
    };
    // These options preserve common paragraph loops and authored line breaks.
    const document = new Docxtemplater(new PizZip(templateBuffer), {
      paragraphLoop: true,
      linebreaks: true,
    });
    document.render(data);
    // Fail closed when the rendered package still exposes template syntax.
    if (/\{[#/]?[A-Za-z0-9_.]+\}/.test(document.getFullText()))
      throw new ToolFailure(
        "RENDER_FAILED",
        "The generated document contains unresolved template markers."
      );
    return document.getZip().generate({ type: "nodebuffer" });
  } catch (error) {
    // Preserve expected codes while hiding library-specific internals.
    if (error instanceof ToolFailure) throw error;
    throw new ToolFailure(
      "RENDER_FAILED",
      "The DOCX/PPTX template could not be rendered."
    );
  }
}
