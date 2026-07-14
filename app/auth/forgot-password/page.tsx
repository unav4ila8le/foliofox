import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { ResetPasswordForm } from "@/components/features/auth/forgot-password-form";

import { createClient } from "@/supabase/server";

export const metadata: Metadata = {
  title: "Forgot Password",
  description:
    "Recover your account if you've lost or forgotten your password.",
};

export default async function ForgotPasswordPage() {
  // Check if user is already logged in and redirect to dashboard
  const supabase = await createClient();

  const { data } = await supabase.auth.getClaims();
  if (data?.claims) {
    redirect("/dashboard");
  }

  return <ResetPasswordForm />;
}
