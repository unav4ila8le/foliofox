import { openai } from "@ai-sdk/openai";
import { createGatewayProvider } from "@ai-sdk/gateway";

const gatewayEnabled = Boolean(process.env.AI_GATEWAY_API_KEY);

// Create gateway provider only if API key is available
const gateway = gatewayEnabled
  ? createGatewayProvider({
      apiKey: process.env.AI_GATEWAY_API_KEY,
    })
  : null;

const prefixForGateway = (id: string) =>
  id.includes("/") ? id : `openai/${id}`;

export const aiModel = (id: string) =>
  gatewayEnabled && gateway ? gateway(prefixForGateway(id)) : openai(id);

// Optional: centralize model ids so routes don’t repeat literals
export const chatModelId = process.env.AI_CHAT_MODEL ?? "gpt-4o-mini";
export const extractionModelId =
  process.env.AI_EXTRACTION_MODEL ?? "gpt-4o-mini";
