"use server";

import { getCurrentUser } from "@/server/auth/actions";

export async function deleteConversation(conversationId: string) {
  const { supabase, user } = await getCurrentUser();

  // Delete the conversation (messages will be deleted on cascade)
  const { error } = await supabase
    .from("conversations")
    .delete()
    .eq("id", conversationId)
    .eq("user_id", user.id);

  if (error) {
    throw new Error(`Failed to delete conversation: ${error.message}`);
  }
}
