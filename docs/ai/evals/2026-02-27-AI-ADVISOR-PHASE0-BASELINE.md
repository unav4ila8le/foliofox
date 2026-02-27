# AI Advisor Phase 0 Baseline (2026-02-27 UTC)

## Scope

Pre-change baseline snapshot before Phase 0 telemetry + brevity rollout.

Source used:

- `/Users/leonardo/Desktop/Supabase Snippet Recent 300 Conversation Messages.csv`
- Date captured: 2026-02-27 (UTC)

## Baseline Metrics (Pre-Telemetry Proxy)

- Conversations in sample: `75`
- Messages in sample: `300`
- Assistant turns: `149`
- User turns: `151`
- Median assistant chars: `2790`
- Assistant average chars: `3209`
- Single-turn conversations (1 user + 1 assistant): `47/75` (`62.7%`)
- Exact quick-suggestion share of user turns: `34/151` (`22.5%`)

### Typed Follow-up Proxy (From Existing Conversation Messages)

Typed follow-up requires `prompt_source`, which does not exist yet in DB.

Temporary proxy used in this baseline:

- treat exact quick-suggestion prompts as non-typed
- treat all other prompts as typed proxy

Observed in this export: `100%` follow-up after typed-proxy assistant turns.

Important caveat:

- this export is a rolling "last N messages" slice, so many conversations are partial.
- this makes follow-up proxy unreliable as an absolute metric.
- once Phase 0 telemetry is live, KPI `follow_up_rate` should be taken from `ai_assistant_turn_events` only.

## Known Failure Examples (Current State)

### Identifier Resolution

Conversation `bdb9e147-2a70-4245-bc80-9278fee964ed`

- Assistant could not resolve ISIN-driven instrument lookup and requested manual product sheet/screenshot.

### Chart Flow / Clarification Loop

Conversation `4a329ddc-c755-4990-92ef-6540971e5d25`

- User requested PNG/drawdown chart.
- Assistant asked repeated format/timeframe clarifications across multiple turns before completion.

## Notes for Week-1 Comparison

When Phase 0 telemetry is live:

1. Compare this snapshot against post-change 7-day window.
2. Use KPI query from `docs/ai/AI-ADVISOR-PHASE0-EVALS.md`.
3. Use only telemetry-backed `prompt_source` for typed metrics.
