# AI Advisor Eval Snapshot (2026-03-25 UTC)

## Window

- Run date (UTC): `2026-03-25`
- Compared windows:
- `pre_14d`: `2026-02-25 00:00:00+00` to `2026-03-11 00:00:00+00`
- `post_14d`: `2026-03-11 00:00:00+00` to `2026-03-25 00:00:00+00`

## KPI Output (14d Pre/Post)

- `assistant_chars_median_typed`: `1743` (`pre_14d`) -> `1321` (`post_14d`) (directionally better, gate-invalid)
- `follow_up_rate_typed`: `0.5600` (`pre_14d`) -> `0.4762` (`post_14d`) (directionally worse, directional-valid only)
- `identifier_error_rate`: `0.0000` (`pre_14d`, denominator `1`) -> `N/A` (`post_14d`, denominator `0`) (gate-invalid)
- `chart_completion_rate`: `0.9091` (`pre_14d`) -> `1.0000` (`post_14d`) (directionally better, gate-invalid)
- `write_commit_success_rate`: `N/A` (`pre_14d`) -> `N/A` (`post_14d`) (write tools traffic not present)
- `suggestion_share`: `0.2857` (`pre_14d`) -> `0.1250` (`post_14d`) (prompt mix shifted toward typed)

## Denominators (14d Pre/Post)

- `assistant_turns`: `35` (`pre_14d`), `24` (`post_14d`)
- `typed_turns`: `25` (`pre_14d`), `21` (`post_14d`)
- `suggestion_turns`: `10` (`pre_14d`), `3` (`post_14d`)
- `identifier_turns`: `1` (`pre_14d`), `0` (`post_14d`)
- `chart_turns`: `11` (`pre_14d`), `3` (`post_14d`)
- `write_turns`: `0` (`pre_14d`), `0` (`post_14d`)

## Trailing 28d Companion

- `as_of_end`: `2026-03-25 00:00:00+00`
- `assistant_chars_median_typed`: `1461`
- `follow_up_rate_typed`: `0.5217`
- `identifier_error_rate`: `0.0000`
- `chart_completion_rate`: `0.9286`
- `write_commit_success_rate`: `N/A`
- `suggestion_share`: `0.2203`
- `assistant_turns`: `59`
- `typed_turns`: `46`
- `suggestion_turns`: `13`
- `identifier_turns`: `1`
- `chart_turns`: `14`
- `write_turns`: `0`

## Volume Gate Check

Decision gates (high confidence, both windows must pass):

- typed KPI decision-valid (`pre_typed_turns >= 30` and `post_typed_turns >= 30`): `no`
- identifier KPI decision-valid (`pre_identifier_turns >= 20` and `post_identifier_turns >= 20`): `no`
- chart KPI decision-valid (`pre_chart_turns >= 20` and `post_chart_turns >= 20`): `no`
- write KPI decision-valid (`pre_write_turns >= 20` and `post_write_turns >= 20`): `no`

Directional gates (early-stage, both windows must pass):

- typed KPI directional-valid (`pre_typed_turns >= 10` and `post_typed_turns >= 10`): `yes`
- identifier KPI directional-valid (`pre_identifier_turns >= 5` and `post_identifier_turns >= 5`): `no`
- chart KPI directional-valid (`pre_chart_turns >= 5` and `post_chart_turns >= 5`): `no`
- write KPI directional-valid (`pre_write_turns >= 5` and `post_write_turns >= 5`): `no`

## Decision

- Status: `watch`
- Confidence: `directional-only`
- Short reason: typed KPIs have enough volume for a directional read only and show mixed movement (shorter answers, lower follow-up), while identifier/chart/write KPIs remain volume-invalid for decision-making.

## Regressions / Observations

1. Typed responses got materially shorter (`1743 -> 1321`, about `-24.2%`), and the trailing 28d median landed at `1461`, so the brevity work still appears directionally positive.
2. Typed follow-up rate fell (`0.5600 -> 0.4762`) even as suggestion share also fell (`0.2857 -> 0.1250`), which is a mild regression signal worth watching because the post window was more typed-heavy.
3. Route-level telemetry is still too sparse for confident calls: identifier traffic was `1 -> 0`, chart traffic was `11 -> 3`, and write traffic remained `0 -> 0`.

## Actions for Next Run

1. Run the next fixed-cadence snapshot for `2026-04-08` UTC using `pre_14d = 2026-03-11 -> 2026-03-25` and `post_14d = 2026-03-25 -> 2026-04-08`.
2. Keep using the trailing 28d companion view as the stability read until route-level traffic consistently clears directional gates.
3. If errors appear in the next post window, add an optional error drilldown query with top conversation IDs and route-level notes to support the observations section.
