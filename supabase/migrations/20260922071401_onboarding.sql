BEGIN;

-- 1. Post-signup onboarding completion marker.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS onboarding_completed_at timestamptz;

COMMENT ON COLUMN public.profiles.onboarding_completed_at IS
  'Set when the user finishes or skips post-signup onboarding. Null routes the dashboard to /onboarding.';

-- Existing accounts are already set up; never send them through onboarding.
UPDATE public.profiles
  SET onboarding_completed_at = now()
  WHERE onboarding_completed_at IS NULL;

-- 2. AI data sharing is on by default for accounts created from here on.
-- No backfill: existing users keep whatever they already chose.
ALTER TABLE public.profiles
  ALTER COLUMN data_sharing_consent SET DEFAULT true;

COMMIT;
