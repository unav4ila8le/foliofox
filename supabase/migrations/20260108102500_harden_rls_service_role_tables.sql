-- Harden RLS policies for service-role managed tables.

-- Remove overly permissive authenticated write policies.
DROP POLICY IF EXISTS "Enable insert for all authenticated users"
  ON public.domain_valuations;
DROP POLICY IF EXISTS "Enable update for authenticated users"
  ON public.domain_valuations;

DROP POLICY IF EXISTS "Enable insert for all authenticated users"
  ON public.quotes;
DROP POLICY IF EXISTS "  Enable update for authenticated users"
  ON public.quotes;

DROP POLICY IF EXISTS "Enable insert for all authenticated users"
  ON public.symbols;
DROP POLICY IF EXISTS "Enable update for all authenticated users"
  ON public.symbols;

DROP POLICY IF EXISTS "Enable insert for authenticated users only"
  ON public.feedback;

-- Allow authenticated users to submit feedback only for themselves.
CREATE POLICY "Authenticated users can submit feedback"
  ON public.feedback
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);
