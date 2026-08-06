import type { Metadata } from "next";
import { Suspense } from "react";

import { AuthRedirect } from "@/components/features/auth/auth-redirect";
import { AuthToastHandler } from "@/components/features/auth/auth-toast-handler";
import { LoginForm } from "@/components/features/auth/login-form";

export const metadata: Metadata = {
  title: "Login",
  description: "Sign in to your Foliofox account.",
};

export default function LoginPage() {
  return (
    <>
      {/* Redirect already-logged-in users without blocking the shell */}
      <Suspense>
        <AuthRedirect when="authenticated" to="/dashboard" />
      </Suspense>
      <AuthToastHandler />
      <LoginForm />
    </>
  );
}
