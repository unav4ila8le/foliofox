"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/supabase/server";

// Sign up
export async function signUp(formData: FormData) {
  const supabase = await createClient();

  // Data is already validated in the form component
  const data = {
    email: String(formData.get("email")).trim().toLowerCase(),
    password: String(formData.get("password")),
    options: {
      data: {
        username: String(formData.get("username")).trim(),
      },
    },
  };

  const { data: signUpData, error } = await supabase.auth.signUp(data);

  // Check if user already exists (identities array will be empty)
  if (signUpData?.user && signUpData.user.identities?.length === 0) {
    return {
      success: false,
      code: "user_already_exists",
      message: "This email is already registered. Please log in instead.",
    };
  }

  // Return Supabase errors
  if (error) {
    return { success: false, code: error.code, message: error.message };
  }

  revalidatePath("/", "layout");
  return { success: true };
}
