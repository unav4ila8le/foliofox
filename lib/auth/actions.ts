"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/utils/supabase/server";

export async function login(formData: FormData) {
  const supabase = await createClient();

  // Data is already validated in the form component
  const data = {
    email: formData.get("email") as string,
    password: formData.get("password") as string,
  };

  const { error } = await supabase.auth.signInWithPassword(data);

  // Catch any error from Supabase
  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/", "layout");
  redirect("/dashboard");
}

export async function signup(formData: FormData) {
  const supabase = await createClient();

  // Data is already validated in the form component
  const data = {
    email: formData.get("email") as string,
    password: formData.get("password") as string,
  };

  const { data: signUpData, error } = await supabase.auth.signUp(data);

  // Check if user already exists
  if (signUpData.user && signUpData.user.identities?.length === 0) {
    redirect("/auth/login?message=user-already-exists");
  }

  // Catch any other error from Supabase
  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/", "layout");
  redirect("/auth/login?message=signup-success");
}

export type SignOutScope = "global" | "local" | "others";

export async function signout(scope: SignOutScope = "global") {
  const supabase = await createClient();
  const { error } = await supabase.auth.signOut({ scope });

  // Catch any error from Supabase
  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/", "layout");
  redirect("/auth/login?message=signout-success");
}
