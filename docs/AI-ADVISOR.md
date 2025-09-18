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
  - [x] `getHoldings({ holdingId?, date? })`
  - [x] `getTransactions({ range?, holdingId? })`
  - [x] `getRecords({ holdingId, range? })`
  - [x] `getNetWorthHistory({ baseCurrency, range })`
  - [x] `getNetWorthChange({ baseCurrency, range })`
  - [x] `getProjectedIncome({ baseCurrency, monthsAhead? })`
  - [x] `getHoldingsPerformance({ baseCurrency, date? })`
  - [x] `getTopMovers({ baseCurrency, date?, limit? })`
  - [x] `getAllocationDrift({ baseCurrency, compareToDate })`
  - [x] `getCurrencyExposure({ baseCurrency, date? })`
  - [x] `getNews({ limit? })`
  - [ ] `getDividends({ symbolIds? })`
  - [ ] `searchSymbols({ query, limit? })`
  - [ ] `validateSymbol({ symbolId })`

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

### Conversation history (persistent chats)

- **Goal**: Automatically save chats so users can resume, rename, or delete threads (similar to ChatGPT). Keep privacy and token costs in mind.
- **Storage**: Use Supabase with two tables and RLS.

Schema (proposed):

```sql
-- conversations: one row per chat thread
create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- conversation_messages: one row per message within a thread
create table if not exists public.conversation_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('system','user','assistant','tool')),
  content text not null, -- keep simple; can move to jsonb later for rich parts
  model text,
  usage_tokens int,
  created_at timestamptz not null default now()
);

-- Helpful indexes
create index if not exists idx_conversations_user_updated on public.conversations(user_id, updated_at desc);
create index if not exists idx_messages_conversation_time on public.conversation_messages(conversation_id, created_at asc);

-- RLS
alter table public.conversations enable row level security;
alter table public.conversation_messages enable row level security;

-- Only the owner can read/write their conversations
create policy "Users can manage own conversations" on public.conversations
  for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Messages inherit access from the parent conversation via user_id
create policy "Users can manage own conversation messages" on public.conversation_messages
  for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
```

Runtime flow:

- On first user message without `conversationId`, create a `conversations` row (title derived from first prompt, truncated), return `conversationId` to the client, and persist the user message.
- After generating the assistant response, persist it as a second message in the same conversation.
- On subsequent turns, the client includes `conversationId`; the server loads the recent history and appends new messages.

Context window strategy (resume without blowing tokens):

- Do not inject the full thread. Load a sliding window of the last N turns (e.g., 15–30) under a token budget.
- Optionally maintain a server-side running summary per conversation (short paragraph). Refresh it periodically, and include it as a `system` message to preserve older context.
- Attachments or tools can be stored out-of-band and referenced by ID inside messages if needed later.

Deletion:

- Support permanent delete. The UI can list, rename, delete.

Security & moderation basics:

- Apply the same safety/topic-gating checks to resumed chats before calling the model.
- Ensure all queries filter by `auth.uid()` to honor RLS and user isolation.

Relationship to vector memory:

- Conversation history = per-thread transcript so the model stays in-context when a user resumes the same chat.
- Vector memory (e.g., pgvector) = cross-thread, long-term facts and user profile details retrievable via embeddings. It’s optional and orthogonal. Start with conversation persistence; add vector memory later if you need durable knowledge across conversations.

### Future considerations

- Vector memory (pgvector) for ongoing context
- Scheduled checkups that precompute insights
- AI Gateway for observability, budgets, multi-model
- Multi-model strategy (cheap default, smart fallback)
