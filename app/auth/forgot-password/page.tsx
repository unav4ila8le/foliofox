import type { Metadata } from "next";
import { Suspense } from "react";

import { AuthRedirect } from "@/components/features/auth/auth-redirect";
import { ResetPasswordForm } from "@/components/features/auth/forgot-password-form";

export const metadata: Metadata = {
  title: "Forgot Password",
  description:
    "Recover your account if you've lost or forgotten your password.",
};

export default function ForgotPasswordPage() {
  return (
    <>
      {/* Redirect already-logged-in users without blocking the shell */}
      <Suspense>
        <AuthRedirect when="authenticated" to="/dashboard" />
      </Suspense>
      <ResetPasswordForm />
    </>
  );
}
