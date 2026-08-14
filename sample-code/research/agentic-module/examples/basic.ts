import {
  ToolRegistry,
  createAgenticModule,
  type ProviderAdapter,
} from "@agentic/module";

let providerCalls = 0;
const provider: ProviderAdapter = {
  supportsNativeToolCalling: () => true,
  complete: async () => {
    providerCalls += 1;
    return providerCalls === 1
      ? { type: "tool_call", callId: "call-1", name: "greet", arguments: { name: "Ada" } }
      : { type: "text", text: "Greeting completed." };
  },
};

const tools = new ToolRegistry().register({
  name: "greet",
  description: "Create a greeting",
  parameters: { type: "object", properties: { name: { type: "string" } }, required: ["name"] },
  risk: "read",
  execute: async (input) => ({
    type: "continue",
    content: `Hello ${(input as { name: string }).name}`,
  }),
});

const agent = createAgenticModule({
  provider,
  tools,
  policy: { authorize: () => true },
});

console.log(await agent.start({ runId: "demo", input: "Greet Ada", context: {} }));
