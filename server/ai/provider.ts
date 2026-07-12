import { createOpenAI } from "@ai-sdk/openai";
import type { LanguageModel, streamText } from "ai";

type SupportedAIProvider = "openai";
type AIGenerationOptions = Pick<
  Parameters<typeof streamText>[0],
  "providerOptions" | "reasoning"
>;

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

// Centralize AI model ids and generation knobs.
export const chatModelId = "gpt-5.6-luna";
export const extractionModelId = "gpt-5.6-luna";

export const chatGenerationOptions = {
  reasoning: "high",
  providerOptions: {
    openai: {
      reasoningSummary: "concise",
    },
  },
} satisfies AIGenerationOptions;

export const extractionGenerationOptions = {
  reasoning: "high",
} satisfies AIGenerationOptions;
