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

- **Status**: ✅ **Phase 2 Complete**, ⏳ **Phase 3 Ready**

**Currently Implemented:**

- ✅ `getPortfolioSnapshot({ baseCurrency })` - Current holdings, net worth, allocation, and key P/L metrics

**Ready to Implement (existing analysis functions available):**

- `getHistoricalNetWorth({ baseCurrency, date })` - **FIXES CURRENT LIMITATION**: AI currently can't provide historical net worth because existing tool is hardcoded to current date
- `getNetWorthHistory({ baseCurrency, range })` - Uses existing `fetchNetWorthHistory()` with optimized bulk API calls
- `getNetWorthChange({ baseCurrency, range })` - Uses existing `fetchNetWorthChange()` for period comparisons
- `getTransactions({ range, limit, holdingId?, sortByCreatedAt: true })` - Uses existing `fetchTransactions()` [[memory:7587299]]
- `getRecords({ holdingId, range? })` - Uses existing `fetchRecords()` for historical holding snapshots
- `getProjectedIncome({ baseCurrency, monthsAhead? })` - Uses existing `calculateProjectedIncome()` (renamed from dividends for broader scope)

**Technical Notes:**

- All tools enforce RLS via `supabase/server.ts` for data security
- Existing analysis functions use bulk API optimization (2 calls regardless of time period) [[memory:3963302]]
- All tools return compact summaries to keep token usage low
- Server-side summarization prevents raw PII leakage to model

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

#### Phase 2 — Portfolio context (single tool) ✅ **COMPLETED**

- ✅ Implemented `getPortfolioSnapshot()` in `server/ai/tools/portfolio.ts` using `supabase/server.ts`.
- ✅ Added as AI SDK tool with proper schema validation and RLS compliance.
- ✅ Updated system prompt with comprehensive role, capabilities, and guidelines.
- ✅ Model successfully calls tool and provides portfolio analysis with holdings, net worth, allocation, and P/L.

#### Phase 3 — Historical insights & deeper analysis ⏳ **NEXT**

**Priority 1: Historical Data Access**

- `getHistoricalNetWorth({ baseCurrency, date })` - Fix current limitation where AI can't provide historical net worth
- `getNetWorthHistory({ baseCurrency, range })` - Performance trends over time periods
- `getNetWorthChange({ baseCurrency, range })` - Period-over-period comparison

**Priority 2: Transaction & Activity Analysis**

- `getTransactions({ range, limit, holdingId? })` - Recent portfolio activity analysis [[memory:7587299]]
- `getRecords({ holdingId, range? })` - Historical holding snapshots for performance tracking

**Priority 3: Income & Growth Analysis**

- `getProjectedIncome({ baseCurrency, monthsAhead? })` - Dividend and income projections (renamed from dividends for broader scope)
- `getAssetAllocation({ baseCurrency })` - Detailed category breakdown (may already be covered by portfolio snapshot)

This enables queries like: "What was my net worth on Jan 1st?", "What changed this week?", "Top winners/losers?", "Allocation drift over 6 months?", "Projected income this year?"

#### Phase 4 — UX polish

- Add advice mode selector (Educational/Advisory/Unhinged) in chat interface.
- Show last-updated times (quotes/FX updated daily at 22:00 UTC).
- Add quick-suggestions (chips): "Allocation", "Winners/Losers", "Transactions", "Income".
- Add copy-to-clipboard and basic message persistence per session.

---

### Current Limitations & Solutions

#### Why AI Says "No Historical Data Access"

**Problem**: Users asking "What was my net worth on [past date]?" get told the AI doesn't have historical data access.

**Root Cause**: The current `getPortfolioSnapshot` tool is hardcoded to use `new Date()` and only accepts `baseCurrency` parameter. Even though the underlying `calculateNetWorth(targetCurrency, date)` function supports historical dates, the AI tool doesn't expose this capability.

**Solution**: Implement `getHistoricalNetWorth({ baseCurrency, date })` as Priority 1 in Phase 3.

#### Additional Tool Opportunities

Beyond the planned tools, we could add:

**Advanced Analysis:**

- `getHoldingPerformance({ holdingId, timeRange })` - Individual holding analysis with profit/loss
- `getAllocationDrift({ baseCurrency, compareToDate })` - How allocation has changed over time
- `getTopMovers({ baseCurrency, timeRange, limit? })` - Biggest winners/losers in portfolio

**Comparative Analysis:**

- `compareNetWorth({ baseCurrency, fromDate, toDate })` - Side-by-side comparison
- `getRebalancingNeeds({ baseCurrency, targetAllocation? })` - Suggested rebalancing actions

**Risk Analysis:**

- `getCurrencyExposure({ baseCurrency })` - Foreign exchange risk analysis
- `getConcentrationRisk()` - Identify over-concentrated positions

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
