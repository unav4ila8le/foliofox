# Date & Timezone Handling

## Core Principles

1. **Two date semantics, never mixed.** Business-day fields (record dates, snapshot dates, filter boundaries) are civil date keys resolved in the user's timezone. Timestamps (`created_at`, `updated_at`) and cron/provider windows use UTC.
2. **User timezone is persisted.** `profiles.time_zone` (IANA string, NOT NULL, default `'UTC'`) and `profiles.time_zone_mode` (`auto` | `manual`, NOT NULL, default `'auto'`).
3. **No `new Date()` for civil dates.** User-facing "today" is always `resolveTodayDateKey(profile.time_zone)`. Never derive a civil date from `Date` serialization (`toISOString().slice(0,10)`, UTC midnight, etc.).

## Branded Types

`lib/date/date-utils.ts` exports two branded string types to prevent mixing at compile time:

| Type           | Purpose                                        | Constructor                                              |
| -------------- | ---------------------------------------------- | -------------------------------------------------------- |
| `CivilDateKey` | User/business civil day (`YYYY-MM-DD`)         | `toCivilDateKey(value)` / `toCivilDateKeyOrThrow(value)` |
| `UTCDateKey`   | Provider/cron/UTC-day semantics (`YYYY-MM-DD`) | `toUTCDateKey(value)`                                    |

Both are plain strings at runtime. The branding prevents accidental assignment between the two.

## Key Helpers

| Helper                                    | Returns               | Use when                                                                                    |
| ----------------------------------------- | --------------------- | ------------------------------------------------------------------------------------------- |
| `resolveTodayDateKey(timeZone, now?)`     | `CivilDateKey`        | You need "today" for a user-facing query or display                                         |
| `formatDateKeyInTimeZone(date, timeZone)` | `CivilDateKey`        | You have a `Date` and need the civil day in a specific timezone                             |
| `addCivilDateKeyDays(dateKey, days)`      | `CivilDateKey`        | Shifting a civil key by calendar days (uses UTC carrier internally to avoid DST drift)      |
| `buildCivilDateKeyRange(start, end)`      | `CivilDateKey[]`      | Building an inclusive day-by-day axis                                                       |
| `formatUTCDateKey(date)`                  | `UTCDateKey`          | Formatting a `Date` as a UTC day key (cron, provider, cache keys)                           |
| `parseUTCDateKey(dateKey)`                | `Date` (UTC midnight) | Parsing a `YYYY-MM-DD` key into a deterministic UTC `Date` for arithmetic or provider calls |

## Where Each Semantic Applies

### Civil date keys (`CivilDateKey`)

- `fetchPositions({ asOfDateKey })` — snapshot/record filtering
- `fetchPortfolioRecords({ startDateKey, endDateKey })`
- `fetchPositionSnapshots({ startDateKey, endDateKey })`
- Dashboard, analytics, AI tools — any "today" or date-range input
- Public portfolio valuation day (uses **owner** timezone)
- Portfolio record `date` column (written from browser form, already civil)

### UTC date keys (`UTCDateKey`)

- Cron fetch windows and provider effective dates
- Market-data handler `date` parameter (UTC carrier date)
- Exchange-rate lookback windows
- `quotes.date` and `exchange_rates.date` cache table keys

## Timezone Model

- Every profile defaults to `time_zone='UTC'`, `time_zone_mode='auto'`.
- Auto-mode users get silent browser-based sync via `syncProfileTimeZone()` in the dashboard layout. No blocking UI.
- Manual-mode users are never overwritten by auto-sync.
- Timezone is validated against IANA zones (`isValidIanaTimeZone` in `lib/date/time-zone.ts`).
- Public portfolio views use the owner's timezone, not the viewer's.

## Rules of Thumb

- If you are writing a query filter for user-visible data, accept `CivilDateKey`.
- If you are calling a market-data provider or writing cron logic, use `UTCDateKey` or raw `Date` in UTC.
- Never convert between the two implicitly. If a boundary crosses (e.g., civil key to provider date), use `parseUTCDateKey(civilDateKey)` explicitly — this is a deterministic conversion that anchors the key at UTC midnight.
- `resolveTodayDateKey` is request-time data. Do not cache its result across civil-midnight boundaries.

## Documented Limitation

Changing a user's timezone (via settings or auto-sync) affects forward-looking "today/as-of" resolution only. Historical records and snapshots keep their originally stored civil date keys — no retroactive re-interpretation is performed.

## Related

- [MARKET-DATA-HUB.md](./MARKET-DATA-HUB.md) — market data handler architecture (UTC provider semantics)
- [SYMBOL-RENAME-HANDLING.md](./SYMBOL-RENAME-HANDLING.md) — symbol health and stale detection
