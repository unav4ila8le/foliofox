# Scenario Planning Roadmap

Last reviewed: 2026-03-04

## North Star

Turn Scenario Planning into a portfolio-aware planning workspace that supports:

- Deterministic what-if cashflow modeling (existing engine)
- Portfolio-based starting assumptions
- FIRE planning workflows
- Monte Carlo probability views

## Product Language (important)

Legacy wording (`initial balance`) is ambiguous. In this roadmap, we use:

- **Starting value**: the stock value at simulation start
- **Starting value basis**: what that value represents (`manual`, `cash`, `net worth`)

This keeps the model flexible without forcing users into "cash-only" semantics.

## Planning Suite IA (agreed on 2026-03-04)

Sidebar navigation under `Tools`:

- `AI Advisor`
- `Planning`

Planning is a suite with three views that share one scenario context:

- `Scenario`: events + assumptions editing (source of truth for planning inputs)
- `FIRE`: goal-focused projection view derived from the current plan
- `Simulations`: deterministic/Monte Carlo results derived from the current plan
- Assumptions are scenario-global shared inputs across all three views

Naming rule:

- Use `Scenario` (not `Scenario Planning`) as the first planning view label to avoid redundancy (`Planning > Scenario Planning`).

Route model:

- Phase 2-4 (single-scenario UX): `/dashboard/planning/scenario`, `/dashboard/planning/fire`, `/dashboard/planning/simulations`
- Phase 5 (multi-scenario UX): `/dashboard/planning/[scenarioId]/scenario`, `/dashboard/planning/[scenarioId]/fire`, `/dashboard/planning/[scenarioId]/simulations`
- Canonical routes from Phase 2 onward are `/dashboard/planning/*`
- Clean cut migration: remove `/dashboard/scenario-planning` and ship only `/dashboard/planning/*`
- Until Phase 5, all Planning routes resolve against `fetchOrCreateDefaultScenario()` (single-scenario behavior)

## Assumptions + FIRE Semantics (locked defaults)

UX guardrail (must not be skipped):

- Users must always understand assumptions are scenario-global and affect `Scenario`, `FIRE`, and `Simulations`
- `Scenario` is the primary place to edit assumptions
- `FIRE` and `Simulations` should show a compact assumptions summary with clear "Edit assumptions" action back to `Scenario`
- On assumptions save, show clear confirmation that all planning views for this scenario are updated

Assumptions input model:

- Inputs are annual nominal percentages (`%`), not decimal fractions
- Fields:
  - expected return (annual nominal %)
  - inflation (annual nominal %)
  - volatility (annual nominal %, standard deviation)
- Users can always override with manual values

Assumptions preset model:

- Provide 3 preset chips (same UX style as `capital-gains-tax-rate-field` quick presets):
  - `Negative`
  - `Average`
  - `Positive`
- Presets are based on historical market return regimes (documented constants in code)
- Preset click prefills all fields; manual edits remain allowed per field

Initial preset constants (v1 placeholders, annual nominal %):

| Preset   | Expected Return | Inflation | Volatility |
| -------- | --------------- | --------- | ---------- |
| Negative | 1.5             | 4.0       | 22.0       |
| Average  | 7.0             | 2.5       | 15.0       |
| Positive | 10.0            | 2.0       | 12.0       |

FIRE conventions:

- FIRE spending input is in today's purchasing power (real terms)
- FIRE target uses SWR/multiple on real spending (for example, default 25x)
- Portfolio projections may run in nominal terms, but FIRE time-to-target compares against inflation-adjusted (real) portfolio value

## Progress Snapshot (as of 2026-03-04)

| Phase   | Ticket | Status                            | Notes                                                                                          |
| ------- | ------ | --------------------------------- | ---------------------------------------------------------------------------------------------- |
| Phase 0 | #163   | Completed                         | Starting value semantics + basis enum + synced/manual UX shipped.                              |
| Phase 1 | #153   | Completed (closed 2026-02-26 UTC) | Portfolio-linked baseline UX shipped. Metadata hardening is moved into Phase 2 data work.      |
| Phase 2 | #154   | Next up (not started)             | Assumptions model, presets/manual inputs, persisted resolved values, and Planning suite shell. |
| Phase 3 | #155   | Not started                       | FIRE view panel, time-to-target, SWR sensitivity.                                              |
| Phase 4 | #156   | Not started                       | Simulations view with deterministic/Monte Carlo modes and probability bands.                   |
| Phase 5 | TBD    | Deferred (last phase)             | Multi-scenario switcher and scenario-aware routing/management UX.                              |

