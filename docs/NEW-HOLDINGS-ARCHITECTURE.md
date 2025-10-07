# Holding Types Architecture

## Overview

**Problem:** Current implicit type system (via nullable FKs) won't scale beyond 3 types  
**Solution:** Explicit `source` enum + extension tables + pluggable market data handlers

---

## Current State

### Schema (Implicit Types)

```sql
holdings:
  - id, user_id, name, category_code, currency, description
  - symbol_id (nullable) → symbols.id  -- implies "symbol" type
  - domain_id (nullable)                -- implies "domain" type
  - archived_at, created_at, updated_at
```

**Type discrimination:** If `symbol_id` set → symbol holding, if `domain_id` set → domain holding, else → custom

### What Works ✅

- Separate creation forms per type
- Valuation logic checks which FK is set
- Unified records system
- Centralized `fetchMarketData()` aggregator for bulk fetching

### Scaling Blockers ❌

- No explicit `source` field → can't route reliably
- Adding crypto/real estate = more nullable FKs (messy)
- Edit forms can't be type-aware
- Import/export ambiguous
- **New blocker:** Adding sources requires editing `fetchMarketData()` central logic

---

## New Architecture

### Database Schema

```sql
-- 1. Add explicit source enum
CREATE TYPE holding_source AS ENUM (
  'custom',        -- User tracks manually
  'symbol',        -- Yahoo Finance API
  'domain',        -- Domain valuation API
  'crypto_wallet', -- Blockchain API (future)
  'real_estate',   -- Real estate API (future)
  'bank_account'   -- Plaid/Teller (future)
);

ALTER TABLE holdings ADD COLUMN source holding_source NOT NULL DEFAULT 'custom';

-- 2. Backfill existing data
UPDATE holdings SET source = 'symbol' WHERE symbol_id IS NOT NULL;
UPDATE holdings SET source = 'domain' WHERE domain_id IS NOT NULL;

-- 3. Create extension tables (type-specific fields)
CREATE TABLE symbol_holdings (
  holding_id UUID PRIMARY KEY REFERENCES holdings(id) ON DELETE CASCADE,
  symbol_id TEXT NOT NULL REFERENCES symbols(id) ON UPDATE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE domain_holdings (
  holding_id UUID PRIMARY KEY REFERENCES holdings(id) ON DELETE CASCADE,
  domain_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Migrate data to extensions
INSERT INTO symbol_holdings (holding_id, symbol_id)
  SELECT id, symbol_id FROM holdings WHERE symbol_id IS NOT NULL;

INSERT INTO domain_holdings (holding_id, domain_id)
  SELECT id, domain_id FROM holdings WHERE domain_id IS NOT NULL;

-- 5. Clean up main table
ALTER TABLE holdings DROP COLUMN symbol_id;
ALTER TABLE holdings DROP COLUMN domain_id;

-- 6. Indexes
CREATE INDEX idx_symbol_holdings_symbol ON symbol_holdings(symbol_id);
CREATE INDEX idx_domain_holdings_domain ON domain_holdings(domain_id);
```

### Why This Works

- **Explicit routing:** `holding.source` tells us which form/logic to use
- **No NULL bloat:** Type-specific fields isolated in extensions
- **Easy to extend:** New source = new extension table + enum value
- **Analysis unchanged:** Unified `records` table works for all types

### Future: Liabilities Support

```sql
-- Add when needed (not now)
ALTER TABLE holdings ADD COLUMN is_liability BOOLEAN NOT NULL DEFAULT false;

-- Net worth = SUM(WHERE is_liability=false) - SUM(WHERE is_liability=true)
```

---

## TypeScript Types

```typescript
// types/global.types.ts

export type HoldingSource = "custom" | "symbol" | "domain" | "crypto_wallet" | ...;

export type Holding = Pick<Tables<"holdings">,
  | "id" | "name" | "category_code" | "currency" | "description"
  | "source" // NEW
  | "archived_at" | "created_at"
> & {
  asset_categories: Pick<Tables<"asset_categories">, "name" | "display_order">;
};

// Source-specific types (discriminated union for type safety)
export interface SymbolHolding extends Holding {
  source: "symbol";
  symbol_id: string; // Joined from symbol_holdings
}

export interface DomainHolding extends Holding {
  source: "domain";
  domain_id: string; // Joined from domain_holdings
}

export interface CustomHolding extends Holding { source: "custom"; }

export type TypedHolding = CustomHolding | SymbolHolding | DomainHolding | ...;

// Type guards
export function isSymbolHolding(h: Holding): h is SymbolHolding {
  return h.source === "symbol";
}
```

