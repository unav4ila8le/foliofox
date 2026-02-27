# AI Advisor Roadmap (Data-Backed)

## Purpose

Turn Foliofox AI Advisor into a faster, more conversational, portfolio-native decision partner by prioritizing:

1. Brevity and flow
2. Instrument resolution (ISIN/ticker/symbol)
3. Chart-first generative UI
4. Better measurement of real user demand (not just quick-question clicks)

---

## Dataset Used

Source: `Last 300 Conversation Messages as of 2026-02-27 02:20 UTC`  
Columns: `id, conversation_id, role, content, model`

### Snapshot

- Messages: 300
- Conversations: 75
- Users vs assistant: 151 user, 149 assistant
- Single-turn conversations (1 user + 1 assistant): 47/75 (62.7%)
- Models in sample:
  - `gpt-5-mini` (including `openai/gpt-5-mini`): 202 messages
  - `gpt-4o-mini`: 98 messages

### Key Behavioral Signals

- User messages are short: average ~70 characters.
- Assistant messages are long: average ~3209 characters (median ~2790).
- For `gpt-5-mini` specifically, assistant average is ~4012 characters.
- Suggestion bias is material:
  - 22.5% of all user turns are exact quick-question prompts.
  - 40.0% of first user prompts per conversation are exact quick-question prompts.
- First-response length vs follow-up:
  - Overall, conversations with first assistant response `4000+` chars had lower follow-up rates than shorter responses.
  - Suggestion-driven conversations are especially low-follow-up by design, so this must be segmented in analytics.

### Confirmed Product Gaps

1. **Identifier resolution gap (ISIN/ticker/symbol):** users ask with broker/product identifiers the advisor cannot reliably resolve.
2. **Chart UX gap:** users ask for PNG/chart output and the current experience can loop or degrade into repeated clarifications.
3. **Over-verbose answers:** response size is often disproportionate to user prompt size, slowing conversation flow.

### Additional Organic Opportunities

1. **Execution-intent boundary is unclear:** prompts like "sell it for me" show users testing actionability limits. The advisor should clearly separate analysis from execution and offer broker-ready next steps.
2. **Product-support prompts appear in chat:** examples include quantity not updating after records. AI should detect likely app issues and route to an in-product troubleshooting flow instead of generic investment advice.
3. **Mixed language inputs are common:** English and Italian appear frequently in the same dataset, so concise bilingual-safe response behavior matters.

---

## Important Caveats

1. Quick-question prompts significantly bias message distribution and engagement metrics.
2. This dataset spans at least two model eras (`gpt-4o-mini` and `gpt-5-mini`), so quality/length comparisons must be segmented.
3. CSV includes only persisted message text, not explicit metadata for prompt source (typed vs suggestion click), tool success, or render success.

---

## North Star

AI answers should feel like:

- Immediate: lead with a direct answer in 2-6 lines
- Contextual: grounded in user portfolio/history
- Interactive: easy to continue the thread
- Operational: structured output (cards/charts/actions) when useful

---

## Roadmap

## Phase 0 (Now): Conversation Flow + Observability

Objective: reduce verbosity and establish reliable product telemetry.

### Workstream A: Response Brevity

- Update system prompt to enforce:
  - short answer first
  - max 3 bullets unless user asks for deep dive
  - explicit "want details?" follow-up affordance
- Lower default `maxOutputTokens` for chat responses.
- Add optional "Expand" instruction path (user-triggered) rather than verbose-by-default.

### Workstream B: Telemetry MVP (Keep It Light)

- Emit one event per completed assistant turn (single event type).
- Implementation and weekly eval guide: see `docs/ai/evals/README.md`.
- Required fields only:
  - `conversation_id`
  - `assistant_message_id`
  - `created_at`
  - `model`
  - `prompt_source` (`suggestion` | `typed`)
  - `assistant_chars`
  - `route` (`general` | `identifier` | `chart` | `write`)
  - `outcome` (`ok` | `clarify` | `error` | `approved` | `committed`)
- Derive follow-up behavior from message sequence instead of storing extra fields.
- Rule: add new telemetry fields only when a KPI cannot be explained with this MVP schema.

### Exit Criteria

- Median assistant length reduced by >=35% on typed prompts.
- Typed-prompt follow-up rate improved by >=15%.
- Weekly KPI report is computed from telemetry MVP without schema expansion.

---

## Phase 1: Instrument Resolution Layer (ISIN-first UX)

Objective: make symbol/instrument queries robust for global users and broker-specific inputs.

### Workstream A: Data Model + Resolver

- Expand alias strategy in `symbol_aliases` to support additional alias types (starting with ISIN).
- Add resolver chain:
  1. exact UUID
  2. local aliases (ticker, isin, legacy)
  3. provider search fallback + disambiguation
- Persist successful alias resolutions to reduce repeated misses.

### Workstream B: AI Tooling + Prompting

