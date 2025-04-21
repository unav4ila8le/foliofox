"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/utils/supabase/server";

export async function updateProfile(formData: FormData) {
  const supabase = await createClient();

  // Data is already validated in the form component
  const data = {
    username: formData.get("username") as string,
    display_currency: formData.get("display_currency") as string,
  };

  // Get user
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Return error if no user
  if (!user) {
    return {
      success: false,
      code: "not_authenticated",
      message: "You must be logged in to update your profile",
    };
  }

  // Update profile
  const { error } = await supabase
    .from("profiles")
    .update(data)
    .eq("id", user.id);

  // Return Supabase errors instead of throwing
  if (error) {
    return { success: false, code: error.code, message: error.message };
  }

  revalidatePath("/dashboard", "layout");
  return { success: true };
}
