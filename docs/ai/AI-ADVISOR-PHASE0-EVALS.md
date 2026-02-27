# AI Advisor Phase 0 Evals (Operational Runbook)

Use this guide after telemetry is live to run weekly Phase 0 evaluation in a
repeatable way.

## Scope

Phase 0 telemetry tracks one event per completed assistant turn in
`public.ai_assistant_turn_events`.

Current fields:

- `conversation_id` (FK to conversations)
- `assistant_message_id` (UUID, unique, not FK)
- `user_id` (FK to auth.users)
- `created_at`
- `model`
- `prompt_source` (`typed` or `suggestion`)
- `assistant_chars`
- `route` (`general`, `identifier`, `chart`, `write`)
- `outcome` (`ok`, `clarify`, `error`, `approved`, `committed`)

Reference schema source:

- `supabase/migrations/20260227032421_create_ai_assistant_turn_events.sql`

## Phase 0.4 Gate

Before moving past Phase 0.4, you must confirm:

1. Ingestion query returns non-zero events.
2. `prompt_source` split includes both `typed` and `suggestion`.
3. 7-day KPI query returns non-empty rows for both windows.

## Step 1: Ingestion Verification

Run this in Supabase SQL editor:

```sql
select
  date_trunc('day', created_at) as day_utc,
  count(*) as events
from public.ai_assistant_turn_events
where created_at >= now() - interval '7 days'
group by 1
order by 1 desc;
```

Prompt source sanity check:

```sql
select
  prompt_source,
  count(*) as events
from public.ai_assistant_turn_events
where created_at >= now() - interval '7 days'
group by prompt_source
order by prompt_source;
```

Route/outcome sanity check:

```sql
select
  route,
  outcome,
  count(*) as events
from public.ai_assistant_turn_events
where created_at >= now() - interval '7 days'
group by route, outcome
order by events desc;
```

## Step 2: Week-1 Pre/Post KPI Query

Run this once after your first full 7-day post window.

If Phase 0 started on `2026-02-27 00:00:00+00`, then first run should compare:

- pre: `2026-02-20 00:00:00+00` to `2026-02-27 00:00:00+00`
- post: `2026-02-27 00:00:00+00` to `2026-03-06 00:00:00+00`

```sql
with params as (
  select
    timestamptz '2026-02-27 00:00:00+00' as phase0_start,
    timestamptz '2026-03-06 00:00:00+00' as phase0_end
),
windows as (
  select 'post_phase0_7d'::text as period, phase0_start as start_ts, phase0_end as end_ts from params
  union all
  select 'pre_phase0_7d'::text, phase0_start - interval '7 days', phase0_start from params
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

## Step 3: Read KPI Results Correctly

Expected direction:

- `assistant_chars_median_typed`: lower is better
- `follow_up_rate_typed`: higher is better
- `identifier_error_rate`: lower is better
- `chart_completion_rate`: higher is better
- `write_commit_success_rate`: ignore until write tools exist

Minimum denominator rule:

- typed KPIs: `typed_turns >= 30`
- identifier KPI: `identifier_turns >= 20`
- chart KPI: `chart_turns >= 20`
- write KPI: `write_turns >= 20`

If denominator is below threshold, do not call it regression/improvement yet.

## Step 4: Save Snapshot in `docs/ai/evals/`

Create one weekly file:

- `YYYY-MM-DD-AI-ADVISOR-WEEKLY-KPI.md`

Template:

- `docs/ai/evals/TEMPLATE-AI-ADVISOR-WEEKLY-KPI.md`

Minimum content per weekly file:

1. raw query output or summarized KPI values
2. all denominators
3. decision: pass / watch / investigate
4. next action items

## Common Pitfalls

1. Evaluating with tiny denominators.
2. Comparing non-aligned windows.
3. Mixing typed and suggestion traffic in one metric.
4. Treating one-week noise as product signal.
