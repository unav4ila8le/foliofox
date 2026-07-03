"use server";

import type { SupabaseClient } from "@supabase/supabase-js";

import { addUTCDays, parseUTCDateKey } from "@/lib/date/date-utils";
import { isTransientError, stringifyError } from "@/server/shared/retry";
import { resolveSymbolsBatch } from "@/server/symbols/resolve";
import { yahooFinance } from "@/server/yahoo-finance/client";
import { createServiceClient } from "@/supabase/service";
import type { Database } from "@/types/database.types";
import { normalizeChartQuoteEntries, scaleProviderQuoteEntries } from "./utils";

const DEFAULT_BATCH_SIZE = 50;
const STALE_CLAIM_MINUTES = 30;
const MAX_REPAIR_ATTEMPTS = 5;
const BACKOFF_MINUTES_BY_ATTEMPT = [15, 60, 360, 1_440];

type ServiceClient = SupabaseClient<Database>;

interface QuoteRepairJob {
  id: string;
  symbol_id: string;
  target_date: string;
  attempt_count: number;
}

interface RepairSymbolMetadata {
  id: string;
  providerAlias: string;
  quoteToCurrencyRate: number;
}

interface QuoteUpsertRow {
  symbol_id: string;
  date: string;
  close_price: number;
  adjusted_close_price: number;
}

export interface QuoteRepairQueueStats {
  claimedJobs: number;
  resolvedExact: number;
  nonTradingOrNoExact: number;
  retriesScheduled: number;
  terminalFailures: number;
  skippedMissingSymbol: number;
  quoteRowsUpserted: number;
  symbolHealthUpdates: number;
}

export interface QuoteRepairQueueResult {
  success: true;
  message: string;
  stats: QuoteRepairQueueStats;
}

interface RunQuoteRepairQueueOptions {
  supabase?: ServiceClient;
  now?: Date;
  batchSize?: number;
}

function createEmptyStats(): QuoteRepairQueueStats {
  return {
    claimedJobs: 0,
    resolvedExact: 0,
    nonTradingOrNoExact: 0,
    retriesScheduled: 0,
    terminalFailures: 0,
    skippedMissingSymbol: 0,
    quoteRowsUpserted: 0,
    symbolHealthUpdates: 0,
  };
}

function groupJobsBySymbol(jobs: QuoteRepairJob[]) {
  const jobsBySymbol = new Map<string, QuoteRepairJob[]>();

  jobs.forEach((job) => {
    const group = jobsBySymbol.get(job.symbol_id) ?? [];
    group.push(job);
    jobsBySymbol.set(job.symbol_id, group);
  });

  return jobsBySymbol;
}

function buildQuoteKey(symbolId: string, dateKey: string): string {
  return `${symbolId}|${dateKey}`;
}

function resolveNextAttemptAt(now: Date, nextAttemptCount: number): string {
  const backoffIndex = Math.min(
    Math.max(0, nextAttemptCount - 1),
    BACKOFF_MINUTES_BY_ATTEMPT.length - 1,
  );
  const backoffMinutes = BACKOFF_MINUTES_BY_ATTEMPT[backoffIndex];

  return new Date(now.getTime() + backoffMinutes * 60_000).toISOString();
}

async function claimPendingJobs(
  supabase: ServiceClient,
  now: Date,
  limit: number,
): Promise<QuoteRepairJob[]> {
  if (limit <= 0) return [];

  const nowIso = now.toISOString();
  const { data: candidates, error: selectError } = await supabase
    .from("quote_repair_queue")
    .select("id")
    .eq("status", "pending")
    .lte("next_attempt_at", nowIso)
    .order("next_attempt_at", { ascending: true })
    .order("created_at", { ascending: true })
    .limit(limit);

  if (selectError) {
    console.warn(
      "[quoteRepairWorker] Failed to select pending jobs:",
      selectError,
    );
    return [];
  }

  const ids = (candidates ?? []).map((row) => row.id);
  if (!ids.length) return [];

  // Repeat the status predicate on update so overlapping cron runs only claim
  // rows that are still pending after candidate selection.
  const { data, error } = await supabase
    .from("quote_repair_queue")
    .update({ status: "in_progress", claimed_at: nowIso })
    .in("id", ids)
    .eq("status", "pending")
    .select("id, symbol_id, target_date, attempt_count");

  if (error) {
    console.warn("[quoteRepairWorker] Failed to claim pending jobs:", error);
    return [];
  }

  return data ?? [];
}

