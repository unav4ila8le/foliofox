ALTER TABLE "public"."positions"
ADD COLUMN IF NOT EXISTS "capital_gains_tax_rate" numeric;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'positions_capital_gains_tax_rate_check'
  ) THEN
    ALTER TABLE ONLY "public"."positions"
      ADD CONSTRAINT "positions_capital_gains_tax_rate_check"
      CHECK ("capital_gains_tax_rate" >= 0 AND "capital_gains_tax_rate" <= 1);
  END IF;
END $$;
