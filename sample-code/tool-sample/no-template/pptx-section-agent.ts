import type {
  AgentRuntime,
  FileToolDependencies,
  RegisteredFunction,
} from "./types.js";
import type { SlideData } from "./pptx-renderer.js";

/** System contract that constrains one child agent to one presentation section. */
const SYSTEM_PROMPT = `You create detailed slides for exactly one presentation section.
Create 2-5 slides. Do not create a deck title slide. Content slides contain 3-6 concise bullets and speaker notes. Be specific and data-driven. Use research tools only when current facts are required. Finish by calling submit-section-slides; never return raw JSON.`;

/** Section outline accepted by the parent presentation tool. */
export interface SectionInput {
  title: string;
  keyPoints?: string[];
  instructions?: string | null;
}

/**
 * Runs one focused child agent and returns submitted slides or a safe fallback.
 * @param input Parent runtime, section outline, bounded context, and host child adapter.
 * @returns Submitted/fallback slides plus citations collected by the child.
 */
export async function runSectionAgent(input: {
  parent: AgentRuntime;
  dependencies: FileToolDependencies;
  section: SectionInput;
  presentationTitle: string;
  conversationContext: string;
  sectionPrefix: string;
}): Promise<{ slides: SlideData[]; citations: unknown[] }> {
  // Missing child support degrades to deterministic slides instead of failing the deck.
  if (!input.dependencies.createChildRuntime)
    return { slides: fallback(input.section), citations: [] };
  const child = input.dependencies.createChildRuntime({
    parent: input.parent,
    maxToolCalls: 5,
    suppressChatOutput: true,
  });
  // Research tools are explicitly allowlisted by the host for this child only.
  input.dependencies.attachResearchTools?.(child);
  let submitted: SlideData[] | undefined;
  // This private function is the only structured handoff from child to parent.
  child.function({
    super: child,
    name: "submit-section-slides",
    description: "Submit all completed slides for this presentation section.",
    examples: [],
    parameters: {
      $schema: "http://json-schema.org/draft-07/schema#",
      type: "object",
      properties: {
        slides: {
          type: "array",
          minItems: 1,
          items: {
            type: "object",
            properties: {
              layout: { type: "string", enum: ["section", "content", "blank"] },
              title: { type: "string" },
              subtitle: { type: "string" },
              content: { type: "array", items: { type: "string" } },
              notes: { type: "string" },
              table: {
                type: "object",
                properties: {
                  headers: { type: "array", items: { type: "string" } },
                  rows: {
                    type: "array",
                    items: { type: "array", items: { type: "string" } },
                  },
                },
                required: ["headers", "rows"],
                additionalProperties: false,
              },
            },
            required: ["layout", "title"],
            additionalProperties: false,
          },
        },
      },
      required: ["slides"],
      additionalProperties: false,
    },
    /**
     * Captures the child's final structured slide submission.
     * @param args Structured slide payload supplied by the child.
     * @returns Confirmation text indicating whether slide data was accepted.
     */
    handler({ slides }) {
      // Keep submission in invocation-local memory; never expose it globally.
      submitted = Array.isArray(slides) ? slides : undefined;
      return submitted?.length
        ? "Slides submitted successfully."
        : "No slides submitted.";
    },
  });
  const functions = child.functions ? Array.from(child.functions.values()) : [];
  // Prompt context is bounded by the parent before it reaches this function.
  const prompt = [
    `Presentation: ${input.presentationTitle}`,
    `Section: ${input.section.title}`,
    input.section.keyPoints?.length
      ? `Key points:\n${input.section.keyPoints
          .map(
            /** Formats one requested key point for the child prompt. */
            (point) => `- ${point}`
          )
          .join("\n")}`
      : "",
    input.section.instructions
      ? `Instructions: ${input.section.instructions}`
      : "",
    input.conversationContext
      ? `Conversation context:\n${input.conversationContext}`
      : "",
    "Create 2-5 slides and call submit-section-slides.",
  ]
    .filter(Boolean)
    .join("\n\n");
  try {
    // The adapter maps to the host's actual provider/runtime execution method.
    if (!input.dependencies.executeChildRuntime)
      throw new Error("Child runtime adapter is unavailable.");
    const result = await input.dependencies.executeChildRuntime({
      child,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: prompt },
      ],
      functions: functions as RegisteredFunction[],
      agentName: `[${input.sectionPrefix}] @section-builder`,
    });
    // Prefer citations returned by execution; otherwise inspect child state safely.
    const citations =
      result?.citations ?? input.dependencies.getChildCitations?.(child) ?? [];
    return {
      slides: submitted?.length ? submitted : fallback(input.section),
      citations,
    };
  } catch (error) {
    // Preserve partial research citations even when slide generation fails.
    input.parent.handlerProps?.log?.(
      `Section agent failed for ${input.section.title}: ${error instanceof Error ? error.message : "unknown error"}`
    );
    return {
      slides: fallback(input.section),
      citations: input.dependencies.getChildCitations?.(child) ?? [],
    };
  }
}

/**
 * Creates deterministic section/content slides when a child cannot submit.
 * @param section Requested presentation section.
 * @returns Divider slide and optional key-point content slide.
 */
function fallback(section: SectionInput): SlideData[] {
  const slides: SlideData[] = [{ layout: "section", title: section.title }];
  if (section.keyPoints?.length)
    slides.push({
      layout: "content",
      title: section.title,
      content: section.keyPoints,
      notes: `Key points for ${section.title}`,
    });
  return slides;
}
