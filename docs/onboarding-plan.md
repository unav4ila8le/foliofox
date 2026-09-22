# Post-Signup Onboarding Plan

## Summary

Add a skippable, four-step onboarding at `/onboarding` that runs once after signup. It fills the account's base currency and the existing `financial_profiles` record, then hands the user into the existing add-position paths.

Alongside it, `profiles.data_sharing_consent` flips to default `true` for **new accounts only**, so the AI Advisor works out of the box.

Every phase below must stop after completion and wait for explicit user approval before continuing.

## Context

New accounts land on an empty dashboard with no guidance. Two concrete problems:

1. `profiles.display_currency` is always `USD` (the column default — `handle_new_user()` inserts only `user_id` and `username`) and the only way to change it is Settings → Account, which new users don't know exists. Non-US users see their net worth in the wrong currency until they go looking.
2. `financial_profiles` has no row until the user finds "Financial profile" in the sidebar user menu. That record is what gives the AI advisor its context — per `VISION.md` it is the reason the product exists — and today almost nobody fills it in.

The shape is borrowed from getquin: gather context first, then help the user add their first position. Nothing is mandatory. The only field that materially matters is base currency, and it is prefilled with `USD`, so skipping everything leaves the user exactly where they are today.

Audience constraint from `VISION.md`: financially literate self-directed investors who "don't want hand-holding or gamification". No progress gamification, no confetti, no cheerful exclamation marks. Short, direct, skippable.

### Scope note on the consent flip

`content/legal/privacy-policy.md` currently uses opt-in language ("after enabling AI-related consent", "If you enable AI-related consent"). Defaulting the flag on contradicts that wording, so the policy text is updated in the same PR (Phase 4).

Data still only reaches OpenAI when the user actually sends a message — the gate at `app/api/ai/chat/route.ts:205` is unchanged — so this makes the AI usable by default, not chatty by default. Existing users are untouched.

## Flow

Four steps, all skippable, entered at `/onboarding`.

| #   | Step            | Writes                                            | Fields                                                                      |
| --- | --------------- | ------------------------------------------------- | --------------------------------------------------------------------------- |
| 1   | Basics          | `profiles.display_currency`, `financial_profiles` | Base currency (prefilled `USD`), age band                                   |
| 2   | Income and risk | `financial_profiles`                              | Yearly income + income currency, risk preference                            |
| 3   | Goals           | `financial_profiles`                              | The open question, relabelled "What should Foliofox know about your goals?" |
| 4   | First position  | nothing directly                                  | Four grouped entry points into the existing dialogs                         |

Partial progress persists: every "Continue" upserts the financial profile, so abandoning mid-flow and returning later prefills what was already answered.

## Design

Foliofox has a settled identity — Manrope only, oklch neutral scale with one terracotta brand hue (`--brand: oklch(0.67 0.131 38.76)`), `--radius: 0.625rem`, semantic tokens only, and essentially no motion (`motion` is imported in exactly one file). The onboarding adopts that wholesale. No new typeface, no new palette, no animation library.

- **Shell** — mirror `app/auth/layout.tsx`: `bg-muted min-h-svh`, `FoliofoxIcon` at top, single `<Card className="w-full max-w-2xl gap-0 overflow-hidden p-0">`. Reuse the `DialogBody` / `DialogFooter` spacing rhythm from `components/ui/custom/dialog.tsx` (both are plain divs, safe outside a Dialog root) so the flow reads as the same product as every other form.
- **Progress** — four `h-0.5` segments, left-aligned above the heading: completed/current `bg-foreground`, upcoming `bg-border`. The content genuinely is a sequence, so a sequence marker is honest here; a percentage bar or a "2 of 4 done" celebration is not. No step numerals.
- **Step 4 carries the visual weight.** Two labelled groups of two cards rather than an undifferentiated grid of four:
  - _Add one holding_ — **Ticker symbol** (stocks, ETFs, crypto, funds) · **Custom asset** (cash, property, anything without a ticker)
  - _Bring what you already have_ — **File or screenshot** (CSV, spreadsheet, PDF or image via AI) · **Broker export** (description built from `listSupportedBrokerDisplayNames()` so it stays true as adapters are added)

  Group labels are sentence-case `text-sm font-medium`, not tracked-out caps eyebrows. A `Separator` between groups.

