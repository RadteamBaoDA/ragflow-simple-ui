import type { FileToolDependencies, FunctionTool } from "./types.js";
import {
  approve,
  normalizeFilename,
  publishFile,
  safeError,
  stripInvalidXmlChars,
  throwIfAborted,
} from "./file-helpers.js";
import { renderDocx } from "./docx-renderer.js";

/**
 * Creates the public DOCX function tool bound to host-owned dependencies.
 * @param dependencies Approval, storage, output, branding, and image adapters.
 * @returns Registry-compatible DOCX function tool.
 */
export function createDocxFileTool(
  dependencies: FileToolDependencies
): FunctionTool {
  const name = "create-docx-file";
  return {
    name,
    /**
     * Returns the registry plugin consumed by the host tool ecosystem.
     * @returns Plugin metadata and its setup callback.
     */
    plugin: () => ({
      name,
      /**
       * Registers exactly one model-callable DOCX function.
       * @param runtime Active host agent runtime.
       * @returns Nothing; registration mutates the runtime.
       */
      setup(runtime) {
        runtime.function({
          super: runtime,
          name,
          description:
            "Create a professional Microsoft Word DOCX document from Markdown or plain text, with themes, margin presets, tables, lists, code blocks, title page, header, and page footer.",
          examples: [
            {
              prompt: "Create Word meeting notes",
              call: JSON.stringify({
                filename: "meeting-notes.docx",
                title: "Meeting Notes",
                subtitle: null,
                author: null,
                content:
                  "# Meeting Notes\n\n- Review results\n- Assign actions",
                theme: "neutral",
                margins: "normal",
                includeTitlePage: false,
              }),
            },
            {
              prompt: "Create a project proposal with a title page",
              call: JSON.stringify({
                filename: "proposal.docx",
                title: "Project Proposal",
                subtitle: "Q2 Initiative",
                author: "Product Team",
                content: "## Summary\n\nProposal content",
                theme: "blue",
                margins: "normal",
                includeTitlePage: true,
              }),
            },
          ],
          parameters: {
            $schema: "http://json-schema.org/draft-07/schema#",
            type: "object",
            properties: {
              filename: { type: "string" },
              title: { type: ["string", "null"] },
              subtitle: { type: ["string", "null"] },
              author: { type: ["string", "null"] },
              content: { type: "string" },
              theme: { type: "string", enum: ["neutral", "blue", "warm"] },
              margins: { type: "string", enum: ["normal", "narrow", "wide"] },
              includeTitlePage: { type: "boolean" },
            },
            required: [
              "filename",
              "title",
              "subtitle",
              "author",
              "content",
              "theme",
              "margins",
              "includeTitlePage",
            ],
            additionalProperties: false,
          },
          /**
           * Validates, approves, renders, and publishes a DOCX request.
           * @param args Model arguments matching this tool's closed JSON Schema.
           * @returns Creation success text, denial message, or safe error text.
           */
          async handler(args) {
            try {
              // Normalize all model-controlled strings before generating XML.
              const filename = normalizeFilename(
                args.filename,
                "docx",
                "document.docx"
              );
              const content = stripInvalidXmlChars(
                typeof args.content === "string" ? args.content : ""
              );
              if (!content.trim())
                return "Error creating DOCX file: content is required.";
              // Prefer an explicit title, then the first H1, then the filename.
              const title = stripInvalidXmlChars(
                args.title ||
                  content.match(/^#\s+(.+)$/m)?.[1] ||
                  filename.replace(/\.docx$/i, "")
              );
              // Approval happens before importing renderer packages or writing files.
              const denied = await approve(
                dependencies,
                name,
                { filename, title },
                `Create Word document "${filename}"`
              );
              if (denied) return denied;
              throwIfAborted(this.super);
              // Rendering is pure; publishFile owns the persistence boundary.
              const buffer = await renderDocx({
                content,
                title,
                subtitle: stripInvalidXmlChars(args.subtitle),
                author: stripInvalidXmlChars(args.author),
                theme: args.theme ?? "neutral",
                margins: args.margins ?? "normal",
                includeTitlePage: args.includeTitlePage ?? false,
                dependencies,
                signal: this.super.abortController?.signal,
              });
              await publishFile({
                runtime: this.super,
                dependencies,
                type: "docx",
                outputType: "DocxFileDownload",
                filename,
                buffer,
              });
              return `Successfully created Word document "${filename}" (${(buffer.length / 1024).toFixed(2)}KB).`;
            } catch (error) {
              return safeError("DOCX", error, this.super);
            }
          },
        });
      },
    }),
  };
}
