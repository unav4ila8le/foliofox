BEGIN;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS last_app_activity_at timestamptz;

COMMENT ON COLUMN public.profiles.last_app_activity_at IS
  'Last dashboard activity timestamp used for automated email inactivity logic.';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typnamespace = 'public'::regnamespace
      AND typname = 'automated_email_type'
  ) THEN
    CREATE TYPE public.automated_email_type AS ENUM (
      'weekly_recap',
      'reengagement'
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typnamespace = 'public'::regnamespace
      AND typname = 'automated_email_delivery_status'
  ) THEN
    CREATE TYPE public.automated_email_delivery_status AS ENUM (
      'pending',
      'sent',
      'failed'
    );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.email_preferences (
  user_id uuid PRIMARY KEY
    REFERENCES public.profiles(user_id)
    ON UPDATE CASCADE
    ON DELETE CASCADE,
  weekly_recap_enabled boolean NOT NULL DEFAULT true,
  marketing_emails_enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.email_preferences IS
  'Per-user preferences for automated lifecycle and marketing email categories.';

COMMENT ON COLUMN public.email_preferences.weekly_recap_enabled IS
  'Whether the user wants the weekly portfolio recap email.';

COMMENT ON COLUMN public.email_preferences.marketing_emails_enabled IS
  'Whether the user wants marketing-category automations such as re-engagement emails.';

CREATE TABLE IF NOT EXISTS public.automated_email_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL
    REFERENCES public.profiles(user_id)
    ON UPDATE CASCADE
    ON DELETE CASCADE,
  email_type public.automated_email_type NOT NULL,
  delivery_key text NOT NULL,
  status public.automated_email_delivery_status NOT NULL DEFAULT 'pending',
  provider_message_id text,
  error_message text,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT automated_email_deliveries_delivery_key_not_blank_check
    CHECK (btrim(delivery_key) <> ''),

  CONSTRAINT automated_email_deliveries_user_id_email_type_delivery_key_key
    UNIQUE (user_id, email_type, delivery_key)
);

COMMENT ON TABLE public.automated_email_deliveries IS
  'Audit and dedupe log for automated email send attempts.';

COMMENT ON COLUMN public.automated_email_deliveries.delivery_key IS
  'Deterministic per-user send key used to prevent duplicate deliveries for the same email window.';

CREATE INDEX IF NOT EXISTS idx_profiles_last_app_activity_at
  ON public.profiles(last_app_activity_at DESC);

CREATE INDEX IF NOT EXISTS idx_automated_email_deliveries_user_type_sent_at
  ON public.automated_email_deliveries(user_id, email_type, sent_at DESC);

CREATE INDEX IF NOT EXISTS idx_automated_email_deliveries_status_created_at
  ON public.automated_email_deliveries(status, created_at DESC);

DO $$
BEGIN
  CREATE TRIGGER email_preferences_handle_updated_at
    BEFORE UPDATE ON public.email_preferences
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TRIGGER automated_email_deliveries_handle_updated_at
    BEFORE UPDATE ON public.automated_email_deliveries
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

INSERT INTO public.email_preferences (
  user_id,
  weekly_recap_enabled,
  marketing_emails_enabled
)
SELECT
  profile.user_id,
  true,
  true
FROM public.profiles AS profile
ON CONFLICT (user_id) DO NOTHING;

ALTER TABLE public.email_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automated_email_deliveries ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  CREATE POLICY "Users can view own email preferences"
    ON public.email_preferences
    FOR SELECT
    TO authenticated
    USING ((SELECT auth.uid()) = user_id);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "Users can insert own email preferences"
    ON public.email_preferences
    FOR INSERT
    TO authenticated
    WITH CHECK ((SELECT auth.uid()) = user_id);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "Users can update own email preferences"
    ON public.email_preferences
    FOR UPDATE
    TO authenticated
    USING ((SELECT auth.uid()) = user_id)
    WITH CHECK ((SELECT auth.uid()) = user_id);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "Service role can manage automated email deliveries"
    ON public.automated_email_deliveries
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, username)
  VALUES (
    new.id,
    new.raw_user_meta_data->>'username'
  );

  INSERT INTO public.email_preferences (
    user_id,
    weekly_recap_enabled,
    marketing_emails_enabled
  )
  VALUES (
    new.id,
    true,
    true
  );

  RETURN new;
END;
$$;

COMMIT;
