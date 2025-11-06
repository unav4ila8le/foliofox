DO $$
BEGIN
  CREATE POLICY "Enable read access for anonymous users"
    ON public.currencies
    FOR SELECT
    TO anon
    USING (true);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "Enable read access for anonymous users"
    ON public.position_categories
    FOR SELECT
    TO anon
    USING (true);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;