# AI Advisor Eval Snapshot (YYYY-MM-DD UTC)

## Window

- Run date (UTC): `YYYY-MM-DD`
- Compared windows:
- `pre_14d`: `YYYY-MM-DD 00:00:00+00` to `YYYY-MM-DD 00:00:00+00`
- `post_14d`: `YYYY-MM-DD 00:00:00+00` to `YYYY-MM-DD 00:00:00+00`

## KPI Output (14d Pre/Post)

Paste SQL output table here, or summarize:

- `assistant_chars_median_typed`:
- `follow_up_rate_typed`:
- `identifier_error_rate`:
- `chart_completion_rate`:
- `write_commit_success_rate`:
- `suggestion_share`:

## Denominators (14d Pre/Post)

- `assistant_turns`:
- `typed_turns`:
- `suggestion_turns`:
- `identifier_turns`:
- `chart_turns`:
- `write_turns`:

## Trailing 28d Companion

- `as_of_end`:
- `assistant_chars_median_typed`:
- `follow_up_rate_typed`:
- `identifier_error_rate`:
- `chart_completion_rate`:
- `write_commit_success_rate`:
- `suggestion_share`:
- `assistant_turns`:
- `typed_turns`:
- `suggestion_turns`:
- `identifier_turns`:
- `chart_turns`:
- `write_turns`:

## Volume Gate Check

Decision gates (high confidence, both windows must pass):

- typed KPI decision-valid (`pre_typed_turns >= 30` and `post_typed_turns >= 30`): `yes|no`
- identifier KPI decision-valid (`pre_identifier_turns >= 20` and `post_identifier_turns >= 20`): `yes|no`
- chart KPI decision-valid (`pre_chart_turns >= 20` and `post_chart_turns >= 20`): `yes|no`
- write KPI decision-valid (`pre_write_turns >= 20` and `post_write_turns >= 20`): `yes|no`

Directional gates (early-stage, both windows must pass):

- typed KPI directional-valid (`pre_typed_turns >= 10` and `post_typed_turns >= 10`): `yes|no`
- identifier KPI directional-valid (`pre_identifier_turns >= 5` and `post_identifier_turns >= 5`): `yes|no`
- chart KPI directional-valid (`pre_chart_turns >= 5` and `post_chart_turns >= 5`): `yes|no`
- write KPI directional-valid (`pre_write_turns >= 5` and `post_write_turns >= 5`): `yes|no`

## Decision

- Status: `pass | watch | investigate`
- Confidence: `decision-valid | directional-only | insufficient-sample`
- Short reason:

## Regressions / Observations

1.
2.
3.

## Actions for Next Run

1.
2.
3.
