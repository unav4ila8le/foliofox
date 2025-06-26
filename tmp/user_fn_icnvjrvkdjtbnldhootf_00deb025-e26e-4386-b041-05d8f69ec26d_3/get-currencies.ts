import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
);
export async function getCurrencyCodes() {
  const { data, error } = await supabase
    .from("currencies")
    .select("alphabetic_code");
  if (error) throw new Error(error.message);
  return data.map((row) => row.alphabetic_code);
}
