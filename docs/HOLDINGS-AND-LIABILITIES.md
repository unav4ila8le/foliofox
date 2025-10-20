## Holdings vs Assets, and Future Liabilities

### Context

- Today, the database and server logic consistently model user-owned items as `holdings` (table: `holdings`).
- The UI now uses the term "Holdings" for user positions. "Asset Allocation" and "Asset Categories" remain valid for classification/instrument views.
- We will likely add liabilities (credit cards, loans, mortgages) in the future. This document captures the recommended domain model and an incremental plan.

### Canonical terminology (user-facing and internal)

- **Holding**: A user's position or balance they track in their portfolio (e.g., stock position, cash account, loan balance).
- **Asset**: An instrument/classification concept (e.g., symbol, asset category). Assets are not "owned amounts" by themselves.
- **Portfolio**: Collection of holdings owned by the user.
- Keep "Asset Allocation" and "Asset Categories" naming (charts and taxonomy).

### Current state (after recent refactors)

- UI routes and labels use "Holdings" (e.g., `/dashboard/holdings`).
- Tables and charts already consume data shaped around holdings.
- Column label recommendation: use "Name" (or "Holding") instead of "Asset name" to remain neutral and future‑proof for liabilities.

---

## Liabilities: design options

We considered two approaches.

### Option A — Single table with a `type` enum (recommended)

- Add column `type` to `holdings`: `'asset' | 'liability'` (default `'asset'`).
- Reuse the same `records` and analysis pipeline.
- Pros:
  - Minimal duplication: one CRUD, one records/history model, one analysis pipeline.
  - Easy analytics: net worth = sum(assets) − sum(liabilities).
  - Straightforward UI reuse: liabilities page is just a filtered view.
- Cons:
  - If fields diverge heavily, you may need optional fields or detail tables later.

### Option B — Separate `liabilities` table (not recommended now)

- Duplicate table mirroring `holdings`.
- Pros:
  - Can enforce different required fields without NULLs.
- Cons:
  - Duplicates CRUD, records, RLS, imports/exports, and analysis.
  - Net worth and charts require merging/union logic.
  - Larger ongoing maintenance surface.

### Extensible variant (if fields diverge later)

- Keep `holdings(type)` as the canonical table.
- Add optional detail tables if/when necessary:
  - `asset_positions(holding_id, symbol_id, …)`
  - `liability_positions(holding_id, lender, apr, due_date, …)`
- Enforce via constraint/trigger: exactly one matching detail record must exist per holding `type`.

---

## Implementation plan (now and future)

### 1) Database changes (non‑breaking now, future‑proof)

1. Add a new enum and column on `holdings`:
   - Create enum `holding_type` with values `asset`, `liability`.
   - Add column `type holding_type NOT NULL DEFAULT 'asset'`.
2. (Optional) Categorization alignment:
   - Keep `asset_categories` as is. For future liabilities taxonomy, either:
     - Add a `kind` column on `asset_categories` to distinguish asset vs liability categories, or
     - Reserve a code namespace for liabilities (e.g., `LIAB_*`).

Example migration snippet:

```sql
-- 1) Create enum type if not exists
DO $$ BEGIN
  CREATE TYPE holding_type AS ENUM ('asset', 'liability');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2) Add column with default
ALTER TABLE holdings ADD COLUMN IF NOT EXISTS type holding_type NOT NULL DEFAULT 'asset';

-- 3) Backfill existing rows implicitly use default 'asset'
UPDATE holdings SET type = 'asset' WHERE type IS NULL;
```

RLS: no changes required if policies are already scoped by `user_id`.

### 2) Types

- Update `types/global.types.ts`:
  - Add `type: 'asset' | 'liability'` to `Holding` and downstream composite types.

### 3) Server layer

- `fetchHoldings` signature addendum:
  - Add optional filter `type?: 'asset' | 'liability' | 'all'` (default `'asset'`).
  - Default behavior remains unchanged for current UI (assets/holdings).
- Net worth computation:
  - `netWorth = sum(values where type='asset') - sum(values where type='liability')`.
- Asset allocation:
  - Filter to `type='asset'` only.
- Records model:
  - Keep using the existing `records` table keyed by `holding_id`.
  - For liabilities, store current balance as either:
    - (A) `quantity = 1`, `unit_value = current_balance`, or
    - (B) keep the same semantics as assets (quantity × unit_value). (A) is simplest now.

### 4) UI

- Keep the main page as "Holdings" (assets). Add a "Liabilities" page later by filtering `type='liability'` and reusing tables.
- Ensure charts and summaries:
  - Dashboard net worth subtracts liabilities.
  - Asset Allocation chart remains asset-only; add a separate liabilities breakdown later (optional).

### 5) Imports/Exports (future)

- Extend CSV format with a `type` column (default to `asset` for backward compatibility).
- Validation: require 3-letter ISO currency; for liabilities, allow only categories tagged as liabilities (when taxonomy is added).

### 6) Migration & rollout

- Step 1: Add `type` column with default `'asset'`. Update types and fetchers to accept an optional `type` filter.
- Step 2: Keep UI unchanged. Add feature flags/routes for liabilities later.
- Step 3: Introduce liabilities UI (new menu item) reusing existing tables with filter.

### 7) Testing checklist

- Unit: `fetchHoldings` filter behavior; net worth calculation with mixed asset/liability.
- E2E: create/edit/archive/restore/delete on each type; charts correctness; RLS unchanged.
- Import/Export: round-trip with `type` preserved (when implemented).

### Open questions (to decide when implementing liabilities)

- Do we support negative quantities/values, or always positive with `type` indicating sign? (Recommendation: always positive; use `type` to decide sign in aggregates.)
- Do we need separate categories (taxonomy) for liabilities, or re-use `asset_categories` with a `kind` flag?
- Do we need debt‑specific fields (APR, minimum payment, due date)? If yes, consider detail table approach.

---

## Summary

- Use one canonical `holdings` table with a `type` enum for assets and liabilities.
- Keep user‑facing "Holdings" for positions; "Asset Allocation" remains classification‑focused.
- This approach minimizes duplication, keeps analytics straightforward, and allows optional detail tables later if liabilities need additional domain fields.
