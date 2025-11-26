import { openai } from "@ai-sdk/openai";

// AI SDK automatically uses AI Gateway when AI_GATEWAY_API_KEY is set
// Just use the model format "provider/model" for gateway, or "model" for direct
export const aiModel = (id: string) => {
  const gatewayEnabled = Boolean(process.env.AI_GATEWAY_API_KEY);
  // If gateway is enabled, use "openai/model" format
  // Otherwise use direct model name
  return openai(gatewayEnabled && !id.includes("/") ? `openai/${id}` : id);
};

// Centralize model ids so routes don’t repeat literals
export const chatModelId = "gpt-4o-mini";
export const extractionModelId = "gpt-4o-mini";
