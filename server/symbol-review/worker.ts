"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { Output, generateText } from "ai";

import {
  aiModel,
  extractionGenerationOptions,
  extractionModelId,
  openaiWebSearchTool,
} from "@/server/ai/provider";
import { createAutomatedEmailSender } from "@/server/automated-emails/sender";
import { stringifyError } from "@/server/shared/retry";
import { createServiceClient } from "@/supabase/service";
import type { Database } from "@/types/database.types";
import {
  buildReviewPrompt,
  resolveDigestRecipient,
  symbolVerdictSchema,
  type DigestEntry,
  type SymbolReviewCandidate,
} from "./helpers";
import { buildSymbolReviewDigestEmail } from "./template";

const DAY_MS = 86_400_000;

// Matches the badge threshold in `server/positions/stale.ts`.
const STALENESS_THRESHOLD_DAYS = 7;
const REVIEW_COOLDOWN_DAYS = 30;

// Sized against the route's maxDuration of 800s, not against the stale pool.
// A backlog beyond the cap drains across subsequent weekly runs.
const MAX_SYMBOLS_PER_RUN = 10;

// Failures write no verdict row, so they never enter the cooldown set and
// re-select first every run. Fetching past the cap gives the loop slack to
// step over a run of them instead of letting them consume the weekly quota
// forever; the quota is enforced on stored verdicts, not on rows fetched.
const CANDIDATE_OVERFETCH = 2;

// Bound the loop from both ends so the run always reaches the digest send
// instead of being killed mid-loop: per-call for a single hung research call,
// per-loop for the accumulated worst case.
const PER_CALL_TIMEOUT_MS = 120_000;
const LOOP_BUDGET_MS = 600_000;

type ServiceClient = SupabaseClient<Database>;

export interface SymbolReviewStats {
  candidates: number;
  reviewed: number;
  failed: number;
  digestsSent: number;
}

export interface SymbolReviewResult {
  success: true;
  message: string;
  skipped?: string;
  stats: SymbolReviewStats;
}

interface RunSymbolReviewOptions {
  supabase?: ServiceClient;
  now?: Date;
  maxSymbols?: number;
}

function createEmptyStats(): SymbolReviewStats {
  return { candidates: 0, reviewed: 0, failed: 0, digestsSent: 0 };
}

/**
 * The feature is opt-in by configuration: AI + email must both be set up.
 * Returns the missing variable names, or null when the run may proceed.
 */
function resolveMissingConfiguration(): string[] {
  return [
    "AI_PROVIDER_API_KEY",
    "RESEND_API_KEY",
    "EMAILS_FROM_ADDRESS",
  ].filter((name) => !process.env[name]?.trim());
}

/**
 * Symbol ids reviewed recently enough to skip. Excluded in the candidate query
 * itself rather than after it: filtering a capped page in JS would keep
 * re-selecting the same already-reviewed rows (still stale, still first by
 * `last_quote_at`) and starve everything behind them.
 */
async function fetchCooldownSymbolIds(
  supabase: ServiceClient,
  now: Date,
): Promise<string[]> {
  const cutoff = new Date(
    now.getTime() - REVIEW_COOLDOWN_DAYS * DAY_MS,
  ).toISOString();

  const { data, error } = await supabase
    .from("symbol_review_verdicts")
    .select("symbol_id")
    .gte("created_at", cutoff);

  if (error) {
    throw new Error(`Failed to load review cooldown: ${stringifyError(error)}`);
  }

  return Array.from(new Set((data ?? []).map((row) => row.symbol_id)));
}

