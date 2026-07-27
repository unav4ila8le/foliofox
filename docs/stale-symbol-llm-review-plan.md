# Weekly LLM Review of Stale Symbols — Plan

Status: implemented (2026-07-27), pending the post-deploy smoke test below.

## Context

The quote pipeline can detect that a symbol stopped producing data (`symbols.last_quote_at`, stale badge), but it cannot know _why_ — delisted, merged, renamed, thinly traded, or a provider glitch. That judgment currently requires manual research (as done for CFLT/WBIT in the July 2026 remediation). This feature automates the research step with an LLM that does web search, while keeping the _apply_ step human: a weekly cron researches stale symbols, stores structured verdicts in a service-role table, and emails the operator a digest with evidence links and ready-to-run retirement SQL. Nothing is auto-applied.

Decisions already made:

- Table + email digest, no admin UI. Foliofox is open source and self-hosted; every instance has its own operator, and env-var + email fits that better than an admin view.
- No dedicated feature flag or new required env var. The feature enables itself when `AI_PROVIDER_API_KEY`, `RESEND_API_KEY`, and `EMAILS_FROM_ADDRESS` are all set (all pre-existing vars); otherwise the worker exits early with a logged skip reason — no LLM calls, no rows, no noise for self-hosters who haven't configured AI or email.
- Digest recipient defaults to the mailbox inside `EMAILS_FROM_ADDRESS`; optional `SYMBOL_REVIEW_ALERT_EMAIL` overrides it for operators whose from-address isn't a real inbox.
- Weekly cadence, 30-day re-review cooldown for still-stale symbols.
- Verdicts are operator-scoped, not per-user — users keep the existing stale/unavailable badge and their own change-ticker/archive actions.
- Digest is built from verdict rows where `emailed_at IS NULL`, not from the in-memory run, so verdicts inserted by an email-failed run ride along in the next run's digest instead of silently vanishing behind the cooldown. Sent once, after the loop — the per-call and per-loop time bounds are what make a single send sufficient.
- Verdicts are keyed to the **active Yahoo ticker alias**, not to `symbols.ticker`: that is what the quote pipeline reads, and it is the thing the operator retires.

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
  alias_id uuid NOT NULL REFERENCES public.symbol_aliases(id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  alias_value text NOT NULL,
  verdict text NOT NULL,
  confidence text NOT NULL,
  summary text NOT NULL,
  evidence_urls text[] NOT NULL,
  successor_ticker text,
  model text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  emailed_at timestamptz,
  CONSTRAINT symbol_review_verdicts_verdict_check
    CHECK (verdict IN ('retired','renamed','thinly_traded','provider_issue','unknown')),
  CONSTRAINT symbol_review_verdicts_confidence_check
    CHECK (confidence IN ('high','medium','low')),
  CONSTRAINT symbol_review_verdicts_evidence_urls_check
    CHECK (cardinality(evidence_urls) > 0),
  CONSTRAINT symbol_review_verdicts_successor_ticker_check
    CHECK (
      CASE
        WHEN verdict = 'renamed'
          THEN successor_ticker IS NOT NULL AND btrim(successor_ticker) <> ''
        ELSE successor_ticker IS NULL
      END
    )
);

COMMENT ON TABLE public.symbol_review_verdicts IS
  'LLM research verdicts for stale market symbols; operator applies changes manually. Rows are immutable except emailed_at (digest delivery bookkeeping).';

COMMENT ON COLUMN public.symbol_review_verdicts.alias_id IS
  'The active Yahoo ticker alias the verdict is about; the digest scopes its retirement SQL by this id, never by ticker value (tickers are reusable).';

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

Deliberate deviations from the template: no `updated_at`/trigger (`emailed_at` is the only mutable field, set once); `text[]` not jsonb (generates as `string[]` in types, no casts). `ON DELETE CASCADE` means the monthly `symbols_cleanup` pg_cron purges verdicts for orphan symbols for free — desired. `alias_value` is a point-in-time snapshot for the digest label; `alias_id` is what the SQL keys on.

`evidence_urls` deliberately has no `DEFAULT '{}'`: the empty default would let a future insert path omit the field and store an ungrounded verdict that reaches the operator looking exactly like a researched one. Dropping the default plus `cardinality(...) > 0` makes groundedness a table invariant instead of a property of the worker's guard, and makes the column required in the generated `Insert` type.

