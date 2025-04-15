import { redirect } from "next/navigation";
import Link from "next/link";

import { AuthToastHandler } from "@/components/auth/auth-toast-handler";
import { Logo } from "@/components/ui/logo";
import { SignupForm } from "@/components/auth/signup-form";
import { createClient } from "@/utils/supabase/server";

export default async function SignupPage() {
  // Check if user is already logged in and redirect to dashboard
  const supabase = await createClient();

  const { data, error } = await supabase.auth.getUser();
  if (data?.user && !error) {
    redirect("/dashboard");
  }
  return (
    <div className="bg-muted flex min-h-svh flex-col items-center justify-center p-4">
      <AuthToastHandler />
      <div className="flex w-full max-w-sm flex-col gap-6">
        <Link href="/" className="self-center">
          <Logo />
        </Link>
        <SignupForm />
      </div>
    </div>
  );
}
