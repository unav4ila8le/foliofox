import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { MailCheck } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { AuthRedirect } from "@/components/features/auth/auth-redirect";

export const metadata: Metadata = {
  title: "Check Your Email",
  description: "Confirm your email address to complete signup.",
};

// Awaits URL data inside the Suspense boundary so the rest of the card stays
// in the instant navigation shell.
async function EmailDescription({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>;
}) {
  const { email } = await searchParams;

  return (
    <CardDescription>
      We sent a confirmation link to{" "}
      {email ? (
        <span className="text-foreground font-medium">{email}</span>
      ) : (
        "your email address"
      )}
    </CardDescription>
  );
}

export default function CheckEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>;
}) {
  return (
    <>
      {/* Redirect already-logged-in users without blocking the shell */}
      <Suspense>
        <AuthRedirect when="authenticated" to="/dashboard" />
      </Suspense>
      <Card>
        <CardHeader className="text-center">
          <div className="bg-brand/10 mx-auto mb-2 flex items-center justify-center rounded-full p-3">
            <MailCheck className="text-brand size-6" />
          </div>
          <CardTitle className="text-xl">Check your inbox</CardTitle>
          <Suspense
            fallback={
              <CardDescription>
                We sent a confirmation link to your email address
              </CardDescription>
            }
          >
            <EmailDescription searchParams={searchParams} />
          </Suspense>
        </CardHeader>
        <CardContent className="grid gap-4 text-center text-sm">
          <p>
            Click the link in the email to confirm your account. If you
            don&apos;t see it, check your spam folder.
          </p>
          <p className="text-muted-foreground">
            Already confirmed?{" "}
            <Link
              href="/auth/login"
              className="text-foreground underline underline-offset-4"
            >
              Log in
            </Link>
          </p>
        </CardContent>
      </Card>
    </>
  );
}
