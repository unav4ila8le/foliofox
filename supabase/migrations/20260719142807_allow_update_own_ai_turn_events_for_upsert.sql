BEGIN;

-- UNIQUE (assistant_message_id) already exists from the create migration
-- (20260227032421), so telemetry upserts on it directly. What was missing is
-- RLS: the table only had SELECT and INSERT policies, so the ON CONFLICT DO
-- UPDATE path (tool-approval continuations re-reporting the same assistant
-- message) would be rejected.

DO $$
BEGIN
  CREATE POLICY "Users can update own AI turn events"
    ON public.ai_assistant_turn_events
    FOR UPDATE
    TO authenticated
    USING (user_id = (select auth.uid()))
    WITH CHECK (user_id = (select auth.uid()));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

COMMENT ON CONSTRAINT ai_assistant_turn_events_assistant_message_id_key
  ON public.ai_assistant_turn_events IS
  'One telemetry event per assistant message; approval continuations upsert into the same row.';

COMMIT;