---

## Market Data Architecture (CRITICAL)

### ✅ COMPLETED: Pluggable Source Handlers

**Strategy Pattern** - Each source handles its own market data and extensions:

```typescript
// server/market-data/sources/types.ts
export interface MarketDataHandler {
  source: string;

  // NEW: Handlers fetch their own extension data
  fetchExtensions?(
    holdingIds: string[],
    supabase: SupabaseClient,
  ): Promise<Map<string, string>>;

  // Fetch market data for holdings
  fetchForHoldings(
    holdings: TransformedHolding[],
    date: Date,
    options?: { upsert?: boolean },
  ): Promise<Map<string, number>>;

  // Generate lookup key for price retrieval
  getKey(holding: TransformedHolding, date: Date): string | null;
}
```

**Symbol Handler:**

```typescript
// server/market-data/sources/symbol-handler.ts
export const symbolHandler: MarketDataHandler = {
  source: "symbol",

  // NEW: Fetch symbol extensions from database
  async fetchExtensions(holdingIds, supabase) {
    const { data } = await supabase
      .from("symbol_holdings")
      .select("holding_id, symbol_id")
      .in("holding_id", holdingIds);

    const map = new Map();
    data?.forEach((row) => map.set(row.holding_id, row.symbol_id));
    return map;
  },

  // Fetch market data for symbol holdings
  async fetchForHoldings(holdings, date, options) {
    const requests = holdings
      .filter((h) => h.source === "symbol" && h.symbol_id)
      .map((h) => ({ symbolId: h.symbol_id!, date }));

    if (requests.length === 0) return new Map();
    return await fetchQuotes(requests, options?.upsert);
  },

  getKey(holding, date) {
    if (holding.source !== "symbol" || !holding.symbol_id) return null;
    return `${holding.symbol_id}|${format(date, "yyyy-MM-dd")}`;
  },
};
```

**Domain Handler:**

```typescript
// server/market-data/sources/domain-handler.ts
export const domainHandler: MarketDataHandler = {
  source: "domain",

  // NEW: Fetch domain extensions from database
  async fetchExtensions(holdingIds, supabase) {
    const { data } = await supabase
      .from("domain_holdings")
      .select("holding_id, domain_id")
      .in("holding_id", holdingIds);

    const map = new Map();
    data?.forEach((row) => map.set(row.holding_id, row.domain_id));
    return map;
  },

  // Fetch market data for domain holdings
  async fetchForHoldings(holdings, date, options) {
    const requests = holdings
      .filter((h) => h.source === "domain" && h.domain_id)
      .map((h) => ({ domain: h.domain_id!, date }));

    if (requests.length === 0) return new Map();
    return await fetchDomainValuations(requests, options?.upsert ?? true);
  },

  getKey(holding, date) {
    if (holding.source !== "domain" || !holding.domain_id) return null;
    return `${holding.domain_id}|${format(date, "yyyy-MM-dd")}`;
  },
};
```

**Registry (Auto-Discovery):**

```typescript
// server/market-data/sources/registry.ts
import { symbolHandler } from "./symbol-handler";
import { domainHandler } from "./domain-handler";
// Future: import { cryptoHandler } from './crypto-handler';

export const MARKET_DATA_HANDLERS: MarketDataHandler[] = [
  symbolHandler,
  domainHandler,
  // cryptoHandler, // Just add here when ready
];
```

**Updated `fetchMarketData()` (fully dynamic, no edits needed for new sources):**

