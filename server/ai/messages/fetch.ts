"use server";

import type { UIMessage } from "ai";
import { getCurrentUser } from "@/server/auth/actions";

export async function fetchConversationMessages(
  conversationId: string,
  limit = 100,
): Promise<UIMessage[]> {
  const { supabase, user } = await getCurrentUser();

  const { data } = await supabase
    .from("conversation_messages")
    .select("id, role, content, parts, message_order, created_at")
    .eq("conversation_id", conversationId)
    .eq("user_id", user.id)
    .order("message_order", { ascending: true })
    .limit(Math.min(Math.max(limit, 1), 200));

  return (data ?? []).map((m) => {
    if (m.parts && Array.isArray(m.parts)) {
      return {
        id: m.id,
        role: m.role as "user" | "assistant",
        parts: m.parts as UIMessage["parts"],
        createdAt: m.created_at,
      };
    }

    // Legacy fallback for old messages without parts
    return {
      id: m.id,
      role: m.role as "user" | "assistant",
      parts: [{ type: "text" as const, text: m.content }],
      createdAt: m.created_at,
    };
  });
}
