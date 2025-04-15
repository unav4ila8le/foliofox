"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/utils/supabase/server";

export async function login(formData: FormData) {
  const supabase = await createClient();

  // type-casting here for convenience
  // in practice, you should validate your inputs
  const data = {
    email: formData.get("email") as string,
    password: formData.get("password") as string,
  };

  const { error } = await supabase.auth.signInWithPassword(data);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/", "layout");
  redirect("/");
}

export async function signup(formData: FormData) {
  const supabase = await createClient();

  // type-casting here for convenience
  // in practice, you should validate your inputs
  const data = {
    email: formData.get("email") as string,
    password: formData.get("password") as string,
  };

  const { data: signUpData, error } = await supabase.auth.signUp(data);

  if (error) {
    throw new Error(error.message);
  }

  // Check if user already exists
  if (signUpData.user && signUpData.user.identities?.length === 0) {
    redirect("/auth/login?message=user-already-exists");
  }

  revalidatePath("/", "layout");
  redirect("/auth/login?message=success");
}

export type SignOutScope = "global" | "local" | "others";

export async function signout(scope: SignOutScope = "global") {
  const supabase = await createClient();
  const { error } = await supabase.auth.signOut({ scope });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/", "layout");
  redirect("/auth/login");
}
