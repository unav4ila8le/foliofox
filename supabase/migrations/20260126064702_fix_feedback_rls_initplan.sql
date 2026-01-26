-- Fix RLS initplan warning on feedback inserts.

ALTER POLICY "Authenticated users can submit feedback"
  ON public.feedback
  WITH CHECK ((SELECT auth.uid()) = user_id);

-- Avoid per-row auth.uid() evaluation in public_portfolios policies.
ALTER POLICY "Users can select own public portfolio"
  ON public.public_portfolios
  USING ((SELECT auth.uid()) = user_id);

ALTER POLICY "Users can insert own public portfolio"
  ON public.public_portfolios
  WITH CHECK ((SELECT auth.uid()) = user_id);

ALTER POLICY "Users can update own public portfolio"
  ON public.public_portfolios
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);