```typescript
// server/market-data/fetch.ts
export async function fetchMarketData(
  holdings: TransformedHolding[],
  date: Date,
  options: { upsert?: boolean } = {},
): Promise<Map<string, number>> {
  // Dynamic import to avoid circular dependencies
  const { MARKET_DATA_HANDLERS } = await import("./sources/registry");

  const marketDataMap = new Map<string, number>();

  // Call each handler and merge results
  for (const handler of MARKET_DATA_HANDLERS) {
    const resultMap = await handler.fetchForHoldings(holdings, date, {
      upsert: options.upsert ?? true,
    });

    // Merge into unified map
    resultMap.forEach((value, key) => {
      marketDataMap.set(key, value);
    });
  }

  return marketDataMap; // Single unified map
}
```

**Updated `fetchHoldings()` (fully dynamic extension fetching):**

```typescript
// server/holdings/fetch.ts

// 1. Dynamic extension fetching - handlers fetch their own data
const { MARKET_DATA_HANDLERS } = await import("./sources/registry");
const extensionsBySource = new Map<string, Map<string, string>>();

for (const handler of MARKET_DATA_HANDLERS) {
  if (handler.fetchExtensions) {
    const extensionMap = await handler.fetchExtensions(holdingIds, supabase);
    extensionsBySource.set(handler.source, extensionMap);
  }
}

// 2. Market data fetching (only when asOfDate provided)
let marketDataMap = new Map<string, number>();
if (asOfDate !== null) {
  const marketDataHoldings = holdings
    .filter((holding) => activeHoldingIds.has(holding.id))
    .map((holding) => {
      const sourceExtensions = extensionsBySource.get(holding.source);
      const sourceId = sourceExtensions?.get(holding.id) ?? null;

      // Dynamic field setting based on source
      const result = { source: holding.source, currency: holding.currency };
      setSourceId(result, holding.source, sourceId);
      return result as TransformedHolding;
    });

  marketDataMap = await fetchMarketData(marketDataHoldings, asOfDate);
}

// 3. Transformation with dynamic handler lookup
const transformedHoldings = holdings.map((holding) => {
  const sourceExtensions = extensionsBySource.get(holding.source);
  const sourceId = sourceExtensions?.get(holding.id) ?? null;

  let current_unit_value: number;

  if (asOfDate !== null) {
    const handler = MARKET_DATA_HANDLERS.find(
      (h) => h.source === holding.source,
    );

    if (handler) {
      const holdingForKey = { source: holding.source };
      setSourceId(holdingForKey, holding.source, sourceId);

      const marketKey = handler.getKey(
        holdingForKey as TransformedHolding,
        asOfDate,
      );
      current_unit_value =
        marketDataMap.get(marketKey) || baseRecord?.unit_value || 0;
    } else {
      current_unit_value = baseRecord?.unit_value || 0;
    }
  } else {
    current_unit_value = baseRecord?.unit_value || 0;
  }

  // Build final holding with dynamic source ID
  const transformed = { ...holding, current_unit_value /* ... */ };
  setSourceId(transformed, holding.source, sourceId);
  return transformed as TransformedHolding;
});
```

### Benefits of This Approach

✅ **Adding crypto wallet:**

1. Create `crypto-handler.ts` with `fetchExtensions`, `fetchForHoldings`, `getKey`
2. Add to registry: `import { cryptoHandler } from './crypto-handler'`
3. Update `setSourceId` helper in `fetchHoldings` (3 lines)
4. **That's it!** No changes to `fetchMarketData()`, core logic, or anywhere else

✅ **Fully modular** - each source is self-contained and fetches its own extensions  
✅ **Type-safe** - TypeScript ensures all handlers implement the interface  
✅ **Testable** - test each handler in isolation  
✅ **Discoverable** - registry shows all sources at a glance  
✅ **Dynamic** - extension fetching and market data fetching are completely pluggable

---

## Implementation Phases

### Phase 1: Database Migration (Week 1-2)

**Goal:** Add type system without breaking existing functionality

**Database:**

- [x] Create `holding_source` enum
- [x] Add `source` column with default `'custom'`
- [x] Backfill based on symbol_id/domain_id
- [x] Create extension tables (`symbol_holdings`, `domain_holdings`)
- [x] Migrate data to extensions
- [x] Drop old FKs from main table

**Server:**

