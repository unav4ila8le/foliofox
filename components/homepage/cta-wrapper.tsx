import { connection } from "next/server";

import { createClient } from "@/supabase/server";

export async function CTAWrapper() {
  // supabase-js calls Date.now() during JWT validation, which Next.js rejects
  // while prerendering — declare this component request-time first.
  await connection();
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  return data?.claims ? "Dashboard" : "Get started";
}
