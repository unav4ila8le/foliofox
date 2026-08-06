import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";

import { AuthRedirect } from "@/components/features/auth/auth-redirect";
import { SignupForm } from "@/components/features/auth/signup-form";

export const metadata: Metadata = {
  title: "Signup",
  description: "Create a new free account on Foliofox.",
};

export default function SignupPage() {
  return (
    <>
      {/* Redirect already-logged-in users without blocking the shell */}
      <Suspense>
        <AuthRedirect when="authenticated" to="/dashboard" />
      </Suspense>
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
