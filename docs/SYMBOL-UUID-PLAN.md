# Symbol Identifier Refactor – Updated Plan

## What

- Promote `symbols.id` to a UUID primary key while the current text identifier becomes `symbols.ticker`, a mutable metadata column.
- Introduce `symbol_aliases` so every identifier (ticker, ISIN, broker code, vendor slug) resolves to the canonical symbol UUID, with a notion of the primary alias.
- Build resolver utilities so server paths accept user/vendor identifiers, resolve them to UUIDs, and keep `symbols.ticker` aligned with the active alias.
- Backfill existing data (positions, quotes, dividends, news, analytics) to use UUID foreign keys, regenerate types, and update services/clients accordingly.

## Why

- Ticker churn currently forces schema rewrites; UUIDs let us update metadata without touching relationships.
- Alias tracking future-proofs us for multiple providers and identifier types without new tables per vendor.
- Market data, analytics, and imports stay reliable during renames because they key off UUIDs while aliases map to the right text identifier.
- Centralized resolution logic reduces drift between ingestion paths and unlocks rename detection workflows later.

## Where

- Database: Supabase migrations for `symbols`, dependent FK tables, new `symbol_aliases`, updated RLS policies, and supporting indexes.
- Server code: modules under `server/symbols`, `server/positions`, `server/market-data`, `server/quotes`, `server/dividends`, analytics jobs, CSV import/export, AI tools.
- Tooling: Supabase type generation, Zod schemas, shared interfaces in `types/`, fixtures/tests.
- Documentation: this plan, README notes, deployment checklist.

## How

### Phase 0 – Discovery & Design

- Review existing migrations and `supabase/types.ts` to catalogue every ticker-based FK.
- Expand this doc with schema diagrams (UUID column, alias table shape, index strategy, cascade behaviour).
- Inventory code paths that assume ticker primary keys (SQL views/RPCs, server modules, UI hooks, cron jobs).

### Phase 1 – Database Migrations & Backfill

- Add `id uuid default gen_random_uuid()` to `symbols`, populate values, and promote it to primary key.
- Rename the old text PK column to `ticker`, keep it unique, and continue storing the current Yahoo ticker there.
- Create `symbol_aliases` with `id uuid`, `symbol_id uuid references symbols(id)`, `value text`, `type text`, `source text`, `effective_from/through timestamptz`, `is_primary boolean`, plus unique/index constraints to prevent duplicates.
- Add nullable `symbol_id uuid` columns to dependent tables (`positions`, `portfolio_records`, `quotes`, `dividends`, `news`, snapshots, analytics caches, CSV staging) and backfill them by joining on the legacy ticker.
- Flip the new columns to `not null`, enforce foreign keys, drop legacy ticker FKs, and update RLS policies to reference UUIDs.

### Phase 2 – Tooling & Types

- Regenerate Supabase types (e.g., `npm run supabase:types`) and commit updates to generated files such as `types/supabase.ts`.
- Refresh shared TS/Zod definitions (e.g., `types/symbol.ts`) to include UUIDs, ticker metadata, and alias arrays.
- Update seeds/fixtures/tests that assumed ticker primary keys.

### Phase 3 – Resolver Layer & Server Refactor

- Implement `server/symbols/resolver.ts` helpers (`resolveSymbolInput`, `getCanonicalSymbol`, `getProviderSymbolAlias`, `setPrimarySymbolAlias`) backed by `symbol_aliases`.
- Ensure `setPrimarySymbolAlias` write-through updates `symbols.ticker` whenever a new alias becomes primary (or alternatively refresh a derived view if we pick that approach).
- Refactor all data ingress/egress (position CRUD, CSV import/export, cron fetchers, analytics jobs) to call the resolver and persist UUID foreign keys.
- Update market data handlers (quotes, dividends, news, analytics) to request provider-specific aliases via the resolver before hitting external APIs.

### Phase 4 – Client & API Updates

