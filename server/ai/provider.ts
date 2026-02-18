import { createGatewayProvider } from "@ai-sdk/gateway";
import { createOpenAI } from "@ai-sdk/openai";
import type { LanguageModel } from "ai";

type SupportedAIProvider = "openai" | "gateway";

const DEFAULT_AI_PROVIDER: SupportedAIProvider = "openai";
const DEFAULT_MODEL_ID = "gpt-5-mini";

const resolveProvider = (
  rawProvider: string | undefined,
): SupportedAIProvider => {
  const normalizedProvider =
    rawProvider?.trim().toLowerCase() ?? DEFAULT_AI_PROVIDER;

  if (normalizedProvider === "openai" || normalizedProvider === "gateway") {
    return normalizedProvider;
  }

  throw new Error(
    `Unsupported AI_PROVIDER "${rawProvider}". Supported values: openai, gateway.`,
  );
};

const normalizeOpenAIModelId = (id: string): string => {
  const normalizedId = id.trim();
  return normalizedId.startsWith("openai/")
    ? normalizedId.slice("openai/".length)
    : normalizedId;
};

const normalizeGatewayModelId = (id: string): string => {
  const normalizedId = id.trim();
  return normalizedId.includes("/") ? normalizedId : `openai/${normalizedId}`;
};

const provider = resolveProvider(process.env.AI_PROVIDER);
const providerApiKey = process.env.AI_PROVIDER_API_KEY;

const openAIProvider = createOpenAI({
  apiKey: providerApiKey ?? process.env.OPENAI_API_KEY,
});

const gatewayProvider = createGatewayProvider({
  apiKey: providerApiKey ?? process.env.AI_GATEWAY_API_KEY,
});

export const aiModel = (id: string): LanguageModel =>
  provider === "gateway"
    ? gatewayProvider(normalizeGatewayModelId(id))
    : openAIProvider(normalizeOpenAIModelId(id));

// Optional: centralize model ids so routes don’t repeat literals
export const chatModelId = process.env.AI_CHAT_MODEL_ID ?? DEFAULT_MODEL_ID;
export const extractionModelId =
  process.env.AI_EXTRACTION_MODEL_ID ?? DEFAULT_MODEL_ID;
