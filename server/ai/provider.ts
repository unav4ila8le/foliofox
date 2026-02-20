import { createOpenAI } from "@ai-sdk/openai";
import type { LanguageModel } from "ai";

type SupportedAIProvider = "openai";

const DEFAULT_MODEL_ID = "gpt-5-mini";
const DEFAULT_AI_PROVIDER: SupportedAIProvider = "openai";

const resolveProvider = (
  rawProvider: string | undefined,
): SupportedAIProvider => {
  const normalizedProvider =
    rawProvider?.trim().toLowerCase() ?? DEFAULT_AI_PROVIDER;

  if (normalizedProvider === "openai") {
    return normalizedProvider;
  }

  throw new Error(
    `Unsupported AI_PROVIDER "${rawProvider}". Supported values: openai.`,
  );
};

const normalizeOpenAIModelId = (id: string): string => {
  const normalizedId = id.trim();
  return normalizedId.startsWith("openai/")
    ? normalizedId.slice("openai/".length)
    : normalizedId;
};

const provider = resolveProvider(process.env.AI_PROVIDER);

const openAIProvider = createOpenAI({
  apiKey: process.env.AI_PROVIDER_API_KEY,
});

export const aiModel = (id: string): LanguageModel => {
  if (provider !== "openai") {
    throw new Error(`Unsupported AI provider "${provider}".`);
  }

  return openAIProvider(normalizeOpenAIModelId(id));
};

// Optional: centralize model ids so routes don’t repeat literals
export const chatModelId = process.env.AI_CHAT_MODEL_ID ?? DEFAULT_MODEL_ID;
export const extractionModelId =
  process.env.AI_EXTRACTION_MODEL_ID ?? DEFAULT_MODEL_ID;
