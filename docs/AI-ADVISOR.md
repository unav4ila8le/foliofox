# Foliofox AI Advisor

## Advice modes

- **Educational**: Explain concepts and context; avoid direct recommendations
- **Advisory**: Provide conditional, actionable options with rationale
- **Unhinged**: Direct recommendations with clear assumptions and risks (no boilerplate disclaimers; UI provides persistent disclaimer)

## Configuration

- Current: direct OpenAI via Vercel AI SDK
  - `OPENAI_API_KEY=...`
- Future (optional): AI Gateway
  - `AI_GATEWAY_API_KEY=...`
  - `AI_GATEWAY_BASE_URL=https://ai-gateway.vercel.sh/v1`
  - `AI_MODEL=openai/gpt-4o-mini`

## Conversation history (persistent chats)

- **Goal**: Automatically save chats so users can resume, rename, or delete threads (similar to ChatGPT). Keep privacy and token costs in mind.
- **Storage**: Use Supabase with two tables and RLS.

### Runtime flow:

- On first user message without `conversationId`, create a `conversations` row (title derived from first prompt, truncated), return `conversationId` to the client, and persist the user message.
- After generating the assistant response, persist it as a second message in the same conversation.
- On subsequent turns, the client includes `conversationId`; the server loads the recent history and appends new messages.

Context window strategy (resume without blowing tokens):

- Do not inject the full thread. Load a sliding window of the last N turns (e.g., 15–30) under a token budget.
- Optionally maintain a server-side running summary per conversation (short paragraph). Refresh it periodically, and include it as a `system` message to preserve older context.
- Attachments or tools can be stored out-of-band and referenced by ID inside messages if needed later.

Deletion:

- Support permanent delete. The UI can list and delete.

Security & moderation basics:

- Apply the same safety/topic-gating checks to resumed chats before calling the model.
- Ensure all queries filter by `auth.uid()` to honor RLS and user isolation.

Relationship to vector memory:

- Conversation history = per-thread transcript so the model stays in-context when a user resumes the same chat.
- Vector memory (e.g., pgvector) = cross-thread, long-term facts and user profile details retrievable via embeddings. It's optional and orthogonal. Start with conversation persistence; add vector memory later if you need durable knowledge across conversations.

## Future considerations

- Vector memory (pgvector) for ongoing context
- Scheduled checkups that precompute insights
- AI Gateway for observability, budgets, multi-model
- Multi-model strategy (cheap default, smart fallback)
