"use server";

import { format } from "date-fns";

import { getCurrentUser } from "@/server/auth/actions";
import { fetchMarketData } from "@/server/market-data/fetch";

import type {
  TransformedHolding,
  Record,
  TransformedRecord,
} from "@/types/global.types";

interface FetchHoldingsOptions {
  includeArchived?: boolean;
  onlyArchived?: boolean;
  holdingId?: string;
  /**
   * As-of valuation date. When provided, all holdings are valued as-of this date:
   * - Market-backed (symbols/domains): use market data at this date, fallback to record
   * - Non-market: use latest record where record.date <= asOfDate
   */
  asOfDate?: Date | null;
  includeRecords?: boolean;
}

interface FetchSingleHoldingOptions {
  includeRecords?: boolean;
  includeArchived?: boolean;
  asOfDate?: Date | null;
}

/**
 * Fetch holdings with optional filtering for archived holdings.
 *
 * If asOfDate is provided, `current_unit_value`, `current_quantity`, and
 * `total_value` are computed as-of that date using market data for
 * market-backed holdings (symbols/domains) with record fallback; basic
 * holdings use the latest record ≤ asOfDate.
 */
export async function fetchHoldings(
  options: FetchHoldingsOptions & { includeRecords: true },
): Promise<{ holdings: TransformedHolding[]; records: Map<string, Record[]> }>;

export async function fetchHoldings(
  options?: FetchHoldingsOptions & { includeRecords?: false | undefined },
): Promise<TransformedHolding[]>;

