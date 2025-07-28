"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { createClient } from "@/utils/supabase/server";

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

// Login
export async function login(formData: FormData) {
  const supabase = await createClient();

  // Data is already validated in the form component
  const data = {
    email: formData.get("email") as string,
    password: formData.get("password") as string,
  };

  const { error } = await supabase.auth.signInWithPassword(data);

  // Return Supabase errors
  if (error) {
    return { success: false, code: error.code, message: error.message };
  }

  revalidatePath("/", "layout");
  return { success: true };
}

// Signup
export async function signup(formData: FormData) {
  const supabase = await createClient();

  // Data is already validated in the form component
  const data = {
    email: formData.get("email") as string,
    password: formData.get("password") as string,
    options: {
      data: {
        username: formData.get("username") as string,
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
