"use server";

import { cache } from "react";
import { revalidatePath } from "next/cache";

import { getCurrentUser, getOptionalUser } from "@/server/auth/actions";

import type { Profile } from "@/types/global.types";
import { createClient } from "@/supabase/server";

// Fetch current user profile
export const fetchProfile = cache(async () => {
  const { supabase, user } = await getCurrentUser();

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("username, display_currency, avatar_url")
    .eq("user_id", user.id)
    .single();

  if (error || !profile) {
    throw new Error(error?.message || "Profile not found");
  }

  // Return both profile and email
  return {
    profile,
    email: user.email ?? "",
  };
});

// Fetch optional user profile
export const fetchOptionalProfile = cache(async () => {
  const { supabase, user } = await getOptionalUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("username, display_currency, avatar_url")
    .eq("user_id", user.id)
    .single();

  if (!profile) return null;
  return { profile, email: user.email ?? "" };
});

export async function checkUsernameAvailability(username: string) {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("check_username_available", {
    name: username.trim(),
  });

  if (error) {
    return { available: false, error: error.message };
  }

  return { available: data, error: null };
}

// Update profile
export async function updateProfile(formData: FormData) {
  const { supabase, user } = await getCurrentUser();

  // Data is already validated in the form component
  const data: Pick<Profile, "username" | "display_currency"> = {
    username: String(formData.get("username")).trim(),
    display_currency: String(formData.get("display_currency"))
      .trim()
      .toUpperCase(),
  };

  // Update profile
  const { error } = await supabase
    .from("profiles")
    .update(data)
    .eq("user_id", user.id);

  // Return Supabase errors instead of throwing
  if (error) {
    return { success: false, code: error.code, message: error.message };
  }

  revalidatePath("/dashboard", "layout");
  return { success: true };
}
