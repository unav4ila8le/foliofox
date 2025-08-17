"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/supabase/server";

// Sign out scope (default is global)
export type SignOutScope = "global" | "local" | "others";

// Sign out
export async function signOut(scope: SignOutScope = "global") {
  const supabase = await createClient();

  const { error } = await supabase.auth.signOut({ scope });

  // Return Supabase errors
  if (error) {
    return { success: false, code: error.code, message: error.message };
  }

  revalidatePath("/", "layout");
  return { success: true };
}
