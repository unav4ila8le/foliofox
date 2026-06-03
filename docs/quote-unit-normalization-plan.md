# Quote Unit Normalization Plan

## Summary

Implement UK and Kuwait market support by keeping `public.currencies`
ISO-only and normalizing provider quote units like `GBp`/`GBX` and `KWF`
into major ISO currencies before values enter symbols, quote cache, dividend
events, positions, FX, P/L, and display. Deployment/admin workflows manage the
available ISO currency list, including `KWD`.

Execution is split into reviewable phases. At the end of every phase, the agent
must stop, summarize changed files and checks run, and wait for your explicit
green light before continuing.

## Phase 0: Add Repo Guardrails To `AGENTS.md`

Add a concise section to root `AGENTS.md`, near Development Principles or
References:

```md
## Planning & Execution Guardrails

- For phased plans, stop after each phase and wait for explicit user approval before continuing.
- Do not run Supabase CLI commands, Next CLI commands, or any command against any database or production system.
- Allowed verification commands are limited to lint, type, format-check, and test checks.
- Do not create Supabase migration files. Ask the user to create an empty migration file first, then edit that file only after it exists.
```

Verification for this phase:

- `npm run format:check` if practical.
- Do not run `npm run type`, because it invokes `next typegen`.

Pause for review.

## Phase 1: Add Quote Unit Normalization Code

Add a small internal quote-unit helper, for example under
`server/market-data/quote-units.ts`, with a typed mapping:

- `GBp`, `GBX` -> `GBP`, multiplier `0.01`
- `KWF` -> `KWD`, multiplier `0.001`
- ISO currency codes -> same currency, multiplier `1`
- unsupported provider units return a clear unsupported quote-unit error

Use this helper when fetching Yahoo symbol metadata so `symbols.currency` stores
the normalized ISO currency, while separate symbol metadata stores the original
quote unit and multiplier.

Update import/validation messaging so symbol-backed position currency means
normalized ISO accounting currency, not provider quote unit.

Tests:

- unit tests for quote-unit mapping and unsupported units
- symbol validation/creation tests for `GBp -> GBP` and `KWF -> KWD`

Allowed checks:

- targeted Vitest tests
- `npm run lint`
- `npm run format:check`
- `./node_modules/.bin/tsc --noEmit` only if it does not require Next-generated
  type updates

Pause for review.

## Phase 2: Migration, After User Creates Empty File

The agent must ask you to create an empty Supabase migration file. It must not
create the file itself and must not run Supabase CLI.

Once the empty migration exists, add SQL to:

- add symbol quote metadata:
  - `quote_currency text not null default currency`
  - `quote_to_currency_rate numeric(20,10) not null default 1`
  - check constraint requiring `quote_to_currency_rate > 0`
- backfill existing symbols to `quote_currency = currency`, multiplier `1`
- add no new FK from `quote_currency` to `currencies`, because quote units are
  not always ISO

Do not insert currencies in migrations; users/admins manage the rows in
`public.currencies` separately.

Update `types/database.types.ts` manually to match the migration, unless you
explicitly run Supabase typegen yourself.

Tests:

- type-level compile coverage through existing symbol insert/update usage
- any affected symbol fixture tests

Pause for review.

## Phase 3: Normalize Quote Cache Prices

Update quote fetching so raw Yahoo chart prices are scaled before caching or
returning:

- `close_price = rawClose * quote_to_currency_rate`
- `adjusted_close_price = rawAdjustedClose * quote_to_currency_rate`
- fallback `regularMarketPrice` is scaled the same way

Extend symbol batch resolution to include `quote_to_currency_rate`, avoiding N+1
lookups.

Existing downstream valuation should remain unchanged because
`fetchPositions({ asOfDateKey })` already uses cached quote prices directly as
unit values.

Tests:

- `BP.L`-style fixture: raw `524.4 GBp` returns/stores `5.244 GBP`
- `NBK.KW`-style fixture: raw `838 KWF` returns/stores `0.838 KWD`
- existing USD/EUR quote behavior remains multiplier `1`

Pause for review.

## Phase 4: Normalize Dividend Event Amounts

Apply quote-unit normalization only to chart dividend event amounts, because
Yahoo chart events use `chart.meta.currency`.

Do not blindly scale `summaryDetail.dividendRate`,
`trailingAnnualDividendRate`, or yield-derived values; those fields can already
be in major currency.

Store dividend events with ISO currency and scaled gross amount.

Tests:

- UK chart dividend event `6.1780996 GBp` stores `0.061780996 GBP`
- Kuwait chart dividend event `35 KWF` stores `0.035 KWD`
- projected income still uses ISO event currency

Pause for review.

## Phase 5: Import, UI, Docs, And Final Verification

Update user-facing import/AI guidance:

- position `currency` must be ISO accounting currency
- `GBX`, `GBp`, and `KWF` in broker files are accepted as quote units and
  normalized
- symbol-backed unit values/cost basis must end up in the normalized ISO currency

Update relevant docs/runbooks to mention quote-unit normalization and the fact
that `public.currencies` remains ISO-only.

Final allowed checks:

- targeted Vitest suites for symbols, quotes, dividends, imports
- `npm run test -- --run`
- `npm run lint`
- `npm run format:check`
- `./node_modules/.bin/tsc --noEmit` if feasible without invoking Next CLI

Explicitly forbidden throughout:

- `supabase` CLI
- `next` CLI
- `npm run build`, `npm run dev`, `npm run type`
- any command against local, staging, or production databases
- creating migration files from scratch

## Assumptions

- `positions.currency`, `symbols.currency`, `dividend_events.currency`,
  profiles, financial profiles, and `exchange_rates` remain ISO-only.
- Quote cache rows should store normalized major-currency unit prices, not raw
  provider quote-unit prices.
- `server/market-data/quote-units.ts` can keep the small provider-unit mapping
  for now. If it grows beyond a handful of deterministic quote units, revisit an
  admin-managed mapping table while keeping `symbols.quote_to_currency_rate` as
  the persisted per-symbol source of truth.
- Historical existing quote rows do not need automatic data migration unless you
  already have affected UK/Kuwait symbols in production; if so, handle reseeding
  separately outside this agent workflow.
