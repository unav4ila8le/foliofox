import { redirect } from "next/navigation";
import Link from "next/link";

import { Logo } from "@/components/ui/logos/logo";
import { ResetPasswordForm } from "@/components/auth/forgot-password-form";

import { createClient } from "@/supabase/server";

export default async function ForgotPasswordPage() {
  // Check if user is already logged in and redirect to dashboard
  const supabase = await createClient();

  const { data } = await supabase.auth.getClaims();
  if (data?.claims) {
    redirect("/dashboard");
  }

  return (
    <div className="bg-muted flex min-h-svh flex-col items-center justify-center p-4">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <Link href="/" className="self-center">
          <Logo />
        </Link>
        <ResetPasswordForm />
      </div>
    </div>
  );
}