## Multi-Scenario Direction (deferred to final phase)

Current product behavior:

- UI loads a single scenario via `fetchOrCreateDefaultScenario()`
- "Default" currently resolves to the first scenario by `created_at` for a user
- There is no scenario selector or scenario-specific route yet

What is already ready in architecture:

- Schema supports multiple scenarios per user (`financial_scenarios` rows keyed by `id`, scoped by `user_id`)
- RLS policies already allow users to manage all of their own scenario rows
- Mutations are already scenario-scoped via `scenarioId` (`upsertScenarioEvent`, `deleteScenarioEvent`, `updateScenarioInitialValue`)

What is still needed before exposing multi-scenario UX (planned for final phase):

- Add a richer scenario list/read model that includes `id`, `name`, `initial_value`, and `initial_value_basis`
- Add backend actions for lifecycle management (create, rename, delete, duplicate)
- Replace "first created scenario" fallback with an explicit default pointer (`profiles.default_financial_scenario_id` or equivalent)
- Add a persistent scenario switcher in Planning header (no separate intermediary page required)
- Add scenario-aware AI tool selection (`scenarioId` input with safe default behavior)
- Add list/query indexes optimized for per-user scenario lists and sorting

## Phase Plan

## Phase 0: Clarify semantics + quick visualization

Status: Completed

Delivered:

- Renamed persisted/model naming from `initial_balance` to `initial_value`
- Added DB enum `scenario_initial_value_basis` with exactly 3 values:
  - `net_worth`
  - `cash`
  - `manual`
- Default basis is `net_worth` for new scenarios
- Added "Starting value basis" selector in UI with order:
  - Net Worth
  - Cash
  - Manual
- Implemented basis behaviors:
  - Manual: editable input + explicit Save action
  - Cash: read-only input, auto-populated from current cash positions, auto-saved
  - Net worth: read-only input, auto-populated from current net worth, auto-saved
- Removed synced-value date display from UX (always current/live)
- Normalize persisted starting values to 2 decimals to avoid long fractional tails
- Synced starting-value suggestions to profile civil date (`resolveTodayDateKey(profile.time_zone)`)

Outcome: users can see and control what the starting number means.

## Phase 1: Portfolio-linked baseline (ticket #153)

Status: Completed (ticket closed on 2026-02-26 UTC)

Delivered:

- Scenario page fetches portfolio-derived starting-value suggestions for both `cash` and `net_worth`
- Basis/source mode persists in DB via `initial_value_basis`
- Manual override path is preserved and explicit (`manual` + Save action)
- Synced basis modes (`cash` and `net_worth`) auto-save current portfolio values

Follow-up moved to Phase 2:

- Persist explicit baseline metadata for stronger reproducibility/auditability:
  - source currency at sync time
  - source as-of key / snapshot reference (when available)

Outcome: baseline scenario setup is portfolio-linked and usable; metadata hardening is the remaining piece.

## Phase 2: Return assumptions + presets (ticket #154)

Status: Next up (active phase to execute)

- Add assumptions model (expected return/inflation/volatility as annual nominal % inputs)
- Add preset packs (`Negative`, `Average`, `Positive`) based on historical market-return regimes
- Add manual assumptions input mode so users can type their own values
- Preset selection should prefill assumption fields, and users can still override any field manually
- Introduce Planning suite shell UI for single-scenario mode:
  - `Scenario` view (active in this phase)
  - `FIRE` and `Simulations` tabs as placeholders or disabled entries until their phases ship
- Persist both:
  - selected preset id (if any)
  - resolved numeric assumption values actually used for projection
- Save resolved assumption values in scenario payload (not only preset id)
- Include Phase 1 follow-up baseline metadata in scenario settings
- Keep rollout safe: in this phase, integrate expected return into deterministic scenario projection first; keep volatility for Monte Carlo phase

Phase 2 delivery sequence (backend-first, with review checkpoints):

1. Phase 2A - DB and domain contract
   - Add `financial_scenarios.settings` column (JSONB)
   - Add server-side typed settings schema + defaults (assumptions + baseline metadata)
   - Pause for review
2. Phase 2B - Backend persistence
   - Add server read/write paths for assumptions in scenario settings
   - Keep UI unchanged; endpoints/actions become ready for future UI wiring
   - Pause for review
