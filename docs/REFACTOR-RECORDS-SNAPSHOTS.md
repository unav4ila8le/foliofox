## Database Refactor Plan (Concise) — Position-Centric Model

This plan supersedes the details below. It is the authoritative, simplified blueprint for the refactor. No code or SQL here—just a clear plan.

### Objectives

- Align UI and backend terminology; remove ambiguity.
- Future‑proof for liabilities and Plaid integrations.
- Maximize clarity and flexibility; avoid TypeScript naming collisions.

### Target Data Model

- positions: id, user_id, type ('asset' | 'liability'), name, currency, entity_id (nullable), archived_at, created_at, updated_at
- portfolio_records: unified action log (buy, sell, update, borrow, repay, interest, fee, etc.); order timelines by created_at
- position_snapshots: unified value history by date; record_id is nullable (initial/synthetic snapshots)
- portfolio_entities (hub): id, type ('symbol' | 'domain' | 'property' | 'account' | 'loan' | 'custom'), created_at
  -- per-type detail tables (only for current needs):
  - entity_symbols: id (PK/FK to portfolio_entities.id), symbol_id (FK to symbols.id)
  - entity_domains: id (PK/FK to portfolio_entities.id), domain_id (text)
  - entity_properties: id (PK/FK to portfolio_entities.id), external_id, ... (future)

### Categories

- position_categories: code (PK), name, description, display_order, position_type ('asset' | 'liability')
- positions.category_code → position_categories.code (FK)
- Migrate: asset_categories → position_categories (position_type='asset'); add liability categories
- Views (for UX/back-compat): asset_categories = position_categories WHERE position_type='asset'; liability_categories = position_categories WHERE position_type='liability'

### Priority Checklist

- [x] Create GitHub branches: `development` (staging), protect `main` (production)
- [x] Set up CI/CD: PRs → staging preview; merge to `development` → staging deploy; merge to `main` → production deploy
- [x] Turn on maintenance mode
- [ ] Full production DB backup and schema export
- [ ] Create new DB tables: positions, portfolio_records, position_snapshots, position_categories, portfolio_entities, entity_symbols, entity_domains (keep existing tables for backfill)
- [ ] Replace `symbol_holdings`/`domain_holdings` with `portfolio_entities` hub + `positions.entity_id`
- [ ] Backfill data: holdings → positions (type='asset'); transactions → portfolio_records; records → position_snapshots
- [ ] Create compatibility views: holdings, transactions, records (optional if maintenance mode covers full cutover)
- [ ] Add RLS policies and essential indexes; verify with EXPLAIN where relevant
- [ ] Regenerate TypeScript types and update type aliases (avoid TS `Record`)
- [ ] Refactor server modules: holdings→positions, transactions→portfolio-records, records→position-snapshots
- [ ] Update components, routes, and AI tools to new imports/types and copy
- [ ] Run full test pass on staging (DB, functionality, UI, edge cases)
- [ ] Stakeholder review on staging; fix issues; repeat tests
- [ ] Schedule production maintenance window; backup again
- [ ] Apply migrations to production; cut over app to new modules
- [ ] Monitor errors/metrics; rollback plan ready
- [ ] Turn off maintenance mode

Notes

- Use DB table names: positions, portfolio_records, position_snapshots.
- TypeScript types: Position, PortfolioRecord, PortfolioRecordWithPosition, PositionSnapshot (avoid TS `Record`).
- UI remains user‑friendly: “Record” as the action term; list/history can say “Activity” or “Records”.

### Migration Strategy (High‑Level)

1. Introduce new tables/enums alongside existing ones (add‑first).
2. Backfill data: holdings → positions (type='asset'); transactions → portfolio_records; records → position_snapshots.
3. Create compatibility views for holdings, transactions, records to keep the app running during code refactor. If maintenance mode is active for the full duration, this step is optional and can be skipped to reduce complexity.
4. Regenerate types; refactor server actions, AI tools, and components to new modules and names.
5. Remove views and decommission old tables once the app is fully migrated.

Categories migration specifics

