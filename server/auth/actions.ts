"use server";

import { redirect } from "next/navigation";

import { createClient } from "@/supabase/server";

// Get current user
export async function getCurrentUser() {
  const supabase = await createClient();

  const { data, error } = await supabase.auth.getUser();

  // Redirect to login if no user
  if (error || !data?.user) {
    redirect("/auth/login");
  }

  // Return supabase client and user
  return { supabase, user: data.user };
}

export async function getOptionalUser() {
  const supabase = await createClient();

  const { data } = await supabase.auth.getUser();

  // Return supabase client and user
  return { supabase, user: data?.user ?? null };
}
