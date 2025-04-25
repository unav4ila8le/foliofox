"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { createClient } from "@/utils/supabase/server";

import type { Profile } from "@/types/global.types";

// Get current user
async function getCurrentUser() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Redirect to login if no user
  if (!user) {
    redirect("/auth/login");
  }

  // Return supabase client and user
  return { supabase, user };
}

// Fetch profile
export async function fetchProfile() {
  const { supabase, user } = await getCurrentUser();

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("username, display_currency, avatar_url")
    .eq("id", user.id)
    .single();

  if (error || !profile) {
    throw new Error(error?.message || "Profile not found");
  }

  // Return both profile and email
  return {
    profile: profile as Pick<
      Profile,
      "username" | "display_currency" | "avatar_url"
    >,
    email: user.email as string,
  };
}

// Update profile
export async function updateProfile(formData: FormData) {
  const { supabase, user } = await getCurrentUser();

  // Data is already validated in the form component
  const data: Pick<Profile, "username" | "display_currency"> = {
    username: formData.get("username") as string,
    display_currency: formData.get("display_currency") as string,
  };

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
