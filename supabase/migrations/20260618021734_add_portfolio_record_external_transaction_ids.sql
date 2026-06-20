BEGIN;

ALTER TABLE public.portfolio_records
  ADD COLUMN IF NOT EXISTS import_source text,
  ADD COLUMN IF NOT EXISTS external_transaction_id text;

COMMENT ON COLUMN public.portfolio_records.import_source IS
  'Stable broker/import adapter identifier for externally imported records. Null for manual records.';

COMMENT ON COLUMN public.portfolio_records.external_transaction_id IS
  'Broker-provided transaction identifier used for idempotent imports. Null for manual records.';

-- Only broker-imported records participate in duplicate protection; manual
-- records keep using their internal portfolio_records.id as the app identity.
CREATE UNIQUE INDEX IF NOT EXISTS uq_pr_user_source_external_transaction_id
  ON public.portfolio_records(user_id, import_source, external_transaction_id)
  WHERE import_source IS NOT NULL
    AND external_transaction_id IS NOT NULL;

COMMIT;
