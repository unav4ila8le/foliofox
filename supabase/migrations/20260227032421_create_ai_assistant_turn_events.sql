CREATE TABLE IF NOT EXISTS public.ai_assistant_turn_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  assistant_message_id uuid NOT NULL,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  model text NOT NULL,
  prompt_source text NOT NULL CHECK (prompt_source IN ('suggestion', 'typed')),
  route text NOT NULL CHECK (route IN ('general', 'identifier', 'chart', 'write')),
  outcome text NOT NULL CHECK (outcome IN ('ok', 'clarify', 'error', 'approved', 'committed')),
  assistant_chars integer NOT NULL CHECK (assistant_chars >= 0),
  UNIQUE (assistant_message_id)
);

CREATE INDEX IF NOT EXISTS idx_ai_turn_events_created_at
  ON public.ai_assistant_turn_events(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_turn_events_user_created_at
  ON public.ai_assistant_turn_events(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_turn_events_route_outcome_created_at
  ON public.ai_assistant_turn_events(route, outcome, created_at DESC);

ALTER TABLE public.ai_assistant_turn_events ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  CREATE POLICY "Users can view own AI turn events"
    ON public.ai_assistant_turn_events
    FOR SELECT
    TO authenticated
    USING (user_id = (select auth.uid()));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "Users can insert own AI turn events"
    ON public.ai_assistant_turn_events
    FOR INSERT
    TO authenticated
    WITH CHECK (user_id = (select auth.uid()));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
