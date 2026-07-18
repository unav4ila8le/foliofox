<!--
  Foliofox Product Reference — served to the AI advisor via the getProductReference tool.

  MAINTENANCE: update this file in the same PR as any change to user-facing behavior.
  Source files this document distills:
  - lib/import/positions/header-mapper.ts (positions CSV headers + aliases)
  - lib/import/portfolio-records/header-mapper.ts (records CSV headers)
  - lib/import/positions/category-mapper.ts (category ids + aliases)
  - lib/import/positions/validation.ts (import validation rules)
  - public/sample-positions-template.csv, public/sample-records-template.csv
  - lib/import/broker-transactions/registry.ts + adapters/ (supported brokers)
  - components/dashboard/new-asset/forms/ (add-asset paths + field rules)
  - components/dashboard/new-portfolio-record/forms/ (buy/sell/update rules)
  - server/portfolio-records/create.ts (record semantics + snapshot recalculation)
  - lib/capital-gains-tax-rate.ts (tax rate input semantics)
  - types/database.types.ts Constants.public.Enums
  - VISION.md, README.md, AGENTS.md
-->

# Foliofox Product Reference

## What Foliofox is

Foliofox is a portfolio tracker and net worth tool with an AI advisor. It is built for financially literate users (FIRE, Bogleheads, self-managed investors) who want a clean tracker plus an AI thinking partner with full context on their portfolio history. The tracker is free and open source.

Foliofox is **not** a budgeting app or expense tracker. It does not track daily spending, and it is not aimed at day traders.

Market prices and FX rates refresh once daily (plus manual updates). There are no real-time streaming prices.

The AI advisor has three modes: **Educational** (explains concepts), **Advisory** (suggests plans and trade-offs), and **Unhinged** (challenges assumptions).

## Core data model

- **Positions** — everything you own (assets) or owe (future liabilities). Each position has a name, category, currency, and either a linked market symbol (auto-priced) or manual values. Assets live under Dashboard → Assets; liabilities under Dashboard → Liabilities.
- **Portfolio records** — dated events on a position, one of three types: `buy`, `sell`, or `update`. Records are the position's history.
- **Position snapshots** — daily valuations derived from records and market prices. When you add or edit a record, snapshots recalculate from that date forward until the next `update` record.

## Adding an asset

Three ways to add an asset:

1. **Symbol search** — search a ticker or ISIN (Yahoo Finance data). The current price is fetched automatically, so you only enter quantity and, optionally, cost basis per unit. Currency is set by the symbol's listing.
2. **Manual entry** — for anything without a market symbol (cash, real estate, collectibles, private equity). You enter quantity and unit value yourself.
3. **Domain** — track a web domain as an asset, with an optional automatic valuation estimate.

### Field meanings

| Field                  | Meaning                                              | Rules                                                                                          |
| ---------------------- | ---------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Name                   | Position name                                        | 3–64 characters                                                                                |
| Category               | Asset class used for allocation charts               | Pick one; custom categories supported                                                          |
| Currency               | The position's accounting currency                   | 3-letter ISO 4217 code (USD, EUR, GBP, …), must be supported                                   |
| Quantity               | Number of units/shares held                          | ≥ 0                                                                                            |
| Unit value             | Current value of one unit                            | ≥ 0; auto-fetched for symbol-backed positions                                                  |
| Cost basis per unit    | What you paid per unit (your average purchase price) | Optional; must be > 0 if provided. Used to compute profit/loss and estimated capital gains tax |
| Capital gains tax rate | Your tax rate on gains for this position             | Optional; entered as a percentage 0–100 in forms                                               |
| Description            | Free-form note                                       | Max 256 characters                                                                             |

**Cash and single items:** either set quantity to the balance with unit value 1 (e.g. quantity 5000, unit value 1), or quantity 1 with unit value equal to the total (e.g. a house: quantity 1, unit value 8,200,000). Both work; total value = quantity × unit value.

**Position value** = quantity × unit value. **Profit/loss** = (unit value − cost basis per unit) × quantity, computed from the latest relevant snapshot.

## Portfolio records (buy / sell / update)

| Type     | Meaning                                                                            | Rules                                                                      |
| -------- | ---------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| `buy`    | You acquired units on a date at a price                                            | Quantity and unit value must be > 0                                        |
| `sell`   | You disposed of units on a date at a price                                         | Quantity and unit value must be > 0                                        |
| `update` | A revaluation checkpoint: sets the position's quantity and unit value as of a date | Quantity and unit value must be ≥ 0; optionally resets cost basis per unit |

Buys and sells adjust quantity incrementally and feed cost basis. An `update` overrides the running state — useful for interest accrual on cash, revaluing property, or correcting drift. Record dates use `YYYY-MM-DD` format. After any record change, snapshots recalculate from the record's date until the next `update` record.

## CSV import — positions

Import positions from Dashboard → Assets. Accepts CSV/TSV (and spreadsheet exports). Sample templates are available to download in the import dialog.

