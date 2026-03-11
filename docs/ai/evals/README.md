# AI Evals Runbook

This is the single runbook for AI Advisor evaluations.

## What Lives Here

`docs/ai/evals/` stores outputs and templates:

1. One historical baseline snapshot (`2026-02-27-AI-ADVISOR-BASELINE-EVAL.md`)
2. Cadenced eval snapshots (telemetry KPI comparisons, default every 14 days)
3. One eval template

## Naming Convention (UTC)

Use this for ongoing operation:

- `YYYY-MM-DD-AI-ADVISOR-WEEKLY-EVAL.md`
- Template: `TEMPLATE-AI-ADVISOR-WEEKLY-EVAL.md`

`WEEKLY` remains in file names for compatibility, even though the default cadence is now every 14 days.
Baseline is a one-time historical artifact and does not need its own recurring template.
The baseline file follows the same structure as recurring eval snapshots.

## Current Telemetry Table

Eval queries use `public.ai_assistant_turn_events`.

Tracked fields:

1. `conversation_id`
2. `assistant_message_id`
3. `user_id`
4. `created_at`
5. `model`
6. `prompt_source` (`typed` or `suggestion`)
7. `assistant_chars`
8. `routes` (array of: `general`, `identifier`, `chart`, `write`)
9. `outcome` (`ok`, `clarify`, `error`, `approved`, `committed`)

Schema source:

- `supabase/migrations/20260227032421_create_ai_assistant_turn_events.sql`
- `supabase/migrations/20260228022739_convert_ai_turn_events_route_to_routes_array.sql`

## Eval Procedure (Every 14 Days, UTC)

Run on a fixed UTC schedule (example: every other Wednesday at `00:30 UTC`) so windows stay consistent.

### Step 1: Create This Run's File

1. Copy `TEMPLATE-AI-ADVISOR-WEEKLY-EVAL.md`
2. Save as `YYYY-MM-DD-AI-ADVISOR-WEEKLY-EVAL.md`

### Step 2: Run 14-Day Pre/Post KPI Query

Set your post window in `params`:

```sql
with params as (
  select
    timestamptz '2026-03-11 00:00:00+00' as post_start,
    timestamptz '2026-03-25 00:00:00+00' as post_end
),
windows as (
  select 'post_14d'::text as period, post_start as start_ts, post_end as end_ts from params
  union all
  select 'pre_14d'::text, post_start - interval '14 days', post_start from params
),
base as (
  select
    w.period,
    e.conversation_id,
    e.assistant_message_id,
    e.created_at,
    e.prompt_source,
    e.assistant_chars,
    e.routes,
    e.outcome
  from windows w
  join public.ai_assistant_turn_events e
    on e.created_at >= w.start_ts
   and e.created_at < w.end_ts
),
typed_followups as (
  select
    b.period,
    b.assistant_message_id,
    exists (
      select 1
      from public.conversation_messages m
      where m.conversation_id = b.conversation_id
        and m.role = 'user'
        and m.created_at > b.created_at
    ) as has_followup
  from base b
  where b.prompt_source = 'typed'
),
kpis as (
  select
    b.period,
    percentile_cont(0.5) within group (order by b.assistant_chars)
      filter (where b.prompt_source = 'typed') as assistant_chars_median_typed,
    avg(case when tf.has_followup then 1.0 else 0.0 end)
      filter (where b.prompt_source = 'typed') as follow_up_rate_typed,
    avg(case when b.outcome = 'error' then 1.0 else 0.0 end)
      filter (where b.routes @> array['identifier']::text[]) as identifier_error_rate,
    avg(case when b.outcome = 'ok' then 1.0 else 0.0 end)
      filter (where b.routes @> array['chart']::text[]) as chart_completion_rate,
    avg(case when b.outcome = 'committed' then 1.0 else 0.0 end)
      filter (where b.routes @> array['write']::text[]) as write_commit_success_rate
  from base b
  left join typed_followups tf
    on tf.period = b.period
   and tf.assistant_message_id = b.assistant_message_id
  group by b.period
),
volume as (
  select
    period,
    count(*) as assistant_turns,
    count(*) filter (where prompt_source = 'typed') as typed_turns,
    count(*) filter (where prompt_source = 'suggestion') as suggestion_turns,
    avg(case when prompt_source = 'suggestion' then 1.0 else 0.0 end) as suggestion_share,
    count(*) filter (where routes @> array['identifier']::text[]) as identifier_turns,
    count(*) filter (where routes @> array['chart']::text[]) as chart_turns,
    count(*) filter (where routes @> array['write']::text[]) as write_turns
  from base
  group by period
)
select
  k.*,
  v.assistant_turns,
  v.typed_turns,
  v.suggestion_turns,
  v.suggestion_share,
  v.identifier_turns,
  v.chart_turns,
  v.write_turns
from kpis k
join volume v using (period)
order by k.period;
```

