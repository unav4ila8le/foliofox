BEGIN;

ALTER TABLE public.financial_scenarios
  ADD COLUMN IF NOT EXISTS settings jsonb;

UPDATE public.financial_scenarios
SET settings = '{}'::jsonb
WHERE settings IS NULL;

ALTER TABLE public.financial_scenarios
  ALTER COLUMN settings SET DEFAULT '{}'::jsonb;

ALTER TABLE public.financial_scenarios
  ALTER COLUMN settings SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'financial_scenarios_settings_is_object'
      AND conrelid = 'public.financial_scenarios'::regclass
  ) THEN
    ALTER TABLE public.financial_scenarios
      ADD CONSTRAINT financial_scenarios_settings_is_object
      CHECK (jsonb_typeof(settings) = 'object');
  END IF;
END $$;

COMMENT ON COLUMN public.financial_scenarios.settings IS
  'Scenario-global planning settings: assumptions, baseline metadata, FIRE inputs, simulation config.';

COMMIT;