- **Copy** — questions, not slogans. CTAs name what happens: "Continue", "Skip", "Back", "Go to dashboard". Header carries a ghost "Skip setup" on steps 1–3, hidden on step 4 where "Go to dashboard" already means the same thing. The three navigation controls are specified precisely in Phase 2 — they behave differently and one of them is easy to get wrong.

## Phase 0 — Database Contract

Precondition: the user creates two empty Supabase migration files. The agent edits only those existing files. Two files rather than one so the consent flip can be reviewed and reverted independently of onboarding.

Do not run Supabase CLI or apply the migrations. The user applies them locally and regenerates `types/database.types.ts`.

**`<timestamp>_add_profiles_onboarding_completed_at.sql`**

```sql
alter table public.profiles add column onboarding_completed_at timestamptz;

comment on column public.profiles.onboarding_completed_at is
  'Set when the user finishes or skips post-signup onboarding. Null routes the dashboard to /onboarding.';

-- Existing accounts are already set up; never send them through onboarding.
update public.profiles
  set onboarding_completed_at = now()
  where onboarding_completed_at is null;
```

- The backfill is **not** optional — without it every existing user is gated into onboarding on their next visit.
- No RLS or grant change is needed: the baseline `FOR UPDATE` policy is row-level and the table grant has no column list.
- `handle_new_user()` is **not** touched; new rows must be `NULL`.

**`<timestamp>_default_data_sharing_consent_true.sql`**

```sql
alter table public.profiles
  alter column data_sharing_consent set default true;
```

- No backfill. Existing users keep their stored value.
- `handle_new_user()` does not insert this column, so the new default applies to every future signup automatically.

### Why a column instead of inferring completion

Inferring from `hasActivePositions() && financialProfile !== null` avoids the migration but is fragile: a user who deliberately skips is re-prompted on every login forever, archiving every position re-triggers onboarding, and step 2 deliberately writes no row when unanswered, so `financialProfile` stays null even for someone who completed the flow. A cookie has the same problem on cookie clear or a second device.

**Stop.** Deliverable is two migration files, edited in place. The agent runs nothing. You apply both locally and regenerate `types/database.types.ts`; Phase 1 cannot start until the generated types carry `onboarding_completed_at`.

## Phase 1 — Pure Refactors, No Behavior Change

Precondition: database types have been regenerated by the user.

Two extractions, both verifiable by "the app looks and behaves identically".

### Dashboard data fetch

- New `server/dashboard/fetch-dashboard-data.ts` (`"use server"`, `cache()`-wrapped) lifting the fetch block verbatim from `app/(dashboard)/dashboard/layout.tsx` (lines ~52–78) and returning `DashboardDataValue`.
- Export that type from `components/dashboard/providers/dashboard-data-provider.tsx` (currently module-private). A type-only import into a `"use server"` file is erased at compile time.
- `app/(dashboard)/dashboard/layout.tsx` then calls `fetchDashboardData()`, keeping its `"use cache: private"` + `cacheLife("hours")` header and `cookies()` reads untouched.

### Financial-profile fields

Split `components/features/financial-profile/form.tsx` so onboarding can render subsets of the same fields across three screens:

