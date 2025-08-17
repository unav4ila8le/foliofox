"use server";

import { createClient } from "@/supabase/server";

// Reset password
export async function resetPassword(formData: FormData) {
  const supabase = await createClient();

  const email = String(formData.get("email")).trim().toLowerCase();

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/update-password`,
  });

  // Return Supabase errors
  if (error) {
    return { success: false, code: error.code, message: error.message };
  }

  return { success: true };
}
