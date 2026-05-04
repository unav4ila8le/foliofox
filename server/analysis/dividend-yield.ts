"use server";

import { fetchDividends } from "@/server/dividends/fetch";
import { fetchSingleQuote } from "@/server/quotes/fetch";
import { resolveAnnualDividendAmount } from "@/server/analysis/projected-income/utils";
import { ensureSymbol } from "@/server/symbols/ensure";

/**
 * Fetch dividend data and compute a dividend yield for a symbol.
 */
export async function calculateSymbolDividendYield(symbolLookup: string) {
  const input = symbolLookup.trim();
  if (!input) {
    throw new Error("symbol lookup value is required");
  }

  // 1) Resolve the identifier to a canonical symbol (UUID + aliases)
  const ensuredSymbol = await ensureSymbol(input);
  if (!ensuredSymbol?.symbol?.id) {
    throw new Error(`Unable to resolve symbol "${symbolLookup}".`);
  }

  const canonicalId = ensuredSymbol.symbol.id;
  const displayTicker =
    ensuredSymbol.primaryAlias?.value ?? ensuredSymbol.symbol.ticker ?? input;

  // 2) Reuse cached dividend data when present, but do not seed the cache from
  // an on-demand yield probe.
  const dividendsMap = await fetchDividends([{ symbolId: canonicalId }], {
    upsert: false,
  });
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

  const annualDividendRate =
    resolveAnnualDividendAmount(summary, events, latestPrice ?? undefined) ||
    null;

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
