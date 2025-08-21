"use server";

import { getCurrentUser } from "@/server/auth/actions";

export async function createFeedback(formData: FormData) {
  const { supabase, user } = await getCurrentUser();

  const { error } = await supabase.from("feedback").insert({
    user_id: user.id,
    type: formData.get("type") as "issue" | "idea" | "other",
    message: String(formData.get("message")),
  });

  // Return Supabase errors
  if (error) {
    return { success: false, code: error.code, message: error.message };
  }

  return { success: true };
}