- `components/features/financial-profile/schema.ts` — move the inline `formSchema` (currently lines 53–70) out as `financialProfileFormSchema`, plus `toFinancialProfileFormData(values)` packing the `FormData` currently built inline in `onSubmit`.
- `components/features/financial-profile/fields.tsx` — `AgeBandField`, `IncomeFields`, `RiskPreferenceField`, `AboutField`, each taking `{ control }` and rendering the existing `Controller` + `Field` markup unchanged. `AboutField` takes optional `label` / `description` overrides so onboarding can ask the goals-framed version without changing the settings dialog. `RISK_PREFERENCES_DESCRIPTIONS` moves here.
- `form.tsx` keeps its `useForm`, submit handler and `DialogBody`/`DialogFooter`, and composes the four field components. Rendered output must be equivalent.

### Why one shared form across steps 1–3, not one form per step

`upsertFinancialProfile` (`server/financial-profiles/actions.ts`) builds all five columns on every call — a missing `FormData` key becomes `null` via `pickStringOrNull` / `pickNumberOrNull` — and then does a whole-row `.upsert(..., { onConflict: "user_id" })`. A step that posted only `age_band` would null the rest. The onboarding flow therefore owns a single `useForm` and always submits the full current values. Changing the action to merge partially is the alternative and is strictly more risk for no gain.

Two constraints follow from that, both easy to miss while implementing:

- **Leave `shouldUnregister` at its default (`false`).** Fields belonging to unmounted steps must stay in form state. If they unregister, the next full submit nulls them.
- **Step 1's income-currency follow-up must run before the upsert, and must match on the previous display currency** — see Phase 2.

**Stop.** Exit criteria: `npm run lint`, `npm run type`, `npm test`, `npm run format:check` all pass, and the app is unchanged to look at. Specifically, open the Financial profile dialog from the sidebar user menu and confirm it renders and saves exactly as before — that dialog is the thing this phase is most likely to break.

## Phase 2 — Route And Steps 1–3

### `app/onboarding/page.tsx`

Flat route, no route group, same shape as `app/maintenance/page.tsx`. An inner async component does the data fetch inside a `<Suspense>` boundary — mandatory under `cacheComponents`, since `fetchDashboardData` reads cookies via Supabase — and redirects to `/dashboard` when `onboarding_completed_at` is already set.

**Deliberately not `"use cache: private"`** — step 1 changes the display currency and step 2 reads it back.

```tsx
const dashboardData = await fetchDashboardData();
if (dashboardData.profile.onboarding_completed_at) redirect("/dashboard");
return (
  <DashboardDataProvider value={dashboardData}>
    <DashboardDialogsProvider>
      <OnboardingFlow />
    </DashboardDialogsProvider>
  </DashboardDataProvider>
);
```

Only two providers are needed. Of the five add-position paths, just `NewAssetDialogProvider` touches `useDashboardData()` (for `profile`); `TooltipProvider`, `Toaster` and `LocaleProvider` already live in `app/layout.tsx`. Reuse `DashboardDialogsProvider` wholesale rather than hand-composing a subset.

### `components/features/onboarding/flow.tsx` (`"use client"`)

The shell and all of steps 1–3.

- `const STEPS = ["Basics", "Income and risk", "Goals", "First position"] as const;` plus a `useState` index. No `?step=` param: under `cacheComponents` it drags in `searchParams`/Suspense ceremony, and since every step persists on advance a restart loses nothing.
- One `useForm({ resolver: zodResolver(financialProfileFormSchema) })` spanning steps 1–3, defaults from `useDashboardData()` exactly as the dialog form does today.
- `saveProfileStep()` — if the form is dirty, `upsertFinancialProfile(toFinancialProfileFormData(values))`, then advance. An untouched form means no write, so no all-null `financial_profiles` row is created for someone who skips.
- Step 1 currency: `<CurrencySelector field={{ value, onChange }} id="display_currency" />` labelled **"Base currency"** (the term already used in settings). On Continue, if it changed, call `updateProfile(formData)` with `username`, `display_currency`, `time_zone`, `time_zone_mode` — the action requires all four, so the three unchanged ones are round-tripped exactly as `components/features/settings/account/form.tsx` already does. Then `refreshDashboardData()`.

  **Order matters here, and the condition is not "untouched".** Sync `income_currency` into the shared form _before_ the profile write and before `saveProfileStep()`, and only when it still equals the display currency being replaced:

  ```ts
  // The income-currency default tracks the base currency until the user picks
  // their own. Compare against the outgoing value, not the form's dirty state:
  // on a return visit a saved GBP loads as a pristine default and must survive
  // a later base-currency change.
  if (form.getValues("income_currency") === profile.display_currency) {
    form.setValue("income_currency", nextCurrency);
  }
  ```

  Getting either half wrong is a silent data bug: sync after the upsert and the row stores the old income currency whenever step 1's form is also dirty; gate on `isDirty` and a deliberately chosen income currency gets overwritten on any later base-currency change.

