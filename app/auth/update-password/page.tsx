import { redirect } from "next/navigation";
import { connection } from "next/server";

import { UpdatePasswordForm } from "@/components/features/auth/update-password-form";

import { createClient } from "@/supabase/server";

// Entered via password-recovery email links (full page load), so instant
// navigation shells don't apply — and the form must not flash for visitors
// without a recovery session.
export const instant = false;

export default async function UpdatePasswordPage() {
  // Request-time only: supabase auth calls Date.now(), which prerendering rejects
  await connection();
  const supabase = await createClient();

  // Check if user is in password recovery mode
  const { data } = await supabase.auth.getClaims();

  // If no session or not in recovery mode, redirect to login
  if (!data?.claims) {
    redirect("/auth/login");
  }

  return <UpdatePasswordForm />;
}
