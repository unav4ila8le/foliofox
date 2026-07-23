# Weekly LLM Review of Stale Symbols — Plan

Status: draft, refined (2026-07-22). Not yet implemented.

## Context

The quote pipeline can detect that a symbol stopped producing data (`symbols.last_quote_at`, stale badge), but it cannot know _why_ — delisted, merged, renamed, thinly traded, or a provider glitch. That judgment currently requires manual research (as done for CFLT/WBIT in the July 2026 remediation). This feature automates the research step with an LLM that does web search, while keeping the _apply_ step human: a weekly cron researches stale symbols, stores structured verdicts in a service-role table, and emails the operator a digest with evidence links and ready-to-run retirement SQL. Nothing is auto-applied.

Decisions already made:

- Table + email digest, no admin UI. Foliofox is open source and self-hosted; every instance has its own operator, and env-var + email fits that better than an admin view.
- No dedicated feature flag or new required env var. The feature enables itself when `AI_PROVIDER_API_KEY`, `RESEND_API_KEY`, and `EMAILS_FROM_ADDRESS` are all set (all pre-existing vars); otherwise the worker exits early with a logged skip reason — no LLM calls, no rows, no noise for self-hosters who haven't configured AI or email.
- Digest recipient defaults to the mailbox inside `EMAILS_FROM_ADDRESS`; optional `SYMBOL_REVIEW_ALERT_EMAIL` overrides it for operators whose from-address isn't a real inbox.
- Weekly cadence, 30-day re-review cooldown for still-stale symbols.
- Verdicts are operator-scoped, not per-user — users keep the existing stale/unavailable badge and their own change-ticker/archive actions.
- Digest is built from verdict rows where `emailed_at IS NULL`, not from the in-memory run, and is flushed both before and after the LLM loop — so verdicts inserted by a truncated or email-failed run are picked up by the next run's opening flush instead of silently vanishing behind the cooldown.

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
  emailed_at timestamptz,
  CONSTRAINT symbol_review_verdicts_verdict_check
    CHECK (verdict IN ('retired','renamed','thinly_traded','provider_issue','unknown')),
  CONSTRAINT symbol_review_verdicts_confidence_check
    CHECK (confidence IN ('high','medium','low'))
);

COMMENT ON TABLE public.symbol_review_verdicts IS
  'LLM research verdicts for stale market symbols; operator applies changes manually. Rows are immutable except emailed_at (digest delivery bookkeeping).';

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

Deliberate deviations from the template: no `updated_at`/trigger (`emailed_at` is the only mutable field, set once); `text[]` not jsonb (generates as `string[]` in types, no casts). `ON DELETE CASCADE` means the monthly `symbols_cleanup` pg_cron purges verdicts for orphan symbols for free — desired.

`emailed_at IS NULL` rows are the pending-digest set; no partial index needed at this table's scale (tens of rows).

## Step 2 — `server/ai/provider.ts` edit (one export)

```ts
// Provider-executed web search tool (OpenAI Responses API `web_search`).
export const openaiWebSearchTool = () => openAIProvider.tools.webSearch();
```