- `exitOnboarding()` — `completeOnboarding()` then `router.replace("/dashboard")`, `toast.error` on failure. Manual `isLoading` state with try/finally, matching every other form in the repo. Do **not** introduce `useActionState` (zero files use it) and do **not** `redirect()` inside the server action.

### The two Skips are different, and both need care

| Control                        | Where     | Behavior                                                                                                   |
| ------------------------------ | --------- | ---------------------------------------------------------------------------------------------------------- |
| **Skip** (footer, ghost)       | steps 1–3 | Advance one step. Does **not** go through `handleSubmit`, does **not** write, does **not** reset the form. |
| **Skip setup** (header, ghost) | steps 1–3 | `exitOnboarding()` — completes and leaves. Writes no financial profile, even if fields were filled in.     |
| **Back** (footer, ghost)       | steps 2–4 | `setStep(i - 1)`. No write, no reset. Hidden on step 1.                                                    |

Footer Skip calling `handleSubmit` would save the step the user just declined to answer, and resetting the form on skip would drop earlier steps' answers from the next Continue's full submit. Header "Skip setup" is hidden on step 4, where "Go to dashboard" already means the same thing.

Back is free because steps 1–3 share one `useForm` — going back re-renders a different field subset over the same state. Returning to step 1 and changing the base currency again re-runs the income-currency rule above, which is exactly the case manual check 6 covers.

### `server/profile/actions.ts`

Append `completeOnboarding()`. This file already owns profile writes; no new file.

```ts
export async function completeOnboarding() {
  const { supabase, user } = await getCurrentUser();
  // Keep the first completion timestamp; re-running is a no-op.
  const { error } = await supabase
    .from("profiles")
    .update({ onboarding_completed_at: new Date().toISOString() })
    .eq("user_id", user.id)
    .is("onboarding_completed_at", null);
  if (error) return { success: false, message: error.message } as const;
  revalidatePath("/dashboard", "layout");
  return { success: true } as const;
}
```

### `proxy.ts`

Matcher becomes `["/dashboard/:path*", "/onboarding", "/auth/update-password"]`, so the session refreshes during a long onboarding and maintenance mode covers the route.

At the end of this phase `/onboarding` works for steps 1–3 with step 4 stubbed, and is reachable only by typing the URL. The dashboard is untouched.

**Do not deploy between here and Phase 4.** Phases 2 and 3 deliberately leave `/dashboard` ungated, so onboarding exists but nothing routes anyone into it. The feature is only live once the Phase 4 gate lands.

**Stop.** Exit criteria: `npm run lint`, `npm run type`, `npm test`, `npm run format:check` all pass, plus manual checks **2, 4, 5 and 6** from the Verification section, all reached by typing `/onboarding` directly. The others cannot be tested yet and should not be attempted here: checks 1, 3 and 8 all depend on the Phase 4 gate, and check 7 needs Phase 3's cards.

## Phase 3 — Step 4, The Four Entry Points

### `components/dashboard/new-asset/selection-dialog.tsx`

Export `SelectionCard`, and change its root from `<div onClick>` (no role, not focusable) to `<button type="button" className="... w-full text-left">`. Drop `cursor-default` along with the div — it was compensating for the div not being a button. Keyboard access is not something to skip, and the fix improves the existing dialog too.

