CREATE TABLE IF NOT EXISTS public.public_portfolios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(user_id) ON UPDATE CASCADE ON DELETE CASCADE,
  slug TEXT NOT NULL,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT public_portfolios_user_id_key UNIQUE (user_id),
  CONSTRAINT public_portfolios_slug_key UNIQUE (slug),
  CONSTRAINT public_portfolios_slug_check CHECK (slug ~ '^[a-z0-9]+$')
);

CREATE OR REPLACE TRIGGER public_portfolios_handle_updated_at
  BEFORE UPDATE ON public.public_portfolios
  FOR EACH ROW
  EXECUTE FUNCTION storage.update_updated_at_column();

ALTER TABLE public.public_portfolios ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  CREATE POLICY "Users can select own public portfolio"
    ON public.public_portfolios
    FOR SELECT
    USING (auth.uid() = user_id);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "Users can insert own public portfolio"
    ON public.public_portfolios
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "Users can update own public portfolio"
    ON public.public_portfolios
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