- Introduce a dedicated `resolveInstrument` tool returning:
  - canonical symbol id
  - matched alias
  - confidence
  - alternatives when ambiguous
- Update tool descriptions/prompt behavior to resolve before analysis calls.
- Standardize user-facing fallback message when unresolved:
  - clear reason
  - one-step disambiguation request
  - avoid repetitive loops

### Exit Criteria

- Unresolved symbol/identifier error rate reduced by >=60%.
- ISIN-origin prompts resolved successfully in >=80% of attempts.

---

## Phase 2: Generative UI for Charts and Structured Insights

Objective: replace text-heavy chart explanations with visual, scannable outputs.

### Workstream A: Chart Components

- Add chart message parts/cards for:
  - historical price
  - drawdown
  - scenario/projection bands (when available)
- Prefer structured tool output rendered by UI components over inline text dumps.

### Workstream B: Interaction Patterns

- Add "Show chart" and "Show table" quick actions under relevant answers.
- Add timeframe chips (`3M`, `6M`, `1Y`, `Max`) for follow-up refinement.
- Ensure chart requests do not require repeated clarification when timeframe already provided.

### Exit Criteria

- Chart request completion rate >=90% without clarification loops.
- Reduction in chart-related multi-turn clarification chains by >=50%.

---

## Phase 3: Planning Copilot (Goals, Scenarios, and Execution)

Objective: transform frequent goal/probability/rebalance questions into actionable planning workflows.

### Workstream A: Scenario-Aware Answers

- Deep integration with scenario planning outputs and assumptions.
- Promote deterministic + probability-aware outputs with explicit assumptions.

### Workstream B: Actionability

- "Convert answer to plan" actions:
  - create/adjust scenario events
  - save target allocation
  - create watchlist/review checklist

### Exit Criteria

- Higher repeat usage on planning conversations.
- Improved completion rate for goal-oriented threads (user confirms a next action in-thread).

---

## Phase 4: Controlled Portfolio Writes (Approval-Gated Tools)

Objective: let users update portfolio data directly from chat with explicit approval and strong safety checks.

### Why This Phase

- Users naturally ask operational requests like: "today I bought 20 shares of AAPL, can you update my records?"
- Current advisor is mostly read/analyze oriented; this phase closes the loop from advice to execution inside Foliofox.
- UI already includes tool states for approval/denial, so we can build on an aligned interaction model.

### Workstream A: Write Tool Surface (Records First)

- Add approval-gated tools for portfolio records:
  - `draftCreatePortfolioRecord`
  - `commitCreatePortfolioRecord`
  - `draftUpdatePortfolioRecord`
  - `commitUpdatePortfolioRecord`
- Start with records (`buy`, `sell`, `update`) before direct position mutations to reduce blast radius.
- Keep inputs explicit and typed: `position_id`, `type`, `date`, `quantity`, `unit_value`, optional `description`.

### Workstream B: Draft -> Confirm -> Commit Protocol

- Enforce a two-step flow:
  1. Draft tool resolves symbol/position and validates missing fields.
  2. Assistant asks only for unresolved required values (price/date/fees/description).
  3. Commit tool executes only after explicit user approval.
- Assistant must present a clear "execution summary" before commit:
  - target position
  - action type
  - quantity and unit value
  - effective date
  - resulting quantity delta preview (if applicable)

### Workstream C: Safety, Permissions, and Auditability

- Approval is mandatory for all mutating tools (deny by default).
- Add idempotency protection to prevent duplicate writes on retries/regenerations.
- Persist audit metadata for each write:
  - `approved_by_user` boolean
  - `approved_at`
  - `tool_call_id` / `conversation_id`
  - `before_snapshot` and `after_snapshot` summary
- Add strict server-side ownership checks (`user_id`) and schema validation.
- Return user-friendly conflict errors (archived position, invalid date, currency mismatch, etc.).

### Workstream D: UX Details

- Approval card should show concise diff-style preview ("what will change").
- After commit, assistant responds with a short confirmation and next best action.
- Add "undo guidance" message when reversible via a counter-record.

### Exit Criteria

- > =90% of approved write intents complete without manual fallback.
- <1% duplicate-write incidents.
- Median write flow completion <=2 assistant turns after user intent.
- Clear audit trail available for 100% of AI-triggered mutations.

---

## Metrics to Monitor Weekly

1. `assistant_chars_median` (typed prompts only)
2. `follow_up_rate` (typed prompts only)
3. `identifier_error_rate`
4. `chart_completion_rate`
5. `write_commit_success_rate` (Phase 4)

---

## Suggested Execution Order

1. Phase 0 first (flow + telemetry)
2. Phase 1 (identifier reliability)
3. Phase 2 (generative UI charts)
4. Phase 3 (planning copilot)
5. Phase 4 (approval-gated portfolio writes)

This order reduces immediate UX friction first, then unlocks richer AI experiences on a stable, measurable base.