### `components/features/onboarding/first-position-step.tsx` (`"use client"`)

The four cards in two groups, wired to `useNewAssetDialog()`, `useImportPositionsDialog()` and `useBrokerImportDialog()`.

Critical detail: **this component must render `<FormDialog />` itself.** `FormDialog` is rendered at the bottom of `SelectionDialog`, and `SelectionDialog` is itself mounted only while the selection dialog is open — `new-asset/index.tsx:89` is `{openSelectionDialog ? <SelectionDialog /> : null}`. So calling `setOpenFormDialog(true)` from an onboarding card updates context and renders nothing. `FormDialog` is already exported and only needs `useNewAssetDialog()` context, so this is one import and zero edits to existing files.

This applies to the **ticker symbol and custom cards only**. The import and broker providers each render their own `<Dialog open={open}>` (`positions/import/index.tsx:97`, `broker-import/index.tsx:55`), so `setOpen(true)` works with nothing extra mounted.

Note that the unit test in Phase 4 mocks this step away, so manual check 6 is what actually covers the `FormDialog` mount.

Footer: **Go to dashboard** (primary) calling `exitOnboarding()`.

Deliberately not built: `createPosition` and the import actions call `revalidatePath("/dashboard", "layout")`, which does not revalidate `/onboarding`, and none of those forms call `router.refresh()`. So step 4 shows no live "1 position added" counter — the existing sonner toast is the confirmation. Plumbing revalidation through four server actions for a cosmetic counter is not worth it; that is also why the exit is an explicit button rather than auto-advance.

Also not built, flagged rather than bundled: CSV+AI and broker import get one card each rather than separate cards per tab, since the import dialog's own tabs disambiguate one level down. No `defaultTab` prop on `import-dialog-body.tsx`, no exported `BrokerImportButton`.

**Stop.** Exit criteria: `npm run lint`, `npm run type`, `npm test`, `npm run format:check` all pass, plus manual check 7 — every one of the four cards opens its dialog and creates a position. Nothing routes users into onboarding yet.

## Phase 4 — Go Live, Docs, Tests

### Gate

In `app/(dashboard)/dashboard/layout.tsx`, before the heavy fetch:

```ts
const { profile } = await fetchProfile(); // react cache(): no extra query
if (!profile.onboarding_completed_at) redirect("/onboarding");
```

One line covers the confirm-link landing, login, and deep links, with no changes to `app/auth/confirm/route.ts` or the Supabase-hosted confirmation email template. `/onboarding` sits outside the `(dashboard)` group, so the two redirects cannot chain.

The extra `fetchProfile()` is free: it is `cache()`-wrapped, and `fetchDashboardData()` calls it internally, so the request issues one profile query either way. Gating before the heavy `Promise.all` just avoids computing net worth and market-data statuses for someone about to be redirected.

**On redirecting from inside `"use cache: private"`** — this is safe, and the layout already does it. `fetchProfile()` calls `getCurrentUser()`, which `redirect()`s to `/auth/login` when the session is missing (`server/auth/actions.ts:16`), so the cached layout has been throwing redirects in production all along. `redirect()` throws to interrupt rendering rather than returning a value; only a successful render is cached. A user with `onboarding_completed_at` null never produces a successful dashboard render, so there is no stale "still onboarding" payload that could be replayed after completion. On top of that, `completeOnboarding()` calls `revalidatePath("/dashboard", "layout")` before the client navigates.

If that reasoning is wrong, the failure is a **loop**, not a single bounce: the cached dashboard redirect sends the user to `/onboarding`, whose uncached page sees completion and sends them straight back. It would persist for the client `stale` window of `cacheLife("hours")` and clear on a full reload, since a private cache lives in browser memory and is not kept server-side.

