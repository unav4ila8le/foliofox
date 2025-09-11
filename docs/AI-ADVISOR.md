## docs/AI-ADVISOR.md

### Foliofox AI Advisor — Project Plan

#### Goal

Add a right-side collapsible chat that lets users “talk to Foliofox” about their portfolio. Answers must be contextual (holdings, transactions, records, quotes, FX, performance). A persistent UI disclaimer will be shown; responses will not repeat disclaimers. Users can choose the advice mode to control how opinionated the AI is.

#### Scope (MVP)

- UI: Right sidebar chat revealed by shifting the dashboard layout (not a Sheet/Drawer). Toggle button lives in the header. On mobile, use a full-height right panel pushing content left.
- Backend: One chat API route using Vercel AI SDK + AI Gateway (BYOK).
- Tools: Server-side functions to fetch a user-scoped portfolio snapshot on demand (no client PII leakage).
- Safety: Mode-driven advice intensity (see below). Persistent UI disclaimer; no per-message disclaimers.

#### Non-goals (MVP)

- No embeddings/vector DB yet.
- No long-term memory beyond the current chat session.
- No trade execution.

---

### Architecture

#### UI

- Add a toggle button in `components/dashboard/header/index.tsx` to shift the layout and reveal a right sidebar (similar to the existing left sidebar behavior in `app/dashboard/layout.tsx`).
- Chat pane component under `components/dashboard/ai/chat.tsx`:
  - Input box, history list, streaming response.
  - Uses a server route for messages; no secrets in the client.
  - The right panel presence adjusts the main `SidebarInset` width so the whole dashboard shifts, not overlays.

#### API

- Route: `app/api/ai/chat/route.ts` (Edge or Node runtime).
- Use Vercel **AI SDK** (v5) with **AI Gateway**:
  - Model example: `openai/gpt-4o-mini` (configurable).
  - Stream responses.
  - Enable “tools” (function calling) to fetch data server-side when the model needs it.

#### Data access (tools)

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

Add to `.env.local` and Vercel:

- `AI_GATEWAY_API_KEY=...`
- Provider key (BYOK, starting with OpenAI only):
  - `OPENAI_API_KEY=...`
- Optional:
  - `AI_GATEWAY_BASE_URL=https://ai-gateway.vercel.sh/v1`
  - `AI_MODEL=openai/gpt-4o-mini`

References: [AI Gateway docs](https://vercel.com/docs/ai-gateway), [AI Gateway blog](https://vercel.com/blog/ai-gateway)

##### AI Gateway (BYOK) vs calling OpenAI directly

- Pros (Gateway with BYOK): unified API, observability, budgets/limits, retries/fallbacks, easy provider/model switching later, app attribution, and consistent auth. With BYOK, you pay OpenAI directly; the gateway does not add per-token fees. See docs: [AI Gateway](https://vercel.com/docs/ai-gateway).
- Cons: small additional network hop/latency; some features (e.g., provider-specific knobs) may need mapping; fallbacks/load-balancing matter less while using a single provider.

---

### Implementation Phases

#### Phase 1 — Skeleton

- Create `app/api/ai/chat/route.ts` with AI SDK `streamText()` returning a canned response (no tools).
- Add right sidebar in the dashboard layout that shifts content (no overlay/Sheet). Add header toggle.
- Wire chat UI to stream from the route.

#### Phase 2 — Portfolio context (single tool)

- Implement `get_portfolio_snapshot()` in `server/ai/tools/portfolio.ts` using `supabase/server.ts`.
- Add it as an AI SDK tool; update the system prompt with safety/role.
- Model calls tool when needed; responses summarize holdings, net worth, allocation, and key P/L.

#### Phase 3 — Deeper insights (more tools)

- Add `get_transactions()`, `get_net_worth_history()`, and (optional) `get_dividends()`.
- Support common queries: “What changed this week?”, “Top winners/losers?”, “Allocation drift?”, “Income this month?”

#### Phase 4 — UX polish

- Show disclaimers and last-updated times (quotes/FX updated daily at 22:00 UTC).
- Add quick-suggestions (chips): “Allocation”, “Winners/Losers”, “Transactions”, “Income”.
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

- Vector memory (pgvector) for “ongoing” user context and explanations.
- Scheduled “checkups” that precompute insights.
- Multi-model strategy (cheap default, smart fallback) via AI Gateway budgets.
- App attribution in AI Gateway and Observability.

---