export async function fetchHoldings(options: FetchHoldingsOptions = {}) {
  const {
    holdingId, // Used in fetchSingleHolding
    includeArchived = false,
    onlyArchived = false,
    asOfDate = null,
    includeRecords = false,
  } = options;

  const { supabase, user } = await getCurrentUser();

  const query = supabase
    .from("holdings")
    .select(
      `
      *,
      asset_categories (
        name,
        display_order
      )
    `,
    )
    .eq("user_id", user.id);

  // If a holdingId is provided, filter for that specific holding
  if (holdingId) {
    query.eq("id", holdingId);
  }

  // Handle archived holdings filtering
  if (onlyArchived) {
    query.not("archived_at", "is", null);
  } else if (!includeArchived) {
    query.is("archived_at", null);
  }

  // Run the query and order by category display order
  const { data: holdings, error } = await query.order(
    "asset_categories(display_order)",
    { ascending: true },
  );

  if (error) {
    throw new Error(error.message);
  }

  if (holdingId && (!holdings || holdings.length === 0)) {
    throw new Error("Holding not found");
  }

  const holdingIds = holdings.map((holding) => holding.id);

  // If no holdings are found, return an empty array or empty map
  if (holdingIds.length === 0) {
    if (includeRecords) {
      return {
        holdings: [],
        records: new Map<string, Record[]>(),
      };
    }
    return [];
  }

  const recordsByHolding = new Map<string, Record[]>();

  // Prefer extension tables for symbol/domain identifiers
  const symbolIdByHolding = new Map<string, string>();
  const domainIdByHolding = new Map<string, string>();

  // Fetch extension table mappings
  {
    const { data: symbolExtensionRows, error: symbolExtensionError } =
      await supabase
        .from("symbol_holdings")
        .select("holding_id, symbol_id")
        .in("holding_id", holdingIds);
    if (symbolExtensionError) {
      throw new Error(
        `Failed to fetch symbol extensions: ${symbolExtensionError.message}`,
      );
    }
    symbolExtensionRows?.forEach((row) => {
      if (row.symbol_id) symbolIdByHolding.set(row.holding_id, row.symbol_id);
    });

    const { data: domainExtensionRows, error: domainExtensionError } =
      await supabase
        .from("domain_holdings")
        .select("holding_id, domain_id")
        .in("holding_id", holdingIds);
    if (domainExtensionError) {
      throw new Error(
        `Failed to fetch domain extensions: ${domainExtensionError.message}`,
      );
    }
    domainExtensionRows?.forEach((row) => {
      if (row.domain_id) domainIdByHolding.set(row.holding_id, row.domain_id);
    });
  }

  // Bulk fetch ALL records for all holdings at once (only if includeRecords is true)
  if (includeRecords) {
    const { data: allRecords, error: recordsError } = await supabase
      .from("records")
      .select("*")
      .in("holding_id", holdingIds)
      .eq("user_id", user.id)
      .order("date", { ascending: false })
      .order("created_at", { ascending: false });

    if (recordsError) {
      throw new Error(`Failed to fetch records: ${recordsError.message}`);
    }

    // Populate with ALL records for each holding
    allRecords?.forEach((record) => {
      const holdingId = record.holding_id;

      // Get existing array or create new one
      const existingRecords = recordsByHolding.get(holdingId) || [];
      existingRecords.push(record);
      recordsByHolding.set(holdingId, existingRecords);
    });
  } else {
    // Bulk fetch LATEST records only for all holdings at once (for TransformedHolding)
    let recordsQuery = supabase
      .from("records")
      .select("*")
      .in("holding_id", holdingIds)
      .eq("user_id", user.id)
      .order("holding_id")
      .order("date", { ascending: false })
      .order("created_at", { ascending: false });

    if (asOfDate) {
      recordsQuery = recordsQuery.lte("date", format(asOfDate, "yyyy-MM-dd"));
    }

    const { data: latestRecords, error: recordsError } = await recordsQuery;

    if (recordsError) {
      throw new Error(
        `Failed to fetch latest records: ${recordsError.message}`,
      );
    }

    // Group by holding_id and keep only the latest record for each
    const latestByHolding = new Map<string, Record>();
    latestRecords?.forEach((record) => {
      const holdingId = record.holding_id;
      // Since records are ordered by holding_id, date DESC, created_at DESC
      // the first record we see for each holding_id is the latest
      if (!latestByHolding.has(holdingId)) {
        latestByHolding.set(holdingId, record);
      }
    });

    // Populate recordsByHolding with just the latest record for each holding
    latestByHolding.forEach((record, holdingId) => {
      recordsByHolding.set(holdingId, [record]);
    });
  }

  // Fetch market-backed data (quotes/domains) via centralized aggregator when as-of date is provided
  let quotesMap = new Map<string, number>();
  let domainValuationsMap = new Map<string, number>();
  if (asOfDate !== null) {
    // Determine which holdings actually existed as-of the date (have a record <= asOfDate)
    const activeHoldingIds = new Set<string>();
    recordsByHolding.forEach((recs, holdingId) => {
      if (recs && recs.length > 0) activeHoldingIds.add(holdingId);
    });

    // Build a minimal shape for market data collection without requiring full TransformedHolding
    const marketDataHoldings: TransformedHolding[] = holdings
      .filter((holding) => activeHoldingIds.has(holding.id))
      .map((holding) => ({
        source: holding.source,
        symbol_id: symbolIdByHolding.get(holding.id) ?? null,
        domain_id: domainIdByHolding.get(holding.id) ?? null,
        currency: holding.currency,
      })) as TransformedHolding[];

    const { quotes, domainValuations } = await fetchMarketData(
      marketDataHoldings,
      asOfDate,
      undefined,
      { include: { exchangeRates: false } },
    );
    quotesMap = quotes;
    domainValuationsMap = domainValuations;
  }

  // Transform the holdings data
  const transformedHoldings: TransformedHolding[] = holdings.map((holding) => {
    // Get the records for this specific holding
    const holdingRecords = recordsByHolding.get(holding.id) || [];

    // Choose the appropriate record: latest overall, or latest at/before as-of date
    let baseRecord: Record | undefined = undefined;
    if (asOfDate) {
      const asOfKey = format(asOfDate, "yyyy-MM-dd");
      baseRecord = holdingRecords.find((r) => r.date <= asOfKey);
    } else {
      baseRecord = holdingRecords[0];
    }

    // Determine current_unit_value based on holding type
    let current_unit_value: number;

    const effectiveSymbolId = symbolIdByHolding.get(holding.id);
    const effectiveDomainId = domainIdByHolding.get(holding.id);

    if (holding.source === "symbol" && asOfDate !== null && effectiveSymbolId) {
      // For holdings with symbols, use the quote for the as-of date
      const quoteKey = `${effectiveSymbolId}|${format(asOfDate, "yyyy-MM-dd")}`;
      current_unit_value =
        quotesMap.get(quoteKey) || baseRecord?.unit_value || 0;
    } else if (
      holding.source === "domain" &&
      asOfDate !== null &&
      effectiveDomainId
    ) {
      // For domain holdings, use the domain valuation at the as-of date
      const domainKey = `${effectiveDomainId}|${format(asOfDate, "yyyy-MM-dd")}`;
      current_unit_value =
        domainValuationsMap.get(domainKey) || baseRecord?.unit_value || 0;
    } else {
      // For non-market holdings or when as-of date not provided, use the appropriate record
      current_unit_value = baseRecord?.unit_value || 0;
    }

    // Get the current quantity from the latest record
    const current_quantity = baseRecord?.quantity || 0;

    return {
      ...holding,
      symbol_id: effectiveSymbolId ?? null,
      domain_id: effectiveDomainId ?? null,
      is_archived: holding.archived_at !== null,
      asset_type: holding.asset_categories.name,
      current_unit_value,
      current_quantity,
      total_value: current_unit_value * current_quantity,
    };
  });

  if (includeRecords) {
    return {
      holdings: transformedHoldings,
      records: recordsByHolding,
    };
  }

  return transformedHoldings;
}

/**
 * Fetch a single holding by its ID.
 *
 * @param holdingId - The ID of the holding to fetch
 * @returns The transformed holding
 */
export async function fetchSingleHolding(
  holdingId: string,
  options: FetchSingleHoldingOptions & { includeRecords: true },
): Promise<{ holding: TransformedHolding; records: TransformedRecord[] }>;

export async function fetchSingleHolding(
  holdingId: string,
  options?: FetchSingleHoldingOptions & { includeRecords?: false | undefined },
): Promise<TransformedHolding>;

export async function fetchSingleHolding(
  holdingId: string,
  options: FetchSingleHoldingOptions = {},
) {
  const {
    includeRecords = false,
    includeArchived = true,
    asOfDate = null,
  } = options;

  if (includeRecords) {
    const { holdings, records } = await fetchHoldings({
      holdingId,
      includeRecords: true,
      includeArchived,
      asOfDate,
    });
    return {
      holding: holdings[0],
      records: Array.from(records.get(holdings[0].id) || []),
    };
  } else {
    const holdings = await fetchHoldings({
      holdingId,
      includeArchived,
      asOfDate,
    });
    return holdings[0];
  }
}
