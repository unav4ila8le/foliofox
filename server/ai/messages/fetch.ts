"use server";

import type { UIMessage } from "ai";
import { getCurrentUser } from "@/server/auth/actions";
import { MAX_PERSISTED_MESSAGES_PER_CONVERSATION } from "@/lib/ai/chat-guardrails-config";

export async function fetchConversationMessages(
  conversationId: string,
  limit = MAX_PERSISTED_MESSAGES_PER_CONVERSATION,
): Promise<UIMessage[]> {
  const { supabase, user } = await getCurrentUser();
  const normalizedLimit = Math.min(
    Math.max(limit, 1),
    MAX_PERSISTED_MESSAGES_PER_CONVERSATION,
  );

  const { data } = await supabase
    .from("conversation_messages")
    .select("id, role, content, parts, order, created_at")
    .eq("conversation_id", conversationId)
    .eq("user_id", user.id)
    // Query newest first for an efficient bounded read.
    .order("order", { ascending: false })
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(normalizedLimit);

  // Return chronological order for the chat UI.
  return [...(data ?? [])].reverse().map((m) => {
    return {
      id: m.id,
      role: m.role as "user" | "assistant",
      parts: m.parts as UIMessage["parts"],
      createdAt: m.created_at,
    };
  });
}
