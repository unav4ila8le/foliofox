import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
);
export async function insertExchangeRates(base, rates, date) {
  const rows = Object.entries(rates).map(([target_currency, rate]) => ({
    base_currency: base,
    target_currency,
    rate,
    date,
  }));
  const { error } = await supabase.from("exchange_rates").upsert(rows, {
    onConflict: ["base_currency", "target_currency", "date"],
  });
  if (error)
    throw new Error("Failed to upsert exchange rates: " + error.message);
}
