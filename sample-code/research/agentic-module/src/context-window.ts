import type { AgentMessage } from "./types.ts";

/**
 * Creates a transcript token estimator backed by the host model tokenizer.
 * @param input - Host tokenizer used to count one serialized transcript.
 * @returns An estimator compatible with `contextWindow.estimateTokens`.
 * @throws When the host tokenizer returns an invalid token count.
 */
export function createContextWindowEstimator(input: {
  /**
   * Counts tokens in one serialized provider transcript.
   * @param text - Serialized transcript to tokenize.
   * @returns The token count produced by the target model tokenizer.
   */
  countTokens(text: string): number | Promise<number>;
}): (messages: AgentMessage[]) => Promise<number> {
  // Keep provider-specific tokenization outside the portable module.
  return async (messages) => {
    const count = await input.countTokens(JSON.stringify(messages));
    if (!Number.isFinite(count) || count < 0)
      throw new RangeError("Token count must be a non-negative finite number.");
    return count;
  };
}
