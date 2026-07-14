import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { MailCheck } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { createClient } from "@/supabase/server";

export const metadata: Metadata = {
  title: "Check Your Email",
  description: "Confirm your email address to complete signup.",
};

export default async function CheckEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>;
}) {
  const { email } = await searchParams;

  // Check if user is already logged in and redirect to dashboard
  const supabase = await createClient();

  const { data } = await supabase.auth.getClaims();
  if (data?.claims) {
    redirect("/dashboard");
  }

  return (
    <Card>
      <CardHeader className="text-center">
        <div className="bg-brand/10 mx-auto mb-2 flex items-center justify-center rounded-full p-3">
          <MailCheck className="text-brand size-6" />
        </div>
        <CardTitle className="text-xl">Check your inbox</CardTitle>
        <CardDescription>
          We sent a confirmation link to{" "}
          {email ? (
            <span className="text-foreground font-medium">{email}</span>
          ) : (
            "your email address"
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 text-center text-sm">
        <p>
          Click the link in the email to confirm your account. If you don&apos;t
          see it, check your spam folder.
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
  );
}
