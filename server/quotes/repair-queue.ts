"use server";

import { subDays } from "date-fns";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  formatUTCDateKey,
  parseUTCDateKey,
  type UTCDateKey,
} from "@/lib/date/date-utils";
import type { Database } from "@/types/database.types";

const CRYPTO_QUOTE_TYPE = "CRYPTOCURRENCY";
const STALE_PROBE_WINDOW_DAYS = 7;
const ACTIVE_REPAIR_STATUSES = new Set(["pending", "in_progress"]);
const FAILED_REPAIR_STATUSES = new Set([
  "non_trading_or_no_exact",
  "terminal_error",
]);

type ServiceClient = SupabaseClient<Database>;

export interface ExactQuoteRepairRequest {
  symbolId: string;
  targetDateKey: UTCDateKey;
}

interface SymbolRepairMetadata {
  id: string;
  quote_type: string;
  last_quote_at: string | null;
}

interface ExistingRepairRow {
  symbol_id: string;
  status: string;
  created_at: string;
}

function dedupeRepairRequests(
  requests: ExactQuoteRepairRequest[],
): ExactQuoteRepairRequest[] {
  const byKey = new Map<string, ExactQuoteRepairRequest>();

  requests.forEach((request) => {
    byKey.set(`${request.symbolId}|${request.targetDateKey}`, request);
  });

  return Array.from(byKey.values());
}

function isWeekendDate(dateKey: string): boolean {
  const day = parseUTCDateKey(dateKey).getUTCDay();
  return day === 0 || day === 6;
}

function isRepairEligibleMarketDate(
  symbol: SymbolRepairMetadata,
  targetDateKey: UTCDateKey,
): boolean {
  if (symbol.quote_type === CRYPTO_QUOTE_TYPE) return true;
  return !isWeekendDate(targetDateKey);
}

function isBeyondLastKnownQuoteWindow(
  symbol: SymbolRepairMetadata,
  targetDateKey: UTCDateKey,
): boolean {
  if (!symbol.last_quote_at) return false;

  const lastQuoteDateKey = formatUTCDateKey(new Date(symbol.last_quote_at));
  const lastQuoteMs = parseUTCDateKey(lastQuoteDateKey).getTime();
  const targetMs = parseUTCDateKey(targetDateKey).getTime();
  const ageInDays = Math.floor((targetMs - lastQuoteMs) / 86_400_000);

  return ageInDays > STALE_PROBE_WINDOW_DAYS;
}

function shouldTreatMissingLastQuoteAsProbeOnly(
  rows: ExistingRepairRow[],
): boolean {
  return rows.some((row) => FAILED_REPAIR_STATUSES.has(row.status));
}

function canEnqueueProbe(rows: ExistingRepairRow[], now: Date): boolean {
  if (rows.some((row) => ACTIVE_REPAIR_STATUSES.has(row.status))) {
    return false;
  }

  const recentProbeCutoff = subDays(now, STALE_PROBE_WINDOW_DAYS).getTime();

  return !rows.some(
    (row) => new Date(row.created_at).getTime() >= recentProbeCutoff,
  );
}

function pickLatestTargetDateKey(
  requests: ExactQuoteRepairRequest[],
): UTCDateKey {
  return requests
    .map((request) => request.targetDateKey)
    .sort((left, right) => right.localeCompare(left))[0];
}

async function fetchSymbolRepairMetadata(
  supabase: ServiceClient,
  symbolIds: string[],
) {
  if (!symbolIds.length) return new Map<string, SymbolRepairMetadata>();

  const { data, error } = await supabase
    .from("symbols")
    .select("id, quote_type, last_quote_at")
    .in("id", symbolIds);

  if (error) {
    console.warn("[quoteRepairQueue] Failed to load symbol metadata:", error);
    return new Map<string, SymbolRepairMetadata>();
  }

  return new Map((data ?? []).map((symbol) => [symbol.id, symbol]));
}