- Adjust API routes and React components to expect `{ id, ticker, aliases[] }`, retaining ticker for display while relying on UUIDs for references.
- Audit hooks/utils for ticker assumptions and propagate canonical UUIDs where necessary.
- Update CSV export/import flows: expose tickers to users but persist UUIDs internally.
- **Inventory (needs refactor to use resolver + canonical UUIDs while surfacing tickers):**
  - UI forms & dialogs
    - `components/dashboard/new-asset/forms/symbol-search-form.tsx` (rename input to `symbolLookup`, resolve to UUID on submit, surface ticker in UI).
    - `components/dashboard/symbol-search.tsx` (shared picker expects tickers, needs resolver integration).
    - `components/dashboard/new-portfolio-record/index.tsx` and forms (`buy-form.tsx`, `sell-form.tsx`, `update-form.tsx`) – ensure preselected positions show tickers via resolver and submit UUIDs only.
  - Positions import/export flows
    - `components/dashboard/positions/import/csv-form.tsx`, `.../review/form.tsx`, `.../review/table.tsx` (rename `symbol_id` inputs to `symbolLookup`, pipe through resolver before import).
    - `public/sample-positions-template.csv` (update header/help text to reflect UUID backing + alias support).
    - `server/positions/export.ts` (export tickers via resolver while keeping UUIDs internal).
    - `lib/import/*` (`sources/csv.ts`, `sources/ai.ts`, `serialize.ts`, `parser/*`) – update schemas to accept `symbolLookup`, resolve to UUID before persistence.
  - Misc client hooks/components
    - `components/dashboard/positions/asset/table/row-actions/actions-cell.tsx` (presentation should rely on resolver for tickers).
    - `components/dashboard/positions/import/review/form.tsx` (auto-fill currency via resolver metadata instead of legacy symbol map).
    - `components/dashboard/new-portfolio-record/position-selector.tsx` (surface ticker via resolver helper).

### Phase 5 – Testing, Verification & Rollout

- Extend unit/integration/e2e tests to cover alias resolution, renamed ticker flows, market data updates, and CSV workflows.
- Run staging smoke tests for migrations, backfill, cron jobs, dashboards, analytics, and AI tools.
- Document rollback steps (snapshot pre-migration, reapply old constraints) and prepare production deployment checklist for a low-traffic window.
- Communicate schema/API changes to contributors; update README and this plan with rollout status.

## Follow-ups

- Rename detection/automation can build on this foundation once UUID + resolver land.
- Evaluate SQL trigger vs. application-level write-through for keeping `symbols.ticker` synchronized after we have real usage data.
- Consider materialized views or caching if alias lookups become hot paths after rollout.
- Finish naming pass: adopt `symbolLookup` for user-supplied identifiers during the final cleanup so future functions communicate they accept tickers/aliases/UUIDs.
- ✅ **Extracted shared helper**: `resolveSymbolsBatch` in `server/symbols/resolver.ts` consolidates the repeated resolver + provider alias pattern. Updated `server/quotes/fetch.ts`, `server/dividends/fetch.ts`, `server/news/fetch.ts`, and AI tool resolvers (`assets-performance`, `portfolio-snapshot`, `positions`) to use it.

## Implementation Status

- **Phase 0 – Discovery & Design** ✅ Completed (schema/catalogue documented).
- **Phase 1 – Database Migrations & Backfill** ✅ Completed (`symbol_aliases`, UUID PK, news arrays, alias seeding).
- **Phase 2 – Tooling & Types** ✅ Supabase types regenerated; remaining Zod helpers updated alongside feature refactors.
- **Phase 3 – Resolver Layer & Server Refactor** ✅ Completed
  - Resolver module shipped (`resolveSymbolInput`, `getCanonicalSymbol`, `getProviderSymbolAlias`, `setPrimarySymbolAlias`).
  - Positions CRUD/import and market data (quotes/dividends/news) resolve UUIDs before hitting Yahoo/Supabase caches.
  - AI/analytics + AI tools now accept `symbolLookup` values and return canonical UUIDs while exposing tickers for display.
  - All server-side code verified: no deprecated `symbol_id` usage assuming tickers remains. All database UUIDs correctly flow through resolver layer.
  - ✅ Shared batch resolver helper (`resolveSymbolsBatch`) extracted and integrated into quotes/dividends/news modules.
- **Phase 4 – Client & API Updates** ✅ Completed
  - ✅ Updated `server/symbols/fetch.ts` to include `ticker` in select
  - ✅ Fixed `components/dashboard/positions/asset/header.tsx` to display `symbol.ticker` instead of `symbol.id`
  - ✅ Updated `components/dashboard/new-asset/forms/symbol-search-form.tsx` to use `symbolLookup` field name (still passes as `symbol_id` to server action which handles resolution)
  - ✅ Updated `server/positions/export.ts` to resolve symbol UUIDs to tickers for CSV export (users see tickers, not UUIDs)
  - ✅ CSV import already handles tickers correctly via resolver in `server/positions/import.ts`
  - ✅ Verified portfolio record forms, position selector, and other client components - all correctly use UUIDs internally while accepting/displaying tickers where appropriate
- **Phase 5 – Testing, Verification & Rollout** ⏳ Queued (expanded automated coverage, staging smoke tests, rollout checklist).
