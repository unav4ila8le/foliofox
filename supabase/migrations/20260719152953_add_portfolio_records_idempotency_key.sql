-- Idempotency key for AI-approved portfolio record writes.
-- A retried approval continuation (lost response + client resend) re-executes
-- the same tool call with the same tool-call id; the partial unique index makes
-- the second insert fail instead of silently duplicating the record.
-- Forms, CSV import, and broker import leave the key NULL and are unaffected.
ALTER TABLE "public"."portfolio_records"
ADD COLUMN IF NOT EXISTS "idempotency_key" text;

CREATE UNIQUE INDEX IF NOT EXISTS "portfolio_records_user_idempotency_key_idx"
ON "public"."portfolio_records" ("user_id", "idempotency_key")
WHERE "idempotency_key" IS NOT NULL;
