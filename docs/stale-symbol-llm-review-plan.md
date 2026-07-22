# Weekly LLM Review of Stale Symbols — Plan

Status: draft, under refinement (2026-07-22). Not yet implemented.

## Context

The quote pipeline can detect that a symbol stopped producing data (`symbols.last_quote_at`, stale badge), but it cannot know _why_ — delisted, merged, renamed, thinly traded, or a provider glitch. That judgment currently requires manual research (as done for CFLT/WBIT in the July 2026 remediation). This feature automates the research step with an LLM that does web search, while keeping the _apply_ step human: a weekly cron researches stale symbols, stores structured verdicts in a service-role table, and emails the operator a digest with evidence links and ready-to-run retirement SQL. Nothing is auto-applied.

Decisions already made: table + email digest (no admin UI), weekly cadence, 30-day re-review cooldown for still-stale symbols. Verdicts are operator-scoped, not per-user — users keep the existing stale/unavailable badge and their own change-ticker/archive actions.

## Sequencing

1. Operator creates empty migration (`supabase migration new create_symbol_review_verdicts`). Implementer never runs Supabase CLI.
2. Implementer fills in the migration SQL.
3. Operator applies it locally + regenerates `types/database.types.ts`. (Later steps won't type-check before this.)
4. Implementer writes code + tests; verification is lint/type/test/format only.

## Step 1 — Migration (edit the operator-created file)

Table `public.symbol_review_verdicts`, following the service-role-only template in `supabase/migrations/20260703042511_async_exact_date_quote_repair_queue.sql`:

```sql
BEGIN;

CREATE TABLE IF NOT EXISTS public.symbol_review_verdicts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  symbol_id uuid NOT NULL REFERENCES public.symbols(id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  verdict text NOT NULL,
  confidence text NOT NULL,
  summary text NOT NULL,
  evidence_urls text[] NOT NULL DEFAULT '{}',
  successor_ticker text,
  model text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT symbol_review_verdicts_verdict_check
    CHECK (verdict IN ('retired','renamed','thinly_traded','provider_issue','unknown')),
  CONSTRAINT symbol_review_verdicts_confidence_check
    CHECK (confidence IN ('high','medium','low'))
);

COMMENT ON TABLE public.symbol_review_verdicts IS
  'Immutable LLM research verdicts for stale market symbols; operator applies changes manually.';

CREATE INDEX IF NOT EXISTS idx_symbol_review_verdicts_symbol_created
  ON public.symbol_review_verdicts(symbol_id, created_at DESC);

ALTER TABLE public.symbol_review_verdicts ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  CREATE POLICY "Service role can manage symbol review verdicts"
    ON public.symbol_review_verdicts
    FOR ALL TO service_role USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

REVOKE ALL ON TABLE public.symbol_review_verdicts FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.symbol_review_verdicts TO service_role;

COMMIT;
```

Deliberate deviations from the template: no `updated_at`/trigger (rows are insert-only); `text[]` not jsonb (generates as `string[]` in types, no casts). `ON DELETE CASCADE` means the monthly `symbols_cleanup` pg_cron purges verdicts for orphan symbols for free — desired.

## Step 2 — `server/ai/provider.ts` edit (one export)

```ts
// Provider-executed web search tool (OpenAI Responses API `web_search`).
export const openaiWebSearchTool = () => openAIProvider.tools.webSearch();
```

Verified present in installed `@ai-sdk/openai@4.0.17` (`provider.tools.webSearch`). Reuse `extractionModelId` + `extractionGenerationOptions`; no new model config.

## Step 3 — `server/symbol-review/worker.ts` (new; all logic in one module)

Mirror `server/quotes/repair-worker.ts` style: `"use server"`, `createServiceClient()`, injectable options for tests, stats result `{ candidates, reviewed, failed, emailSent }`.

Constants: `STALENESS_THRESHOLD_DAYS = 7`, `REVIEW_COOLDOWN_DAYS = 30`, `MAX_SYMBOLS_PER_RUN = 25` (hard cap keeps run inside maxDuration; raise/paginate if the stale pool grows).

**Zod schema** (keys required, `.nullable()` per `lib/import/positions/ai-extraction.ts` convention):

```ts
export const symbolVerdictSchema = z.object({
  verdict: z.enum([
    "retired",
    "renamed",
    "thinly_traded",
    "provider_issue",
    "unknown",
  ]),
  confidence: z.enum(["high", "medium", "low"]),
  summary: z.string(),
  evidence_urls: z.array(z.string()),
  successor_ticker: z.string().nullable(),
});
```

**Selection** (two queries; ~1,200 symbols total, expect <20 stale — no keyset pagination):

1. From `symbols`: select `id, ticker, exchange, long_name, short_name, currency, quote_type, last_quote_at` with `positions!inner(id)` filtered `.is("positions.archived_at", null)` (≥1 live position) and `symbol_aliases!inner(id)` filtered `.eq(source,'yahoo').eq(type,'ticker').is(effective_to,null)` (ACTIVE alias — retired-only symbols are already "unavailable", nothing left to retire); `.or("last_quote_at.is.null,last_quote_at.lt.<now-7d>")`; order by `last_quote_at` asc nulls-first; `limit(MAX_SYMBOLS_PER_RUN * 2)` headroom, warn if hit.
2. Cooldown: fetch `symbol_review_verdicts.symbol_id` where `symbol_id IN candidates AND created_at >= now()-30d` → Set. Pure exported helper `filterDueCandidates(candidates, recentlyReviewedIds)` filters, then `.slice(0, MAX_SYMBOLS_PER_RUN)`.

**LLM loop** — sequential `for...of`, per-symbol try/catch, insert each verdict immediately after its call (a timeout only truncates the tail; no verdict row → picked up next week):

```ts
const result = await generateText({
  model: aiModel(extractionModelId),
  ...extractionGenerationOptions,
  tools: { web_search: openaiWebSearchTool() },
  output: Output.object({ schema: symbolVerdictSchema }),
  // prompt from buildReviewPrompt(candidate, daysStale)
});
```

Insert `{ symbol_id, ...result.output, model: extractionModelId }`.

**Prompt** (co-located `buildReviewPrompt`): symbol context (ticker, exchange, name, currency, quote_type, last quote date, days stale) + instructions: research CURRENT listing status via web search; classify per the five verdicts (successor_ticker only for "renamed", pointing at the new Yahoo ticker); cite actually-used URLs (exchange notices/issuer releases/regulator filings over aggregators); "high" confidence only with multiple independent sources; inconclusive → "unknown"/"low"; summary 2–3 sentences with what/when.

**Email digest** — pure helper `buildDigestEmail(verdicts)` producing raw `html`/`text` strings (no react-email; `AutomatedEmailSender.sendEmail` accepts raw html/text):

- Send only if ≥1 verdict inserted this run, via `createAutomatedEmailSender().sendEmail(...)` in try/catch (email failure must not fail the run).
- Recipient `process.env.SYMBOL_REVIEW_ALERT_EMAIL`; if it or `EMAILS_FROM_ADDRESS` unset → log + skip. NOT gated by `AUTOMATED_EMAILS_ENABLED` (that flag gates user-facing emails).
- Subject `Foliofox symbol review: {n} stale symbol(s) reviewed`; grouped retired → renamed → provider_issue → thinly_traded → unknown; each entry: ticker, name, confidence, summary, evidence links.
- HTML-escape all LLM-derived text (local `escapeHtml`) — LLM output into operator email is a trust boundary.
- For each `retired` verdict, a `<pre>` block with guarded SQL (escape `'` in ticker via `replaceAll("'", "''")`):

```sql
-- {TICKER} (symbol_id {id}) — sanity check, expect exactly 1 row:
SELECT id, symbol_id, value, effective_to FROM symbol_aliases
WHERE source = 'yahoo' AND type = 'ticker' AND value = '{TICKER}' AND effective_to IS NULL;
-- Retire:
UPDATE symbol_aliases SET effective_to = now()
WHERE source = 'yahoo' AND type = 'ticker' AND value = '{TICKER}' AND effective_to IS NULL;
```

(Scoping matches the active-alias partial unique index from migration `20260722110857_support_symbol_ticker_reuse.sql` and the Phase 2 retirement pattern.)

## Step 4 — Cron route

`app/api/cron/review-stale-symbols/route.ts`: copy of `app/api/cron/repair-quote-gaps/route.ts` (CRON_SECRET bearer auth, `await connection()`), delegating to `runSymbolReview` from `@/server/symbol-review/worker`, plus `export const maxDuration = 800;` (already used by fetch-quotes, plan supports it).

## Step 5 — Config

- `vercel.json` crons: `{ "path": "/api/cron/review-stale-symbols", "schedule": "0 6 * * 1" }` — Monday 06:00 UTC, well after Sunday's 22:00 UTC quote cron so `last_quote_at` reflects the weekend.
- `.env.example`: `SYMBOL_REVIEW_ALERT_EMAIL=` under the automated-emails block, with comment "unset = skip email, verdicts still stored".
- `content/product-reference.md`: no update — operator-only, nothing user-facing.

## Step 6 — Tests (`server/symbol-review/worker.test.ts`, pure functions only)

1. `symbolVerdictSchema`: valid parse; rejects out-of-enum verdict; rejects missing `successor_ticker` key.
2. `filterDueCandidates`: drops symbols with a verdict inside 30 days, keeps rest, tolerates `last_quote_at: null`.
3. `buildDigestEmail`: retired verdict yields sanity SELECT + guarded UPDATE scoped `source='yahoo' AND type='ticker' AND effective_to IS NULL`; ticker with `'` escaped; non-retired verdicts get no SQL; `<script>` in summary is HTML-escaped.

## Verification

```
npm run lint
npm run type          # after migration applied + types regenerated
npx vitest run server/symbol-review
npm run format:check
```

Post-deploy: trigger the cron manually once with the bearer header, confirm verdict rows + digest email, sanity-check one verdict's evidence by hand.

## Open risks

1. **web_search + `Output.object` in one `generateText`**: tool factory confirmed in installed SDK; the combination is unverified in this repo. If they conflict, fall back to two-step (research call with tools → cheap structuring call with `Output.object`). Only the per-symbol function changes.
2. **Model** `gpt-5.6-luna` must accept the web_search tool; if not, fix is a single model-id const in the worker.
3. **PostgREST double `!inner` embed filter** on `positions` + `symbol_aliases`; if the alias filter misbehaves, fetch alias rows and filter in JS like `server/positions/stale.ts` does.
4. **Runtime**: 25 × slow research calls could approach 800s worst-case; insert-as-you-go means overrun only truncates the tail, retried next week.

## Cut on purpose

No admin UI, no verdict status/ack workflow, no updated_at trigger, no react-email template, no retry queue (weekly rerun retries free), no concurrency, no keyset pagination, no dedicated review model config, no raw-transcript storage, no product-reference update.
