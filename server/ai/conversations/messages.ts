"use server";

import type { UIMessage } from "ai";
import { getCurrentUser } from "@/server/auth/actions";

export async function getConversationMessages(
  conversationId: string,
  limit = 100,
): Promise<UIMessage[]> {
  const { supabase, user } = await getCurrentUser();

  const { data } = await supabase
    .from("conversation_messages")
    .select("id, role, content, created_at")
    .eq("conversation_id", conversationId)
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(Math.min(Math.max(limit, 1), 200));

  return (data ?? []).map((m) => ({
    id: m.id,
    role: m.role as "user" | "assistant",
    parts: [{ type: "text", text: m.content }],
    createdAt: m.created_at,
  }));
}
