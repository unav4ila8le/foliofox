import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { getCurrencyCodes } from "./get-currencies.ts";
import { FrankfurterProvider } from "./fetch-rates.ts";
import { insertExchangeRates } from "./insert-exchange-rates.ts";
Deno.serve(async (req) => {
  // 1. Get the date from the query string, or use today
  const url = new URL(req.url);
  const date =
    url.searchParams.get("date") || new Date().toISOString().slice(0, 10);
  const base = "USD";
  let symbols;
  try {
    symbols = await getCurrencyCodes();
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: "Failed to fetch currency codes: " + error.message,
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
        },
      },
    );
  }
  const provider = new FrankfurterProvider();
  let rates;
  try {
    // 2. Pass the date to fetchRates
    rates = await provider.fetchRates(base, symbols, date);
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: "Failed to fetch rates: " + error.message,
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
        },
      },
    );
  }
  try {
    // 3. Pass the date to insertExchangeRates
    await insertExchangeRates(base, rates, date);
    return new Response(
      JSON.stringify({
        base,
        rates,
        date,
        status: "success",
      }),
      {
        headers: {
          "Content-Type": "application/json",
        },
      },
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: "Failed to insert rates: " + error.message,
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
        },
      },
    );
  }
});
