# Broker Transaction CSV Import Plan

## Summary

Implement in phases and stop after each phase for approval. The empty migration exists at `supabase/migrations/20260618021734_add_portfolio_record_external_transaction_ids.sql`.

Keep Foliofox’s model unchanged: positions are holdings, records are transactions, snapshots are derived. Add broker transaction import as an adapter-based layer so future brokers only need a new adapter.

## Phase 1: Transaction Metadata Foundation

- Edit the existing empty migration only.
- Add nullable `portfolio_records.import_source text` and `portfolio_records.external_transaction_id text`.
- Add a partial unique index on `(user_id, import_source, external_transaction_id)` where both fields are non-null.
- Do not backfill existing records; manual records keep only their internal `portfolio_records.id`.
- Stop after this phase. User applies migration and regenerates Supabase types.

## Phase 2: Adapter-Based Parser Layer

- Add `lib/import/broker-transactions/` with:
  - shared adapter types
  - shared CSV detection helpers
  - a registry of adapters
  - `trade-republic` adapter as the first implementation
- Adapter contract:
  - `source`: stable import source string, e.g. `"trade_republic"`
  - `detect(headers)`: returns whether this adapter owns the CSV
  - `parse(csvContent)`: returns normalized position drafts, record drafts, ignored row count, warnings, and errors
- Trade Republic adapter:
  - detects headers like `datetime`, `category`, `type`, `asset_class`, `name`, `symbol`, `shares`, `price`, `currency`, `transaction_id`
  - imports only `category = TRADING` and `type = BUY|SELL`
  - converts sell shares to positive sell quantities
  - groups instruments by broker symbol/ISIN plus name
  - keeps fully sold positions active
  - warns that cash, dividend, interest, fee, and tax rows are ignored
- Add concise comments around adapter contract, row filtering, and broker-specific assumptions.

## Phase 3: Combined Import Server Flow

- Update the asset CSV import flow to auto-route:
  - normal positions CSV: existing behavior
  - broker transaction CSV: adapter-backed combined import
- For broker transaction imports:
  - match existing active positions by normalized name
  - create missing positions with quantity `0`, earliest trade date, broker currency, category from `asset_class`, and first trade price as initial unit value
  - create manual positions when instrument resolution is not available yet or cannot produce a safe match
  - insert buy/sell records with `import_source` and `external_transaction_id`
  - skip records already imported by external transaction ID
  - reuse existing timeline validation and snapshot recalculation
- Add comments for idempotency, zero-quantity position creation, and snapshot recalculation assumptions.

## Phase 3b: Instrument Resolution And Currency Safety

- Add broker instrument resolution before creating missing positions.
- Keep adapters broker-focused: they emit broker symbols/ISINs, names, and currencies, but do not call market-data providers.
- Detect ISIN-like broker symbols with a strict ISIN pattern.
- Resolve in this order:
  - existing `symbol_aliases` match for `type = "isin"` and the broker symbol
  - existing ticker alias when the broker symbol is not an ISIN
  - provider search by ISIN, then by instrument name
- Persist successful ISIN matches as non-primary aliases, e.g. `source = "trade_republic"`, `type = "isin"`, without changing the primary ticker alias.
- Return one resolution state per broker position:
  - `auto_linked`: one confident symbol match exists and its quote currency matches the broker transaction currency
  - `needs_review`: one or more candidates exist, but none can be safely auto-selected
  - `unresolved`: no usable candidates were found
- Auto-link a broker transaction position only for `auto_linked` matches.
- For Trade Republic, prefer EUR-quoted candidates because the sample export records trading `price`, `amount`, and `fee` in EUR.
- Do not use the first provider result as a fallback. A same-ISIN, different-currency symbol can make EUR records and non-EUR market prices look valid while producing wrong P/L.
- For `needs_review`, pause final import and route the user through the asset import review flow with candidate symbols and currencies.
- For `unresolved`, allow manual/custom import from the review flow and show a warning.
- Do not add FX conversion in this phase; records currently store unit values without per-record currency metadata.
- Add tests for ISIN alias lookup, provider fallback, currency-matched auto-linking, currency-mismatch review state, and unresolved manual fallback.
- Stop after this phase before the UI/results phase.

## Phase 4: UI And Results

