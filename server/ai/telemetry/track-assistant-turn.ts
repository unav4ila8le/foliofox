import type { FinishReason, UIMessage } from "ai";
import { z } from "zod";

import { createClient } from "@/supabase/server";
import { resolveRoutesFromMessageParts } from "@/server/ai/tooling/tool-route-registry";
import type {
  AIAssistantOutcome,
  AIAssistantPromptSource,
  AIAssistantRoute,
} from "@/server/ai/telemetry/constants";

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
 * Classify assistant turn routes from tool usage in message parts.
 */
export function resolveAssistantRoutes(
  parts: UIMessage["parts"],
): AIAssistantRoute[] {
  return resolveRoutesFromMessageParts(parts);
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

  const conversationIdParse = z.uuid().safeParse(conversationId);
  const assistantMessageIdParse = z.uuid().safeParse(assistantMessageId);
  if (!conversationIdParse.success || !assistantMessageIdParse.success) {
    return;
  }

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth?.user?.id;

  if (!userId) return;

  const routes = resolveAssistantRoutes(params.message.parts);
  const outcome = resolveAssistantOutcome({
    parts: params.message.parts,
    finishReason: params.finishReason,
  });
  const assistantChars = getAssistantTextCharCount(params.message.parts);

  const { error } = await supabase.from("ai_assistant_turn_events").insert({
    conversation_id: conversationIdParse.data,
    assistant_message_id: assistantMessageIdParse.data,
    user_id: userId,
    model: params.model,
    prompt_source: params.promptSource,
    routes,
    outcome,
    assistant_chars: assistantChars,
  });

  if (error) {
    throw new Error(
      `Failed to track assistant turn telemetry: ${error.message}`,
    );
  }
}
