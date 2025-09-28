"use server";

import { format } from "date-fns";

import { getCurrentUser } from "@/server/auth/actions";
import { fetchQuotes } from "@/server/quotes/fetch";
import { fetchDomainValuations } from "@/server/domain-valuations/fetch";

import type {
  TransformedHolding,
  Record,
  TransformedRecord,
} from "@/types/global.types";

interface FetchHoldingsOptions {
  includeArchived?: boolean;
  onlyArchived?: boolean;
  holdingId?: string;
  quoteDate?: Date | null;
  includeRecords?: boolean;
}

interface FetchSingleHoldingOptions {
  includeRecords?: boolean;
  includeArchived?: boolean;
  quoteDate?: Date | null;
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
    holdingId, // Used in fetchSingleHolding
    includeArchived = false,
    onlyArchived = false,
    quoteDate = null,
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
      domain_id,
      currency,
      description,
      archived_at,
      created_at,
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
    const { data: latestRecords, error: recordsError } = await supabase
      .from("records")
      .select("*")
      .in("holding_id", holdingIds)
      .eq("user_id", user.id)
      .order("holding_id")
      .order("date", { ascending: false })
      .order("created_at", { ascending: false });

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

  // Identify holdings with market data and fetch their latest quotes/valuations
  const holdingsWithSymbols = holdings.filter((holding) => holding.symbol_id);
  const symbolIds = holdingsWithSymbols.map((holding) => holding.symbol_id!);

  const domainHoldings = holdings.filter(
    (holding) => holding.category_code === "domain",
  );
  const domains = domainHoldings.map((holding) => holding.domain_id!);

  let quotesMap = new Map<string, number>();
  let domainValuationsMap = new Map<string, number>();

  // Fetch quotes for holdings with symbols
  if (symbolIds.length > 0 && quoteDate !== null) {
    const quoteRequests = symbolIds.map((symbolId) => ({
      symbolId,
      date: quoteDate,
    }));
    quotesMap = await fetchQuotes(quoteRequests);
  }

  // Fetch valuations for domain holdings
  if (domainHoldings.length > 0 && quoteDate !== null) {
    const domainRequests = domains.map((domain) => ({
      domain,
      date: quoteDate,
    }));
    domainValuationsMap = await fetchDomainValuations(domainRequests);
  }

  // Transform the holdings data
  const transformedHoldings: TransformedHolding[] = holdings.map((holding) => {
    // Get the records for this specific holding
    const holdingRecords = recordsByHolding.get(holding.id) || [];

    // Get the latest record (first one, since they're sorted by date descending)
    const latestRecord = holdingRecords[0];

    // Determine current_unit_value based on holding type
    let current_unit_value: number;

    if (holding.symbol_id && quoteDate !== null) {
      // For holdings with symbols, use the quote for the specified date
      const quoteKey = `${holding.symbol_id}|${format(quoteDate, "yyyy-MM-dd")}`;
      current_unit_value =
        quotesMap.get(quoteKey) || latestRecord?.unit_value || 0;
    } else if (holding.category_code === "domain" && quoteDate !== null) {
      // For domain holdings, use the domain valuation
      const domainKey = `${holding.domain_id}|${format(quoteDate, "yyyy-MM-dd")}`;
      current_unit_value =
        domainValuationsMap.get(domainKey) || latestRecord?.unit_value || 0;
    } else {
      // For holdings without symbols or when quotes are skipped, use the latest record
      current_unit_value = latestRecord?.unit_value || 0;
    }

    // Get the current quantity from the latest record
    const current_quantity = latestRecord?.quantity || 0;

    return {
      ...holding,
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
    quoteDate = null,
  } = options;

  if (includeRecords) {
    const { holdings, records } = await fetchHoldings({
      holdingId,
      includeRecords: true,
      includeArchived,
      quoteDate,
    });
    return {
      holding: holdings[0],
      records: Array.from(records.get(holdings[0].id) || []),
    };
  } else {
    const holdings = await fetchHoldings({
      holdingId,
      includeArchived,
      quoteDate,
    });
    return holdings[0];
  }
}
