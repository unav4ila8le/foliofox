-- Idempotency key for AI-approved position creation.
-- A retried approval continuation (lost response + client resend) re-executes
-- the same tool call with the same tool-call id; the partial unique index makes
-- the second insert fail instead of duplicating the position (the replay path
-- then returns the committed position as a success).
-- Forms, CSV import, and broker import leave the key NULL and are unaffected.
ALTER TABLE "public"."positions"
ADD COLUMN IF NOT EXISTS "idempotency_key" text;

CREATE UNIQUE INDEX IF NOT EXISTS "positions_user_idempotency_key_idx"
ON "public"."positions" ("user_id", "idempotency_key")
WHERE "idempotency_key" IS NOT NULL;
