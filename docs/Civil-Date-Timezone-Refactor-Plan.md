## Civil-Date Timezone Refactor Plan (Phased, Approval-Gated)

### Summary

Current behavior mixes two incompatible semantics:

1. Record writes use user civil dates (`YYYY-MM-DD` from the browser form).
2. Holdings reads cut off by UTC day (`asOfDate: new Date()` -> `toISOString().slice(0,10)`).

This causes the regression you observed:

- At **2026-03-01 08:30 KST** (still **2026-02-28 UTC**), a record saved as `2026-03-01` is excluded from reads filtered to `<= 2026-02-28`.
- It appears only after UTC midnight (around **09:00 KST**).

Why this is problematic:

1. Users in UTC+ offsets get stale holdings every morning window.
2. “Today” differs between write paths and read paths.
3. The same inconsistency affects holdings, public portfolio views, and analytics defaults.

Fix once and for all:

1. Persist user timezone (`profiles.time_zone`, IANA).
2. Treat business dates as civil `DateKey` (`YYYY-MM-DD`) resolved in actor timezone.
3. Keep UTC for timestamps, cron, provider fetch windows, and storage instants.
4. Remove UTC-day fallback logic from user-civil pathways.

---

## Public API / Interface / Type Changes

1. Database profile shape:

- Add `profiles.time_zone` (IANA timezone string).
- `types/database.types.ts` must be regenerated after migration(s).

2. Profile APIs:

- Extend `updateProfile(formData)` to accept/update `time_zone`.
- Add new idempotent server action: `syncProfileTimeZone(timeZone: string)` for silent browser-based bootstrap.
- Timezone setting semantics: UI can expose an `Auto` option, but backend always stores a concrete IANA timezone in `profiles.time_zone` (no separate auto/manual mode column).

3. Date contracts:

- Introduce branded key types to prevent semantic mixups at compile time:
  - `CivilDateKey` (user/business civil day)
  - `UTCDateKey` (provider/cron/UTC-day semantics)
- Add constructor/parser/validator helpers so public APIs avoid raw `string` where possible.
- Refactor date-sensitive read APIs to key-based inputs instead of `Date` cutoffs:
  - `fetchPositions({ asOfDateKey?: CivilDateKey | null, ... })`
  - `fetchPortfolioRecords({ startDateKey?: CivilDateKey, endDateKey?: CivilDateKey, ... })`
  - `fetchPositionSnapshots({ startDateKey?: CivilDateKey, endDateKey?: CivilDateKey, ... })`
- Explicit market-data boundary in `fetchPositions`:
  - Snapshot/record filtering uses `CivilDateKey` directly in SQL.
  - Market-data fetch continues to use UTC/provider semantics by converting `CivilDateKey` to a deterministic UTC carrier date (`parseUTCDateKey(asOfDateKey)`) for existing market-data handlers.
  - No civil key is ever derived from a `Date` object at this boundary.

4. Public portfolio typing:

- `PublicPortfolioWithProfile.profile` includes `time_zone`.
- Public valuation day uses **owner timezone** (minimal clean change, consistent output for all viewers).

5. Timezone inference contract:

- Infer timezone only from browser API: `Intl.DateTimeFormat().resolvedOptions().timeZone`.
- Validate inferred/manual values against supported IANA zones before persist.
- Do not infer timezone from locale headers or IP geolocation.
- Locale provider remains formatting-only; timezone for civil-day business logic comes from persisted profile data.

6. Cache and midnight rollover contract:

- `resolveTodayDateKey(timeZone)` is request-time data and must not be cached across civil-midnight boundaries.
- Any route-level/server cache that depends on civil "today" must use short TTL and/or include resolved date key in cache key.
- Bootstrap-gate branch must not be cached in a way that persists after timezone sync.
  - Either bypass cache for the null-timezone branch, or key that branch by current `profile.time_zone` and refresh after sync.

---

## Phase 1 — Schema + Profile Plumbing

