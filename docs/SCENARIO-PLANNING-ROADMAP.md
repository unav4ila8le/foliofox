# Scenario Planning Roadmap

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

## Phase Plan

## Phase 0: Clarify semantics + quick visualization

Status: Completed in current branch

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

Outcome: users can see and control what the starting number means.

## Phase 1: Portfolio-linked baseline (ticket #153)

Status: Not started

- Add explicit source metadata when portfolio sync is used:
  - source currency
  - source mode (`net_worth` / `cash`)
- Preserve manual override while retaining clear basis semantics

Outcome: reproducible scenario starts, not just raw numbers.

## Phase 2: Return assumptions + presets (ticket #154)

- Add assumptions model (expected return/inflation/volatility)
- Add preset packs (`conservative`, `base`, `optimistic`) for:
  - Equities-focused profile
  - Global diversified profile
- Save resolved assumption values in scenario payload (not only preset id)

Outcome: deterministic projections become faster to configure and reproducible.

## Phase 3: FIRE mode (ticket #155)

- Add FIRE mode panel with:
  - annual spending input
  - target multiple (default 25x)
  - SWR sensitivity table (3% / 4% / 5%)
- Compute deterministic time-to-target from scenario projections
- Persist FIRE settings in scenario

Outcome: Scenario Planning becomes useful as a practical FIRE calculator.

## Phase 4: Monte Carlo + bands (ticket #156)

- Add server-side simulation endpoint
- Add cached simulation outputs (keyed by scenario version + assumptions)
- Show percentile bands (p10 / p50 / p90) in chart
- Allow deterministic and Monte Carlo mode switching

Outcome: move from single-path projection to probability-aware planning.

## Suggested Data Evolution

Current:

- `financial_scenarios.initial_value`
- `financial_scenarios.initial_value_basis`
- `financial_scenarios.events`

Near-term:

- `financial_scenarios.settings` (JSON for assumptions/FIRE/Monte Carlo params)
- optional `financial_scenario_simulations` table for cached run outputs

## Execution Order

1. Phase 0 complete: monitor and iterate UX copy/edge-cases
2. Complete #153 metadata persistence
3. Implement #154 assumptions/presets
4. Implement #155 FIRE mode
5. Implement #156 Monte Carlo API/cache/UI

## Why this order

- Reduces semantic ambiguity first
- Avoids building FIRE/Monte Carlo on unclear baseline meaning
- Reuses deterministic engine and existing portfolio services before adding stochastic complexity