- [x] Update `fetchHoldings()` to prefer extension tables
- [x] Update `createHolding()` to insert into extensions
- [x] Update TypeScript types

**Testing:**

- [x] Verify holdings load correctly
- [x] Verify valuations unchanged
- [x] Check import/export works

---

### Phase 2: Refactor Market Data ✅ COMPLETED

**Goal:** Make market data system pluggable

**Create Handler System:**

- [x] Define `MarketDataHandler` interface with `fetchExtensions` method
- [x] Create `symbol-handler.ts` with extension fetching and quote logic
- [x] Create `domain-handler.ts` with extension fetching and domain logic
- [x] Create `registry.ts` to collect all handlers
- [x] Refactor `fetchMarketData()` to use dynamic handler registry
- [x] Update `fetchHoldings()` to use dynamic extension fetching
- [x] Add `setSourceId` helper for dynamic field mapping
- [x] Remove all hardcoded source references from `fetchHoldings`

**Testing:**

- [x] Verify all holdings still valued correctly
- [x] Test with different as-of dates
- [x] Ensure backwards compatibility
- [x] No linter errors

---

### Phase 3: Selection Screen UI ✅ COMPLETED

**Goal:** Replace tabs with card-based selection for better UX and modularity

**Flow:**

```
[New Holding] → Selection Dialog → Form Dialog
```

**Selection Cards (User-Facing Categories):**

1. **📈 Ticker Symbol** → `source: 'symbol'`
   - Stocks, ETFs, mutual funds, crypto supported via symbol search
   - Pre-fills category, currency, and today's unit value from Yahoo Finance

2. **🌐 Domain Name** → `source: 'domain'`
   - Website valuations via HumbleWorth
   - Sets category to `domain`, currency to `USD`, `quantity=1`, and `unit_value` from valuation

3. **✏️ Custom Holding** → `source: 'custom'`
   - Manual assets (cash, real estate, collectibles, private equity, etc.)
   - Full form: name, category, currency, quantity, unit_value, cost_basis

4. **🪄 Import CSV/AI**
   - Opens the import dialog; supports CSV and AI extraction flows

**Implementation Details:**

- Single dialog with card selection screen
- When a card is clicked, the corresponding form opens in the same dialog
- The server infers `source` based on presence of extension identifiers:
  - Symbol form appends `symbol_id` plus holding fields
  - Domain form appends `domain_id` and sets `currency=USD`, `quantity=1`
  - Custom form appends manual fields only (no extension ID)
- Symbol form auto-fills category/currency/unit value from Yahoo Finance; Domain form can auto-fill valuation

**Key Design Decision:**
Cash is treated as `source='custom'` for now. A dedicated "Cash quick add" UX can be added later as a thin wrapper over the manual form (default `category='cash'`, `quantity=1`, `unit_value=amount`) without schema changes.

---

### Phase 4: Edit Holding Form (Unified)

**Goal:** Keep editing simple and consistent for all sources

**Decision:** Use a single edit form for all holdings with only:

- Name
- Category
- Description

Currency editing is deferred (records are currency-agnostic, so we can add later without schema changes). Source-specific identifiers (e.g., `symbol_id`, `domain_id`) remain immutable and are not exposed in the edit form.

---

### Phase 5: Import/Export (Week 6)

**Goal:** CSV/AI import handles `source` column

**CSV format:**

```csv
name,source,category,currency,quantity,unit_value,symbol_id,domain_id
"Apple",symbol,equity,USD,10,150.50,AAPL,
"Savings",custom,cash,USD,1,10000,,
```

**Validation:**

- `source=symbol` requires `symbol_id`
- `source=domain` requires `domain_id`
- `source=custom` ignores both

---

## Adding New Sources

### Example: Crypto Wallet (After Refactor)

**1. Database:**

