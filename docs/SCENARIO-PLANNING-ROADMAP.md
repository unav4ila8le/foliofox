# Scenario Planning Roadmap

Last reviewed: 2026-03-03

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

## Progress Snapshot (as of 2026-03-03)

| Phase   | Ticket | Status                            | Notes                                                                                     |
| ------- | ------ | --------------------------------- | ----------------------------------------------------------------------------------------- |
| Phase 0 | #163   | Completed                         | Starting value semantics + basis enum + synced/manual UX shipped.                         |
| Phase 1 | #153   | Completed (closed 2026-02-26 UTC) | Portfolio-linked baseline UX shipped. Metadata hardening is moved into Phase 2 data work. |
| Phase 2 | #154   | Next up (not started)             | Assumptions model, presets, and persisted resolved values.                                |
| Phase 3 | #155   | Not started                       | FIRE mode panel, time-to-target, SWR sensitivity.                                         |
| Phase 4 | #156   | Not started                       | Monte Carlo API/cache and probability bands in chart.                                     |
| Phase 5 | TBD    | Deferred (last phase)             | Multi-scenario management and UX.                                                         |

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
- Add backend actions for lifecycle management (create, rename, delete, duplicate) even if hidden behind UI for now
- Replace "first created scenario" fallback with an explicit default pointer (`profiles.default_financial_scenario_id` or equivalent)
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

- Add assumptions model (expected return/inflation/volatility)
- Add preset packs (`conservative`, `base`, `optimistic`) for:
  - Equities-focused profile
  - Global diversified profile
- Add manual assumptions input mode so users can type their own values
- Preset selection should prefill assumption fields, and users can still override any field manually
- Persist both:
  - selected preset id (if any)
  - resolved numeric assumption values actually used for projection
- Save resolved assumption values in scenario payload (not only preset id)
- Include Phase 1 follow-up baseline metadata in scenario settings

Definition of done:

- Scenario data can persist assumptions + baseline metadata in a typed structure
- UI includes preset selector plus manual editable inputs for resolved values
- Deterministic projections are reproducible from persisted scenario payload alone

Outcome: deterministic projections become faster to configure and reproducible.

## Phase 3: FIRE mode (ticket #155)

Status: Not started

- Add FIRE mode panel with:
  - annual spending input
  - target multiple (default 25x)
  - SWR sensitivity table (3% / 4% / 5%)
- Compute deterministic time-to-target from scenario projections
- Persist FIRE settings in scenario

Outcome: Scenario Planning becomes useful as a practical FIRE calculator.

## Phase 4: Monte Carlo + bands (ticket #156)

Status: Not started

- Add server-side simulation endpoint
- Add cached simulation outputs (keyed by scenario version + assumptions)
- Show percentile bands (p10 / p50 / p90) in chart
- Allow deterministic and Monte Carlo mode switching

Outcome: move from single-path projection to probability-aware planning.

## Phase 5: Multi-scenario management + UX (deferred final phase)

Status: Deferred (last phase)

- Add scenario list and selector UX
- Add scenario lifecycle actions (create, rename, delete, duplicate)
- Add explicit default scenario resolution (`profiles.default_financial_scenario_id` or equivalent)
- Add scenario-specific routing and scenario-aware AI selection
- Add list/query indexes optimized for per-user scenario lists and sorting

Outcome: users can run and compare multiple independent plans.

## Suggested Data Evolution

Current:

- `financial_scenarios.initial_value`
- `financial_scenarios.initial_value_basis`
- `financial_scenarios.events`

Near-term (Phase 2+):

- `financial_scenarios.settings` (JSON for baseline metadata, assumptions, FIRE, Monte Carlo params)
- optional `financial_scenario_simulations` table for cached run outputs

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