async function fetchCandidates(
  supabase: ServiceClient,
  now: Date,
  maxSymbols: number,
): Promise<{ candidates: SymbolReviewCandidate[]; totalStale: number }> {
  const cooldownSymbolIds = await fetchCooldownSymbolIds(supabase, now);
  const staleCutoff = new Date(
    now.getTime() - STALENESS_THRESHOLD_DAYS * DAY_MS,
  ).toISOString();

  let query = supabase
    .from("symbols")
    .select(
      `
      id,
      exchange,
      long_name,
      short_name,
      currency,
      quote_type,
      last_quote_at,
      positions!inner (
        id
      ),
      symbol_aliases!inner (
        id,
        value
      )
    `,
      { count: "exact" },
    )
    // At least one live position: nobody is holding a symbol nobody holds.
    .is("positions.archived_at", null)
    // Active Yahoo ticker alias only. A symbol whose alias is already retired
    // reads as "unavailable" to users and has nothing left to retire.
    .eq("symbol_aliases.source", "yahoo")
    .eq("symbol_aliases.type", "ticker")
    .is("symbol_aliases.effective_to", null)
    .or(`last_quote_at.is.null,last_quote_at.lt.${staleCutoff}`)
    // A symbol created moments ago whose warm quote fetch failed also has a
    // null last_quote_at; it is new, not stale.
    .lt("created_at", staleCutoff)
    .order("last_quote_at", { ascending: true, nullsFirst: true })
    .limit(maxSymbols * CANDIDATE_OVERFETCH);

  if (cooldownSymbolIds.length) {
    // PostgREST rejects an empty in-list, hence the guard.
    query = query.not("id", "in", `(${cooldownSymbolIds.join(",")})`);
  }

  const { data, error, count } = await query;

  if (error) {
    throw new Error(
      `Failed to load stale symbol candidates: ${stringifyError(error)}`,
    );
  }

  const candidates = (data ?? []).flatMap<SymbolReviewCandidate>((row) => {
    // Active ticker aliases are unique by (source, value), not per symbol, so
    // a symbol can in principle carry two. Skip rather than guess which
    // listing a verdict would be about.
    if (row.symbol_aliases.length !== 1) {
      console.warn(
        `[symbolReview] Skipping symbol ${row.id}: expected 1 active Yahoo ticker alias, found ${row.symbol_aliases.length}`,
      );
      return [];
    }

    const alias = row.symbol_aliases[0];
    const lastQuoteAtMs = row.last_quote_at
      ? Date.parse(row.last_quote_at)
      : Number.NaN;

    return [
      {
        symbolId: row.id,
        aliasId: alias.id,
        aliasValue: alias.value,
        exchange: row.exchange,
        displayName: row.long_name ?? row.short_name,
        currency: row.currency,
        quoteType: row.quote_type,
        lastQuoteAt: row.last_quote_at,
        daysStale: Number.isFinite(lastQuoteAtMs)
          ? Math.floor((now.getTime() - lastQuoteAtMs) / DAY_MS)
          : null,
      },
    ];
  });

  return { candidates, totalStale: count ?? candidates.length };
}

/**
 * Research one symbol and store the verdict. Returns false when nothing was
 * stored: no verdict row means no cooldown, so the symbol is retried next week.
 */
async function reviewCandidate(
  supabase: ServiceClient,
  candidate: SymbolReviewCandidate,
): Promise<boolean> {
  const result = await generateText({
    model: aiModel(extractionModelId),
    ...extractionGenerationOptions,
    tools: { web_search: openaiWebSearchTool() },
    // Every verdict turns on CURRENT listing status, so an answer from prior
    // knowledge is worthless by construction. Force the search.
    toolChoice: { type: "tool", toolName: "web_search" },
    timeout: PER_CALL_TIMEOUT_MS,
    output: Output.object({ schema: symbolVerdictSchema }),
    prompt: buildReviewPrompt(candidate),
  });

  // Throws NoOutputGeneratedError rather than returning undefined when the
  // model produced no structured output; the caller's catch counts it failed.
  const verdict = result.output;

  // Read the pages the search consulted, which the provider asks for via the
  // `web_search_call.action.sources` include. NOT `result.sources`: those are
  // built from url_citation annotations on generated prose, and a structured
  // JSON output has no prose to annotate, so that list is empty here.
  // `dynamic` is the union's discriminant: without excluding the dynamic-tool
  // variant, `toolName` alone leaves the output typed as unknown.
  const searchOutputs = result.toolResults.flatMap((toolResult) =>
    !toolResult.dynamic && toolResult.toolName === "web_search"
      ? [toolResult.output]
      : [],
  );

  // Did a search actually run? `toolChoice` forces it, so this is a cheap
  // assertion; if it fires chronically, that is the signal to split research
  // and structuring into two calls.
  if (!searchOutputs.length) {
    console.warn(
      `[symbolReview] No web_search call for ${candidate.aliasValue}; refusing to store an ungrounded verdict`,
    );
    return false;
  }

  const evidenceUrls = Array.from(
    new Set(
      searchOutputs.flatMap(
        (output) =>
          output.sources
            ?.filter((source) => source.type === "url")
            .map((source) => source.url) ?? [],
      ),
    ),
  );

  if (!evidenceUrls.length) {
    console.warn(
      `[symbolReview] Search ran but reported no sources for ${candidate.aliasValue}; refusing to store a verdict with no evidence`,
    );
    return false;
  }

  const { error } = await supabase.from("symbol_review_verdicts").insert({
    symbol_id: candidate.symbolId,
    alias_id: candidate.aliasId,
    alias_value: candidate.aliasValue,
    verdict: verdict.verdict,
    confidence: verdict.confidence,
    summary: verdict.summary,
    evidence_urls: evidenceUrls,
    // Normalized so the table's CHECK only ever rejects the one unactionable
    // case: a "renamed" verdict that names no successor.
    successor_ticker:
      verdict.verdict === "renamed" ? verdict.successor_ticker : null,
    model: extractionModelId,
  });

  if (error) {
    throw new Error(`Failed to store verdict: ${stringifyError(error)}`);
  }

  return true;
}