No index on `alias_id`: nothing queries by it (it is payload for the digest's SQL), and the only reader is cascade resolution over a table of tens of rows. Supabase's advisor flags unindexed FKs, but it also flags unused indexes, so adding one trades one INFO lint for another.

`emailed_at IS NULL` rows are the pending-digest set; no partial index needed at this table's scale (tens of rows).

## Step 2 — `server/ai/provider.ts` edit (one export)

```ts
// Provider-executed web search tool (OpenAI Responses API `web_search`).
export const openaiWebSearchTool = () => openAIProvider.tools.webSearch();
```

Verified present in installed `@ai-sdk/openai@4.0.20` (`provider.tools.webSearch`) and in that package's bundled docs (`docs/03-openai.mdx`): it is a provider-executed tool on the Responses API (the provider's default API), OpenAI's servers run the search inside the same API call (so one `generateText` step, no tool round-trip). **Do not read `result.sources` for evidence, despite those bundled docs presenting it as the direct accessor.** Verified in the installed provider: those `Source` entries are emitted only from `url_citation` annotations on generated prose, and a structured JSON output has no prose to annotate — so with `Output.object` that list is empty on every call, and a grounding guard built on it would reject every verdict while all tests pass. The consulted-pages list lives on the `web_search` tool result (`toolResults[].output.sources`, elements `{ type: 'url', url }`), which the provider requests via an explicit `web_search_call.action.sources` include. Narrow with `!toolResult.dynamic && toolResult.toolName === "web_search"`: `dynamic` is the discriminant of the `TypedToolResult` union, and `toolName` alone leaves the output typed `unknown`. The same docs show `toolChoice: { type: 'tool', toolName: 'web_search' }` as the supported way to force the search. Optional knobs (`searchContextSize`, `userLocation`, `filters.allowedDomains`) — defaults are fine, don't set any. Reuse `extractionModelId` + `extractionGenerationOptions`; no new model config.

Note: this export is inert for the AI chat advisor. The advisor's toolset is the explicit `aiTools` registry in `server/ai/tools/index.ts` (wired through the tool-call guard and system prompt in `app/api/ai/chat/route.ts`); nothing outside that registry is callable. Giving the advisor web search is a separate feature — see "Cut on purpose".

## Step 3 — `server/symbol-review/` (two modules)

**Module split is mandatory, not stylistic.** Next 16's `next-flight-loader/action-validate` rejects any non-async export from a `"use server"` file, so the Zod schema and the sync helpers cannot live in the worker (every `export const` in this repo's `"use server"` files is a `cache(async …)`). Layout:

- `server/symbol-review/helpers.ts` — no directive: `symbolVerdictSchema`, `buildReviewPrompt`, `resolveDigestRecipient`, `buildRetirementSql`, `groupDigestEntries`, `buildDigestSubject`, and the verdict/confidence literal arrays. Precedent: `lib/import/positions/ai-extraction.ts` holds its schema in a plain module.
- `server/symbol-review/template.tsx` — `"use server"`, one async export `buildSymbolReviewDigestEmail`. Mirrors `server/automated-emails/templates.tsx`.
- `emails/symbol-review-digest.tsx` — the template itself, default export + `.PreviewProps` from `emails/_preview-data.ts`, same as `emails/weekly-recap.tsx`.
- `server/symbol-review/worker.ts` — `"use server"`, exports only `runSymbolReview`.

