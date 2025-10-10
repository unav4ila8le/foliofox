import { redirect } from "next/navigation";
import Link from "next/link";

import { Logo } from "@/components/ui/logos/logo";
import { UpdatePasswordForm } from "@/components/features/auth/update-password-form";

import { createClient } from "@/supabase/server";

export default async function UpdatePasswordPage() {
  const supabase = await createClient();

  // Check if user is in password recovery mode
  const { data } = await supabase.auth.getClaims();

  // If no session or not in recovery mode, redirect to login
  if (!data?.claims) {
    redirect("/auth/login");
  }

  return (
    <div className="bg-muted flex min-h-svh flex-col items-center justify-center p-4">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <Link href="/" className="self-center">
          <Logo />
        </Link>
        <UpdatePasswordForm />
      </div>
    </div>
  );
}
