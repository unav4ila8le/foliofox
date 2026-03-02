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

1. Persist user timezone (`profiles.time_zone`, IANA) and timezone preference mode (`profiles.time_zone_mode`).
2. Treat business dates as civil `DateKey` (`YYYY-MM-DD`) resolved in actor timezone.
3. Keep UTC for timestamps, cron, provider fetch windows, and storage instants.
4. Remove UTC-day fallback logic from user-civil pathways.
5. Avoid nullable timezone bootstrap states by defaulting profiles to `UTC` + `auto`, then silently syncing to browser timezone.

---

## Public API / Interface / Type Changes

1. Database profile shape:

- Add `profiles.time_zone` (IANA timezone string), `NOT NULL`, default `'UTC'`.
- Add `profiles.time_zone_mode` (`auto` | `manual`), `NOT NULL`, default `'auto'`.
- `types/database.types.ts` must be regenerated after migration(s).

2. Profile APIs:

- Extend `updateProfile(formData)` to accept/update `time_zone` and `time_zone_mode`.
- Add new idempotent server action: `syncProfileTimeZone(timeZone: string)` for silent browser-based auto-follow updates.
- Timezone setting semantics:
  - If user selects `Auto`, persist `time_zone_mode='auto'` and also persist a concrete IANA value in `time_zone`.
  - If user selects a specific timezone, persist `time_zone_mode='manual'` and that concrete IANA value in `time_zone`.
  - UI shows `Auto` whenever `time_zone_mode='auto'`, even though `time_zone` still stores a concrete value used by backend date logic.

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
- Only auto-follow (silent `time_zone` updates) when `time_zone_mode='auto'`.
- Do not infer timezone from locale headers or IP geolocation.
- Locale provider remains formatting-only; timezone for civil-day business logic comes from persisted profile data.

6. Cache and midnight rollover contract:

- `resolveTodayDateKey(timeZone)` is request-time data and must not be cached across civil-midnight boundaries.
- Any route-level/server cache that depends on civil "today" must use short TTL and/or include resolved date key in cache key.
- Silent timezone auto-sync should trigger at most one client refresh per tab when persisted timezone actually changes.
- Auto-sync flow must guard against refresh loops (single-flight client state + idempotent server action result).

---

## Phase 1 — Schema + Profile Plumbing

### Goal

Introduce timezone as first-class profile data and surface it in settings.

### Work

1. Add `time_zone` to `public.profiles` via migration pattern aligned with recent migrations (`BEGIN/COMMIT`, safe alters), with default `'UTC'`.
2. Add `time_zone_mode` to `public.profiles` with allowed values (`auto`, `manual`), default `'auto'`, and consistency checks with `time_zone`.
3. Backfill existing profiles so both columns are non-null, then enforce `NOT NULL` in the same migration (pre-production safe path).
4. Regenerate Supabase TS types.
5. Update profile fetch/update paths to include timezone + mode.
6. Add timezone field to settings form UI (read/write).
7. Timezone field behavior: default selection is `Auto` (like Locale).
8. If user saves with `Auto`, client resolves browser timezone and submits/stores concrete IANA value with `time_zone_mode='auto'`.
9. If user saves a manual timezone, store that value with `time_zone_mode='manual'`.
10. Add timezone validation utility (IANA validation in app runtime).

### User action required

1. You create migration file (I will provide exact SQL content when executing this phase).
2. You run migration.
3. You regenerate `types/database.types.ts`.
4. Since this is pre-production, if needed you can revert and edit the latest migration in place before reapplying.

### Verification

1. Settings can persist timezone and mode.
2. Reopening settings preserves `Auto` selection when `time_zone_mode='auto'`.
3. Profile fetch returns timezone + mode.
4. Typecheck passes.

### Approval gate

Stop and wait for your review/approval before Phase 2.

---

## Phase 2 — Invisible Timezone Auto-Sync (No Dashboard Gate)

### Goal

Keep dashboard UX uninterrupted while keeping `auto` users aligned to their current browser timezone.

### Work

1. Add client auto-sync flow in existing authenticated UI (no new route/page):

- Detect browser timezone via `Intl.DateTimeFormat().resolvedOptions().timeZone`.
- Call `syncProfileTimeZone()` silently.
- `syncProfileTimeZone()` must be idempotent and race-safe:
  - Update timezone only when `time_zone_mode='auto'` and detected timezone differs.
  - Never overwrite timezone when `time_zone_mode='manual'`.
- Refresh route only when the current tab actually changed persisted timezone state.
- Reuse this same browser inference path when settings are saved with `Auto`.
- Do not add timezone sync in login/signup server actions; keep sync logic centralized in authenticated dashboard layout flow.

2. Keep dashboard layout fully data-driven (no timezone gate branch):

- Do not block or branch heavy queries behind a visible sync gate.
- Remove temporary bootstrap cards/skeleton loaders for timezone setup.
- If timezone changes due to auto-sync, do one lightweight refresh to align server-rendered data.

3. Public portfolio handling:

- Keep owner-timezone requirements on public-share creation/update flows.
- Do not switch existing public render paths yet in this phase; final public cutover happens in Phase 4 after readiness checks.