The fallback, if it happens: a short-lived `ff_onboarding_done` cookie set by `completeOnboarding()` and checked in the gate. That works specifically because cookies are part of the cache key — which is also why the existing login redirect never sticks (signing in changes the cookies this layout reads) while this one theoretically could (finishing onboarding does not). Ship the one-liner with a `ponytail:` comment naming the ceiling; add the cookie only if manual check 3 actually loops.

### AI consent presentation

`components/dashboard/ai-chat/settings/form.tsx`: the label "AI data sharing consent" is what users called scary. Rename the label and toast copy to describe the feature ("Share portfolio data with the AI Advisor"). The column name `data_sharing_consent` does not change.

The description **cannot** say "this is on" — for an existing user reading that dialog it is off. Word it for both audiences: _"New accounts start with this on. You can turn it off at any time."_

Two related decisions to make deliberately rather than by omission:

- An existing user who opens the advisor with the flag off already gets `components/dashboard/ai-chat/disabled-state.tsx`, whose "Enable AI Advisor" button opens this same dialog. That is a reasonable path, and it is the point of not backfilling — those portfolios stay out of OpenAI until someone opts them in.
- A **new** user never sees `DisabledState`, and onboarding never mentions the switch. The rewritten privacy policy is therefore the only disclosure. If that is not enough, the natural place for a line is step 3, next to the question that feeds the advisor.

### `content/legal/privacy-policy.md`

Four edits. Two are required by the consent flip, one by onboarding itself, one is bookkeeping.

**1. Line 16 — the opt-in clause in "Information We Collect."** "…when you use AI features after enabling AI-related consent" describes a gate that no longer exists for new accounts.

> AI feature inputs, including prompts, messages, and files you submit when you use AI features. AI data sharing is on by default for new accounts and can be turned off at any time in AI chat settings;

**2. Line 53 — the "AI Features" section.** Same problem, and this is the section a reader goes to.

> AI data sharing is on by default for new accounts and can be turned off at any time in AI chat settings. When it is on and you use AI features, the prompts, messages, and files you submit may be sent to OpenAI to generate responses. Nothing is sent to OpenAI unless you use an AI feature. We may also store related conversation history and service metadata to operate, secure, and improve the feature experience inside Foliofox.

**3. Line 15 — name the financial profile.** This one is owed to onboarding, not the consent flip. Age band, yearly income, risk preference and the free-text goals answer currently shelter under "financial planning inputs", which was defensible while the financial profile was buried in a menu almost nobody opened. Onboarding puts those questions on the default path for every new user, so income and age are about to become routinely collected. Name them:

> portfolio data such as positions, transactions, snapshots, financial planning inputs, and imported files or spreadsheets;
> financial profile details you choose to provide, such as age range, yearly income, risk preference, and any goals or context you write for the AI advisor;

**4. Frontmatter — bump both dates.** `lastUpdated: "2026-04-21"` → the ship date. Bump `effectiveDate` too: changing a consent default and adding a collection category is a material change, not a clarification.

**No change needed at line 27.** "operate AI features you choose to use" stays accurate — the flag being on by default does not make anything happen until the user sends a message.

### `content/product-reference.md`

- Add `app/onboarding/page.tsx`, `components/features/onboarding/` and `server/profile/actions.ts (onboarding completion)` to the source-file list in the header comment.
- New `## Onboarding` section after "What Foliofox is": four steps, entirely skippable, every question optional, base currency prefilled `USD` and changeable later in Settings → Account, financial-profile answers feed the AI advisor and stay editable from the user menu, onboarding shows once and skipping does not re-prompt.
- One line in `## Adding an asset` noting the first-position step offers the same paths.
- One sentence wherever the AI advisor is described, stating that AI data sharing is on by default for new accounts and can be turned off in AI chat settings. The advisor answers product questions from this file, so the default has to be written down here too — not just in the privacy policy.

### `components/features/onboarding/flow.test.tsx`

One file, two cases, mirroring the mocking style of `components/dashboard/charts/net-worth/index.test.tsx`. Mock `useDashboardData`, `@/server/profile/actions`, `next/navigation`, and `first-position-step` — that last mock keeps step 4's module graph, which reaches `"use server"` files importing `next/headers`, out of jsdom.

