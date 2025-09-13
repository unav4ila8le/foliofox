## docs/AI-ADVISOR.md

### Foliofox AI Advisor — Project Plan

#### Goal

Add a right-side collapsible chat that lets users “talk to Foliofox” about their portfolio. Answers must be contextual (holdings, transactions, records, quotes, FX, performance). A persistent UI disclaimer will be shown; responses will not repeat disclaimers. Users can choose the advice mode to control how opinionated the AI is.

#### Scope (MVP)

- UI: Right sidebar chat revealed by shifting the dashboard layout (not a Sheet/Drawer). Toggle button lives in the header. On mobile, use a Sheet component for better UX.
- Backend: One chat API route using Vercel AI SDK with direct OpenAI integration.
- Tools: Server-side functions to fetch a user-scoped portfolio snapshot on demand (no client PII leakage).
- Safety: Mode-driven advice intensity (see below). Persistent UI disclaimer; no per-message disclaimers.

#### Non-goals (MVP)

- No embeddings/vector DB yet.
- No long-term memory beyond the current chat session.
- No trade execution.

---

### Architecture

#### UI

- **Status**: ✅ **Implemented**
- Toggle button in `components/dashboard/header/right-panel-toggle-button.tsx` (client component) imported into the server `Header` component.
- Right panel layout managed by `RightPanelProvider` in `components/dashboard/layout/right-panel/index.tsx`.
- Chat component at `components/dashboard/layout/right-panel/chat.tsx` using AI SDK Elements:
  - `Conversation`, `Message`, `MessageContent`, `MessageAvatar` components
  - `PromptInput`, `PromptInputTextarea`, `PromptInputSubmit` for input handling
  - Streaming responses with status indicators
  - Responsive design: desktop fixed panel with smooth transitions, mobile Sheet component

#### API

- **Status**: ✅ **Implemented** (basic version without tools)
- Route: `app/api/ai/chat/route.ts` (Node.js runtime, 30s max duration).
- Uses Vercel **AI SDK** (v5) with **direct OpenAI integration**:
  - Model: `gpt-4o-mini` (hardcoded for now).
  - Streaming responses via `streamText()` and `toUIMessageStreamResponse()`.
  - Ready for "tools" (function calling) to fetch data server-side when needed.

#### Data access (tools)

- **Status**: ⏳ **Pending** - next major implementation phase

Implement server-side tools that enforce RLS via `supabase/server.ts`:

- `get_portfolio_snapshot({ baseCurrency })`
  - Holdings (active), latest records, current value, P/L.
  - Net worth summary, allocation by category, top movers.
- `get_transactions({ range, limit, sortByCreatedAt: true })`
- `get_net_worth_history({ range: '1M' | '3M' | '1Y' | 'YTD' })`
- `get_dividends({ range })` (optional)
- All tools return compact summaries to keep token usage low.

Guideline:

- Summarize server-side (numbers, small tables); only send what’s needed to the model.
- Never return raw secrets/PII.

#### Advice modes (user selectable)

- Educational: Explain concepts and portfolio context; avoid direct buy/sell/hold recommendations. Offer options and trade-offs.
- Advisory: Provide actionable options with conditions (e.g., “If X, consider Y”). Include rationale, assumptions, and risk notes.
- Unhinged: Provide direct, opinionated recommendations (buy/sell/hold/size ideas) with clear rationale and risks. No repeated disclaimers; keep tone decisive but responsible.

#### Prompting & safety

- System prompt includes:
  - Role: “Foliofox AI assistant for personal portfolio insights.”
  - Mode controls: Embed the selected mode (Educational/Advisory/Unhinged) to govern tone and recommendation strength.
  - Constraints: cannot predict the future; explain uncertainty and assumptions; cite which portfolio facts were used.
  - Style: concise, actionable; include risks. Avoid boilerplate disclaimers in responses (covered by UI).
- Inject user settings (preferred currency) and date/time in system context.

#### Configuration

**Current setup** (direct OpenAI):

Add to `.env.local` and Vercel:

- `OPENAI_API_KEY=...` (required)

**Future consideration** (AI Gateway):

For later implementation with AI Gateway:

- `AI_GATEWAY_API_KEY=...`
- `AI_GATEWAY_BASE_URL=https://ai-gateway.vercel.sh/v1`
- `AI_MODEL=openai/gpt-4o-mini`

##### Direct OpenAI vs AI Gateway trade-offs

**Current approach (Direct OpenAI)**:

- Pros: Simple setup, direct billing/monitoring via OpenAI dashboard, lower latency
- Cons: No unified observability, manual provider switching, limited retry logic

**Future option (AI Gateway with BYOK)**:

- Pros: unified API, observability, budgets/limits, retries/fallbacks, easy provider/model switching, app attribution. With BYOK, you pay OpenAI directly; no additional per-token fees.
- Cons: small additional network hop/latency; some provider-specific features may need mapping.

References: [AI Gateway docs](https://vercel.com/docs/ai-gateway), [AI Gateway blog](https://vercel.com/blog/ai-gateway)

---

### Implementation Phases

#### Phase 1 — Skeleton ✅ **COMPLETED**

- ✅ Created `app/api/ai/chat/route.ts` with AI SDK `streamText()` using direct OpenAI integration.
- ✅ Added right sidebar with `RightPanelProvider` context management and smooth transitions.
- ✅ Implemented header toggle button that respects server/client component boundaries.
- ✅ Built chat UI using AI SDK Elements (`Conversation`, `Message`, `PromptInput`) with streaming support.
- ✅ Added responsive design (desktop panel, mobile Sheet) and cookie-based state persistence.

#### Phase 2 — Portfolio context (single tool) ⏳ **NEXT**

- Implement `get_portfolio_snapshot()` in `server/ai/tools/portfolio.ts` using `supabase/server.ts`.
- Add it as an AI SDK tool; update the system prompt with safety/role.
- Model calls tool when needed; responses summarize holdings, net worth, allocation, and key P/L.

#### Phase 3 — Deeper insights (more tools)

- Add `get_transactions()`, `get_net_worth_history()`, and (optional) `get_dividends()`.
- Support common queries: “What changed this week?”, “Top winners/losers?”, “Allocation drift?”, “Income this month?”

#### Phase 4 — UX polish

- Add advice mode selector (Educational/Advisory/Unhinged) in chat interface.
- Show last-updated times (quotes/FX updated daily at 22:00 UTC).
- Add quick-suggestions (chips): "Allocation", "Winners/Losers", "Transactions", "Income".
- Add copy-to-clipboard and basic message persistence per session.

---

### Security & Privacy

- All data fetching is server-side with user-scoped Supabase client and RLS.
- The model only sees summarized portfolio metrics needed to answer the question.
- Log redaction: don’t log raw user prompts or portfolio dumps; keep minimal telemetry.

---

### Testing

- Unit: tools return correct aggregates, respect `created_at` ordering.
- E2E: login → open chat → ask “What’s my current allocation and 1M change?” → verify results match dashboard.
- Token budgeting: validate payload sizes; snapshot should stay compact.
- Mode behavior: Educational avoids direct recommendations; Advisory provides conditional options; Unhinged provides direct recommendations with rationale.

---

### Future (post‑MVP)

- Vector memory (pgvector) for "ongoing" user context and explanations.
- Scheduled "checkups" that precompute insights.
- Migration to AI Gateway for unified observability and multi-model support.
- Multi-model strategy (cheap default, smart fallback) via AI Gateway budgets.
- App attribution in AI Gateway and Observability.

---
