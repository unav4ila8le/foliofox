"use server";

import { cache } from "react";
import { revalidatePath } from "next/cache";

import { getCurrentUser, getOptionalUser } from "@/server/auth/actions";
import {
  isValidTimeZoneMode,
  normalizeIanaTimeZone,
  TIME_ZONE_MODES,
} from "@/lib/date/time-zone";

import type { Profile } from "@/types/global.types";
import { createClient } from "@/supabase/server";

// Fetch current user profile
export const fetchProfile = cache(async () => {
  const { supabase, user } = await getCurrentUser();

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("*")
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
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

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

  // 1. Resolve and validate timezone mode. Keep manual as a safe default for
  // backward compatibility if an older client omits this field.
  const rawTimeZoneMode = String(
    formData.get("time_zone_mode") ?? TIME_ZONE_MODES.MANUAL,
  )
    .trim()
    .toLowerCase();

  if (!isValidTimeZoneMode(rawTimeZoneMode)) {
    return {
      success: false,
      code: "INVALID_TIME_ZONE_MODE",
      message:
        "Invalid timezone mode. Please select Auto or a manual timezone.",
    };
  }

  // 2. Resolve and validate concrete timezone value.
  const rawTimeZone = String(formData.get("time_zone") ?? "").trim();
  const normalizedTimeZone = normalizeIanaTimeZone(rawTimeZone);

  if (!normalizedTimeZone) {
    return {
      success: false,
      code: "INVALID_TIME_ZONE",
      message: "Invalid timezone. Please select a valid IANA timezone.",
    };
  }

  // Keep server-side validation explicit so profile updates do not trust client-only checks.
  const data: Pick<
    Profile,
    "username" | "display_currency" | "time_zone" | "time_zone_mode"
  > = {
    username: String(formData.get("username")).trim(),
    display_currency: String(formData.get("display_currency"))
      .trim()
      .toUpperCase(),
    time_zone: normalizedTimeZone,
    time_zone_mode: rawTimeZoneMode,
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

// Update profile
export async function updateAISettings(formData: FormData) {
  const { supabase, user } = await getCurrentUser();

  // Data is already validated in the form component
  const data: Pick<Profile, "data_sharing_consent"> = {
    data_sharing_consent: formData.get("data_sharing_consent") === "true",
  };

  // Update AI settings
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