### Goal

Introduce timezone as first-class profile data and surface it in settings.

### Work

1. Add `time_zone` to `public.profiles` via migration pattern aligned with recent migrations (`BEGIN/COMMIT`, safe alters).
2. Regenerate Supabase TS types.
3. Update profile fetch/update paths to include timezone.
4. Add timezone field to settings form UI (read/write).
5. Timezone field behavior: default selection is `Auto` (like Locale).
6. If user saves with `Auto`, client resolves browser timezone and submits/stores concrete IANA value.
7. Add timezone validation utility (IANA validation in app runtime).

### User action required

1. You create migration file (I will provide exact SQL content when executing this phase).
2. You run migration.
3. You regenerate `types/database.types.ts`.

### Verification

1. Settings can persist timezone.
2. Profile fetch returns timezone.
3. Typecheck passes.

### Approval gate

Stop and wait for your review/approval before Phase 2.

---

## Phase 2 — Silent Timezone Bootstrap + Strict Access Gate

### Goal

Enforce that date-sensitive pages only run when timezone exists, without UTC fallback logic.

### Work

1. Add client bootstrap flow:

- Detect browser timezone via `Intl.DateTimeFormat().resolvedOptions().timeZone`.
- Call `syncProfileTimeZone()` silently.
- `syncProfileTimeZone()` must be idempotent and race-safe (`UPDATE ... WHERE user_id = ? AND time_zone IS NULL`) so multi-tab bootstrap calls are safe and do not overwrite a manually-set timezone.
- Refresh route only when the current tab actually changed `time_zone` from `NULL` to a concrete value.
- Reuse this same browser inference path when settings are saved with `Auto`.

2. Gate dashboard date-sensitive rendering:

- In dashboard layout flow, resolve profile first.
- If timezone missing, render bootstrap gate instead of running holdings/analytics queries.
- Implementation detail (required): branch in `app/(dashboard)/dashboard/layout.tsx` immediately after `fetchProfile()`.
  - Branch A (`time_zone` is null): render dashboard shell + bootstrap gate only, and skip `Promise.all` for `calculateNetWorth`, `fetchStalePositions`, and other heavy data calls.
  - Branch B (`time_zone` present): execute the current data-driven path.
- This gate logic must live in layout/page flow, not middleware redirects.

3. Public portfolio handling:

- Start with owner-timezone requirements on public-share creation/update flows.
- Do not switch existing public render paths yet in this phase; final public cutover happens in Phase 4 after readiness checks.

4. Public share enable/update guard:

- Prevent enabling/updating public sharing until owner timezone exists.

5. User experience constraints:

- Bootstrap gate must preserve dashboard shell and show a deterministic loading state (avoid full-page blink).
- This is a one-time post-release sync path for legacy users with null timezone.

### Verification

1. Existing user with null timezone gets silently synced on first dashboard load.
2. No holdings/analytics query executes with missing timezone.
3. Public-share create/update flows are blocked until owner timezone is present.
4. Null-timezone branch skips heavy `Promise.all` data calls and avoids full-page blink.

### Approval gate

Stop and wait for your review/approval before Phase 3.

---

## Phase 3 — Core Date-Key Refactor in Data Layer

### Goal

Remove Date-object cutoff drift in core reads, with atomic contract + callsite migration.

### Work

1. Add timezone-aware date helpers:

- `formatDateKeyInTimeZone(date, timeZone)`
- `resolveTodayDateKey(timeZone, now?)`
- `toCivilDateKey(...)` / `toUTCDateKey(...)` parser-validators for branded key construction
- Keep `formatUTCDateKey` only for UTC/provider/cron use.

2. Refactor data access contracts:

- `fetchPositions` to consume `asOfDateKey`.
- `fetchPortfolioRecords` and `fetchPositionSnapshots` to consume `startDateKey/endDateKey`.
- Remove `toISOString().slice(0,10)` from civil-date query paths.

3. Explicit callsite migration inventory:

