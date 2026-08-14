import type { ProviderAdapter } from "./types.ts";
/**
 * Decides whether a request enters the agent loop under manual or capability-based activation.
 * @param input - Validated input required by the operation.
 * @returns A promise that resolves with the operation result.
 */
export async function shouldUseAgent(input: {
  input: string;
  mode: "manual" | "automatic";
  provider: ProviderAdapter;
  model?: string;
}): Promise<boolean> {
  // An explicit mention always wins; automatic mode additionally requires native tool calling.
  if (input.input.trimStart().startsWith("@agent")) return true;
  return (
    input.mode === "automatic" &&
    (await input.provider.supportsNativeToolCalling(input.model))
  );
}