4. Public share enable/update guard:

- Keep validation guard on public sharing flows to ensure timezone integrity before enable/update operations.

5. User experience constraints:

- No visible timezone-sync screen, alert card, or dedicated client bootstrap page.
- Auto-sync runs in background and should feel instantaneous in the common case.
- During rollout, users whose stored timezone still differs from browser timezone may see one stale first render followed by one refresh; this is expected and acceptable.

### Verification

1. Dashboard loads normally without any timezone-gate UI.
2. Auto-mode user whose browser timezone changes gets silent timezone refresh without switching to manual mode.
3. Refresh happens only when persisted timezone changed (no refresh loops).
4. Login/signup flow does not perform timezone synchronization.
5. Public-share create/update validations remain intact.

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

### Implementation notes (2026-03-02)

1. `calculateNetWorth` and `calculateAssetAllocation` now default "today" via `resolveTodayDateKey(profile.time_zone)` and accept explicit `CivilDateKey` callers.
2. Net-worth history axis generation now uses civil date-key range helpers (no UTC-day axis builder in user-civil paths).
3. `synthesizeDailyValuationsByPosition` now consumes `startDateKey/endDateKey` (civil keys) while keeping UTC carrier dates only for deterministic internal date objects.
4. AI date defaults (tools + system prompt) now resolve "today" from profile timezone.

### Approval gate

Stop and wait for your review/approval before Phase 6.

---

## Phase 6 — Cleanup + Hardening

### Goal

Finish the full cut and remove deprecated date logic.

### Work

1. Remove deprecated civil-date code paths that rely on implicit UTC day cutoffs.
2. Remove temporary compatibility overloads and any mixed `Date`/date-key pathways introduced during migration.
3. Remove temporary bootstrap-gate/fallback code paths that were only needed during transition.
4. Audit and clean comments/docs to state final date model.
5. Add guard tests to prevent reintroduction of old patterns in civil-date pathways.

### Verification

1. Schema confirms `profiles.time_zone` and `profiles.time_zone_mode` are `NOT NULL` with expected defaults/checks.
2. No user-civil pathway uses UTC fallback semantics.
3. Final regression suite passes.

### Implementation notes (2026-03-02)

1. Removed remaining user-facing UTC fallback in projected income; both `calculateProjectedIncome` and `calculateProjectedIncomeByAsset` now accept/use `CivilDateKey` (`asOfDateKey`) and default to profile civil today.
2. Extracted shared projected-income FX conversion workflow into `createProjectedIncomeFxContext(...)` to remove duplicated conversion/error-tracking code.
3. Simplified `clampDateRange(...)` to a pure synchronous helper with explicit `todayDateKey` input (no hidden profile fetch side effects).
4. Removed unused/deprecated valuation synthesis exports (`toDateKeyFromUTCDate`, `parseDateKeyToUTCDate`) and corresponding tests.
5. Added guard tests:
   - `server/analysis/projected-income/portfolio.test.ts` now verifies provided civil `asOfDateKey` controls FX request day.
   - `server/ai/system-prompt.test.ts` verifies prompt date comes from injected civil key.
   - `server/ai/tools/helpers/time-range.test.ts` verifies civil range clamping behavior.

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

4. Default bootstrap + auto-sync:

- Profiles start with `time_zone='UTC'` and `time_zone_mode='auto'` after migration.
- Silent auto-sync updates to browser timezone when needed and refreshes once.
- Auto-sync/checking runs in dashboard authenticated layout flow; no login/signup timezone sync path.

5. Settings timezone behavior:

- Timezone field defaults to `Auto`.
- Saving with `Auto` persists concrete browser-resolved IANA timezone and `time_zone_mode='auto'`.
- Reopening settings after saving `Auto` still displays `Auto` (not the concrete IANA value in the selector field).
- Saving a manual timezone persists that timezone and `time_zone_mode='manual'`.
- Switching from manual timezone back to `Auto` updates stored timezone to current browser-resolved value and restores `time_zone_mode='auto'`.
- In `auto` mode, changing device/browser timezone updates stored `time_zone` silently without changing mode.

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
- Changing `profiles.time_zone` (whether via manual settings or auto-follow updates in `auto` mode) affects forward-looking "today/as-of" resolution, not historical date keys already persisted.
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

1. Timezone model: per-user persisted DB timezone (`profiles.time_zone`) + mode (`profiles.time_zone_mode`).
2. Profiles default to `time_zone='UTC'` and `time_zone_mode='auto'` (no nullable bootstrap state).
3. Initial capture and ongoing updates: infer from browser and sync silently in auto mode; runtime sync happens in authenticated dashboard layout auto-sync flow (not in login/signup actions).
4. Public valuation day: owner timezone.
5. No UTC fallback in user-civil logic after cutover.
6. UTC retained for timestamps, cron, and market/provider internal date logic.
7. No visible timezone-gate UI in dashboard; sync is background and non-blocking.
8. Phase 3 and Phase 4 are deployed atomically to avoid broken contracts.
9. Migration workflow constraint: I will not create or run migrations; you will create/run them when each phase requires it.
