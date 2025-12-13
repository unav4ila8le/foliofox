BEGIN;

CREATE TABLE IF NOT EXISTS public.financial_scenarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  events jsonb NOT NULL DEFAULT '{}',
  engine_version integer NOT NULL DEFAULT 1,
  initial_balance numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT financial_scenarios_name_check CHECK (
    char_length(name) >= 1 AND char_length(name) <= 255
  )
);

ALTER TABLE public.financial_scenarios
  ADD CONSTRAINT financial_scenarios_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(user_id) ON UPDATE CASCADE ON DELETE CASCADE;

-- Updated-at trigger
CREATE OR REPLACE TRIGGER financial_scenarios_handle_updated_at
  BEFORE UPDATE ON public.financial_scenarios
  FOR EACH ROW
  EXECUTE FUNCTION storage.update_updated_at_column();


-- RLS
ALTER TABLE public.financial_scenarios ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  CREATE POLICY "Users can select own financial scenarios"
    ON public.financial_scenarios
    FOR SELECT TO authenticated
    USING ((SELECT auth.uid()) = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "Users can insert own financial scenarios"
    ON public.financial_scenarios
    FOR INSERT TO authenticated
    WITH CHECK ((SELECT auth.uid()) = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "Users can update own financial scenarios"
    ON public.financial_scenarios
    FOR UPDATE TO authenticated
    USING ((SELECT auth.uid()) = user_id)
    WITH CHECK ((SELECT auth.uid()) = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
 BEGIN
   CREATE POLICY "Users can delete own financial scenarios"
     ON public.financial_scenarios FOR DELETE TO authenticated
     USING ((SELECT auth.uid()) = user_id);
 EXCEPTION WHEN duplicate_object THEN NULL;
 END $$;

COMMIT;