- `app/(dashboard)/dashboard/assets/page.tsx`
- `app/(dashboard)/dashboard/assets/[id]/page.tsx`
- `components/dashboard/new-portfolio-record/position-selector.tsx`
- `app/(public)/portfolio/[slug]/page.tsx`
- `app/(dashboard)/dashboard/portfolio-records/page.tsx`
- Date-filter parsing callsites currently using `parseUTCDateKey(...)` for civil filter params.

4. Phase sequencing safety:

- Phase 3 and Phase 4 are an atomic deploy pair (single release train, no production deploy in between).
- No intermediate commit is allowed to break public function signatures or leave mixed old/new date contracts.

### Verification

1. Snapshot/record filtering is date-key based, not runtime timezone-sensitive `Date` serialization.
2. No `toISOString().slice(0,10)` remains in civil-date query filters.
3. Typecheck and affected tests pass.

### Approval gate

Stop and wait for your review/approval before Phase 4.
Do not deploy Phase 3 independently.

---

## Phase 4 — Holdings and Public Holdings Cutover

### Goal

Eliminate stale morning holdings in dashboard and public holdings pages.

### Work

1. Replace `asOfDate: new Date()` usage in:

- Dashboard assets list/detail.
- Position selector used by new record flow.
- Public portfolio holdings/overview wrappers.
- Client-to-server boundaries (e.g., position selector) pass `CivilDateKey`, not `Date` objects.

2. Resolve `todayDateKey` from actor timezone:

- Authenticated views: viewer profile timezone.
- Public views: owner profile timezone.

3. Keep write-side record date flow as civil `YYYY-MM-DD` (already correct).

4. Public cutover readiness gates (before enabling owner-timezone rendering for all public views):

- Query and verify active public portfolio owners have non-null `time_zone`.
- If readiness is not met, do not deploy public-render cutover yet (no UTC fallback path introduced).

### Verification

1. Regression scenario passes:

- KST user creates `update` at 08:30 local.
- Refresh immediately shows new quantity (no wait for UTC midnight).

2. Public holdings stay consistent regardless of viewer timezone.
3. Public holdings cutover executes only after readiness gate is satisfied.

### Approval gate

Stop and wait for your review/approval before Phase 5.

---

## Phase 5 — Analytics + AI Day-Semantics Cutover

### Goal

Make all “today/as-of” analytics use user civil day consistently.

### Work

1. Refactor analytics defaults that currently use `startOfUTCDay(new Date())` for user-facing metrics:

- Net worth.
- Asset allocation.
- Net worth history/change.
- Related dashboard wrappers.

2. Net worth history/date-axis deep refactor:

- Replace UTC-day axis generation (`startOfUTCDay` + `addUTCDays`) with civil-day axis generation anchored to `CivilDateKey`.
- Add civil-day increment helpers for history windows.
- Explicitly evaluate `server/analysis/valuations-history/synthesize.ts` and keep UTC internals only where market-data semantics require UTC.

3. Refactor AI date defaults to profile civil day where they represent user “today”, including:

- AI tool defaults.
- `server/ai/system-prompt.ts` “today” injection (remove UTC-string shortcut patterns).

4. Preserve UTC logic for cron and provider effective-date mechanics.

### Verification

1. Dashboard analytics align with holdings day semantics.
2. History/chart date axes use civil-day logic and remain stable across DST boundaries.
3. AI/tooling “today” (including system prompt) matches profile timezone.
4. UTC-only internals (cron/provider freshness windows) remain unchanged.

### Approval gate

Stop and wait for your review/approval before Phase 6.

---

## Phase 6 — Cleanup + Final Hardening

### Goal

Finish the full cut and remove deprecated date logic.

### Work

1. Remove deprecated civil-date code paths that rely on implicit UTC day cutoffs.
2. Remove temporary compatibility overloads and any mixed `Date`/date-key pathways introduced during migration.
3. Audit and clean comments/docs to state final date model.
4. Add guard tests to prevent reintroduction of old patterns in civil-date pathways.
5. Final DB hardening migration to set `profiles.time_zone` `NOT NULL` after null count reaches zero.