- Update “Import Assets” CSV copy to say it accepts either positions/holdings CSVs or broker transaction CSVs.
- Show detected import kind after upload.
- Route broker transaction imports through review whenever any position has `needs_review` or `unresolved` instrument resolution.
- In broker review, show candidate symbols with ticker, exchange/name when available, quote currency, and whether the candidate matches the broker transaction currency.
- Allow the user to choose a same-currency candidate and import it as symbol-backed.
- Block different-currency candidate selection for v1 unless FX conversion is implemented; explain that Trade Republic records are in broker transaction currency.
- Allow unresolved positions to continue as manual/custom positions, but make the warning explicit.
- For broker transaction CSVs, show:
  - positions to create
  - existing positions matched
  - auto-linked symbols
  - positions needing symbol review
  - unresolved/manual positions
  - records to import
  - duplicate records skipped
  - ignored non-trading rows
  - warnings
- Keep the existing records import dialog unchanged.
- Update the existing asset edit UI so positions without a current symbol show a “Link Symbol” action using the existing update-symbol dialog. This prevents manual broker fallbacks from becoming a dead end.

## Phase 5: Cross-Currency Broker Record Conversion

- Allow users to select a different-currency symbol candidate during broker import review.
- When the selected symbol currency differs from the broker transaction currency, convert imported record `unit_value` values before saving them.
- Use the selected or existing position currency as the target currency:
  - new symbol-backed position: selected symbol currency
  - existing matched position: existing position currency
  - manual/custom fallback: broker transaction currency, no conversion
- Convert only monetary per-unit values; never convert share quantities.
- Convert each buy/sell record using historical FX for that record date.
- Batch FX requests by unique `(currency, date)` pairs using the existing `fetchExchangeRates` path.
- Use existing `convertCurrency` math only after confirming all required source and target currency rates exist. Do not silently keep the original amount when FX data is missing.
- For converted symbol-backed positions, create the initial zero-quantity position in the target symbol currency and convert `firstUnitValue` into that target currency.
- Surface conversion details in the broker review/results UI:
  - broker transaction currency
  - selected symbol currency
  - count of records that will be converted
  - warning that historical FX is applied per transaction date
- Block final import if required FX rates cannot be fetched.
- Keep fees, dividends, interest, taxes, and cash rows ignored in this phase; only buy/sell unit prices are converted.
- Add tests for EUR transaction records imported into USD symbol-backed positions, same-currency no-op conversion, missing FX blocking, and existing matched position currency conversion.
- Stop after this phase and verify with targeted tests, type check, lint, and format check only.

## Test Plan

- Unit test adapter detection and Trade Republic parsing.
- Unit test buy/sell normalization, negative sell shares, ignored non-trading rows, duplicate transaction IDs, and fully sold instruments staying active.
- Regression test existing positions CSV parsing.
- Regression test existing portfolio records CSV parsing.
- Unit test broker instrument resolution and currency-safety fallback.
- UI/regression test that manual/custom asset positions expose the existing symbol-link dialog.
- Unit test broker FX conversion for different-currency symbol selections and existing matched positions.
- Verify with targeted `vitest`, type check, and lint only. No Supabase CLI, Next CLI, database commands, or production-system commands.

## Supported Adapters

- `trade_republic`: English transaction export; broker-provided `transaction_id`.
- `scalable_capital`: semicolon CSV (`date;description;type;isin;shares;price;amount;fee;tax;currency`), EU decimals; `Buy`/`Sell`/`Savings plan` rows import, cash rows ignored. No per-row ID, so external transaction IDs are synthesized from normalized row content plus an occurrence suffix for identical rows.
- `directa`: Italian "Movimenti" export with metadata preamble before the header row; `Acquisto`/`Vendita` import, `Commissioni` ignored. Unit price is derived from amount ÷ quantity (`Importo Divisa` for non-EUR trades). `Riferimento ordine` is per-order and Excel-mangled in the wild, so IDs are synthesized the same way as Scalable Capital.
- Adapters own their detection (`detect(csvContent)`) and stay self-contained by design: a broker changing its export format is patched in that adapter file and its test only.

## Assumptions

- New brokers are added as new adapters in `lib/import/broker-transactions/adapters/`.
- Fees, dividends, interest, taxes, and cash movements are ignored in v1 with warnings.
- Trade Republic trading rows may use broker venue currency rather than the instrument home-listing currency; auto-linking must be currency-safe.
- Users expect broker-imported positions to become symbol-backed when safe, but correctness is more important than silently linking the wrong quote currency.
- Different-currency symbol-backed broker imports require historical FX conversion before records are saved.
- Manual records do not need external transaction IDs.
- Re-upload safety is based on `(user_id, import_source, external_transaction_id)`.
