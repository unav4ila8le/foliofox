# AI Evals Runbook

This is the single runbook for AI Advisor evaluations.

## What Lives Here

`docs/ai/evals/` stores outputs and templates:

1. One historical baseline snapshot (`2026-02-27-AI-ADVISOR-BASELINE-EVAL.md`)
2. Weekly eval snapshots (telemetry KPI comparisons)
3. One weekly template

## Naming Convention (UTC)

Use this for ongoing operation:

- `YYYY-MM-DD-AI-ADVISOR-WEEKLY-EVAL.md`
- Template: `TEMPLATE-AI-ADVISOR-WEEKLY-EVAL.md`

Baseline is a one-time historical artifact and does not need its own recurring template.
The baseline file follows the same structure as weekly eval snapshots.

## Current Telemetry Table

Weekly queries use `public.ai_assistant_turn_events`.

Tracked fields:

1. `conversation_id`
2. `assistant_message_id`
3. `user_id`
4. `created_at`
5. `model`
6. `prompt_source` (`typed` or `suggestion`)
7. `assistant_chars`
8. `route` (`general`, `identifier`, `chart`, `write`)
9. `outcome` (`ok`, `clarify`, `error`, `approved`, `committed`)

Schema source:

- `supabase/migrations/20260227032421_create_ai_assistant_turn_events.sql`

## One-Time Launch Check (After Deploy)

Run once after deploying telemetry instrumentation:

1. Send one typed chat message in production.
2. Click one suggestion message in production.
3. Run the two checks below in Supabase SQL editor.

Ingestion check:

```sql
select
  date_trunc('day', created_at) as day_utc,
  count(*) as events
from public.ai_assistant_turn_events
where created_at >= now() - interval '7 days'
group by 1
order by 1 desc;
```

Prompt source split check:

```sql
select
  prompt_source,
  count(*) as events
from public.ai_assistant_turn_events
where created_at >= now() - interval '7 days'
group by prompt_source
order by prompt_source;
```

Pass condition:

1. non-zero events in ingestion check
2. both `typed` and `suggestion` rows present

## Weekly Eval Procedure (Every 7 Days, UTC)

### Step 1: Create This Week's File

1. Copy `TEMPLATE-AI-ADVISOR-WEEKLY-EVAL.md`
2. Save as `YYYY-MM-DD-AI-ADVISOR-WEEKLY-EVAL.md`

### Step 2: Run KPI Query

Set your post window in `params`:

```sql
with params as (
  select
    timestamptz '2026-03-06 00:00:00+00' as post_start,
    timestamptz '2026-03-13 00:00:00+00' as post_end
),
windows as (
  select 'post_7d'::text as period, post_start as start_ts, post_end as end_ts from params
  union all
  select 'pre_7d'::text, post_start - interval '7 days', post_start from params
),
base as (
  select
    w.period,
    e.conversation_id,
    e.assistant_message_id,
    e.created_at,
    e.prompt_source,
    e.assistant_chars,
    e.route,
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
      filter (where b.route = 'identifier') as identifier_error_rate,
    avg(case when b.outcome = 'ok' then 1.0 else 0.0 end)
      filter (where b.route = 'chart') as chart_completion_rate,
    avg(case when b.outcome = 'committed' then 1.0 else 0.0 end)
      filter (where b.route = 'write') as write_commit_success_rate
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
    count(*) filter (where route = 'identifier') as identifier_turns,
    count(*) filter (where route = 'chart') as chart_turns,
    count(*) filter (where route = 'write') as write_turns
  from base
  group by period
)
select
  k.*,
  v.assistant_turns,
  v.typed_turns,
  v.identifier_turns,
  v.chart_turns,
  v.write_turns
from kpis k
join volume v using (period)
order by k.period;
```

### Step 3: Fill Weekly Template

From query output, fill:

1. KPI values
2. Denominators
3. Volume gate checks
4. Decision (`pass`, `watch`, `investigate`)
5. Actions for next week

### Step 4: Apply Minimum Volume Gates

Do not call regressions/improvements if sample is too small:

1. typed KPIs: `typed_turns >= 30`
2. identifier KPI: `identifier_turns >= 20`
3. chart KPI: `chart_turns >= 20`
4. write KPI: `write_turns >= 20`

## KPI Direction Guide

1. `assistant_chars_median_typed`: lower is better
2. `follow_up_rate_typed`: higher is better
3. `identifier_error_rate`: lower is better
4. `chart_completion_rate`: higher is better
5. `write_commit_success_rate`: relevant only after write tools launch

## Current Behavior Notes

1. Current telemetry version emits `outcome` mostly as `ok` or `error`.
2. Regenerate currently defaults to `prompt_source = 'typed'`.
3. If both chart and identifier tools appear in one turn, route precedence is `chart`.
4. `follow_up_rate_typed` may undercount in long threads due to message trimming.
