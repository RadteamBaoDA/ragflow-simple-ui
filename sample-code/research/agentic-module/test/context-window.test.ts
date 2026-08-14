import test from "node:test";
import assert from "node:assert/strict";

test("context estimator sends the complete transcript to the host tokenizer", async () => {
  const api = (await import("../src/index.ts")) as Record<string, unknown>;
  const createEstimator = api.createContextWindowEstimator;
  assert.equal(typeof createEstimator, "function");
  if (typeof createEstimator !== "function") return;

  let tokenized = "";
  const estimateTokens = (
    createEstimator as (input: {
      countTokens: (text: string) => number;
    }) => (messages: unknown[]) => Promise<number>
  )({
    countTokens: (text) => {
      tokenized = text;
      return 37;
    },
  });
  const messages = [
    {
      role: "assistant",
      content: "",
      toolCalls: [{ callId: "call-1", name: "lookup", arguments: { id: 7 } }],
      attachments: [{ id: "file-1", mediaType: "text/plain", data: "payload" }],
    },
    { role: "tool", content: "result", toolCallId: "call-1" },
  ];

  assert.equal(await estimateTokens(messages), 37);
  assert.equal(tokenized, JSON.stringify(messages));
});

test("context estimator rejects invalid tokenizer counts", async () => {
  const { createContextWindowEstimator } = await import("../src/index.ts");

  for (const count of [-1, Number.NaN, Number.POSITIVE_INFINITY]) {
    const estimateTokens = createContextWindowEstimator({
      countTokens: () => count,
    });
    await assert.rejects(
      estimateTokens([]),
      new RangeError("Token count must be a non-negative finite number.")
    );
  }
});
