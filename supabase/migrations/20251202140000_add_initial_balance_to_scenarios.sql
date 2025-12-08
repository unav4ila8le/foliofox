BEGIN;

-- Add initial_balance column to financial_scenarios table
ALTER TABLE public.financial_scenarios
  ADD COLUMN initial_balance numeric NOT NULL DEFAULT 0;

COMMIT;
