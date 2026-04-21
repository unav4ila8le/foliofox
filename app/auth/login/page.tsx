import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";

import { AuthToastHandler } from "@/components/features/auth/auth-toast-handler";
import { FoliofoxLogo } from "@/components/ui/logos/foliofox-logo";
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
    <div className="bg-muted flex min-h-svh flex-col items-center justify-center p-4">
      <AuthToastHandler />
      <div className="flex w-full max-w-sm flex-col gap-6">
        <Link href="/" className="self-center">
          <FoliofoxLogo />
        </Link>
        <LoginForm />
      </div>
    </div>
  );
}
