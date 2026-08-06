import { redirect } from "next/navigation";
import { connection } from "next/server";

import { createClient } from "@/supabase/server";

interface AuthRedirectProps {
  when: "authenticated" | "unauthenticated";
  to: string;
}

// Renders nothing; redirects once the session check resolves. Meant to stream
// inside a <Suspense> boundary so auth pages stay in the instant navigation
// shell. Request-time only: supabase auth calls Date.now(), which
// prerendering rejects, hence the explicit connection().
export async function AuthRedirect({ when, to }: AuthRedirectProps) {
  await connection();
  const supabase = await createClient();

  const { data } = await supabase.auth.getClaims();
  const isAuthenticated = Boolean(data?.claims);

  if (when === "authenticated" ? isAuthenticated : !isAuthenticated) {
    redirect(to);
  }

  return null;
}