### Step 3: Run Trailing 28-Day Companion Query

Use this as a low-traffic stability check. It does not replace the 14d pre/post comparison.

```sql
with params as (
  select timestamptz '2026-03-25 00:00:00+00' as as_of_end
),
base as (
  select
    e.conversation_id,
    e.assistant_message_id,
    e.created_at,
    e.prompt_source,
    e.assistant_chars,
    e.routes,
    e.outcome
  from public.ai_assistant_turn_events e
  join params p
    on e.created_at >= p.as_of_end - interval '28 days'
   and e.created_at < p.as_of_end
),
typed_followups as (
  select
    b.assistant_message_id,
    exists (
      select 1
      from public.conversation_messages m
      where m.conversation_id = b.conversation_id
        and m.role = 'user'
        and m.created_at > b.created_at
    ) as has_followup
  from base b
  where b.prompt_source = 'typed'
),
kpis as (
  select
    percentile_cont(0.5) within group (order by b.assistant_chars)
      filter (where b.prompt_source = 'typed') as assistant_chars_median_typed,
    avg(case when tf.has_followup then 1.0 else 0.0 end)
      filter (where b.prompt_source = 'typed') as follow_up_rate_typed,
    avg(case when b.outcome = 'error' then 1.0 else 0.0 end)
      filter (where b.routes @> array['identifier']::text[]) as identifier_error_rate,
    avg(case when b.outcome = 'ok' then 1.0 else 0.0 end)
      filter (where b.routes @> array['chart']::text[]) as chart_completion_rate,
    avg(case when b.outcome = 'committed' then 1.0 else 0.0 end)
      filter (where b.routes @> array['write']::text[]) as write_commit_success_rate
  from base b
  left join typed_followups tf
    on tf.assistant_message_id = b.assistant_message_id
),
volume as (
  select
    count(*) as assistant_turns,
    count(*) filter (where prompt_source = 'typed') as typed_turns,
    count(*) filter (where prompt_source = 'suggestion') as suggestion_turns,
    avg(case when prompt_source = 'suggestion' then 1.0 else 0.0 end) as suggestion_share,
    count(*) filter (where routes @> array['identifier']::text[]) as identifier_turns,
    count(*) filter (where routes @> array['chart']::text[]) as chart_turns,
    count(*) filter (where routes @> array['write']::text[]) as write_turns
  from base
)
select
  p.as_of_end,
  k.*,
  v.*
from params p
cross join kpis k
cross join volume v;
```

### Step 4: Fill Eval Template

From query output, fill:

1. 14d pre/post KPI values and denominators
2. Trailing 28d companion metrics
3. Volume gate checks (decision + directional)
4. Decision (`pass`, `watch`, `investigate`) and confidence level
5. Actions for next run

### Step 5: Apply Volume Gates

For pre/post comparisons, both windows must pass the gate for that KPI family.

Decision gates (high confidence):

1. typed KPIs: `typed_turns >= 30` in both `pre_14d` and `post_14d`
2. identifier KPI: `identifier_turns >= 20` in both windows
3. chart KPI: `chart_turns >= 20` in both windows
4. write KPI: `write_turns >= 20` in both windows

Directional gates (early-stage, low confidence):

1. typed KPIs: `typed_turns >= 10` in both windows
2. identifier KPI: `identifier_turns >= 5` in both windows
3. chart KPI: `chart_turns >= 5` in both windows
4. write KPI: `write_turns >= 5` in both windows

Route denominators are membership-based (`routes[]` containment), so one turn can contribute to multiple route buckets.

### Step 6: Apply Decision Policy

1. Use `pass` or `investigate` only when the deciding KPI signals are decision-gate valid.
2. Use `watch` with `directional-only` confidence when only directional gates pass.
3. Use `watch` with `insufficient-sample` confidence when directional gates also fail.
4. When KPI signals conflict, prefer `watch` and document what extra data is needed.

## KPI Direction Guide

1. `assistant_chars_median_typed`: lower is better
2. `follow_up_rate_typed`: higher is better
3. `identifier_error_rate`: lower is better
4. `chart_completion_rate`: higher is better
5. `write_commit_success_rate`: relevant only after write tools launch
6. `suggestion_share`: context metric, not a direct quality KPI (use to interpret prompt-mix shifts)

## Current Behavior Notes

1. Current telemetry version emits `outcome` mostly as `ok` or `error`.
2. Regenerate currently defaults to `prompt_source = 'typed'`.
3. One turn can contain multiple routes (`routes[]`) when multiple route-driving tools are used.
4. `general` is a fallback route; when a turn also includes specific routes (`identifier`, `chart`, `write`), `general` is dropped.
5. Tool-call budget counts actual tool executions; exact duplicate tool+input calls are deduplicated and reuse one execution.
6. `follow_up_rate_typed` may undercount in long threads due to message trimming.
