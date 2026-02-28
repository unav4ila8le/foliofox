export const AI_ASSISTANT_PROMPT_SOURCES = ["typed", "suggestion"] as const;
export type AIAssistantPromptSource =
  (typeof AI_ASSISTANT_PROMPT_SOURCES)[number];

// Mirrors DB-allowed values in ai_assistant_turn_events.routes.
export const AI_ASSISTANT_ROUTES = [
  "general",
  "identifier",
  "chart",
  "write",
] as const;
export type AIAssistantRoute = (typeof AI_ASSISTANT_ROUTES)[number];

// Stable sort order for multi-route arrays written to telemetry.
export const AI_ASSISTANT_ROUTE_SORT_ORDER = {
  general: 0,
  identifier: 1,
  chart: 2,
  write: 3,
} as const satisfies Record<AIAssistantRoute, number>;

// Mirrors DB-allowed values in ai_assistant_turn_events.outcome.
export const AI_ASSISTANT_OUTCOMES = [
  "ok",
  "clarify",
  "error",
  "approved",
  "committed",
] as const;
export type AIAssistantOutcome = (typeof AI_ASSISTANT_OUTCOMES)[number];