async function claimStaleInProgressJobs(
  supabase: ServiceClient,
  now: Date,
  limit: number,
): Promise<QuoteRepairJob[]> {
  if (limit <= 0) return [];

  const nowIso = now.toISOString();
  const staleClaimCutoff = new Date(
    now.getTime() - STALE_CLAIM_MINUTES * 60_000,
  ).toISOString();

  const { data: candidates, error: selectError } = await supabase
    .from("quote_repair_queue")
    .select("id")
    .eq("status", "in_progress")
    .lte("claimed_at", staleClaimCutoff)
    .order("claimed_at", { ascending: true })
    .limit(limit);

  if (selectError) {
    console.warn(
      "[quoteRepairWorker] Failed to select stale in-progress jobs:",
      selectError,
    );
    return [];
  }

  const ids = (candidates ?? []).map((row) => row.id);
  if (!ids.length) return [];

  const { data, error } = await supabase
    .from("quote_repair_queue")
    .update({ status: "in_progress", claimed_at: nowIso })
    .in("id", ids)
    .eq("status", "in_progress")
    .lte("claimed_at", staleClaimCutoff)
    .select("id, symbol_id, target_date, attempt_count");

  if (error) {
    console.warn(
      "[quoteRepairWorker] Failed to reclaim stale in-progress jobs:",
      error,
    );
    return [];
  }

  return data ?? [];
}

async function claimQuoteRepairJobs(
  supabase: ServiceClient,
  now: Date,
  batchSize: number,
): Promise<QuoteRepairJob[]> {
  const pendingJobs = await claimPendingJobs(supabase, now, batchSize);
  const remainingLimit = batchSize - pendingJobs.length;
  const staleJobs = await claimStaleInProgressJobs(
    supabase,
    now,
    remainingLimit,
  );

  return [...pendingJobs, ...staleJobs];
}

async function resolveRepairSymbols(symbolIds: string[]) {
  if (!symbolIds.length) return new Map<string, RepairSymbolMetadata>();

  const { byCanonicalId } = await resolveSymbolsBatch(symbolIds, {
    provider: "yahoo",
    providerType: "ticker",
    onError: "warn",
  });

  return new Map(
    symbolIds.flatMap((symbolId) => {
      const resolution = byCanonicalId.get(symbolId);
      if (!resolution) return [];

      return [
        [
          symbolId,
          {
            id: symbolId,
            providerAlias: resolution.providerAlias,
            quoteToCurrencyRate: resolution.quoteToCurrencyRate,
          },
        ],
      ];
    }),
  );
}

async function fetchExistingExactQuoteKeys(
  supabase: ServiceClient,
  jobsBySymbol: Map<string, QuoteRepairJob[]>,
) {
  const exactKeys = new Set<string>();

  for (const [symbolId, jobs] of jobsBySymbol.entries()) {
    const targetDates = [...new Set(jobs.map((job) => job.target_date))];
    if (!targetDates.length) continue;

    const { data, error } = await supabase
      .from("quotes")
      .select("symbol_id, date")
      .eq("symbol_id", symbolId)
      .in("date", targetDates);

    if (error) {
      console.warn(
        `[quoteRepairWorker] Failed to load existing exact quotes for ${symbolId}:`,
        error,
      );
      continue;
    }

    (data ?? []).forEach((row) => {
      exactKeys.add(buildQuoteKey(row.symbol_id, row.date));
    });
  }

  return exactKeys;
}