1. _"Skip setup" marks onboarding complete and leaves_ — `completeOnboarding` called, `router.replace("/dashboard")` called. This is the case that matters: forgetting to mark completion on skip is exactly the infinite re-prompt the column exists to prevent.
2. _Continuing with the prefilled currency writes nothing_ — `updateProfile` not called, step 2 visible.

Skipping a `server/profile/actions.test.ts` case for `completeOnboarding`: that file's fake-query harness needs a new ~30-line class to assert a single `.update().eq().is()` chain whose real guarantee is Postgres's, not JavaScript's.

**Stop.** Exit criteria: the full Verification section below, all nine manual checks included. This is the phase that makes the feature live, so do not treat the static checks as sufficient.

## Verification

Static checks (the only commands the agent runs, per `AGENTS.md`):

```
npm run lint
npm run type
npm test
npm run format:check
```

Manual pass, run by the user:

1. New signup, confirm email, lands on `/onboarding`.
2. Change base currency to EUR, pick an age band, Continue. Step 2 shows EUR as income currency.
3. Skip steps 2 and 3, reach step 4, press "Go to dashboard". **Use the button — do not reload**, since a reload clears the private cache and would hide the failure. Confirm landing on `/dashboard`. If the URL ping-pongs with `/onboarding`, reload once: if the reload lands, that is the cache path described above and the cookie fallback is needed. Dashboard totals read in EUR.
4. Reload `/onboarding` directly — redirects to `/dashboard`.
5. Fresh signup, answer step 1, close the tab. Log back in — returns to `/onboarding` with the age band prefilled.
6. **Income-currency ordering.** In one run: on step 1 pick an age band _and_ change the base currency to EUR, Continue, then check the stored row shows `income_currency = 'EUR'` (not the old `USD`). In a second run: set income currency to GBP on step 2, go back to step 1 and change the base currency again — GBP must survive.
7. Fresh signup, reach step 4, exercise each of the four cards; confirm the symbol form, custom form, import dialog and broker dialog all open and create positions. This is the only coverage of the `FormDialog` mount — the unit test mocks the step away.
8. An existing account logs in — straight to `/dashboard`, never onboarding (Phase 0 backfill).
9. New signup — AI Advisor works without visiting settings; an existing account with consent off still sees `DisabledState`.

## Files

**Created:** `server/dashboard/fetch-dashboard-data.ts`, `components/features/financial-profile/schema.ts`, `components/features/financial-profile/fields.tsx`, `app/onboarding/page.tsx`, `components/features/onboarding/flow.tsx`, `components/features/onboarding/first-position-step.tsx`, `components/features/onboarding/flow.test.tsx`, plus two migration files created by the user.

**Modified:** `app/(dashboard)/dashboard/layout.tsx`, `components/dashboard/providers/dashboard-data-provider.tsx`, `components/features/financial-profile/form.tsx`, `components/dashboard/new-asset/selection-dialog.tsx`, `components/dashboard/ai-chat/settings/form.tsx`, `server/profile/actions.ts`, `proxy.ts`, `content/product-reference.md`, `content/legal/privacy-policy.md`.

## Cut As Over-Engineering

Stepper or progress-bar component, `motion` transitions, `?step=` URL state, a step-config registry, a timezone question (already auto-synced via `TimeZoneAutoSync`), a `defaultTab` prop on the import dialog, an exported `BrokerImportButton`, a dedicated `updateDisplayCurrency` action, auto-advance detection on step 4, and server-side Zod on `upsertFinancialProfile` — the `as`-casts are backed by real Postgres enum columns plus the `about` ≤2000 CHECK, so the trust boundary holds.

Worth doing separately, not bundled: broker import is currently only reachable from the header "New" dropdown, so adding a Broker card to the dashboard's own `SelectionDialog` is a real discoverability win, but it is a different change.
