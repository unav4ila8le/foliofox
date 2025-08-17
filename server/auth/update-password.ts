"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/supabase/server";

// Update password
export async function updatePassword(formData: FormData) {
  const supabase = await createClient();

  const password = String(formData.get("password"));

  // First update the password
  const { error } = await supabase.auth.updateUser({
    password,
  });

  // Return Supabase errors
  if (error) {
    return { success: false, code: error.code, message: error.message };
  }

  // Then sign out
  await supabase.auth.signOut();

  revalidatePath("/", "layout");
  return { success: true };
}