- Column **order does not matter**; unknown/extra columns are **ignored**.
- Header names are flexible: common broker/spreadsheet names (DEGIRO, IBKR, Trading212, Fidelity, Vanguard, Schwab, eToro, …) are recognized automatically — e.g. "shares" or "units" → quantity, "ticker" or "ISIN" → symbol_lookup, "avg cost" or "purchase price" → cost_basis_per_unit.

Canonical columns:

| Column                   | Required            | Notes                                                                    |
| ------------------------ | ------------------- | ------------------------------------------------------------------------ |
| `name`                   | **yes**             | Position name                                                            |
| `currency`               | **yes**             | 3-letter ISO 4217 code                                                   |
| `quantity`               | **yes**             | ≥ 0                                                                      |
| `unit_value`             | only when no symbol | Required if `symbol_lookup` is empty; fetched from market data otherwise |
| `cost_basis_per_unit`    | no                  | Purchase price per unit                                                  |
| `capital_gains_tax_rate` | no                  | Accepts decimal (0–1, e.g. `0.26`) or percentage (1–100, e.g. `26`)      |
| `symbol_lookup`          | no                  | Ticker or ISIN; enables automatic pricing                                |
| `category_id`            | no                  | Defaults to `other` if missing or unrecognized                           |
| `description`            | no                  | Free-form note                                                           |

Categories: `cash`, `equity`, `fixed_income`, `real_estate`, `cryptocurrency`, `commodities`, `domain`, `other`. Everyday terms are mapped automatically ("stocks"/"ETF" → equity, "bonds" → fixed_income, "REIT" → real_estate, "bitcoin" → cryptocurrency, "gold" → commodities); anything unrecognized falls back to `other`.

Import behaviors worth knowing:

- Plain crypto codes are normalized to Yahoo format with USD ("BTC" → "BTC-USD") and the currency is set to USD.
- If a symbol's listing currency differs from the CSV's currency, the import adjusts to the symbol's currency (or reports an error asking you to fix the row).
- Prices quoted in pence/fils (GBX/GBp) are converted to the ISO currency (GBP) automatically.

Example rows:

```csv
name,category_id,currency,quantity,unit_value,cost_basis_per_unit,capital_gains_tax_rate,symbol_lookup,description
Emergency Fund,cash,USD,5000.0,1,,,,High-yield savings account
Apple Inc,equity,USD,10.0,,98.50,26,AAPL,
Hong Kong Apartment,real_estate,HKD,1.0,8200000,7800000,,,Residential property
Bitcoin Wallet,cryptocurrency,USD,0.35,,28000,26,BTC-USD,
```

## CSV import — portfolio records

Import buy/sell/update history for **existing positions**. Same flexibility: order-independent headers, aliases recognized, unknown columns ignored.

| Column          | Required | Notes                                     |
| --------------- | -------- | ----------------------------------------- |
| `position_name` | **yes**  | Must match one of your existing positions |
| `type`          | **yes**  | `buy`, `sell`, or `update`                |
| `date`          | **yes**  | `YYYY-MM-DD`                              |
| `quantity`      | **yes**  |                                           |
| `unit_value`    | **yes**  | Price per unit on that date               |
| `description`   | no       |                                           |

Example rows:

```csv
position_name,type,date,quantity,unit_value,description
Apple Inc,buy,2024-01-15,10,150.50,Initial purchase
Apple Inc,sell,2024-09-01,3,185.75,Partial profit taking
Emergency Fund,update,2024-06-30,5000.0,1.00,Interest accrual
```

## Broker file import

Foliofox can also import a broker's own transaction export directly — the format is detected automatically from the file's columns, and positions plus buy/sell records are created from it. Supported brokers:

- **Trade Republic** — transaction export with `date, type, name, symbol, shares, price, currency, …` columns.
- **Scalable Capital** — the genuine export with `date, time, status, reference, description, assetType, type, isin, shares, price, amount, fee, tax, currency`. "Savings plan" executions are imported as buys.
- **Directa** (Italian) — "Movimenti" export with `data_operazione, tipo_operazione, isin, descrizione, quantità, importo_euro, divisa`; day-first dates (dd-mm-yyyy or dd/mm/yyyy) are handled.

If a file doesn't match a supported broker format, the generic positions/records CSV import (above) is the fallback — export or reshape the data to those columns.

For other brokers, the flexible header aliases of the generic import usually accept the broker's positions export as-is; otherwise rename the headers to the canonical ones.

## Currencies & valuation

- All monetary fields use 3-letter ISO 4217 codes. Each position keeps its own currency; dashboard totals convert to your display currency using daily FX rates.
- Market-backed positions are valued with the market price at the given date; custom positions use their latest snapshot value.
- Prices and FX refresh once daily via scheduled jobs — figures are end-of-day, not real-time.
- Capital gains tax rate is stored per position and used to estimate after-tax net worth and capital gains taxes.

## Sharing

The Share button in the dashboard header creates a public read-only link to your portfolio, with a customizable URL slug and a link lifetime you can extend or revoke.
