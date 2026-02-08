import type { UIMessage } from "ai";
import {
  ESTIMATED_CHARS_PER_TOKEN,
  MAX_ESTIMATED_PROMPT_TOKENS,
  MAX_MODEL_CONTEXT_MESSAGES,
} from "@/lib/ai/chat-guardrails-config";

const RECENT_FULL_CONTEXT_MESSAGE_COUNT = 8;
const ROLE_TOKEN_OVERHEAD = 6;

function estimatePartChars(part: UIMessage["parts"][number]): number {
  if (part.type === "text" || part.type === "reasoning") {
    return typeof part.text === "string" ? part.text.length : 0;
  }

  try {
    return JSON.stringify(part).length;
  } catch {
    return 0;
  }
}

function estimateMessageTokens(message: UIMessage): number {
  const chars = message.parts.reduce((total, part) => {
    return total + estimatePartChars(part);
  }, 0);

  const tokensFromChars = Math.ceil(chars / ESTIMATED_CHARS_PER_TOKEN);
  return Math.max(tokensFromChars + ROLE_TOKEN_OVERHEAD, 1);
}

function keepLightweightParts(message: UIMessage): UIMessage | null {
  const lightweightParts = message.parts.filter((part) => part.type === "text");
  if (lightweightParts.length === 0) {
    return null;
  }

  return {
    ...message,
    parts: lightweightParts,
  };
}

function pruneOlderHeavyParts(messages: UIMessage[]): UIMessage[] {
  // Keep richer context for the most recent turns; prune older assistant noise.
  const firstRecentIndex = Math.max(
    0,
    messages.length - RECENT_FULL_CONTEXT_MESSAGE_COUNT,
  );

  return messages
    .map((message, index) => {
      if (index >= firstRecentIndex) {
        return message;
      }

      if (message.role === "user") {
        return message;
      }

      return keepLightweightParts(message);
    })
    .filter((message): message is UIMessage => Boolean(message));
}

function getLatestUserMessageId(messages: UIMessage[]): string | null {
  const lastUserMessage = [...messages]
    .reverse()
    .find((m) => m.role === "user");
  return lastUserMessage?.id ?? null;
}

export function buildGuardrailedModelContext(
  messages: UIMessage[],
): UIMessage[] {
  if (messages.length === 0) {
    return [];
  }

  // 1) Hard message window guardrail.
  const messageWindow = messages.slice(-MAX_MODEL_CONTEXT_MESSAGES);
  // 2) Drop heavy historical parts (reasoning/tool payloads) from older turns.
  const prunedMessages = pruneOlderHeavyParts(messageWindow);
  const latestUserMessageId = getLatestUserMessageId(prunedMessages);

  // 3) Walk newest -> oldest until approximate token budget is full.
  const selectedMessages: UIMessage[] = [];
  let estimatedTokens = 0;

  for (let index = prunedMessages.length - 1; index >= 0; index -= 1) {
    const message = prunedMessages[index];
    if (!message) continue;

    const isLatestUserMessage = message.id === latestUserMessageId;
    const messageTokens = estimateMessageTokens(message);

    if (!isLatestUserMessage) {
      const wouldExceedBudget =
        estimatedTokens + messageTokens > MAX_ESTIMATED_PROMPT_TOKENS;
      if (wouldExceedBudget) {
        continue;
      }
    }

    selectedMessages.push(message);
    estimatedTokens += messageTokens;
  }

  const contextMessages = selectedMessages.reverse();
  const hasLatestUserMessage = latestUserMessageId
    ? contextMessages.some((message) => message.id === latestUserMessageId)
    : true;

  // Safety: always include the latest user message.
  if (!hasLatestUserMessage && latestUserMessageId) {
    const latestUserMessage = prunedMessages.find(
      (message) => message.id === latestUserMessageId,
    );
    if (latestUserMessage) {
      return [...contextMessages, latestUserMessage];
    }
  }

  if (contextMessages.length > 0) {
    return contextMessages;
  }

  // Final fallback to avoid sending an empty prompt.
  return messageWindow.slice(-1);
}
