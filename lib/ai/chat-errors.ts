import { MAX_CONVERSATIONS_PER_USER } from "@/lib/ai/chat-guardrails-config";

export const AI_CHAT_ERROR_CODES = {
  conversationCapReached: "conversation_cap_reached",
} as const;

export const AI_CHAT_CONVERSATION_CAP_FRIENDLY_MESSAGE = `You've reached the maximum of ${MAX_CONVERSATIONS_PER_USER} conversations. Delete an older conversation to start a new one.`;

export function isConversationCapErrorMessage(message: string): boolean {
  return (
    message.includes(AI_CHAT_ERROR_CODES.conversationCapReached) ||
    message.includes(`maximum of ${MAX_CONVERSATIONS_PER_USER} conversations`)
  );
}
