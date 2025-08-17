"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { createClient } from "@/supabase/server";

// Sign in
export async function signIn(formData: FormData) {
  const supabase = await createClient();

  // Data is already validated in the form component
  const data = {
    email: String(formData.get("email")).trim().toLowerCase(),
    password: String(formData.get("password")),
  };

  const { error } = await supabase.auth.signInWithPassword(data);

  // Return Supabase errors
  if (error) {
    return { success: false, code: error.code, message: error.message };
  }

  revalidatePath("/", "layout");
  redirect("/dashboard");
}
