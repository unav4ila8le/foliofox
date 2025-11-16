"use server";

import { addMonths } from "date-fns";

import { fetchDividends } from "@/server/dividends/fetch";
import { resolveSymbolInput } from "@/server/symbols/resolver";
import { fetchSingleQuote } from "@/server/quotes/fetch";

const FREQUENCY_MULTIPLIER: Record<string, number> = {
  monthly: 12,
  quarterly: 4,
  semiannual: 2,
  annual: 1,
};

/**
 * Fetch dividend data and compute a dividend yield for a symbol.
 */
export async function calculateSymbolDividendYield(symbolLookup: string) {
  const input = symbolLookup.trim();
  if (!input) {
    throw new Error("symbol lookup value is required");
  }

  // 1) Resolve the identifier to a canonical symbol (UUID + aliases)
  const resolved = await resolveSymbolInput(input);
  if (!resolved?.symbol?.id) {
    throw new Error(`Unable to resolve symbol "${symbolLookup}".`);
  }

  const canonicalId = resolved.symbol.id;
  const displayTicker =
    resolved.primaryAlias?.value ?? resolved.symbol.ticker ?? input;

  // 2) Attempt to reuse cached dividend data when available
  const dividendsMap = await fetchDividends([{ symbolId: canonicalId }], false);
  const entry = dividendsMap.get(canonicalId);

  if (!entry || !entry.summary || entry.summary.pays_dividends === false) {
    return {
      symbolId: canonicalId,
      displayTicker,
      paysDividends: false,
      dividendYield: null,
      dividendYieldSource: "unavailable",
      annualDividendRate: null,
      latestPrice: null,
      lastDividend: { amount: null, currency: null, date: null },
      summary: null,
      events: [],
      retrievedAt: new Date().toISOString(),
      message:
        "No recent dividend information is available for this symbol. It may not currently pay dividends.",
    };
  }

  const { summary, events } = entry;

  const sortedEvents = [...events].sort(
    (a, b) =>
      new Date(b.event_date).getTime() - new Date(a.event_date).getTime(),
  );
  const latestEvent = sortedEvents[0] ?? null;

  // Prefer Yahoo-provided annual figures when available
  let annualDividend =
    (summary.trailing_ttm_dividend ?? 0) > 0
      ? summary.trailing_ttm_dividend!
      : (summary.forward_annual_dividend ?? 0);

  // Fall back to the sum of dividends paid in the last year
  if (annualDividend <= 0 && sortedEvents.length > 0) {
    const oneYearAgo = addMonths(new Date(), -12);
    const recentEvents = sortedEvents.filter(
      (event) => new Date(event.event_date) >= oneYearAgo,
    );
    const totalRecent = recentEvents.reduce(
      (sum, event) => sum + event.gross_amount,
      0,
    );
    if (totalRecent > 0) {
      annualDividend = totalRecent;
    }
  }

  // Last resort: estimate using the most recent payout and inferred frequency
  if (annualDividend <= 0 && latestEvent) {
    const frequency = summary.inferred_frequency ?? "";
    const multiplier = FREQUENCY_MULTIPLIER[frequency] ?? 0;
    if (multiplier > 0) {
      annualDividend = latestEvent.gross_amount * multiplier;
    }
  }

  const annualDividendRate = annualDividend > 0 ? Number(annualDividend) : null;

  const reportedYield =
    summary.dividend_yield && summary.dividend_yield > 0
      ? summary.dividend_yield
      : null;

  let latestPrice: number | null = null;
  let estimatedYield: number | null = null;

  // Always fetch the latest price to support estimation and metadata
  try {
    const fetchedPrice = await fetchSingleQuote(canonicalId, {
      upsert: false,
    });
    if (typeof fetchedPrice === "number" && fetchedPrice > 0) {
      latestPrice = fetchedPrice;
    }
  } catch (error) {
    console.warn(
      `Failed to fetch price while calculating dividend yield (${canonicalId}):`,
      error,
    );
  }

  if (!reportedYield && annualDividendRate && latestPrice) {
    estimatedYield = annualDividendRate / latestPrice;
  }

  const dividendYield = reportedYield ?? estimatedYield ?? null;
  const dividendYieldSource = reportedYield
    ? "reported"
    : estimatedYield
      ? "estimated"
      : "unavailable";

  return {
    symbolId: canonicalId,
    displayTicker,
    paysDividends: true,
    dividendYield,
    dividendYieldSource,
    annualDividendRate,
    latestPrice,
    lastDividend: {
      amount: latestEvent?.gross_amount ?? null,
      currency: latestEvent?.currency ?? null,
      date: summary.last_dividend_date ?? latestEvent?.event_date ?? null,
    },
    summary,
    events: sortedEvents,
    retrievedAt: new Date().toISOString(),
  };
}
