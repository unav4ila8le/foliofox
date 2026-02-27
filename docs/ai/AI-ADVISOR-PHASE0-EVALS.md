# AI Advisor Phase 0 Evals (Beginner Runbook)

This guide is for first-time telemetry/eval setup in Foliofox.

If you just finished Phase 0, this document tells you exactly:

1. what telemetry is
2. how to create the telemetry table
3. how to verify events are being recorded
4. how to run the 7-day KPI check

---

## What "Telemetry Table" Means

A telemetry table is just a database table that stores lightweight analytics events.

For Phase 0, we store one event per completed assistant response with the MVP fields from the roadmap:

- `conversation_id`
- `assistant_message_id`
- `created_at`
- `model`
- `prompt_source`
- `assistant_chars`
- `route`
- `outcome`

This is what KPI queries read from.

---

## Step 1: Create the Telemetry Table

Run this once in Supabase SQL Editor.

```sql
create table if not exists public.ai_assistant_turn_events (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null
    references public.conversations(id) on delete cascade,
  assistant_message_id uuid not null
    references public.conversation_messages(id) on delete cascade,
  user_id uuid not null
    references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  model text not null,
  prompt_source text not null
    check (prompt_source in ('suggestion', 'typed')),
  route text not null
    check (route in ('general', 'identifier', 'chart', 'write')),
  outcome text not null
    check (outcome in ('ok', 'clarify', 'error', 'approved', 'committed')),
  assistant_chars integer not null
    check (assistant_chars >= 0),
  unique (assistant_message_id)
);

create index if not exists idx_ai_turn_events_created_at
  on public.ai_assistant_turn_events(created_at desc);

create index if not exists idx_ai_turn_events_user_created_at
  on public.ai_assistant_turn_events(user_id, created_at desc);

create index if not exists idx_ai_turn_events_route_outcome_created_at
  on public.ai_assistant_turn_events(route, outcome, created_at desc);

alter table public.ai_assistant_turn_events enable row level security;

do $$
begin
  create policy "Users can view own AI turn events"
    on public.ai_assistant_turn_events
    for select
    to authenticated
    using (user_id = auth.uid());
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create policy "Users can insert own AI turn events"
    on public.ai_assistant_turn_events
    for insert
    to authenticated
    with check (user_id = auth.uid());
exception
  when duplicate_object then null;
end $$;
```

---

## Step 2: Emit One Event Per Assistant Turn

Implementation point: chat API finish hook.

- File: `app/api/ai/chat/route.ts`
- Place: inside `onFinish`, after assistant message persistence succeeds.

### Field Mapping

- `conversation_id`: request header `x-ff-conversation-id`
- `assistant_message_id`: `responseMessage.id`
- `user_id`: authenticated user id from server session
- `created_at`: `now()`
- `model`: `chatModelId`
- `prompt_source`: start with `typed` unless explicitly sent as `suggestion`
- `assistant_chars`: total text length of assistant text parts
- `route`: classify to `general` / `identifier` / `chart` / `write`
- `outcome`: `ok` / `clarify` / `error` / `approved` / `committed`

### Practical Note

For week 1, you can keep route classification simple:

- default `route = 'general'`
- set `route = 'identifier'` when symbol lookup tools are used
- set `route = 'chart'` when chart/historical quote flow is used
- keep `route = 'write'` for Phase 4 tools only

Until this step is live in production, KPI queries will return empty or partial data.

---

## Step 3: Verify Events Are Arriving

Run after deploying instrumentation:

```sql
select
  date_trunc('day', created_at) as day_utc,
  count(*) as events
from public.ai_assistant_turn_events
where created_at >= now() - interval '7 days'
group by 1
order by 1 desc;
```

You should see non-zero daily counts.

Sanity check distribution:

```sql
select prompt_source, route, outcome, count(*) as events
from public.ai_assistant_turn_events
where created_at >= now() - interval '7 days'
group by 1, 2, 3
order by events desc;
```

---

## Step 4: Run 7-Day KPI Evaluation

Use a fixed comparison: 7 days before Phase 0 vs 7 days after Phase 0.

Replace the timestamps in `params`.

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

---

## Step 5: Read Results Correctly

### Desired Direction

- `assistant_chars_median_typed`: lower is better
- `follow_up_rate_typed`: higher is better
- `identifier_error_rate`: lower is better
- `chart_completion_rate`: higher is better
- `write_commit_success_rate`: used in Phase 4 (ignore until write tools exist)

### Minimum Volume Rule

Only trust a KPI if denominator is large enough:

- typed KPIs: `typed_turns >= 30`
- identifier KPI: `identifier_turns >= 20`
- chart KPI: `chart_turns >= 20`
- write KPI: `write_turns >= 20`

If below threshold, collect another week before deciding.

---

## Weekly Checklist (Copy/Paste)

1. Confirm event ingestion query returns data.
2. Run KPI query for pre/post windows.
3. Save results in a weekly note.
4. Flag regressions:
   - typed median chars up
   - typed follow-up down
   - identifier errors up
   - chart completion down
5. If regression exists, review 20-50 typed conversations for root cause.

---

## Common Pitfalls

1. Missing `prompt_source` split causes misleading follow-up analysis.
2. Mixing suggestion-heavy traffic with typed traffic hides real behavior.
3. Reading KPIs with tiny denominators leads to noisy decisions.
4. Comparing non-aligned date windows (not exact 7-day vs 7-day) creates false trends.