async function updateJob(
  supabase: ServiceClient,
  job: QuoteRepairJob,
  patch: Database["public"]["Tables"]["quote_repair_queue"]["Update"],
) {
  const { error } = await supabase
    .from("quote_repair_queue")
    .update(patch)
    .eq("id", job.id);

  if (error) {
    console.warn(`[quoteRepairWorker] Failed to update job ${job.id}:`, error);
  }
}

async function markResolvedExact(
  supabase: ServiceClient,
  job: QuoteRepairJob,
  stats: QuoteRepairQueueStats,
) {
  await updateJob(supabase, job, {
    status: "resolved_exact",
    attempt_count: job.attempt_count + 1,
    claimed_at: null,
    last_error: null,
  });
  stats.resolvedExact += 1;
}

async function markNoExact(
  supabase: ServiceClient,
  job: QuoteRepairJob,
  stats: QuoteRepairQueueStats,
) {
  await updateJob(supabase, job, {
    status: "non_trading_or_no_exact",
    attempt_count: job.attempt_count + 1,
    claimed_at: null,
    last_error: null,
  });
  stats.nonTradingOrNoExact += 1;
}

async function markTerminal(
  supabase: ServiceClient,
  job: QuoteRepairJob,
  stats: QuoteRepairQueueStats,
  errorMessage: string,
) {
  await updateJob(supabase, job, {
    status: "terminal_error",
    attempt_count: job.attempt_count + 1,
    claimed_at: null,
    last_error: errorMessage,
  });
  stats.terminalFailures += 1;
}

async function markProviderFailure(
  supabase: ServiceClient,
  jobs: QuoteRepairJob[],
  stats: QuoteRepairQueueStats,
  now: Date,
  error: unknown,
) {
  const errorMessage = stringifyError(error);

  for (const job of jobs) {
    const nextAttemptCount = job.attempt_count + 1;
    const shouldRetry =
      isTransientError(error) && nextAttemptCount < MAX_REPAIR_ATTEMPTS;

    if (!shouldRetry) {
      await markTerminal(supabase, job, stats, errorMessage);
      continue;
    }

    await updateJob(supabase, job, {
      status: "pending",
      attempt_count: nextAttemptCount,
      next_attempt_at: resolveNextAttemptAt(now, nextAttemptCount),
      claimed_at: null,
      last_error: errorMessage,
    });
    stats.retriesScheduled += 1;
  }
}

async function upsertQuoteEntries(
  supabase: ServiceClient,
  symbolId: string,
  entries: ReturnType<typeof normalizeChartQuoteEntries>,
) {
  if (!entries.length) return 0;

  const rowsByKey = new Map<string, QuoteUpsertRow>();
  entries.forEach((entry) => {
    rowsByKey.set(buildQuoteKey(symbolId, entry.dateKey), {
      symbol_id: symbolId,
      date: entry.dateKey,
      close_price: entry.closePrice,
      adjusted_close_price: entry.adjustedClosePrice,
    });
  });

  const rows = Array.from(rowsByKey.values());
  const { error } = await supabase
    .from("quotes")
    .upsert(rows, { onConflict: "symbol_id,date" });

  if (error) {
    throw new Error(
      `Failed to upsert repaired quote rows: ${stringifyError(error)}`,
    );
  }

  return rows.length;
}

async function updateSymbolHealth(
  supabase: ServiceClient,
  symbolId: string,
  latestDateKey: string | null,
) {
  if (!latestDateKey) return false;

  const last_quote_at = new Date(`${latestDateKey}T00:00:00Z`).toISOString();
  const { error } = await supabase
    .from("symbols")
    .update({ last_quote_at })
    .eq("id", symbolId)
    .or(`last_quote_at.is.null,last_quote_at.lt.${last_quote_at}`);

  if (error) {
    console.warn(
      `[quoteRepairWorker] Failed to update symbol health for ${symbolId}:`,
      error,
    );
    return false;
  }

  return true;
}

