"use server";

import { getCurrentUser } from "@/server/auth/actions";
import { sendFeedbackToDiscord } from "@/server/feedback/discord";

export async function createFeedback(formData: FormData) {
  const { supabase, user } = await getCurrentUser();

  const type = formData.get("type") as "issue" | "idea" | "other";
  const message = String(formData.get("message"));
  const username = String(formData.get("username"));
  const email = String(formData.get("email"));

  const { error } = await supabase.from("feedback").insert({
    user_id: user.id,
    type,
    message,
  });

  // Return Supabase errors
  if (error) {
    return { success: false, code: error.code, message: error.message };
  }

  // Send Discord notification
  await sendFeedbackToDiscord({ type, message, username, email });

  return { success: true };
}