3. Phase 2C - Deterministic engine integration
   - Feed resolved assumptions into deterministic projection engine
   - Scope safety: apply expected return first; keep volatility for Monte Carlo phase
   - Pause for review
4. Phase 2D - Tests and hardening
   - Add/update tests for settings parsing, persistence, and deterministic projection behavior
   - Pause for review
5. Phase 2E - UI wiring (deferred until explicit approval)
   - Add assumptions controls in `Planning > Scenario`
   - Add read-only shared assumptions summaries in `FIRE` and `Simulations`
   - Requires explicit go-ahead

Definition of done:

- Scenario data can persist assumptions + baseline metadata in a typed structure
- UI includes preset selector plus manual editable inputs for resolved values
- Deterministic projections are reproducible from persisted scenario payload alone
- Planning navigation is established under one `Planning` entry in sidebar
- UI clearly communicates assumptions are scenario-global shared inputs across all planning views

Outcome: deterministic projections become faster to configure and reproducible.

## Phase 3: FIRE mode (ticket #155)

Status: Not started

- Add FIRE mode panel with:
  - annual spending input
  - target multiple (default 25x)
  - SWR sensitivity table (3% / 4% / 5%)
- Compute deterministic time-to-target from scenario projections using real (inflation-adjusted) value tracking
- Persist FIRE settings in scenario
- Mount FIRE panel in the `Planning > FIRE` view

Outcome: Scenario Planning becomes useful as a practical FIRE calculator.

## Phase 4: Monte Carlo + bands (ticket #156)

Status: Not started

- Add server-side simulation endpoint
- Add cached simulation outputs (keyed by scenario version + assumptions)
- Show percentile bands (p10 / p50 / p90) in chart
- Allow deterministic and Monte Carlo mode switching
- Mount simulation controls/results in the `Planning > Simulations` view
- Use deterministic simulation seed derived from input hash so identical inputs return identical percentile bands (stable UX + cacheability)

Outcome: move from single-path projection to probability-aware planning.

## Phase 5: Multi-scenario management + UX (deferred final phase)

Status: Deferred (last phase)

- Add scenario list and selector UX
- Add scenario lifecycle actions (create, rename, delete, duplicate)
- Add explicit default scenario resolution (`profiles.default_financial_scenario_id` or equivalent)
- Add scenario-specific routing and scenario-aware AI selection
- Add list/query indexes optimized for per-user scenario lists and sorting
- Keep view navigation model unchanged (`Scenario`, `FIRE`, `Simulations`) and scope it by selected scenario

Outcome: users can run and compare multiple independent plans.

## Suggested Data Evolution

Current:

- `financial_scenarios.initial_value`
- `financial_scenarios.initial_value_basis`
- `financial_scenarios.events`

Near-term (Phase 2+):

- `financial_scenarios.settings` (JSON for baseline metadata, assumptions, FIRE, Monte Carlo params)
- optional `financial_scenario_simulations` table for cached run outputs

Data model decision (FIRE + Simulations):

- Do not create a dedicated FIRE product table; persist FIRE inputs/preferences in `financial_scenarios.settings.fire`.
- Keep `financial_scenarios` as the canonical input model (events, starting value/basis, assumptions, FIRE inputs).
- Store simulation outputs in `financial_scenario_simulations` (cache/results table) keyed by scenario + input hash, not inside `financial_scenarios`.

Simulation cache key contract:

- `input_hash` must include: scenario id, scenario version marker (`updated_at` and/or `engine_version`), initial value + basis, events payload hash, resolved assumptions, simulation mode, horizon, interval, iteration count, and seed policy
- Same logical inputs must map to the same hash key
- Any input change must create a new hash key (no stale band reuse)

Final phase (Phase 5):

- `profiles.default_financial_scenario_id` (or equivalent) for explicit default scenario resolution

## Execution Order

1. Phase 0 closed: monitor UX copy and edge-cases
2. Phase 1 closed: keep baseline flow stable
3. Execute Phase 2 (#154) including baseline metadata hardening
4. Implement Phase 3 (#155) FIRE mode
5. Implement Phase 4 (#156) Monte Carlo API/cache/UI
6. Implement Phase 5 multi-scenario management + UX

## Why this order

- Semantic clarity and baseline UX are already in place
- Reproducibility gaps are now concentrated in Phase 2 settings persistence
- FIRE and Monte Carlo should build on persisted assumptions, not transient UI state
- Multi-scenario UX should come last after single-scenario assumptions/FIRE/Monte Carlo behavior is stable
