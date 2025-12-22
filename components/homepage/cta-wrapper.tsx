import { createClient } from "@/supabase/server";

export async function CTAWrapper() {
  "use cache: private";
  const supabase = await createClient();

  const { data } = await supabase.auth.getClaims();
  return data?.claims ? "Dashboard" : "Get started";
}
