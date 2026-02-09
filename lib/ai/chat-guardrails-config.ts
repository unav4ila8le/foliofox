// Maximum saved chat threads per user before creating new ones is blocked.
export const MAX_CONVERSATIONS_PER_USER = 10;
// Rolling window of persisted messages retained per conversation.
export const MAX_PERSISTED_MESSAGES_PER_CONVERSATION = 60;
// Hard cap on messages sent to the model for one completion.
export const MAX_MODEL_CONTEXT_MESSAGES = 30;
// Approximate prompt-token ceiling for bounded latency/cost.
export const MAX_ESTIMATED_PROMPT_TOKENS = 12000;
// Heuristic conversion from characters to tokens for rough budgeting.
export const ESTIMATED_CHARS_PER_TOKEN = 4;
