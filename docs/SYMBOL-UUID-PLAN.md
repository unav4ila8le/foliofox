# Symbol Identifier Refactor – High-Level Plan

## What

- Introduce stable UUID primary keys for `symbols` so every downstream table references a security by UUID, not by its ticker text.
- Keep the human-readable ticker (and future identifiers) as mutable metadata on the symbol, paving the way for alias tracking (e.g., SPLG → SPYM) and multiple identifiers per security.
- Add a lightweight alias/resolution layer so server code always resolves user input + Yahoo responses to the canonical UUID before touching market data caches or positions.
- Backfill existing data (positions, quotes, dividends, news, analytics) to use the new UUID FKs, regenerate Supabase types, and update server modules to read/write via the resolver.

## Why

- Tickers change: today a rename forces manual rewrites across every table and cache; UUIDs let us update metadata without touching references.
- Future-proofing: enables storing historical tickers, ISIN/CUSIP/broker IDs, and handling concurrent identifiers without schema churn.
- Reliability: market data, dividends, and analytics can keep working through renames because they key off the UUID while aliases point to the correct current ticker.
- Operational safety: once aliases exist, we can detect upcoming Yahoo changes, schedule metadata updates, and avoid breaking user portfolios.

## Where

- Database: migrations that add UUIDs to `symbols`, new FK columns on dependent tables, and an `symbol_aliases` (or similar) table for historical/current identifiers.
- Server code: modules under `server/symbols`, `server/positions`, `server/market-data`, `server/quotes`, `server/dividends`, `server/news`, analytics, AI tools, and CSV import/export need to read/write UUIDs via the resolver.
- Tooling: Supabase type generation, zod schemas, and any shared types in `types/*.ts` updated to reflect the UUID-based shape.

## How

- Migrations: add `id uuid` to `symbols`, keep the existing ticker as `ticker text UNIQUE`, and backfill UUID FKs on dependent tables before dropping the old text PK constraints.
- Resolver: centralize symbol lookups so every server path (creation, imports, market data, analytics) converts user input or Yahoo responses into the canonical UUID, checking alias tables when needed.
- Code updates: regenerate Supabase types, refactor modules to store UUIDs while still exposing `ticker` (and future identifiers) in APIs/exports, and add regression tests around position creation, market data fetching, and analytics.
- Aliases & metadata: store Yahoo ticker, ISIN, etc., as columns. This makes adding future data sources straightforward—each handler just reads the appropriate identifier from the symbol metadata while the FK relationships stay untouched.

## When

- Phase 1 (Design & Review): lock the schema changes, alias table shape, and rollout order; collect contributor feedback on this doc.
- Phase 2 (Migrations & Backfill): run the Supabase migrations in staging, backfill UUIDs + aliases, regenerate types, and smoke-test critical flows.
- Phase 3 (App Refactor): update server/client code to use the resolver + UUID FKs, run automated tests, and verify end-to-end scenarios (add/edit position, imports, dashboards, AI tools).
- Phase 4 (Production Rollout): deploy migrations + code during a low-traffic window, monitor market data jobs, and announce the alias capability to contributors.
