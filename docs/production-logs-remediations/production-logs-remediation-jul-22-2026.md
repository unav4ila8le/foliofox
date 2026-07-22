# Production Log Remediation

## Phase 1 — Operational fixes

- Keyset-paginate `symbols` by UUID in 1,000-row pages, returning `{ id, ticker }`.
- Run four quote-batch workers per date. Workers pull from a shared batch index, keeping at most four batches in flight; the three dates remain sequential to limit Yahoo pressure.
- Preserve each batch’s existing retry/backoff behavior and aggregate returned batch statistics after completion.
- Set `maxDuration = 800` as headroom, not as the scaling mechanism.
- Emit one compact warning per affected batch containing date, batch number, failure count, and every unresolved ticker. Batch exceptions include the same ticker list.
- Provide the user-run observability query `select count(*) from public.symbols;`. Its result is recorded in the Phase 1 handoff but does not gate implementation.
- Validate `baseCurrency` at the shared AI-tool boundary:
  - whitespace/`""` becomes `null`;
  - nonblank values are trimmed, uppercased, and checked against `fetchCurrencies()`;
  - unsupported values produce: set `baseCurrency` to `null` to use the profile currency;
  - all eight schema descriptions explicitly say “Set to null,” never “leave empty.”
- Add the tested `MarketDataStatus` model:
  - active Yahoo alias plus old/missing `last_quote_at` → yellow stale warning;
  - retired Yahoo history with no active Yahoo alias → neutral “Market data unavailable” indicator;
  - no alias history → retain stale warning.
- The unavailable dialog reuses `UpdateSymbolDialog` and `ArchivePositionDialog`, directing users to update a changed ticker or archive a position they no longer hold.
- Update the product reference for this user-facing behavior.

Tests cover more than 3,000 paginated symbols, page errors, maximum concurrency of four, slot reuse, retry accounting, compact failure logs, AI normalization/validation/copy, market-data classification, and both unavailable-state actions.

**Gate:** focused Vitest suites, `npx tsc --noEmit`, lint, format-check, and `git diff --check`; report results and stop for approval. Production verification covers symbol count, cron duration, concurrency-related transient errors, and unresolved-ticker visibility. The unavailable UI is test-only at this gate.

## Phase 2 — Active provider aliases and retirement

Before changing the cron source:

- Provide user-run SQL listing every symbol linked to any position that lacks an active Yahoo ticker alias, including symbol UUID, ticker, position count, `last_quote_at`, and alias history.
- Partition results into:
  - no Yahoo alias history: safe candidate to backfill from `symbols.ticker`;
  - inactive Yahoo history or conflicting non-Yahoo aliases: list for user review; never reactivate automatically.
- Provide transaction-wrapped backfill SQL only for approved rows.
- Re-run the preflight. The source switch cannot deploy until every linked symbol either has an active Yahoo alias or is explicitly approved as retired.

Code changes:

- Add `providerAliasMode: "active-only" | "display-fallback"` to `resolveSymbolsBatch`; default to display fallback. Active-only mode returns a nullable provider alias while retaining canonical/display metadata.
- Quotes and dividends continue reading cached historical data without an active alias; only live Yahoo requests require the active alias.
- Quotes, dividends, news, and quote repair use active-only mode. AI portfolio overview, assets performance, and positions retain display fallback.
- Switch the Phase 1 paginator to active Yahoo ticker aliases, retaining keyset pagination and canonical-ID deduplication.
- Update resolver, caller, pagination, and cached-history tests plus symbol lifecycle documentation.

Deployment order:

1. Complete the missing-alias preflight/backfill and obtain a clean reviewed result.
2. Deploy the Phase 2 code.
3. The user verifies exactly three active rows for `CFLT`, `WBIT.BE`, and `WBIT.DU`, then runs transaction-wrapped retirement SQL.
4. Leave `is_primary`, canonical symbols, quotes, and positions unchanged; leave `CMPO` active.
5. Confirm the unavailable UI visually after retirement.

**Gate:** verify the three retired tickers disappear from live requests, linked positions show the neutral actionable status, CMPO remains observable, and cached history remains readable; then stop for approval.

## Phase 3 — Ticker reuse and uniqueness migration

**Precondition:** the user supplies an empty migration file. The assistant neither creates nor applies it.

- Confirm `symbolMetadata.ticker` is display-only and audit exact/case-insensitive lookup, current-position association, symbol ensuring, and broker-import resolution.
- Use one deterministic alias rule: active first, requested source next, Yahoo preferred for source-unspecified tickers, then primary, most recently effective/retired, and alias ID.
- Migration:
  - drop `symbols_ticker_key`;
  - add a unique partial index on `(source, type, value) WHERE effective_to IS NULL`;
  - use plain normalized `value`, without `lower()`;
  - roll back and report active duplicates instead of auto-merging them.
- Replace ticker upsert in `createSymbol()`:
  - refresh the symbol behind an existing active Yahoo alias;
  - otherwise create a new UUID and active alias;
  - never overwrite a symbol reached only through an inactive alias.
- Current position creation/import/update and broker ticker resolution use active Yahoo aliases. Display and historical resolution remain active-first with inactive fallback; explicit UUIDs retain canonical historical identity.
- Update lifecycle documentation and cover ticker reuse, broker imports, legacy-case lookup, cached retired quotes, and UUID/history preservation in tests.

**Gate:** after the user applies the migration locally and regenerates types, run focused tests and standard verification; stop for approval before production rollout.

## Defaults

- Fixed quote concurrency: four batches per date.
- No status table, queue, delisting detector, new route, dependency, or automatic identity merge.
- The assistant runs no Supabase, Next, local-database, or production commands.
- Every phase ends with a verification report and explicit approval wait.
