"use server";

import { cache } from "react";
import { redirect } from "next/navigation";

import { createClient } from "@/supabase/server";

// Get current user
export const getCurrentUser = cache(async () => {
  const supabase = await createClient();

  const { data, error } = await supabase.auth.getUser();

  // Redirect to login if no user
  if (error || !data?.user) {
    redirect("/auth/login");
  }

  // Return supabase client and user
  return { supabase, user: data.user };
});

export const getOptionalUser = cache(async () => {
  const supabase = await createClient();

  const { data } = await supabase.auth.getUser();

  // Return supabase client and user
  return { supabase, user: data?.user ?? null };
});
