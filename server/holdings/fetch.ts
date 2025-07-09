"use server";

import { format } from "date-fns";

import { getCurrentUser } from "@/server/auth/actions";
import { fetchQuotes } from "@/server/quotes/fetch";

import type { TransformedHolding, Record } from "@/types/global.types";

interface FetchHoldingsOptions {
  includeArchived?: boolean;
  onlyArchived?: boolean;
  holdingId?: string;
  quoteDate?: Date | null;
  includeRecords?: boolean;
}

/**
 * Fetch holdings with optional filtering for archived holdings.
 *
 * @param options - Optional filtering options
 * @returns Array of transformed holdings
 */
export async function fetchHoldings(
  options: FetchHoldingsOptions & { includeRecords: true },
): Promise<{ holdings: TransformedHolding[]; records: Map<string, Record[]> }>;

export async function fetchHoldings(
  options?: FetchHoldingsOptions & { includeRecords?: false | undefined },
): Promise<TransformedHolding[]>;

export async function fetchHoldings(options: FetchHoldingsOptions = {}) {
  const {
    includeArchived = false,
    onlyArchived = false,
    holdingId,
    quoteDate = new Date(),
    includeRecords = false,
  } = options;

  const { supabase, user } = await getCurrentUser();

  const query = supabase
    .from("holdings")
    .select(
      `
      id,
      name,
      category_code,
      symbol_id,
      currency,
      description,
      is_archived,
      archived_at,
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
    query.eq("is_archived", true);
  } else if (!includeArchived) {
    query.eq("is_archived", false);
  }

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

  // Get records for all holdings at once
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

  // Group records by holding_id
  const recordsByHolding = new Map<string, Record[]>();

  allRecords?.forEach((record) => {
    const holdingId = record.holding_id;

    // Get existing array or create new one
    const existingRecords = recordsByHolding.get(holdingId) || [];
    existingRecords.push(record);
    recordsByHolding.set(holdingId, existingRecords);
  });

  // Identify holdings with symbols and fetch their latest quotes
  const holdingsWithSymbols = holdings.filter((holding) => holding.symbol_id);
  const symbolIds = holdingsWithSymbols.map((holding) => holding.symbol_id!);

  let quotesMap = new Map<string, number>();
  if (symbolIds.length > 0 && quoteDate !== null) {
    const quoteRequests = symbolIds.map((symbolId) => ({
      symbolId,
      date: quoteDate,
    }));
    quotesMap = await fetchQuotes(quoteRequests);
  }

  // Transform the holdings data
  const transformedHoldings: TransformedHolding[] = holdings.map((holding) => {
    // Get the records for this specific holding
    const holdingRecords = recordsByHolding.get(holding.id) || [];

    // Get the latest record (first one, since they're sorted by date descending)
    const latestRecord = holdingRecords[0];

    // Determine current_unit_value based on whether holding has a symbol
    let current_unit_value: number;
    if (holding.symbol_id && quoteDate !== null) {
      // For holdings with symbols, use the quote for the specified date
      const quoteKey = `${holding.symbol_id}|${format(quoteDate, "yyyy-MM-dd")}`;
      current_unit_value =
        quotesMap.get(quoteKey) || latestRecord?.unit_value || 0;
    } else {
      // For holdings without symbols or when quotes are skipped, use the latest record
      current_unit_value = latestRecord?.unit_value || 0;
    }

    // Get the current quantity from the latest record
    const current_quantity = latestRecord?.quantity || 0;

    return {
      ...holding,
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
  includeRecords: true,
): Promise<TransformedHolding>;

export async function fetchSingleHolding(
  holdingId: string,
  includeRecords?: false | undefined,
): Promise<TransformedHolding>;

export async function fetchSingleHolding(
  holdingId: string,
  includeRecords: boolean = false,
) {
  if (includeRecords) {
    const { holdings } = await fetchHoldings({
      holdingId,
      includeRecords: true,
    });
    return holdings[0];
  } else {
    const holdings = await fetchHoldings({ holdingId });
    return holdings[0];
  }
}