Verdict/confidence literals live once in `helpers.ts` as `as const` arrays feeding both `z.enum` and the digest grouping order (they are CHECK constraints, not PG enums, so `types/enums.ts` and `Constants` don't apply).

Worker mirrors `server/quotes/repair-worker.ts` style: `createServiceClient()`, injectable options for tests, stats result `{ candidates, reviewed, failed, digestsSent }` — `failed` includes ungrounded and empty-output results (see guards below) — plus a `skipped: reason` short-circuit result when the feature is not configured.

**Enablement gate** (first thing in the run): require `AI_PROVIDER_API_KEY`, `RESEND_API_KEY`, and `EMAILS_FROM_ADDRESS` to be non-empty; if any is missing, log the reason and return `{ skipped }` — no queries, no LLM calls, no rows. This is the whole opt-in story for self-hosters: configure AI + email and the feature is on; don't and it's inert.

Recipient: pure helper `resolveDigestRecipient(alertEmail, fromAddress)` — returns `SYMBOL_REVIEW_ALERT_EMAIL` if set, else the addr-spec inside `EMAILS_FROM_ADDRESS` (`/<([^>]+)>/` match, else the trimmed whole value).

Constants:

- `STALENESS_THRESHOLD_DAYS = 7` (matches `server/positions/stale.ts`).
- `REVIEW_COOLDOWN_DAYS = 30`.
- `MAX_SYMBOLS_PER_RUN = 10` — derived from the runtime budget, not from the current stale-pool size: ~60–90s per web-search research call against `maxDuration = 800` puts 10 sequential calls at ~600–900s worst-case. Any backlog beyond the cap drains across subsequent weekly runs (log when the cap is hit so the operator can see a backlog forming).
- `PER_CALL_TIMEOUT_MS = 120_000`, `LOOP_BUDGET_MS = 600_000` — the cap alone can overrun `maxDuration`, so bound it from both ends: pass `timeout: PER_CALL_TIMEOUT_MS` to `generateText` (supported in `ai@7`) and `break` the loop once elapsed exceeds `LOOP_BUDGET_MS`. Together these guarantee the run reaches the digest send instead of being killed mid-loop, which is what lets the digest be sent once (see below).

**Zod schema** (keys required, `.nullable()` per `lib/import/positions/ai-extraction.ts` convention):

```ts
export const SYMBOL_REVIEW_VERDICTS = [
  "retired",
  "renamed",
  "thinly_traded",
  "provider_issue",
  "unknown",
] as const;
export const SYMBOL_REVIEW_CONFIDENCES = ["high", "medium", "low"] as const;

export const symbolVerdictSchema = z.object({
  verdict: z.enum(SYMBOL_REVIEW_VERDICTS),
  confidence: z.enum(SYMBOL_REVIEW_CONFIDENCES),
  summary: z.string(),
  successor_ticker: z.string().nullable(),
});
```

No model-authored `evidence_urls` field: evidence comes from the `web_search` tool result's consulted-source list, which OpenAI reports for the searches it actually ran. A model-authored URL list can be fabricated, and a fabricated link under a "high confidence, 3 sources" heading is exactly the thing an operator would trust. Provider-reported sources cost one less schema field, one less fallback branch, and no URL-scheme validation (HTML-escaping does not neuter a `javascript:` href, so model-authored links would have required an explicit `https:`-only filter).

**Selection** (two queries; ~1,200 symbols total, expect <20 stale — no keyset pagination). The cooldown is excluded DB-side, _before_ the row cap: filtering a capped page in JS would keep returning the same already-reviewed rows (still stale, still first by `last_quote_at`) and starve everything past the first page until their cooldown expired.

1. Cooldown set: fetch `symbol_review_verdicts.symbol_id` where `created_at >= now()-30d` → Set. Bounded by review throughput (≤ ~45 ids at 10/week), so no pagination.
2. From `symbols`: select `id, ticker, exchange, long_name, short_name, currency, quote_type, last_quote_at` plus the embeds `positions!inner(id)` and `symbol_aliases!inner(id, value)`. Embedded filters must be written resource-qualified: `.is("positions.archived_at", null)` (≥1 live position), and `.eq("symbol_aliases.source", "yahoo").eq("symbol_aliases.type", "ticker").is("symbol_aliases.effective_to", null)` (ACTIVE alias — retired-only symbols are already "unavailable", nothing left to retire). Then `.or("last_quote_at.is.null,last_quote_at.lt.<now-7d>")`; `.lt("created_at", <now-7d>)` (a just-created symbol whose warm quote fetch failed still has `last_quote_at: null` — don't research it as "stale"); `.not("id", "in", <cooldown set>)` only when the set is non-empty (PostgREST rejects an empty in-list); order by `last_quote_at` asc nulls-first; `{ count: "exact" }` + `limit(MAX_SYMBOLS_PER_RUN * CANDIDATE_OVERFETCH)` (`count` ignores `limit`, so the backlog warning is unaffected), and log a backlog warning when `count` exceeds the cap. The cap itself is enforced in the loop, on stored verdicts rather than on fetched rows — see risk 6.

**The alias — not `symbols.ticker` — is the research and apply target.** `docs/SYMBOL-RENAME-HANDLING.md` §5 is explicit that `symbols.ticker` is display metadata and never decides which canonical symbol owns a current ticker; the quote cron reads `alias.value` (`server/symbols/fetch.ts`). Carry `{ aliasId, aliasValue }` per candidate: research `aliasValue`, and scope the retirement SQL by `aliasId`. Since the active-ticker unique index is `(source, value)` and not per-symbol, a symbol can in principle carry two active Yahoo ticker aliases — if the embed returns anything other than exactly one, log and skip that symbol rather than guessing which listing the verdict is about. `symbols.ticker` is still fetched, for the digest's human-readable label only.

**LLM loop** — sequential `for...of`, per-symbol try/catch, insert each verdict immediately after its call (a timeout only truncates the tail; no verdict row → picked up next week; inserted-but-unemailed rows ride along in the next successful digest via `emailed_at IS NULL`):

```ts
const result = await generateText({
  model: aiModel(extractionModelId),
  ...extractionGenerationOptions,
  tools: { web_search: openaiWebSearchTool() },
  toolChoice: { type: "tool", toolName: "web_search" },
  timeout: PER_CALL_TIMEOUT_MS,
  output: Output.object({ schema: symbolVerdictSchema }),
  // prompt from buildReviewPrompt(candidate, daysStale)
});
```

`toolChoice` forces the search from the start rather than after a smoke test: every verdict here hinges on _current_ listing status, so a prior-knowledge answer is worthless by construction, and the provider docs list forcing as the supported way to require it.

Two guards, both counting the symbol as `failed` and skipping the insert (no verdict row → no cooldown → retried next week):

- **Search ran**: no `web_search` tool result means no search happened despite `toolChoice`. Cheap assertion once the tool is forced; if it fires chronically, take the two-step fallback from risk 1.
- **Evidence present**: the search ran but reported no URL sources. Distinct log message from the above, so the smoke test can tell the two apart.

Not a guard: `result.output`. In `ai@7` it is a getter that throws `NoOutputGeneratedError` rather than returning undefined, so `if (!result.output)` is unreachable — read it once into a local and let the per-symbol catch count it as `failed`. (The check in `app/api/ai/extract-positions/route.ts` is dead code for the same reason.)

Insert `{ symbol_id, alias_id, alias_value, ...result.output, evidence_urls, model: extractionModelId }`, where `evidence_urls` is the de-duplicated URL list from the `web_search` tool result (`emailed_at` stays null until a digest includes it).

Normalize `successor_ticker` to `null` whenever `verdict !== "renamed"` before inserting — the migration's `symbol_review_verdicts_successor_ticker_check` enforces that shape, and normalizing means the constraint only ever fires on the one case worth failing: a `renamed` verdict with no successor, which the digest cannot render into anything actionable. That insert error lands in the per-symbol try/catch → `failed` → retried next week.

**Prompt** (`buildReviewPrompt` in `helpers.ts`): symbol context (the active Yahoo alias value, exchange, name, currency, quote_type, last quote date, days stale) + instructions: research CURRENT listing status via web search; classify per the five verdicts (successor_ticker only for "renamed", pointing at the new Yahoo ticker); ticker reuse — the ticker now trades as a DIFFERENT security — is "retired" for the old security, with the reuse noted in the summary (retiring the alias is the same action, and the new security gets its own canonical symbol when a user adds it); prefer exchange notices/issuer releases/regulator filings over aggregators; "high" confidence only when multiple independent sources agree; inconclusive → "unknown"/"low"; summary 2–3 sentences with what/when. The prompt asks for no URL list — evidence is taken from the search tool result.

**Email digest** — helper `sendPendingDigest(supabase)`: query `symbol_review_verdicts` where `emailed_at IS NULL` with embedded `symbols(ticker, exchange, long_name, short_name)`, build, send, mark. Called **once**, after the loop. The earlier draft also flushed before the loop, to cover a run killed at `maxDuration` before it could send; `PER_CALL_TIMEOUT_MS` + `LOOP_BUDGET_MS` remove that failure mode at the source, so the second call is redundant (and would send two separate emails in any run that had leftovers). The `emailed_at IS NULL` query — not the in-memory run — remains the safety net: verdicts from a run whose send failed ride along in the next run's digest. Rendered by `server/symbol-review/template.tsx` via react-email, mirroring `server/automated-emails/templates.tsx` (`render(template)` + `render(template, { plainText: true })`), so the digest appears in `npm run email:dev` alongside the other two templates and inherits the shared palette and layout. Supersedes the earlier "no react-email template" cut: JSX auto-escaping replaces a hand-rolled `escapeHtml` at a real trust boundary, and `plainText` rendering replaces a hand-built text branch.

- Send only if ≥1 pending verdict, via `createAutomatedEmailSender().sendEmail(...)` in try/catch (email failure must not fail the run; the factory itself throws on missing `RESEND_API_KEY`, but the gate already guarantees it).
- On successful send, update the included rows to `emailed_at = now()`. If that update fails the worst case is duplicate digest entries next week — acceptable.
- NOT gated by `AUTOMATED_EMAILS_ENABLED` (that flag gates user-facing emails; this is operator mail).
- Subject `Foliofox symbol review: {n} stale symbol(s) reviewed`; grouped retired → renamed → provider_issue → thinly_traded → unknown; each entry: ticker, name, confidence, summary, evidence links.
- LLM-derived text is escaped by JSX. `emails/_components/email-layout.tsx` gains optional `dashboardUrl`/`reasonText`/`settingsUrl`/`unsubscribeUrl` so operator mail renders without a CTA, a preference centre, or an unsubscribe link it cannot honour; the two user-facing emails pass all of them and render unchanged.
- Logo URL resolves through `resolveSiteUrl()` _without_ `requireConfiguredPublicUrl`: a self-hosted instance that never set `NEXT_PUBLIC_SITE_URL` must still get its digest, and only the logo image depends on it.
- `renamed` entries: show the successor ticker and point at `docs/SYMBOL-RENAME-HANDLING.md` for the apply playbook (no SQL — renames are multi-step and user-visible, unlike retirement).
- For each `retired` verdict, a `<pre>` block with SQL scoped by the stored `alias_id`:

```sql
-- {ALIAS_VALUE} (symbol {symbol_id}) — sanity check, expect exactly 1 row:
SELECT id, symbol_id, value, effective_to FROM symbol_aliases
WHERE id = '{alias_id}' AND effective_to IS NULL;
-- Retire:
UPDATE symbol_aliases SET effective_to = now()
WHERE id = '{alias_id}' AND effective_to IS NULL;
```

Scoping by alias id rather than by ticker value is the point of storing `alias_id`. A digest is read days after the research ran, and `20260722110857_support_symbol_ticker_reuse.sql` exists precisely so a freed ticker can be re-registered to a different security in the meantime — a `value = '{TICKER}'` predicate would then retire the _new_ security's alias. The uuid also needs no quote escaping (so no `replaceAll("'", "''")`), and `effective_to IS NULL` keeps the UPDATE idempotent: a zero-row sanity SELECT tells the operator it is already handled.

## Step 4 — Cron route

`app/api/cron/review-stale-symbols/route.ts`: copy of `app/api/cron/repair-quote-gaps/route.ts` (CRON_SECRET bearer auth, `await connection()`), delegating to `runSymbolReview` from `@/server/symbol-review/worker`, plus `export const maxDuration = 800;` (already used by fetch-quotes, plan supports it).

## Step 5 — Config

- `vercel.json` crons: `{ "path": "/api/cron/review-stale-symbols", "schedule": "0 6 * * 1" }` — Monday 06:00 UTC, well after Sunday's 22:00 UTC quote cron so `last_quote_at` reflects the weekend.
- `.env.example`: under the automated-emails block, a commented-out `# SYMBOL_REVIEW_ALERT_EMAIL=` with comment "optional override for the weekly symbol-review digest recipient (defaults to the EMAILS_FROM_ADDRESS mailbox); the review runs whenever AI + Resend + from-address are configured, and is not gated by AUTOMATED_EMAILS_ENABLED". No new required vars.
- `content/product-reference.md`: no update — operator-only, nothing user-facing.

## Step 6 — Tests

Cover the failure guarantees, not the library. Dropped from the earlier draft: the `symbolVerdictSchema` enum cases, which assert that `z.enum` rejects out-of-enum values — that is Zod's test suite, not ours.

`server/symbol-review/helpers.test.ts` (pure):

1. `resolveDigestRecipient`: override wins; `"Name <a@b.c>"` → `a@b.c`; bare address passes through.
2. `buildRetirementSql`: scoped by `alias_id` with `effective_to IS NULL`, and contains no `value =` predicate.
3. `groupDigestEntries` orders groups most-actionable-first and drops empties; `buildDigestSubject` singularises.

`server/symbol-review/template.test.ts` (renders for real, like `server/automated-emails/templates.test.ts`): SQL reaches both html and text; `<script>` in a summary is escaped; renamed gets the successor and playbook but no SQL; other non-retired verdicts get no SQL; no unsubscribe or preference chrome.

`server/symbol-review/worker.test.ts` (mock `ai`'s `generateText` and inject a stubbed Supabase client — same approach as `app/api/ai/extract-positions/route.test.ts`):

3. Missing `AI_PROVIDER_API_KEY` / `RESEND_API_KEY` / `EMAILS_FROM_ADDRESS` → `{ skipped }`, and neither the model nor the database is touched. This is the whole self-hoster opt-in contract.
4. No `web_search` tool result → no insert, `failed` incremented; search result with no URL sources → same; a throwing `result.output` getter → same.
5. `emailed_at` is set only after a successful send — a throwing sender leaves the rows pending and does not fail the run.
6. A symbol whose embed returns ≠1 active Yahoo alias is skipped without an LLM call.

`app/api/cron/review-stale-symbols/route.test.ts`: bearer auth fails closed (missing secret → 500, wrong secret → 401), mirroring `app/api/cron/fetch-quotes/route.test.ts`.

## Verification

```
npm run lint
npm run type          # after migration applied + types regenerated
npx vitest run server/symbol-review
npm run format:check
```

Post-deploy: trigger the cron manually once with the bearer header, confirm verdict rows + digest email, sanity-check one verdict's evidence by hand.

## Open risks

1. **web_search + forced `toolChoice` + `Output.object` in one `generateText`**: the installed provider docs show the tool and the forced tool choice, and `Output.object` is already the house pattern, but nothing documents the three combined — and there are community reports of broken/truncated JSON when the older `web_search_preview` tool mixed with structured outputs. Unproven until the post-deploy smoke test. If it misbehaves, fall back to two-step (research call with tools → cheap structuring call with `Output.object`). Only the per-symbol function changes.
2. **Model** `gpt-5.6-luna` must accept the web_search tool; if not, fix is a single model-id const in the worker.
3. **PostgREST double `!inner` embed filter** on `positions` + `symbol_aliases`; if the alias filter misbehaves, fetch alias rows and filter in JS like `server/positions/stale.ts` does.
4. **Runtime**: bounded on both sides now (`PER_CALL_TIMEOUT_MS` per call, `LOOP_BUDGET_MS` between iterations), so the run reaches the digest send rather than being killed at `maxDuration`. Insert-as-you-go plus the `emailed_at IS NULL` sweep still covers the residual cases — a hard kill loses at most the in-flight symbol, retried next week.
5. **From-address fallback recipient**: if `EMAILS_FROM_ADDRESS` isn't a real inbox and no override is set, digests silently go nowhere. Accepted: the feature is advisory, and the `.env.example` comment documents the override.
6. **Failure starvation** (mitigated): no failure path writes a verdict row, so none enters the cooldown, and `last_quote_at` never moves for a symbol that stopped quoting — the same rows re-select at the head of the order every week. Two of the four paths are deterministic rather than transient: the multi-alias skip, and an insert rejected by the `renamed`→`successor_ticker` CHECK. The multi-alias case was the worst, since `limit` applies in Postgres and the skip applies in JS after it, so a page of them yields `candidates: 0` with nothing logged as failed. Mitigation is `CANDIDATE_OVERFETCH = 2`: fetch twice the cap and stop once `MAX_SYMBOLS_PER_RUN` verdicts are **stored**, so failures come out of the slack instead of the quota. Costs at most double the calls in a bad week, already bounded by `LOOP_BUDGET_MS`. Residual: more than `MAX_SYMBOLS_PER_RUN` persistent failures still stalls the backlog — the fix then is recording attempts, which needs either a second table or nullable `verdict`/`summary`/`evidence_urls`, and those NOT NULLs are the groundedness invariant. Not worth trading pre-emptively.
7. **`AUTOMATED_EMAILS_ENABLED=false` does not stop this mail** — deliberate (that flag gates user-facing email; this is operator mail), but it is the obvious kill switch, so the `.env.example` comment must say so.

## Cut on purpose

No admin UI, no feature-flag env var, no verdict status/ack workflow (`emailed_at` is delivery bookkeeping, not acknowledgement), no `updated_at` trigger, no retry queue (weekly rerun retries free), no concurrency, no keyset pagination, no dedicated review model config, no raw-transcript storage, no product-reference update, no model-authored evidence URL list (and therefore no URL-scheme allowlist), no pre-loop digest flush.

**No web search for the AI chat advisor** (deliberate, possible follow-up). The advisor stays grounded in the portfolio tools it already has; giving it `webSearch` would let it answer from arbitrary online data instead of the user's own positions, which needs its own design pass: system-prompt guidelines on when web data is allowed (e.g. current-events context only, never as a substitute for portfolio tools), a call budget in the tool-call guard, source attribution in the chat UI, and a `content/product-reference.md` update. None of that belongs in this operator-only feature; the worker calls the tool factory directly and the advisor's registry is untouched.
