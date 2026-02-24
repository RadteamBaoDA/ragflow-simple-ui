/**
 * @fileoverview RAGFlow-supported AI provider (model_factory) options.
 *
 * Derived from the SupportedLiteLLMProvider enum in ragflow-be-share/rag/llm/__init__.py.
 * Used for "@provider" autocomplete in the server model configuration UI.
 *
 * @module features/ragflow-servers/constants/modelFactoryOptions
 */

/**
 * Full list of AI providers supported by RAGFlow.
 * Each value matches the SupportedLiteLLMProvider enum string value.
 * Users type model names in `model_name@model_factory` format.
 */
export const MODEL_FACTORY_OPTIONS: string[] = [
  "Tongyi-Qianwen",
  "Dashscope",
  "Bedrock",
  "Moonshot",
  "xAI",
  "DeepInfra",
  "Groq",
  "Cohere",
  "Gemini",
  "DeepSeek",
  "NVIDIA",
  "TogetherAI",
  "Anthropic",
  "Ollama",
  "LongCat",
  "CometAPI",
  "SILICONFLOW",
  "OpenRouter",
  "StepFun",
  "PPIO",
  "PerfXCloud",
  "Upstage",
  "NovitaAI",
  "01.AI",
  "GiteeAI",
  "302.AI",
  "Jiekou.AI",
  "ZHIPU-AI",
  "MiniMax",
  "DeerAPI",
  "GPUStack",
  "OpenAI",
  "Azure-OpenAI",
  "n1n",
  "Tencent Hunyuan",
];
