"use server";

import { subDays } from "date-fns";

import { getCurrentUser } from "@/server/auth/actions";

const STALENESS_THRESHOLD_DAYS = 7;
const POSITION_PAGE_SIZE = 1_000;

export type MarketDataStatus = {
  positionId: string;
  positionName: string;
  ticker: string;
  status: "stale" | "unavailable";
};

type MarketDataSymbolRow = {
  ticker: string;
  last_quote_at: string | null;
  symbol_aliases: Array<{
    source: string;
    type: string;
    effective_to: string | null;
  }>;
};

type MarketDataPositionRow = {
  id: string;
  name: string;
  symbols: MarketDataSymbolRow | MarketDataSymbolRow[];
};

/**
 * Fetch market-data statuses for non-archived symbol-backed positions.
 */
export async function fetchMarketDataStatuses(): Promise<MarketDataStatus[]> {
  const { supabase, user } = await getCurrentUser();

  const thresholdDate = subDays(new Date(), STALENESS_THRESHOLD_DAYS);
  const positions: MarketDataPositionRow[] = [];
  let cursor: string | null = null;

  while (true) {
    let query = supabase
      .from("positions")
      .select(
        `
        id,
        name,
        symbols!inner (
          ticker,
          last_quote_at,
          symbol_aliases (
            source,
            type,
            effective_to
          )
        )
      `,
      )
      .eq("user_id", user.id)
      .is("archived_at", null)
      .not("symbol_id", "is", null)
      .order("id", { ascending: true })
      .limit(POSITION_PAGE_SIZE);

    if (cursor) query = query.gt("id", cursor);

    const { data, error } = await query;

    if (error) {
      console.error("Failed to fetch market data statuses:", error);
      return [];
    }

    if (!data?.length) break;

    positions.push(...data);

    if (data.length < POSITION_PAGE_SIZE) break;
    cursor = data[data.length - 1].id;
  }

  return positions.flatMap<MarketDataStatus>((position) => {
    // PostgREST normally returns this to-one join as an object, but preserve
    // the array fallback because that shape has occurred at runtime.
    const symbol = Array.isArray(position.symbols)
      ? position.symbols[0]
      : position.symbols;

    // Skip positions without valid symbol metadata (defensive check).
    if (!symbol?.ticker) return [];

    const yahooTickerAliases = symbol.symbol_aliases.filter(
      (alias) => alias.source === "yahoo" && alias.type === "ticker",
    );
    const hasActiveYahooAlias = yahooTickerAliases.some(
      (alias) => alias.effective_to === null,
    );
    const hasRetiredYahooAlias = yahooTickerAliases.some(
      (alias) => alias.effective_to !== null,
    );

    if (hasRetiredYahooAlias && !hasActiveYahooAlias) {
      return [
        {
          positionId: position.id,
          positionName: position.name,
          ticker: symbol.ticker,
          status: "unavailable" as const,
        },
      ];
    }

    const lastQuoteAtMs = symbol.last_quote_at
      ? Date.parse(symbol.last_quote_at)
      : Number.NaN;
    const isStale =
      !Number.isFinite(lastQuoteAtMs) ||
      lastQuoteAtMs < thresholdDate.getTime();

    if (!isStale) return [];

    return [
      {
        positionId: position.id,
        positionName: position.name,
        ticker: symbol.ticker,
        status: "stale" as const,
      },
    ];
  });
}
