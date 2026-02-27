# AI Advisor Weekly Eval Snapshot (2026-02-27 UTC, Baseline Reference)

## Window

- Run date (UTC): `2026-02-27`
- Compared windows:
- `pre`: `N/A` (pre-telemetry baseline from static export)
- `post`: `N/A` (pre-telemetry baseline from static export)
- Source dataset: `/Users/leonardo/Desktop/Supabase Snippet Recent 300 Conversation Messages.csv`

## KPI Output

Baseline values (proxy where telemetry was not available):

- `assistant_chars_median_typed`: `2790` (proxy)
- `follow_up_rate_typed`: `1.00` (proxy, unreliable on rolling export)
- `identifier_error_rate`: `N/A` (no telemetry route/outcome split at baseline time)
- `chart_completion_rate`: `N/A` (no telemetry route/outcome split at baseline time)
- `write_commit_success_rate`: `N/A` (write tools not live)

## Denominators

- `assistant_turns`: `149`
- `typed_turns`: `N/A` (no telemetry-backed prompt_source for exact denominator)
- `identifier_turns`: `N/A`
- `chart_turns`: `N/A`
- `write_turns`: `N/A`

## Volume Gate Check

- typed KPI valid (`typed_turns >= 30`): `no` (no telemetry denominator)
- identifier KPI valid (`identifier_turns >= 20`): `no`
- chart KPI valid (`chart_turns >= 20`): `no`
- write KPI valid (`write_turns >= 20`): `no`

## Decision

- Status: `baseline`
- Short reason: pre-telemetry reference snapshot used to compare later weekly telemetry-driven results.

## Regressions / Observations

1. Assistant responses were often very long relative to user prompt length.
2. Identifier resolution failures were observed (example conversation: `bdb9e147-2a70-4245-bc80-9278fee964ed`).
3. Chart requests could enter clarification loops (example conversation: `4a329ddc-c755-4990-92ef-6540971e5d25`).

## Actions for Next Week

1. Run weekly SQL query from `docs/ai/evals/README.md` against production telemetry.
2. Fill the same template with telemetry-backed KPI values and real denominators.
3. Compare weekly telemetry outputs against this baseline reference.