### User action required

1. You create and run final hardening migration (`SET NOT NULL`) only when data is ready.
2. I will provide exact SQL and readiness query during execution.

### Verification

1. `SELECT count(*) FROM public.profiles WHERE time_zone IS NULL;` returns `0`.
2. Active public portfolio owner readiness query confirms no null timezone before public cutover.
3. No user-civil pathway uses UTC fallback semantics.
4. Final regression suite passes.

### Approval gate

Stop for your final review and sign-off.

---

## Test Cases and Scenarios (to implement across phases)

1. Core regression:

- Asia/Seoul user updates quantity at 08:30 local; immediate refresh reflects new quantity.

2. Timezone extremes:

- UTC+14 and UTC-12 users around local midnight and UTC midnight.

3. Public portfolio:

- Viewer in different timezone sees values based on owner timezone consistently.

4. Missing timezone bootstrap:

- Null timezone profile gets silent sync and then correct data render.

5. Settings timezone behavior:

- Timezone field defaults to `Auto`.
- Saving with `Auto` persists the concrete browser-resolved IANA timezone.
- Switching from manual timezone back to `Auto` updates stored timezone to current browser-resolved value.

6. Analytics consistency:

- Holdings total and net worth “today” use same civil day key.

7. Date-range filters:

- `dateFrom/dateTo` parsing and query boundaries remain stable across timezones.

8. Safety checks:

- Cron/provider code paths still use UTC logic and are unaffected.

9. Market-data boundary correctness:

- `CivilDateKey` filters snapshots directly.
- Market-data requests use deterministic UTC carrier date conversion from the same civil key.

10. Bootstrap race safety:

- Multiple tabs calling `syncProfileTimeZone()` do not overwrite manual timezone and do not cause redundant refresh loops.

11. DST boundary behavior:

- Civil "today" resolution remains correct on DST start/end days for affected timezones.
- Cached pages do not serve stale civil-day keys across local midnight.

12. AI prompt consistency:

- `server/ai/system-prompt.ts` "today" value matches profile timezone rather than UTC day.

---

## Documented Limitation

1. Timezone changes after historical data entry:

- Existing records and snapshots keep their stored civil date keys (`YYYY-MM-DD`).
- Changing `profiles.time_zone` affects forward-looking "today/as-of" resolution, not historical date keys already persisted.
- This is acceptable and expected; no historical re-interpretation migration is performed.

---

## Code Readability Standards (Required Across All Phases)

1. Add concise comments where business logic or multi-step transformations are not obvious from code alone.
2. Prioritize junior-friendly readability: explicit naming, low indirection, and clear data-flow over clever abstractions.
3. Keep comments minimal but descriptive:

- Explain _why_ a step exists, not only _what_ the line does.
- Avoid noisy comments that simply restate the code.

4. For large or delicate functions, split logic into clearly labeled sections and use numbered flow comments when helpful (for example: `1. Resolve inputs`, `2. Validate`, `3. Query`, `4. Transform`, `5. Return`).
5. If a function already uses numbered flow comments, preserve and extend that structure consistently when editing.
6. During reviews for each phase, include readability checks as first-class acceptance criteria, not an optional polish pass.

---

## Assumptions and Defaults Chosen

1. Timezone model: per-user persisted DB timezone (`profiles.time_zone`).
2. Initial capture: infer from browser and auto-save silently.
3. `Auto` is UI-only; persisted profile value is always a concrete IANA timezone.
4. Public valuation day: owner timezone.
5. No UTC fallback in user-civil logic after cutover.
6. UTC retained for timestamps, cron, and market/provider internal date logic.
7. Phase 3 and Phase 4 are deployed atomically to avoid broken contracts.
8. Migration workflow constraint: I will not create or run migrations; you will create/run them when each phase requires it.
