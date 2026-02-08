"use server";

import { getCurrentUser } from "@/server/auth/actions";
import { MAX_CONVERSATIONS_PER_USER } from "@/lib/ai/chat-guardrails-config";

export interface ConversationListItem {
  id: string;
  title: string;
  updatedAt: string;
}

export interface ConversationsResult {
  conversations: ConversationListItem[];
  totalCount: number;
  isAtCap: boolean;
  maxConversations: number;
}

export async function fetchConversations(
  limit = MAX_CONVERSATIONS_PER_USER,
): Promise<ConversationsResult> {
  const { supabase, user } = await getCurrentUser();

  const normalizedLimit = Math.max(1, limit);

  // Fetch list and total count together so UI can render cap state.
  const [{ data }, { count }] = await Promise.all([
    supabase
      .from("conversations")
      .select("id, title, updated_at")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false })
      .limit(normalizedLimit),
    supabase
      .from("conversations")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id),
  ]);

  const conversations = (data ?? []).map((c) => ({
    id: c.id,
    title: c.title,
    updatedAt: c.updated_at,
  }));

  const totalCount = count ?? 0;

  return {
    conversations,
    totalCount,
    isAtCap: totalCount >= MAX_CONVERSATIONS_PER_USER,
    maxConversations: MAX_CONVERSATIONS_PER_USER,
  };
}
