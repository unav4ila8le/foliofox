import Link from "next/link";

import { Logo } from "@/components/ui/logo";
import { LoginForm } from "@/components/auth/login-form";

export default async function LoginPage() {
  return (
    <div className="bg-muted flex min-h-svh flex-col items-center justify-center p-4">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <Link href="/" className="self-center">
          <Logo />
        </Link>
        <LoginForm />
      </div>
    </div>
  );
}