/**
 * Email every verdict not yet delivered. Driven by `emailed_at IS NULL` rather
 * than by this run's rows, so verdicts from a run whose send failed ride along
 * in the next digest instead of vanishing behind the cooldown.
 */
async function sendPendingDigest(
  supabase: ServiceClient,
  fromAddress: string,
): Promise<number> {
  const { data, error } = await supabase
    .from("symbol_review_verdicts")
    .select(
      `
      id,
      symbol_id,
      alias_id,
      alias_value,
      verdict,
      confidence,
      summary,
      evidence_urls,
      successor_ticker,
      symbols (
        exchange,
        long_name,
        short_name
      )
    `,
    )
    .is("emailed_at", null)
    .order("created_at", { ascending: true });

  if (error) {
    console.warn("[symbolReview] Failed to load pending verdicts:", error);
    return 0;
  }

  if (!data?.length) return 0;

  const entries = data.map<DigestEntry>((row) => {
    // PostgREST normally returns this to-one join as an object, but preserve
    // the array fallback because that shape has occurred at runtime.
    const symbol = Array.isArray(row.symbols) ? row.symbols[0] : row.symbols;

    return {
      symbolId: row.symbol_id,
      aliasId: row.alias_id,
      aliasValue: row.alias_value,
      displayName: symbol?.long_name ?? symbol?.short_name ?? null,
      exchange: symbol?.exchange ?? null,
      verdict: row.verdict,
      confidence: row.confidence,
      summary: row.summary,
      evidenceUrls: row.evidence_urls,
      successorTicker: row.successor_ticker,
    };
  });

  const { subject, html, text } = await buildSymbolReviewDigestEmail(entries);

  try {
    await createAutomatedEmailSender().sendEmail({
      from: fromAddress,
      to: resolveDigestRecipient(
        process.env.SYMBOL_REVIEW_ALERT_EMAIL,
        fromAddress,
      ),
      subject,
      html,
      text,
    });
  } catch (sendError) {
    // Delivery failure must not fail the run; the rows stay pending.
    console.warn("[symbolReview] Failed to send digest:", sendError);
    return 0;
  }

  const { error: markError } = await supabase
    .from("symbol_review_verdicts")
    .update({ emailed_at: new Date().toISOString() })
    .in(
      "id",
      data.map((row) => row.id),
    );

  if (markError) {
    // Worst case is a duplicate entry in next week's digest.
    console.warn(
      "[symbolReview] Failed to mark verdicts as emailed:",
      markError,
    );
  }

  return 1;
}

export async function runSymbolReview(
  options: RunSymbolReviewOptions = {},
): Promise<SymbolReviewResult> {
  const stats = createEmptyStats();

  const missingConfiguration = resolveMissingConfiguration();
  if (missingConfiguration.length) {
    const skipped = `Not configured: ${missingConfiguration.join(", ")}`;
    console.log(`[symbolReview] ${skipped}`);

    return { success: true, message: "Symbol review skipped", skipped, stats };
  }

  const supabase = options.supabase ?? createServiceClient();
  const now = options.now ?? new Date();
  const maxSymbols = Math.max(
    1,
    Math.trunc(options.maxSymbols ?? MAX_SYMBOLS_PER_RUN),
  );

  const { candidates, totalStale } = await fetchCandidates(
    supabase,
    now,
    maxSymbols,
  );
  stats.candidates = candidates.length;

  if (totalStale > maxSymbols) {
    console.warn(
      `[symbolReview] ${totalStale} stale symbols due but only ${maxSymbols} reviewed this run; backlog drains next week`,
    );
  }

  const startedAt = Date.now();
  for (const [index, candidate] of candidates.entries()) {
    // The overfetched tail is slack for failures, not extra work.
    if (stats.reviewed >= maxSymbols) break;

    if (Date.now() - startedAt > LOOP_BUDGET_MS) {
      console.warn(
        `[symbolReview] Loop budget exhausted; deferring ${candidates.length - index} symbols to next run`,
      );
      break;
    }

    try {
      if (await reviewCandidate(supabase, candidate)) {
        stats.reviewed += 1;
      } else {
        stats.failed += 1;
      }
    } catch (error) {
      stats.failed += 1;
      console.warn(
        `[symbolReview] Review failed for ${candidate.aliasValue}:`,
        error,
      );
    }
  }

  stats.digestsSent = await sendPendingDigest(
    supabase,
    process.env.EMAILS_FROM_ADDRESS!.trim(),
  );

  return { success: true, message: "Symbol review processed", stats };
}
