CREATE TABLE IF NOT EXISTS public.portfolio_public_links (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(user_id) ON UPDATE CASCADE ON DELETE CASCADE,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT portfolio_public_links_user_id_key UNIQUE (user_id),
  CONSTRAINT portfolio_public_links_id_check CHECK (LENGTH(id) > 0)
);

CREATE OR REPLACE TRIGGER portfolio_public_links_handle_updated_at
  BEFORE UPDATE ON public.portfolio_public_links
  FOR EACH ROW
  EXECUTE FUNCTION storage.update_updated_at_column();

ALTER TABLE public.portfolio_public_links ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS portfolio_public_links_expires_at_idx
  ON public.portfolio_public_links (expires_at);

DO $$
BEGIN
  CREATE POLICY "Users can select own portfolio public links"
    ON public.portfolio_public_links
    FOR SELECT
    USING (auth.uid() = user_id);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "Users can upsert own portfolio public links"
    ON public.portfolio_public_links
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "Users can update own portfolio public links"
    ON public.portfolio_public_links
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;