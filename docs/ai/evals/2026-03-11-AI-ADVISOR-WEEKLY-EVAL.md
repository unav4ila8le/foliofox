# AI Advisor Weekly Eval Snapshot (2026-03-11 UTC)

## Window

- Run date (UTC): `2026-03-11`
- Compared windows:
- `pre`: `2026-02-25 00:00:00+00` to `2026-03-04 00:00:00+00`
- `post`: `2026-03-04 00:00:00+00` to `2026-03-11 00:00:00+00`

## KPI Output

From telemetry SQL output:

- `assistant_chars_median_typed`: `1750` (`pre_7d`) -> `981` (`post_7d`) (directionally better, gate-invalid)
- `follow_up_rate_typed`: `0.5769` (`pre_7d`) -> `0.7778` (`post_7d`) (directionally better, gate-invalid)
- `identifier_error_rate`: `N/A` (`pre_7d`, denominator `0`) -> `0.0000` (`post_7d`, denominator `1`) (gate-invalid)
- `chart_completion_rate`: `0.9000` (`pre_7d`) -> `1.0000` (`post_7d`) (directionally better, gate-invalid)
- `write_commit_success_rate`: `N/A` (`pre_7d`) -> `N/A` (`post_7d`) (write tools traffic not present)

## Denominators

- `assistant_turns`: `36` (`pre_7d`), `9` (`post_7d`)
- `typed_turns`: `26` (`pre_7d`), `9` (`post_7d`)
- `identifier_turns`: `0` (`pre_7d`), `1` (`post_7d`)
- `chart_turns`: `10` (`pre_7d`), `1` (`post_7d`)
- `write_turns`: `0` (`pre_7d`), `0` (`post_7d`)

## Volume Gate Check

- typed KPI valid (`typed_turns >= 30`): `no` (`pre=26`, `post=9`)
- identifier KPI valid (`identifier_turns >= 20`): `no` (`pre=0`, `post=1`)
- chart KPI valid (`chart_turns >= 20`): `no` (`pre=10`, `post=1`)
- write KPI valid (`write_turns >= 20`): `no` (`pre=0`, `post=0`)

## Decision

- Status: `watch`
- Short reason: all KPI comparisons are volume-gate invalid this week; directional movement is positive, but sample size is too small to call a reliable improvement or regression.

## Regressions / Observations

1. Post window had no telemetry errors (`query #5` returned zero rows); route breakdown shows `post_7d` outcomes were all `ok`.
2. Typed response length and typed follow-up rate moved in a favorable direction (`1750 -> 981` median chars, `0.5769 -> 0.7778` follow-up), but both are below required typed volume.
3. Activity remains sparse and bursty (`2026-03-06`: 1 assistant turn, `2026-03-10`: 8 assistant turns), so weekly signals are currently high-variance.

## Actions for Next Week

1. Keep running the same rolling 7d pre/post telemetry query, but continue labeling KPI comparisons as non-decisive until volume gates pass.
2. Add a supporting trailing 28d view (same KPIs) to monitor trend direction under low-traffic conditions.
3. Keep running the post-window error conversation query; once errors appear, include top conversation IDs and route-level root-cause notes.