- Create position_categories; copy rows from asset_categories with position_type='asset'
- Add liability categories (credit_card, personal_loan, mortgage, auto_loan, student_loan, line_of_credit, tax, other)
- Add positions.category_code and backfill from holdings.category_code
- Update selectors and server actions to use positions.category_code and filter options by positions.type

Portfolio entities (Symbols/Domains/Properties/etc.) migration specifics

-- Introduce neutral hub: `portfolio_entities` with columns: id, type ('symbol' | 'domain' | 'property' | 'account' | 'loan' | 'custom'), created_at.
-- Add `positions.entity_id` (nullable) referencing `portfolio_entities.id`.
-- Add per-type tables for current types:

- `entity_symbols(id, symbol_id)` with FK to `symbols.id`
- `entity_domains(id, domain_id)`
- Backfill: for each holding→position, create a `portfolio_entities` row of the appropriate type, insert into the matching per-type table, then set `positions.entity_id`.
- Notes:
  - Custom/manual positions can leave `entity_id` null.
  - Remove `positions.source`; derive branch logic from `portfolio_entities.type`. Optionally cache as a read-only `positions.entity_type` if needed.

### Code Refactor Scope

- Rename server directories and modules:
  - server/holdings → server/positions
  - server/transactions → server/portfolio-records
  - server/records → server/position-snapshots
- Update imports in analysis, AI tools, and components; ensure UI copy consistency.

### RLS, Indexing, Ordering

- RLS consistently enforced via user_id on positions, portfolio_records, position_snapshots.
- Prefer created_at for ordering/tie‑breakers; date is the user/event date.
- Add pragmatic indexes to support common queries (e.g., per position/user timelines).

Portfolio Entities

-- Add indexes:

- `portfolio_entities(type)`
- `entity_symbols(symbol_id)`
- `entity_domains(domain_id)`
- RLS: `portfolio_entities`, `entity_symbols`, `entity_domains` are global catalogs (no `user_id`). Access is indirect via `positions.entity_id`. Keep all user scoping on `positions`, `portfolio_records`, `position_snapshots`.

Flattened View for reads (recommended)

- Create a normal read-only view `portfolio_entities_flat` that flattens hub + per-type identifiers:
  - columns: id, type, symbol_id, domain_id
  - Recommended default read path: `positions LEFT JOIN portfolio_entities_flat` (single join in app queries).
  - Join per-type tables directly only when you need fields not projected by the view.

### Testing Focus

- Database: tables present, FKs valid, RLS active.
- Functionality: create/update/delete records for assets and liabilities; initial/synthetic snapshots; timeline ordering.
- UI: forms, tables, toasts; archived states; multi‑currency flows; charts and analysis.

### Daily Net Worth History (post-refactor)

- Goal: switch from weekly to daily without performance issues.
- Approach: one range read for `position_snapshots` (user_id, date between [start,end]) and one for FX; forward-fill in memory and sum per day.
- Indexes used: `position_snapshots(user_id, date desc)`, `position_snapshots(position_id, date desc, created_at desc)`, `exchange_rates(base_currency, target_currency, date desc)`.
- Optional later: materialize `user_daily_net_worth(user_id, date, value)` via nightly cron for instant reads.

### Decision Log

- Chosen “positions” as the unified concept (covers assets/liabilities cleanly).
- `positions.type` (not “kind”) with enum 'asset' | 'liability'.
- Adopt neutral `portfolio_entities` hub with `type` instead of "kind".
- `position_snapshots.record_id` stays nullable by design.
- Excluded a generic details jsonb for now; add later only if needed.
- Avoid TS `Record` naming; use PortfolioRecord types in code.
- No separate `mode` column in `portfolio_records`. Semantics are derived from `event_type` (e.g., `update` acts as a reset boundary; buy/sell/deposit/withdrawal are deltas). This mirrors current logic and simplifies the schema.

Maintenance Window

- Given an extended maintenance window is acceptable, we will perform a clean cutover without writable compatibility views. Views remain optional for read-only validation if needed.
