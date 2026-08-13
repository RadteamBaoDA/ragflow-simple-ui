import type {
  AgentRuntime,
  FileToolDependencies,
  FunctionTool,
} from "./types.js";
import {
  approve,
  normalizeFilename,
  publishFile,
  safeError,
  stripInvalidXmlChars,
  throwIfAborted,
} from "./file-helpers.js";
import { runSectionAgent, type SectionInput } from "./pptx-section-agent.js";
import { renderPptx } from "./pptx-renderer.js";
import { PPTX_THEMES, type PptxThemeName } from "./pptx-themes.js";

/**
 * Creates the public PPTX tool that expands sections through child agents.
 * @param dependencies Approval, storage, child-runtime, research, and branding adapters.
 * @returns Registry-compatible PPTX function tool.
 */
export function createPptxPresentationTool(
  dependencies: FileToolDependencies
): FunctionTool {
  const name = "create-pptx-presentation";
  return {
    name,
    /**
     * Returns the registry plugin consumed by the host tool ecosystem.
     * @returns Plugin metadata and its setup callback.
     */
    plugin: () => ({
      name,
      /**
       * Registers exactly one model-callable PPTX function.
       * @param runtime Active host agent runtime.
       * @returns Nothing; registration mutates the runtime.
       */
      setup(runtime) {
        runtime.function({
          super: runtime,
          name,
          description:
            "Create a professional PowerPoint presentation from section outlines. A focused child agent expands each section sequentially, may research current facts, and submits structured slides before PPTX assembly.",
          examples: [
            {
              prompt: "Create a corporate project update deck",
              call: JSON.stringify({
                filename: "project-updates.pptx",
                title: "Q1 Project Updates",
                author: "PMO",
                theme: "corporate",
                sections: [
                  {
                    title: "Overview",
                    keyPoints: ["On track", "Budget healthy"],
                    instructions: null,
                  },
                ],
              }),
            },
            {
              prompt: "Create a dark deck about current AI trends",
              call: JSON.stringify({
                filename: "ai-trends.pptx",
                title: "AI Trends",
                author: "Research Team",
                theme: "dark",
                sections: [
                  {
                    title: "Models",
                    keyPoints: ["Scaling", "Open models"],
                    instructions: "Research recent developments",
                  },
                ],
              }),
            },
          ],
          parameters: {
            $schema: "http://json-schema.org/draft-07/schema#",
            type: "object",
            properties: {
              filename: { type: "string" },
              title: { type: "string" },
              author: { type: "string" },
              theme: { type: "string", enum: Object.keys(PPTX_THEMES) },
              sections: {
                type: "array",
                minItems: 1,
                items: {
                  type: "object",
                  properties: {
                    title: { type: "string" },
                    keyPoints: { type: "array", items: { type: "string" } },
                    instructions: { type: ["string", "null"] },
                  },
                  required: ["title", "keyPoints", "instructions"],
                  additionalProperties: false,
                },
              },
            },
            required: ["filename", "title", "author", "theme", "sections"],
            additionalProperties: false,
          },
          /**
           * Approves, expands, renders, and publishes a presentation request.
           * @param args Model arguments matching this tool's closed JSON Schema.
           * @returns Creation success text, denial message, or safe error text.
           */
          async handler(args) {
            try {
              // Sanitize all model-controlled text before child-agent or XML use.
              const filename = normalizeFilename(
                args.filename,
                "pptx",
                "presentation.pptx"
              );
              const title = stripInvalidXmlChars(
                typeof args.title === "string" && args.title.trim()
                  ? args.title
                  : "Untitled Presentation"
              );
              const author = stripInvalidXmlChars(
                typeof args.author === "string" ? args.author : ""
              );
              // Unknown themes fall back to the neutral default for loose hosts.
              const theme = (
                args.theme in PPTX_THEMES ? args.theme : "default"
              ) as PptxThemeName;
              const sections = stripInvalidXmlChars(
                args.sections
              ) as SectionInput[];
              if (
                !Array.isArray(sections) ||
                !sections.length ||
                sections.some(
                  /** Detects sections that cannot produce a meaningful divider. */
                  (section) => !section.title?.trim()
                )
              )
                return "Error creating PPTX file: at least one titled section is required.";
              // Approval must precede every child-agent invocation.
              const denied = await approve(
                dependencies,
                name,
                {
                  filename,
                  title,
                  sectionCount: sections.length,
                  sectionTitles: sections.map(
                    /** Extracts section titles for the approval summary. */
                    (section) => section.title
                  ),
                },
                `Create PowerPoint presentation "${title}" with ${sections.length} sections`
              );
              if (denied) return denied;
              throwIfAborted(this.super);
              const context = conversationContext(this.super);
              const slides = [],
                citations: unknown[] = [];
              // Process sequentially to preserve section order and provider limits.
              for (let index = 0; index < sections.length; index++) {
                throwIfAborted(this.super);
                this.super.introspect?.(
                  `[${index + 1}/${sections.length}] Building section "${sections[index].title}"`
                );
                const result = await runSectionAgent({
                  parent: this.super,
                  dependencies,
                  section: sections[index],
                  presentationTitle: title,
                  conversationContext: context,
                  sectionPrefix: `${index + 1}/${sections.length}`,
                });
                slides.push(...result.slides);
                citations.push(...result.citations);
              }
              // Child citations are attached once to avoid duplicate parent events.
              if (citations.length) this.super.addCitation?.(citations);
              throwIfAborted(this.super);
              const buffer = await renderPptx({
                title,
                author,
                theme,
                slides: stripInvalidXmlChars(slides),
                dependencies,
              });
              await publishFile({
                runtime: this.super,
                dependencies,
                type: "pptx",
                outputType: "PptxFileDownload",
                filename,
                buffer,
              });
              return `Successfully created presentation "${title}" with ${slides.length + 1} slides across ${sections.length} sections using the ${PPTX_THEMES[theme].name} theme.`;
            } catch (error) {
              return safeError("PPTX", error, this.super);
            }
          },
        });
      },
    }),
  };
}

/**
 * Extracts bounded successful chat context for section child prompts.
 * @param runtime Parent runtime containing chat history.
 * @returns At most ten successful messages, each truncated to 500 characters.
 */
function conversationContext(runtime: AgentRuntime): string {
  if (!Array.isArray(runtime.chats)) return "";
  return runtime.chats
    .filter(
      /** Keeps only successful chat messages with usable content. */
      (chat: any) => chat?.state === "success" && chat.content
    )
    .slice(-10)
    .map(
      /** Converts each chat into one bounded child-prompt context line. */
      (chat: any) => `${chat.from}: ${String(chat.content).slice(0, 500)}`
    )
    .join("\n");
}
