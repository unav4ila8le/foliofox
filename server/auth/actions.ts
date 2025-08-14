"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

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

// Login
export async function login(formData: FormData) {
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

// Signup
export async function signup(formData: FormData) {
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

// Request password reset
export async function requestPasswordReset(formData: FormData) {
  const supabase = await createClient();

  const email = String(formData.get("email")).trim().toLowerCase();

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/update-password`,
  });

  // Return Supabase errors
  if (error) {
    return { success: false, code: error.code, message: error.message };
  }

  return { success: true };
}

// Update password
export async function updatePassword(formData: FormData) {
  const supabase = await createClient();

  const password = String(formData.get("password"));

  const { error } = await supabase.auth.updateUser({
    password,
  });

  // Return Supabase errors
  if (error) {
    return { success: false, code: error.code, message: error.message };
  }

  revalidatePath("/", "layout");
  return { success: true };
}
