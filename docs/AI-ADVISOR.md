## docs/AI-ADVISOR.md

### Foliofox AI Advisor — Plan (condensed)

### Overview

- **Main tool**: `getPortfolioSnapshot({ baseCurrency?, date? })`
  - Lightweight point-in-time overview of the user's portfolio
  - Returns: net worth, high-level asset allocation, top-level holdings summary

### Additional tools (context-specific)

- Provide deeper data only when needed by the conversation.
- Progress:
  - [x] `getPortfolioSnapshot`
  - [x] `getTransactions({ range?, holdingId? })`
  - [ ] `getRecords({ holdingId, range? })`
  - [ ] `getNetWorthHistory({ baseCurrency, range })`
  - [ ] `getNetWorthChange({ baseCurrency, range })`
  - [ ] `getProjectedIncome({ baseCurrency, monthsAhead? })`
  - [ ] `getHoldingsPerformance({ baseCurrency, date? })`
  - [ ] `getTopMovers({ baseCurrency, date?, limit? })`
  - [ ] `getAllocationDrift({ baseCurrency, compareToDate })`
  - [ ] `getCurrencyExposure({ baseCurrency, date? })`

### Advice modes

- **Educational**: Explain concepts and context; avoid direct recommendations
- **Advisory**: Provide conditional, actionable options with rationale
- **Unhinged**: Direct recommendations with clear assumptions and risks (no boilerplate disclaimers; UI provides persistent disclaimer)

### Configuration

- Current: direct OpenAI via Vercel AI SDK
  - `OPENAI_API_KEY=...`
- Future (optional): AI Gateway
  - `AI_GATEWAY_API_KEY=...`
  - `AI_GATEWAY_BASE_URL=https://ai-gateway.vercel.sh/v1`
  - `AI_MODEL=openai/gpt-4o-mini`

### Future considerations

- Vector memory (pgvector) for ongoing context
- Scheduled checkups that precompute insights
- AI Gateway for observability, budgets, multi-model
- Multi-model strategy (cheap default, smart fallback)
