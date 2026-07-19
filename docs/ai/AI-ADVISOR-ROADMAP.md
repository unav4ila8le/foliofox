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
  - `gpt-5.4-mini` (including `openai/gpt-5.4-mini`): 202 messages
  - `gpt-4o-mini`: 98 messages

### Key Behavioral Signals

- User messages are short: average ~70 characters.
- Assistant messages are long: average ~3209 characters (median ~2790).
- For `gpt-5.4-mini` specifically, assistant average is ~4012 characters.
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
2. This dataset spans at least two model eras (`gpt-4o-mini` and `gpt-5.4-mini`), so quality/length comparisons must be segmented.
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
  - `routes` (array of: `general` | `identifier` | `chart` | `write`)
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

## Phase 4: Controlled Portfolio Writes (Approval-Gated Tools) — SHIPPED

Objective: let users update portfolio data directly from chat with explicit approval and strong safety checks.

> **Design note (v2):** the original draft/commit 4-tool protocol below was designed
> against AI SDK 5, before native tool approvals existed. The shipped implementation
> uses AI SDK v7 `toolApproval: 'user-approval'` on `streamText`: the SDK approval
> round-trip **is** the draft → summary → approve → execute flow, so each write needs
> exactly one tool.

### Why This Phase

- Users naturally ask operational requests like: "today I bought 20 shares of AAPL, can you update my records?"
- Current advisor is mostly read/analyze oriented; this phase closes the loop from advice to execution inside Foliofox.
- UI already includes tool states for approval/denial, so we can build on an aligned interaction model.

### Workstream A: Write Tool Surface — DONE

- `createPortfolioRecord` (buy/sell/update on existing positions) and `createPosition`
  (new asset/liability), thin wrappers over the shared form/import mutations
  (`server/portfolio-records/create.ts`, `server/positions/create.ts`).
- Companion read tool `getPositionCategories` so the model picks valid category ids.
- Explicit typed inputs including a mandatory `summary` string rendered on the approval card.
- Deletes/archives, record edits, and imports stay out of scope (dashboard only).

### Workstream B: Approval Flow — DONE (SDK-native)

- `toolApproval: { createPortfolioRecord: 'user-approval', createPosition: 'user-approval' }`
  in the chat route; the model's tool call pauses the turn with an approval request.
- AI Elements `Confirmation` card shows the summary with Approve/Deny;
  `addToolApprovalResponse` + `sendAutomaticallyWhen` resume the turn, which continues
  into the same assistant message (persistence upserts, telemetry dedupes).
- Composer is blocked while an approval is pending (an unanswered request would leave a
  dangling tool call).

### Workstream C: Safety, Permissions, and Auditability — DONE (lean)

- Approval mandatory for all mutating tools; denial produces an `execution-denied` tool
  result and the system prompt forbids retrying denied writes.
- `TOOL_APPROVAL_SECRET` HMAC-signs approval requests (binds tool name + call id +
  input); forged/tampered approvals are rejected fail-closed.
- Server-side re-validation on the approval round-trip: signature, input schema, and
  approval policy are all re-checked before execution.
- Ownership via user-scoped Supabase client + RLS; all form validations (timeline,
  oversell, duplicate name, currency FK) apply unchanged and return friendly errors.
- Audit trail: conversation persistence stores every tool call with inputs, approval
  state, and outputs; telemetry logs `write` route and `committed` outcome per turn.
  (Dedicated audit table skipped — revisit if compliance needs arise.)
- Known caveat: regenerating a turn whose write already committed can make the model
  propose the same write again as a fresh approval. The user gate protects against
  silent duplicates; DB-level idempotency would need a migration if this bites.
- Known caveat: an approved write is not idempotent — if the network response for the
  approval continuation is lost and the client retries the same request, the tool can
  execute twice (duplicate record). Requires a rare double failure. Proper fix is a
  migration adding a unique idempotency key (e.g. the tool-call id) to the write path;
  do together with the regenerate caveat above if either bites.

### Workstream D: UX Details — DONE

- Approval card shows a one-line plain-language summary of exactly what will change.
- After commit, the advisor confirms briefly; the dashboard auto-refreshes
  (`router.refresh()`) after a successful write.
- Undo guidance: not implemented; counter-record advice is left to the model.

### Exit Criteria

- > =90% of approved write intents complete without manual fallback.
- <1% duplicate-write incidents.
- Median write flow completion <=2 assistant turns after user intent.
- AI-triggered mutations traceable via persisted tool calls + `committed` telemetry.

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