async function processSymbolJobs(params: {
  supabase: ServiceClient;
  symbol: RepairSymbolMetadata;
  jobs: QuoteRepairJob[];
  existingExactKeys: Set<string>;
  stats: QuoteRepairQueueStats;
  now: Date;
}) {
  const { supabase, symbol, jobs, existingExactKeys, stats, now } = params;

  const jobsNeedingProvider: QuoteRepairJob[] = [];
  for (const job of jobs) {
    if (existingExactKeys.has(buildQuoteKey(job.symbol_id, job.target_date))) {
      await markResolvedExact(supabase, job, stats);
      continue;
    }

    jobsNeedingProvider.push(job);
  }

  if (!jobsNeedingProvider.length) return;

  const targetDates = jobsNeedingProvider
    .map((job) => job.target_date)
    .sort((left, right) => left.localeCompare(right));
  const earliestTarget = parseUTCDateKey(targetDates[0]);
  const latestTarget = parseUTCDateKey(targetDates[targetDates.length - 1]);

  try {
    const chartData = await yahooFinance.chart(symbol.providerAlias, {
      period1: addUTCDays(earliestTarget, -7),
      period2: addUTCDays(latestTarget, 1),
      interval: "1d",
    });
    const entries = scaleProviderQuoteEntries(
      normalizeChartQuoteEntries(chartData),
      symbol.quoteToCurrencyRate,
    );

    stats.quoteRowsUpserted += await upsertQuoteEntries(
      supabase,
      symbol.id,
      entries,
    );

    const latestDateKey = entries[entries.length - 1]?.dateKey ?? null;
    if (await updateSymbolHealth(supabase, symbol.id, latestDateKey)) {
      stats.symbolHealthUpdates += 1;
    }

    const repairedDateKeys = new Set<string>(
      entries.map((entry) => entry.dateKey),
    );
    for (const job of jobsNeedingProvider) {
      if (repairedDateKeys.has(job.target_date)) {
        await markResolvedExact(supabase, job, stats);
      } else {
        await markNoExact(supabase, job, stats);
      }
    }
  } catch (error) {
    console.warn(
      `[quoteRepairWorker] Failed to repair quotes for ${symbol.id} (${symbol.providerAlias}):`,
      error,
    );
    await markProviderFailure(supabase, jobsNeedingProvider, stats, now, error);
  }
}

export async function runQuoteRepairQueue(
  options: RunQuoteRepairQueueOptions = {},
): Promise<QuoteRepairQueueResult> {
  const supabase = options.supabase ?? createServiceClient();
  const now = options.now ?? new Date();
  const batchSize = Math.max(
    1,
    Math.trunc(options.batchSize ?? DEFAULT_BATCH_SIZE),
  );
  const stats = createEmptyStats();

  const claimedJobs = await claimQuoteRepairJobs(supabase, now, batchSize);
  stats.claimedJobs = claimedJobs.length;

  if (!claimedJobs.length) {
    return {
      success: true,
      message: "No quote repair jobs were due",
      stats,
    };
  }

  const jobsBySymbol = groupJobsBySymbol(claimedJobs);
  const symbolIds = Array.from(jobsBySymbol.keys());
  const [symbolsById, existingExactKeys] = await Promise.all([
    resolveRepairSymbols(symbolIds),
    fetchExistingExactQuoteKeys(supabase, jobsBySymbol),
  ]);

  for (const [symbolId, jobs] of jobsBySymbol.entries()) {
    const symbol = symbolsById.get(symbolId);
    if (!symbol) {
      stats.skippedMissingSymbol += jobs.length;
      for (const job of jobs) {
        await updateJob(supabase, job, {
          status: "terminal_error",
          attempt_count: job.attempt_count + 1,
          claimed_at: null,
          last_error: `Missing symbol metadata for ${symbolId}`,
        });
      }
      continue;
    }

    await processSymbolJobs({
      supabase,
      symbol,
      jobs,
      existingExactKeys,
      stats,
      now,
    });
  }

  return {
    success: true,
    message: "Quote repair queue processed",
    stats,
  };
}
