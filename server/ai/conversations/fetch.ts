"use server";

import { getCurrentUser } from "@/server/auth/actions";

export async function getConversations(limit = 20) {
  const { supabase, user } = await getCurrentUser();

  const { data } = await supabase
    .from("conversations")
    .select("id, title, updated_at")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false })
    .limit(limit);

  return (data ?? []).map((c) => ({
    id: c.id,
    title: c.title,
    updatedAt: c.updated_at,
  }));
}