Verified present in installed `@ai-sdk/openai@4.0.17` (`provider.tools.webSearch`) and in the AI SDK provider docs: it is a provider-executed tool on the Responses API (the provider's default API) — the model decides when to search, OpenAI's servers run the search, and consulted URLs come back on `result.sources` (`{ type: 'url', url }[]`). Supported on gpt-5-class Responses models; no documented restriction against combining it with structured outputs. Optional knobs (`searchContextSize`, `userLocation`, `filters.allowedDomains`) — defaults are fine, don't set any. Reuse `extractionModelId` + `extractionGenerationOptions`; no new model config.

Note: this export is inert for the AI chat advisor. The advisor's toolset is the explicit `aiTools` registry in `server/ai/tools/index.ts` (wired through the tool-call guard and system prompt in `app/api/ai/chat/route.ts`); nothing outside that registry is callable. Giving the advisor web search is a separate feature — see "Cut on purpose".

## Step 3 — `server/symbol-review/worker.ts` (new; all logic in one module)

Mirror `server/quotes/repair-worker.ts` style: `"use server"`, `createServiceClient()`, injectable options for tests, stats result `{ candidates, reviewed, failed, digestsSent }` — `failed` includes ungrounded results (see grounding guard below) — plus a `skipped: reason` short-circuit result when the feature is not configured.

**Enablement gate** (first thing in the run): require `AI_PROVIDER_API_KEY`, `RESEND_API_KEY`, and `EMAILS_FROM_ADDRESS` to be non-empty; if any is missing, log the reason and return `{ skipped }` — no queries, no LLM calls, no rows. This is the whole opt-in story for self-hosters: configure AI + email and the feature is on; don't and it's inert.

Recipient: pure helper `resolveDigestRecipient(alertEmail, fromAddress)` — returns `SYMBOL_REVIEW_ALERT_EMAIL` if set, else the addr-spec inside `EMAILS_FROM_ADDRESS` (`/<([^>]+)>/` match, else the trimmed whole value).

Constants:

- `STALENESS_THRESHOLD_DAYS = 7` (matches `server/positions/stale.ts`).
- `REVIEW_COOLDOWN_DAYS = 30`.
- `MAX_SYMBOLS_PER_RUN = 10` — derived from the runtime budget, not from the current stale-pool size: ~60–90s per web-search research call against `maxDuration = 800` puts 10 sequential calls at ~600–900s worst-case. Any backlog beyond the cap drains across subsequent weekly runs (log when the cap is hit so the operator can see a backlog forming).

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

**Selection** (two queries; ~1,200 symbols total, expect <20 stale — no keyset pagination). The cooldown is excluded DB-side, *before* the row cap: filtering a capped page in JS would keep returning the same already-reviewed rows (still stale, still first by `last_quote_at`) and starve everything past the first page until their cooldown expired.

1. Cooldown set: fetch `symbol_review_verdicts.symbol_id` where `created_at >= now()-30d` → Set. Bounded by review throughput (≤ ~45 ids at 10/week), so no pagination.
2. From `symbols`: select `id, ticker, exchange, long_name, short_name, currency, quote_type, last_quote_at` with `positions!inner(id)` filtered `.is("positions.archived_at", null)` (≥1 live position) and `symbol_aliases!inner(id)` filtered `.eq(source,'yahoo').eq(type,'ticker').is(effective_to,null)` (ACTIVE alias — retired-only symbols are already "unavailable", nothing left to retire); `.or("last_quote_at.is.null,last_quote_at.lt.<now-7d>")`; `.lt("created_at", <now-7d>)` (a just-created symbol whose warm quote fetch failed still has `last_quote_at: null` — don't research it as "stale"); `.not("id", "in", <cooldown set>)` only when the set is non-empty (PostgREST rejects an empty in-list); order by `last_quote_at` asc nulls-first; `{ count: "exact" }` + `limit(MAX_SYMBOLS_PER_RUN)`, and log a backlog warning when `count` exceeds the cap.

**LLM loop** — sequential `for...of`, per-symbol try/catch, insert each verdict immediately after its call (a timeout only truncates the tail; no verdict row → picked up next week; inserted-but-unemailed rows ride along in the next successful digest via `emailed_at IS NULL`):

```ts
const result = await generateText({
  model: aiModel(extractionModelId),
  ...extractionGenerationOptions,
  tools: { web_search: openaiWebSearchTool() },
  output: Output.object({ schema: symbolVerdictSchema }),
  // prompt from buildReviewPrompt(candidate, daysStale)
});
```

Grounding guard: if `result.sources` is empty, the model answered from prior knowledge without actually searching — skip the insert, count the symbol as `failed`, and log it (no verdict row → retried next week). Every verdict here hinges on *current* listing status, so an unsearched answer with plausible-looking evidence URLs must never reach the digest. If the smoke test shows this happening chronically, escalate to forcing the tool via `toolChoice` or the two-step fallback from risk 1.

Insert `{ symbol_id, ...result.output, model: extractionModelId }` (`emailed_at` stays null until a digest includes it). If the model returns an empty `evidence_urls`, fall back to `result.sources` URLs (provider-reported list of consulted pages) so the digest always carries evidence links.

**Prompt** (co-located `buildReviewPrompt`): symbol context (ticker, exchange, name, currency, quote_type, last quote date, days stale) + instructions: research CURRENT listing status via web search; classify per the five verdicts (successor_ticker only for "renamed", pointing at the new Yahoo ticker); ticker reuse — the ticker now trades as a DIFFERENT security — is "retired" for the old security, with the reuse noted in the summary (retiring the alias is the same action, and the new security gets its own canonical symbol when a user adds it); cite actually-used URLs (exchange notices/issuer releases/regulator filings over aggregators); "high" confidence only with multiple independent sources; inconclusive → "unknown"/"low"; summary 2–3 sentences with what/when.

**Email digest** — helper `sendPendingDigest(supabase)`: query `symbol_review_verdicts` where `emailed_at IS NULL` with embedded `symbols(ticker, exchange, long_name, short_name)`, build, send, mark. Called **twice** per run: once at the start — before the LLM loop burns the time budget, so verdicts left behind by a previous truncated/email-failed run reach the operator even if this run is also killed at `maxDuration` — and once after the loop for this run's verdicts. Pure helper `buildDigestEmail(rows)` producing raw `html`/`text` strings (no react-email; `AutomatedEmailSender.sendEmail` accepts raw html/text):

- Send only if ≥1 pending verdict, via `createAutomatedEmailSender().sendEmail(...)` in try/catch (email failure must not fail the run; the factory itself throws on missing `RESEND_API_KEY`, but the gate already guarantees it).
- On successful send, update the included rows to `emailed_at = now()`. If that update fails the worst case is duplicate digest entries next week — acceptable.
- NOT gated by `AUTOMATED_EMAILS_ENABLED` (that flag gates user-facing emails; this is operator mail).
- Subject `Foliofox symbol review: {n} stale symbol(s) reviewed`; grouped retired → renamed → provider_issue → thinly_traded → unknown; each entry: ticker, name, confidence, summary, evidence links.
- HTML-escape all LLM-derived text (local `escapeHtml`) — LLM output into operator email is a trust boundary.
- `renamed` entries: show the successor ticker and point at `docs/SYMBOL-RENAME-HANDLING.md` for the apply playbook (no SQL — renames are multi-step and user-visible, unlike retirement).
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
- `.env.example`: under the automated-emails block, a commented-out `# SYMBOL_REVIEW_ALERT_EMAIL=` with comment "optional override for the weekly symbol-review digest recipient (defaults to the EMAILS_FROM_ADDRESS mailbox); the review runs whenever AI + Resend + from-address are configured". No new required vars.
- `content/product-reference.md`: no update — operator-only, nothing user-facing.

## Step 6 — Tests (`server/symbol-review/worker.test.ts`, pure functions only)

1. `symbolVerdictSchema`: valid parse; rejects out-of-enum verdict; rejects missing `successor_ticker` key.
2. `resolveDigestRecipient`: override wins; `"Name <a@b.c>"` → `a@b.c`; bare address passes through.
3. `buildDigestEmail`: retired verdict yields sanity SELECT + guarded UPDATE scoped `source='yahoo' AND type='ticker' AND effective_to IS NULL`; ticker with `'` escaped; renamed verdict references `SYMBOL-RENAME-HANDLING.md` and gets no SQL; other non-retired verdicts get no SQL; `<script>` in summary is HTML-escaped.

(No `filterDueCandidates` test — the cooldown moved into the selection query, there is no pure filtering helper left.)

## Verification

```
npm run lint
npm run type          # after migration applied + types regenerated
npx vitest run server/symbol-review
npm run format:check
```

Post-deploy: trigger the cron manually once with the bearer header, confirm verdict rows + digest email, sanity-check one verdict's evidence by hand.

## Open risks

1. **web_search + `Output.object` in one `generateText`**: docs show no restriction on the combination for gpt-5-class Responses models, but there are community reports of broken/truncated JSON when the older `web_search_preview` tool mixed with structured outputs — so treat it as unproven until the post-deploy smoke test. If it misbehaves, fall back to two-step (research call with tools → cheap structuring call with `Output.object`). Only the per-symbol function changes.
2. **Model** `gpt-5.6-luna` must accept the web_search tool; if not, fix is a single model-id const in the worker.
3. **PostgREST double `!inner` embed filter** on `positions` + `symbol_aliases`; if the alias filter misbehaves, fetch alias rows and filter in JS like `server/positions/stale.ts` does.
4. **Runtime**: 10 × slow research calls can still brush 800s worst-case; insert-as-you-go plus the `emailed_at IS NULL` digest sweep means an overrun truncates the tail without losing anything — remaining symbols retried next week, and the pre-loop digest flush emails leftover verdicts even if consecutive runs keep getting killed.
5. **From-address fallback recipient**: if `EMAILS_FROM_ADDRESS` isn't a real inbox and no override is set, digests silently go nowhere. Accepted: the feature is advisory, and the `.env.example` comment documents the override.

## Cut on purpose

No admin UI, no feature-flag env var, no verdict status/ack workflow (`emailed_at` is delivery bookkeeping, not acknowledgement), no `updated_at` trigger, no react-email template, no retry queue (weekly rerun retries free), no concurrency, no keyset pagination, no dedicated review model config, no raw-transcript storage, no product-reference update.

**No web search for the AI chat advisor** (deliberate, possible follow-up). The advisor stays grounded in the portfolio tools it already has; giving it `webSearch` would let it answer from arbitrary online data instead of the user's own positions, which needs its own design pass: system-prompt guidelines on when web data is allowed (e.g. current-events context only, never as a substitute for portfolio tools), a call budget in the tool-call guard, source attribution in the chat UI, and a `content/product-reference.md` update. None of that belongs in this operator-only feature; the worker calls the tool factory directly and the advisor's registry is untouched.
