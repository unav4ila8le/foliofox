BEGIN;

CREATE TYPE public.scenario_initial_value_basis AS ENUM (
  'net_worth',
  'cash',
  'manual'
);

ALTER TABLE public.financial_scenarios
  RENAME COLUMN initial_balance TO initial_value;

ALTER TABLE public.financial_scenarios
  ADD COLUMN initial_value_basis public.scenario_initial_value_basis;

UPDATE public.financial_scenarios
SET initial_value_basis = 'manual'
WHERE initial_value_basis IS NULL;

ALTER TABLE public.financial_scenarios
  ALTER COLUMN initial_value_basis SET DEFAULT 'net_worth';

ALTER TABLE public.financial_scenarios
  ALTER COLUMN initial_value_basis SET NOT NULL;

ALTER TABLE public.financial_scenarios
  ALTER COLUMN initial_value SET DEFAULT 0;

ALTER TABLE public.financial_scenarios
  ALTER COLUMN initial_value SET NOT NULL;

COMMIT;
