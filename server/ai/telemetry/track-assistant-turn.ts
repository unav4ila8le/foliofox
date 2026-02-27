"use server";

import type { FinishReason, UIMessage } from "ai";

import { createClient } from "@/supabase/server";

export const AI_ASSISTANT_PROMPT_SOURCES = ["typed", "suggestion"] as const;
export type AIAssistantPromptSource =
  (typeof AI_ASSISTANT_PROMPT_SOURCES)[number];

export const AI_ASSISTANT_ROUTES = [
  "general",
  "identifier",
  "chart",
  "write",
] as const;
export type AIAssistantRoute = (typeof AI_ASSISTANT_ROUTES)[number];

export const AI_ASSISTANT_OUTCOMES = [
  "ok",
  "clarify",
  "error",
  "approved",
  "committed",
] as const;
export type AIAssistantOutcome = (typeof AI_ASSISTANT_OUTCOMES)[number];

interface TrackAssistantTurnParams {
  conversationId: string;
  assistantMessageId: string;
  model: string;
  promptSource: AIAssistantPromptSource;
  message: UIMessage;
  finishReason?: FinishReason;
}

interface ResolveAssistantOutcomeParams {
  parts: UIMessage["parts"];
  finishReason?: FinishReason;
}

/**
 * Count assistant output characters from text parts only.
 */
export function getAssistantTextCharCount(parts: UIMessage["parts"]): number {
  if (!Array.isArray(parts)) return 0;

  return parts.reduce((total, part) => {
    if (part.type !== "text") return total;
    if (typeof part.text !== "string") return total;

    return total + part.text.length;
  }, 0);
}

function getToolPartTypes(parts: UIMessage["parts"]): string[] {
  if (!Array.isArray(parts)) return [];

  return parts
    .filter((part) => part.type.startsWith("tool-"))
    .map((part) => part.type);
}

function hasToolErrorOrDeniedState(parts: UIMessage["parts"]): boolean {
  if (!Array.isArray(parts)) return false;

  return parts.some((part) => {
    if (!part.type.startsWith("tool-")) return false;
    if (!("state" in part)) return false;
    if (typeof part.state !== "string") return false;

    return part.state === "output-error" || part.state === "output-denied";
  });
}

/**
 * Classify the assistant turn route from tool usage in message parts.
 */
export function resolveAssistantRoute(
  parts: UIMessage["parts"],
): AIAssistantRoute {
  const toolTypes = getToolPartTypes(parts);

  if (toolTypes.includes("tool-getHistoricalQuotes")) {
    return "chart";
  }

  if (toolTypes.includes("tool-searchSymbols")) {
    return "identifier";
  }

  // Phase 0 keeps write classification reserved for future mutating tools.
  return "general";
}

/**
 * Resolve the assistant turn outcome for telemetry.
 */
export function resolveAssistantOutcome({
  parts,
  finishReason,
}: ResolveAssistantOutcomeParams): AIAssistantOutcome {
  if (finishReason === "error") {
    return "error";
  }

  if (hasToolErrorOrDeniedState(parts)) {
    return "error";
  }

  return "ok";
}

/**
 * Insert one assistant turn telemetry event after a completed response.
 */
export async function trackAssistantTurn(
  params: TrackAssistantTurnParams,
): Promise<void> {
  const conversationId = params.conversationId.trim();
  const assistantMessageId = params.assistantMessageId.trim();

  if (!conversationId || !assistantMessageId) return;
  if (params.message.role !== "assistant") return;

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth?.user?.id;

  if (!userId) return;

  const route = resolveAssistantRoute(params.message.parts);
  const outcome = resolveAssistantOutcome({
    parts: params.message.parts,
    finishReason: params.finishReason,
  });
  const assistantChars = getAssistantTextCharCount(params.message.parts);

  const { error } = await supabase.from("ai_assistant_turn_events").insert({
    conversation_id: conversationId,
    assistant_message_id: assistantMessageId,
    user_id: userId,
    model: params.model,
    prompt_source: params.promptSource,
    route,
    outcome,
    assistant_chars: assistantChars,
  });

  if (error) {
    throw new Error(
      `Failed to track assistant turn telemetry: ${error.message}`,
    );
  }
}
