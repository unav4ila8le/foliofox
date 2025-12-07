import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";

import { Logo } from "@/components/ui/logos/logo";
import { SignupForm } from "@/components/features/auth/signup-form";

import { createClient } from "@/supabase/server";

export const metadata: Metadata = {
  title: "Signup",
  description: "Create a new free account on Foliofox.",
};

export default async function SignupPage() {
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
        <SignupForm />
      </div>
    </div>
  );
}
