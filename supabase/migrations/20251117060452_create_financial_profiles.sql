BEGIN;

-- Enums
CREATE TYPE public.age_band AS ENUM ('18-24', '25-34', '35-44', '45-54', '55-64', '65+');
CREATE TYPE public.risk_preference AS ENUM (
  'very_conservative',
  'conservative',
  'moderate',
  'aggressive',
  'very_aggressive'
);

-- Table
CREATE TABLE IF NOT EXISTS public.financial_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  age_band public.age_band,
  income_amount numeric,
  income_currency text,
  risk_preference public.risk_preference,
  about text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT financial_profiles_income_amount_non_negative CHECK (income_amount IS NULL OR income_amount >= 0),
  CONSTRAINT financial_profiles_income_currency_length_check CHECK (income_currency IS NULL OR length(income_currency) = 3),
  CONSTRAINT financial_profiles_income_currency_required_with_amount CHECK (income_amount IS NULL OR income_currency IS NOT NULL),
  CONSTRAINT financial_profiles_about_length_check CHECK (about IS NULL OR char_length(about) <= 2000)
);

-- Profiles: add AI data sharing consent
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS data_sharing_consent boolean NOT NULL DEFAULT false;

-- FKs
ALTER TABLE public.financial_profiles
  ADD CONSTRAINT financial_profiles_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(user_id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE public.financial_profiles
  ADD CONSTRAINT financial_profiles_income_currency_fkey
  FOREIGN KEY (income_currency) REFERENCES public.currencies(alphabetic_code) ON UPDATE CASCADE ON DELETE RESTRICT;

-- Updated-at trigger
CREATE OR REPLACE TRIGGER financial_profiles_handle_updated_at
  BEFORE UPDATE ON public.financial_profiles
  FOR EACH ROW
  EXECUTE FUNCTION storage.update_updated_at_column();

-- RLS
ALTER TABLE public.financial_profiles ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  CREATE POLICY "Users can select own financial profile"
    ON public.financial_profiles
    FOR SELECT TO authenticated
    USING ((SELECT auth.uid()) = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "Users can insert own financial profile"
    ON public.financial_profiles
    FOR INSERT TO authenticated
    WITH CHECK ((SELECT auth.uid()) = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "Users can update own financial profile"
    ON public.financial_profiles
    FOR UPDATE TO authenticated
    USING ((SELECT auth.uid()) = user_id)
    WITH CHECK ((SELECT auth.uid()) = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

COMMIT;
