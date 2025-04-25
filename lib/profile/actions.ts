"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { createClient } from "@/utils/supabase/server";

import type { Profile } from "@/types/global.types";

export async function updateProfile(formData: FormData) {
  const supabase = await createClient();

  // Data is already validated in the form component
  const data: Pick<Profile, "username" | "display_currency"> = {
    username: formData.get("username") as string,
    display_currency: formData.get("display_currency") as string,
  };

  // Get user
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Redirect to login if no user
  if (!user) {
    redirect("/auth/login");
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
