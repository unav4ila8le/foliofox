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

/**
 * Provider-executed web search (OpenAI Responses API `web_search`).
 *
 * OpenAI runs the search server-side inside the same request, so this costs no
 * extra tool round-trip.
 *
 * Read consulted pages from the `web_search` tool result
 * (`toolResults[].output.sources`), NOT from `result.sources`: the latter is
 * built only from `url_citation` annotations on generated prose, so it is
 * empty whenever the call uses a structured `Output.object` response.
 *
 * Not reachable from the AI advisor: its toolset is the explicit `aiTools`
 * registry in `server/ai/tools/index.ts`.
 */
export const openaiWebSearchTool = () => openAIProvider.tools.webSearch();

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
