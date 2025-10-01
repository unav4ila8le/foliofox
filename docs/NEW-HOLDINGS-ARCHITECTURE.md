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

### Current Problem

`fetchMarketData()` uses if/else logic for each source:

```typescript
// ❌ Need to edit this file for every new source
if (holding.symbol_id) {
  /* fetch quotes */
}
if (holding.domain_id) {
  /* fetch domains */
}
// Adding crypto = edit this file again
```

### New: Pluggable Source Handlers

**Strategy Pattern** - Each source handles its own market data:

```typescript
// server/market-data/sources/types.ts
export interface MarketDataHandler<T = any> {
  source: HoldingSource;
  collectRequests: (holdings: TransformedHolding[], date: Date) => T[];
  fetchData: (requests: T[], options?: any) => Promise<Map<string, number>>;
  getKey: (holding: TransformedHolding, date: Date) => string;
}
```

**Symbol Handler:**

```typescript
// server/market-data/sources/symbol-handler.ts
import { fetchQuotes } from "@/server/quotes/fetch";

export const symbolHandler: MarketDataHandler = {
  source: "symbol",

  collectRequests: (holdings, date) => {
    return holdings
      .filter((h) => h.source === "symbol" && h.symbol_id)
      .map((h) => ({ symbolId: h.symbol_id!, date }));
  },

  fetchData: async (requests, options) => {
    return fetchQuotes(requests, options?.upsert);
  },

  getKey: (holding, date) => {
    return `${holding.symbol_id}|${format(date, "yyyy-MM-dd")}`;
  },
};
```

**Domain Handler:**

```typescript
// server/market-data/sources/domain-handler.ts
import { fetchDomainValuations } from "@/server/domain-valuations/fetch";

export const domainHandler: MarketDataHandler = {
  source: "domain",

  collectRequests: (holdings, date) => {
    return holdings
      .filter((h) => h.source === "domain" && h.domain_id)
      .map((h) => ({ domain: h.domain_id!, date }));
  },

  fetchData: async (requests, options) => {
    return fetchDomainValuations(requests, options?.upsert);
  },

  getKey: (holding, date) => {
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

**Updated `fetchMarketData()` (no more edits needed):**

```typescript
// server/market-data/fetch.ts
import { MARKET_DATA_HANDLERS } from "./sources/registry";

export async function fetchMarketData(
  holdings: TransformedHolding[],
  date: Date,
  targetCurrency?: string,
  options: { upsert?: boolean; include?: IncludeOptions } = {},
) {
  const { include = {} } = options;

  // Fetch market prices from all registered handlers
  const marketDataPromises =
    include.marketPrices === false
      ? []
      : MARKET_DATA_HANDLERS.map((handler) => {
          const requests = handler.collectRequests(holdings, date);
          return requests.length > 0
            ? handler.fetchData(requests, options)
            : Promise.resolve(new Map());
        });

  // Fetch exchange rates
  const exchangeRatesPromise =
    include.exchangeRates === false
      ? Promise.resolve(new Map())
      : fetchExchangeRates(/* ... */);

  const results = await Promise.all([
    ...marketDataPromises,
    exchangeRatesPromise,
  ]);

  // Merge all market data maps into one
  const marketDataMap = new Map<string, number>();
  results.slice(0, -1).forEach((map) => {
    map.forEach((value, key) => marketDataMap.set(key, value));
  });

  return {
    marketData: marketDataMap, // Single unified map
    exchangeRates: results[results.length - 1],
  };
}
```

**Updated `fetchHoldings()` valuation logic:**

```typescript
// server/holdings/fetch.ts

// After fetching market data
const { marketData, exchangeRates } = await fetchMarketData(holdings, asOfDate, ...);

// In transformation loop
const transformedHoldings = holdings.map(holding => {
  const baseRecord = /* ... */;

  let current_unit_value: number;

  // Find the handler for this source
  const handler = MARKET_DATA_HANDLERS.find(h => h.source === holding.source);

  if (handler && asOfDate !== null) {
    // Get value from market data using handler's key function
    const marketKey = handler.getKey(holding, asOfDate);
    current_unit_value = marketData.get(marketKey) || baseRecord?.unit_value || 0;
  } else {
    // Manual holding or no market data
    current_unit_value = baseRecord?.unit_value || 0;
  }

  // ...
});
```

### Benefits of This Approach

✅ **Adding crypto wallet:**

1. Create `crypto-handler.ts` with the 4 functions
2. Add to registry: `import { cryptoHandler } from './crypto-handler'`
3. **That's it!** No changes to `fetchMarketData()`, `fetchHoldings()`, or anywhere else

✅ **Fully modular** - each source is self-contained  
✅ **Type-safe** - TypeScript ensures all handlers implement the interface  
✅ **Testable** - test each handler in isolation  
✅ **Discoverable** - registry shows all sources at a glance

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

### Phase 2: Refactor Market Data (Week 3)

**Goal:** Make market data system pluggable

**Create Handler System:**

- [x] Define `MarketDataHandler` interface
- [x] Create `symbol-handler.ts` with existing quote logic
- [x] Create `domain-handler.ts` with existing domain logic
- [x] Create `registry.ts` to collect all handlers
- [x] Refactor `fetchMarketData()` to use registry
- [x] Update `fetchHoldings()` to use unified market data map

**Testing:**

- [ ] Verify all holdings still valued correctly
- [ ] Test with different as-of dates
- [ ] Ensure backwards compatibility

---

### Phase 3: Selection Screen UI (Week 4)

**Goal:** Replace tabs with card-based selection (like Kubera)

**Flow:**

```
[New Holding] → Selection Dialog (cards for each source) → Form Dialog (stacked dialog for better UX)
```

**Implementation:**

- Selection dialog with clickable cards per source type
- When card clicked, open form dialog on top (selection dialog stays open underneath)
- Form dialog renders source-specific form based on selected source
- Each form appends `source` to FormData
- Stacked dialog pattern: if user closes form dialog, selection dialog is still available
- Best UX: users can easily switch between source types or go back to selection

---

### Phase 4: Source-Specific Edit Forms (Week 5)

**Goal:** Edit forms respect source constraints

**Strategy:**

- Route to different edit forms based on `holding.source`
- Symbol holdings: can't change symbol_id (show read-only)
- Manual holdings: can change currency
- Domain holdings: can't change domain_id

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

  collectRequests: (holdings, date) => {
    return holdings
      .filter((h) => h.source === "crypto_wallet")
      .map((h) => ({
        walletAddress: h.wallet_address,
        blockchain: h.blockchain,
        date,
      }));
  },

  fetchData: async (requests, options) => {
    return fetchCryptoBalances(requests); // Your API call
  },

  getKey: (holding, date) => {
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

**4. Types:**

```typescript
export interface CryptoWalletHolding extends Holding {
  source: "crypto_wallet";
  wallet_address: string;
  blockchain: string;
}
```

**5. UI:**

- Add card to selection screen
- Create form component

**That's it!** No changes to `fetchMarketData()`, `fetchHoldings()`, or core analysis functions.

**Time:** 1 day (was 1-2 days before handler refactor)

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

**This delivers:**

- ✅ Explicit `source` → reliable routing to forms/logic
- ✅ Extension tables → scalable, no NULL bloat
- ✅ Unified `records` → analysis unchanged
- ✅ Type-safe TypeScript → discriminated unions
- ✅ **Pluggable market data** → add sources without touching core files
- ✅ 1 day per new source type (down from 1-2 days)

**Timeline:** 6 weeks for Phases 1-5 (added Phase 2 for handler refactor)  
**Next:** Review → Start Phase 1 migration