```sql
ALTER TYPE holding_source ADD VALUE 'crypto_wallet';

CREATE TABLE crypto_wallet_holdings (
  holding_id UUID PRIMARY KEY REFERENCES holdings(id) ON DELETE CASCADE,
  wallet_address TEXT NOT NULL,
  blockchain TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

**2. Market Data Handler:**

```typescript
// server/market-data/sources/crypto-handler.ts
export const cryptoHandler: MarketDataHandler = {
  source: "crypto_wallet",

  // NEW: Fetch crypto extensions from database
  async fetchExtensions(holdingIds, supabase) {
    const { data } = await supabase
      .from("crypto_wallet_holdings")
      .select("holding_id, wallet_address")
      .in("holding_id", holdingIds);

    const map = new Map();
    data?.forEach((row) => map.set(row.holding_id, row.wallet_address));
    return map;
  },

  // Fetch market data for crypto holdings
  async fetchForHoldings(holdings, date, options) {
    const requests = holdings
      .filter((h) => h.source === "crypto_wallet" && h.wallet_address)
      .map((h) => ({
        walletAddress: h.wallet_address!,
        blockchain: h.blockchain,
        date,
      }));

    if (requests.length === 0) return new Map();
    return await fetchCryptoBalances(requests, options?.upsert);
  },

  getKey(holding, date) {
    if (holding.source !== "crypto_wallet" || !holding.wallet_address)
      return null;
    return `${holding.wallet_address}|${format(date, "yyyy-MM-dd")}`;
  },
};
```

**3. Register:**

```typescript
// server/market-data/sources/registry.ts
import { cryptoHandler } from "./crypto-handler";

export const MARKET_DATA_HANDLERS = [
  symbolHandler,
  domainHandler,
  cryptoHandler, // ← Just add this line
];
```

**4. Update `setSourceId` Helper (3 lines in `fetchHoldings`):**

```typescript
const setSourceId = (target, source, sourceId) => {
  target.symbol_id = null;
  target.domain_id = null;
  target.crypto_wallet_address = null; // NEW

  if (source === "symbol") {
    target.symbol_id = sourceId;
  } else if (source === "domain") {
    target.domain_id = sourceId;
  } else if (source === "crypto_wallet") {
    // NEW
    target.crypto_wallet_address = sourceId; // NEW
  }
};
```

**5. Types:**

```typescript
export interface CryptoWalletHolding extends Holding {
  source: "crypto_wallet";
  wallet_address: string;
  blockchain: string;
}
```

**6. UI:**

- Add card to selection screen
- Create form component

**That's it!** No changes to `fetchMarketData()`, core analysis functions, or extension fetching logic.

**Time:** 1 day (down from 1-2 days before handler refactor)

---

## Key Decisions

**Why `source` not `type`?**  
Avoids confusion with `transaction_type`, `quote_type`, `category`. Clearly means "data source."

**Why extension tables?**

- Type safety via FK constraints
- No NULL bloat on main table
- Easy to add fields per source without affecting others

**Why handler registry pattern?**

- Add new sources without editing core market data logic
- Each source is self-contained and testable
- Prevents "edit fatigue" burnout when scaling

**Converting holdings (e.g., custom → symbol)?**  
Phase 1: Delete + recreate. Phase 2 (future): Add "Convert" action.

---

## Summary

### Transactions behavior

- UI gating by source:
  - `symbol`: buy, sell, update
  - `domain`: no manual transactions (valuations fetched automatically)
  - `custom`: update only
- UPDATE acts as a reset point. Recalculations start from a date and stop at the next UPDATE, replaying only non-UPDATE transactions in that window.
- Market data: symbols/domains resolve unit_value automatically as-of date; custom relies on user input.
- Same-day transactions are allowed; ordering uses `created_at`.

**This delivers:**

- ✅ Explicit `source` → reliable routing to forms/logic
- ✅ Extension tables → scalable, no NULL bloat
- ✅ Unified `records` → analysis unchanged
- ✅ Type-safe TypeScript → discriminated unions
- ✅ **Fully pluggable market data** → add sources without touching core files
- ✅ **Dynamic extension fetching** → handlers fetch their own data
- ✅ **Single point of change** → only `setSourceId` helper needs updates
- ✅ 1 day per new source type (down from 1-2 days)

**Timeline:** 6 weeks for Phases 1-5 (Phases 1–3 completed)  
**Status:** Phase 3 ✅ COMPLETED - New holding selection/forms shipped; market data system fully modular
