import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";

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
    <>
      <SignupForm />
      <p className="text-muted-foreground text-center text-xs">
        By signing up you acknowledge that you have read, understood and agree
        to our{" "}
        <Link
          href="/privacy"
          target="_blank"
          className="hover:text-foreground underline underline-offset-4 transition-colors"
        >
          Privacy Policy
        </Link>
        .
      </p>
    </>
  );
}
