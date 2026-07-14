import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AuthToastHandler } from "@/components/features/auth/auth-toast-handler";
import { LoginForm } from "@/components/features/auth/login-form";

import { createClient } from "@/supabase/server";

export const metadata: Metadata = {
  title: "Login",
  description: "Sign in to your Foliofox account.",
};

export default async function LoginPage() {
  // Check if user is already logged in and redirect to dashboard
  const supabase = await createClient();

  const { data } = await supabase.auth.getClaims();
  if (data?.claims) {
    redirect("/dashboard");
  }

  return (
    <>
      <AuthToastHandler />
      <LoginForm />
    </>
  );
}
