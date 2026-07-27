import { z } from "zod";

// Ordered as the digest groups them (most to least actionable), so one array
// feeds both the schema enum and the email layout. These are CHECK constraint
// values, not a PG enum, so they are not in `types/enums.ts`.
export const SYMBOL_REVIEW_VERDICTS = [
  "retired",
  "renamed",
  "provider_issue",
  "thinly_traded",
  "unknown",
] as const;

export const SYMBOL_REVIEW_CONFIDENCES = ["high", "medium", "low"] as const;

export type SymbolReviewVerdict = (typeof SYMBOL_REVIEW_VERDICTS)[number];

// Keys stay required with nullable values, per the strict JSON-schema response
// format convention in `lib/import/positions/ai-extraction.ts`. No URL field:
// evidence is taken from the `web_search` tool result's consulted-source list
// (see `worker.ts`), which cannot be fabricated the way a model-authored link
// list can. Not `result.sources` — see the warning in `server/ai/provider.ts`.
export const symbolVerdictSchema = z.object({
  verdict: z.enum(SYMBOL_REVIEW_VERDICTS),
  confidence: z.enum(SYMBOL_REVIEW_CONFIDENCES),
  summary: z.string(),
  successor_ticker: z.string().nullable(),
});

export interface SymbolReviewCandidate {
  symbolId: string;
  aliasId: string;
  aliasValue: string;
  exchange: string | null;
  displayName: string | null;
  currency: string;
  quoteType: string;
  lastQuoteAt: string | null;
  daysStale: number | null;
}

export interface DigestEntry {
  symbolId: string;
  aliasId: string;
  aliasValue: string;
  displayName: string | null;
  exchange: string | null;
  verdict: string;
  confidence: string;
  summary: string;
  evidenceUrls: string[];
  successorTicker: string | null;
}

export const VERDICT_HEADINGS: Record<string, string> = {
  retired: "Retired / delisted",
  renamed: "Renamed",
  provider_issue: "Provider issue",
  thinly_traded: "Thinly traded",
  unknown: "Inconclusive",
};

/**
 * Digest recipient: the explicit override, else the addr-spec inside
 * `EMAILS_FROM_ADDRESS` (which is usually `"Name <mailbox@domain>"`).
 */
export function resolveDigestRecipient(
  alertEmail: string | undefined,
  fromAddress: string,
): string {
  const override = alertEmail?.trim();
  if (override) return override;

  const angleAddress = fromAddress.match(/<([^>]+)>/);
  return (angleAddress ? angleAddress[1] : fromAddress).trim();
}

export function buildReviewPrompt(candidate: SymbolReviewCandidate): string {
  const lastQuote = candidate.lastQuoteAt
    ? `${candidate.lastQuoteAt} (${candidate.daysStale} days ago)`
    : "never";

  return `A market data symbol has stopped returning quotes. Research why, using web search.

Symbol under review:
- Yahoo Finance ticker: ${candidate.aliasValue}
- Exchange: ${candidate.exchange ?? "unknown"}
- Name: ${candidate.displayName ?? "unknown"}
- Currency: ${candidate.currency}
- Instrument type: ${candidate.quoteType}
- Last successful quote: ${lastQuote}

Search the web for this security's CURRENT listing status, then classify:
- "retired" — delisted, liquidated, acquired, or otherwise no longer trading under this ticker as this security. This also covers ticker reuse: if the ticker now trades as a DIFFERENT security, the original one is retired; say so in the summary.
- "renamed" — the same security still trades under a different ticker. Set successor_ticker to the new Yahoo Finance ticker. Only this verdict may set successor_ticker.
- "provider_issue" — the security still trades normally and Yahoo Finance is at fault.
- "thinly_traded" — still listed, but genuinely trades so rarely that gaps are expected.
- "unknown" — the research was inconclusive.

Rules:
- Prefer exchange notices, issuer press releases, and regulator filings over aggregator sites.
- Use "high" confidence only when multiple independent sources agree; when in doubt use "unknown" with "low".
- Write summary as 2-3 sentences covering what happened and when.`;
}

/**
 * Copy-pasteable retirement SQL, scoped by alias id and never by ticker value:
 * a freed ticker can be re-registered to a different security between research
 * and apply, and a value-scoped UPDATE would then retire the new one's alias.
 * `effective_to IS NULL` keeps it idempotent — a zero-row sanity SELECT means
 * the alias is already retired.
 */
export function buildRetirementSql(entry: DigestEntry): string {
  return `-- ${entry.aliasValue} (symbol ${entry.symbolId}) — sanity check, expect exactly 1 row:
SELECT id, symbol_id, value, effective_to FROM symbol_aliases
WHERE id = '${entry.aliasId}' AND effective_to IS NULL;

-- Retire:
UPDATE symbol_aliases SET effective_to = now()
WHERE id = '${entry.aliasId}' AND effective_to IS NULL;`;
}

/**
 * Group entries for the digest, most actionable verdict first.
 */
export function groupDigestEntries(entries: DigestEntry[]) {
  return SYMBOL_REVIEW_VERDICTS.map((verdict) => ({
    verdict,
    heading: VERDICT_HEADINGS[verdict],
    entries: entries.filter((entry) => entry.verdict === verdict),
  })).filter((group) => group.entries.length > 0);
}

export function buildDigestSubject(entries: DigestEntry[]): string {
  return `Foliofox symbol review: ${entries.length} stale symbol${
    entries.length === 1 ? "" : "s"
  } reviewed`;
}