async function fetchExistingRepairRows(
  supabase: ServiceClient,
  symbolIds: string[],
  now: Date,
) {
  if (!symbolIds.length) return new Map<string, ExistingRepairRow[]>();

  const recentCutoffIso = subDays(now, STALE_PROBE_WINDOW_DAYS).toISOString();
  const repairRowQueries = [
    supabase
      .from("quote_repair_queue")
      .select("symbol_id, status, created_at")
      .in("symbol_id", symbolIds)
      .in("status", Array.from(ACTIVE_REPAIR_STATUSES)),
    supabase
      .from("quote_repair_queue")
      .select("symbol_id, status, created_at")
      .in("symbol_id", symbolIds)
      .gte("created_at", recentCutoffIso),
    supabase
      .from("quote_repair_queue")
      .select("symbol_id, status, created_at")
      .in("symbol_id", symbolIds)
      .in("status", Array.from(FAILED_REPAIR_STATUSES)),
  ];

  const results = await Promise.all(repairRowQueries);
  const rowsByKey = new Map<string, ExistingRepairRow>();

  for (const { data, error } of results) {
    if (error) {
      console.warn(
        "[quoteRepairQueue] Failed to load existing repairs:",
        error,
      );
      continue;
    }

    (data ?? []).forEach((row) => {
      rowsByKey.set(`${row.symbol_id}|${row.status}|${row.created_at}`, row);
    });
  }

  const rowsBySymbol = new Map<string, ExistingRepairRow[]>();
  rowsByKey.forEach((row) => {
    const rows = rowsBySymbol.get(row.symbol_id) ?? [];
    rows.push(row);
    rowsBySymbol.set(row.symbol_id, rows);
  });

  return rowsBySymbol;
}

export async function enqueueExactQuoteRepairs({
  supabase,
  requests,
  now = new Date(),
}: {
  supabase: ServiceClient;
  requests: ExactQuoteRepairRequest[];
  now?: Date;
}): Promise<void> {
  const uniqueRequests = dedupeRepairRequests(requests);
  if (!uniqueRequests.length) return;

  const symbolIds = [
    ...new Set(uniqueRequests.map((request) => request.symbolId)),
  ];
  const symbolsById = await fetchSymbolRepairMetadata(supabase, symbolIds);

  const eligibleRequestsBySymbol = new Map<string, ExactQuoteRepairRequest[]>();
  uniqueRequests.forEach((request) => {
    const symbol = symbolsById.get(request.symbolId);
    if (!symbol || !isRepairEligibleMarketDate(symbol, request.targetDateKey)) {
      return;
    }

    const requestsForSymbol =
      eligibleRequestsBySymbol.get(request.symbolId) ?? [];
    requestsForSymbol.push(request);
    eligibleRequestsBySymbol.set(request.symbolId, requestsForSymbol);
  });

  if (eligibleRequestsBySymbol.size === 0) return;

  const probeCheckSymbolIds = Array.from(
    eligibleRequestsBySymbol.keys(),
  ).filter((symbolId) => {
    const symbol = symbolsById.get(symbolId);
    if (!symbol) return false;

    const requestsForSymbol = eligibleRequestsBySymbol.get(symbolId) ?? [];
    return requestsForSymbol.some(
      (request) =>
        !symbol.last_quote_at ||
        isBeyondLastKnownQuoteWindow(symbol, request.targetDateKey),
    );
  });
  const existingRowsBySymbol = await fetchExistingRepairRows(
    supabase,
    probeCheckSymbolIds,
    now,
  );

  const rowsToInsert: Array<{
    symbol_id: string;
    target_date: string;
  }> = [];

  eligibleRequestsBySymbol.forEach((requestsForSymbol, symbolId) => {
    const symbol = symbolsById.get(symbolId);
    if (!symbol) return;

    const existingRows = existingRowsBySymbol.get(symbolId) ?? [];
    const shouldProbeOnly =
      requestsForSymbol.some((request) =>
        isBeyondLastKnownQuoteWindow(symbol, request.targetDateKey),
      ) ||
      (!symbol.last_quote_at &&
        shouldTreatMissingLastQuoteAsProbeOnly(existingRows));

    if (shouldProbeOnly) {
      if (!canEnqueueProbe(existingRows, now)) return;

      rowsToInsert.push({
        symbol_id: symbolId,
        target_date: pickLatestTargetDateKey(requestsForSymbol),
      });
      return;
    }

    requestsForSymbol.forEach((request) => {
      rowsToInsert.push({
        symbol_id: symbolId,
        target_date: request.targetDateKey,
      });
    });
  });

  if (!rowsToInsert.length) return;

  // Deduped by the unique DB constraint as well; ignore duplicates from
  // repeated chart loads so reads can stay cache-first and cheap.
  const { error } = await supabase
    .from("quote_repair_queue")
    .upsert(rowsToInsert, {
      onConflict: "symbol_id,target_date",
      ignoreDuplicates: true,
    });

  if (error) {
    console.warn("[quoteRepairQueue] Failed to enqueue repairs:", error);
  }
}
