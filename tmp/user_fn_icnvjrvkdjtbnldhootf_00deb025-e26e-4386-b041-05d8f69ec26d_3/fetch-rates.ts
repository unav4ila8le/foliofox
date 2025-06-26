import "jsr:@supabase/functions-js/edge-runtime.d.ts";
// --- Frankfurter API Provider ---
export class FrankfurterProvider {
  async fetchRates(base, symbols) {
    const url = `https://api.frankfurter.app/latest?base=${base}&symbols=${symbols.join(",")}`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Frankfurter API error: ${response.statusText}`);
    }
    const data = await response.json();
    return data.rates;
  }
}
