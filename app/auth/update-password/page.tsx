import { redirect } from "next/navigation";

import { UpdatePasswordForm } from "@/components/features/auth/update-password-form";

import { createClient } from "@/supabase/server";

export default async function UpdatePasswordPage() {
  const supabase = await createClient();

  // Check if user is in password recovery mode
  const { data } = await supabase.auth.getClaims();

  // If no session or not in recovery mode, redirect to login
  if (!data?.claims) {
    redirect("/auth/login");
  }

  return <UpdatePasswordForm />;
}
