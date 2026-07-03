BEGIN;

CREATE TABLE IF NOT EXISTS public.quote_repair_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  symbol_id uuid NOT NULL
    REFERENCES public.symbols(id)
    ON UPDATE CASCADE
    ON DELETE CASCADE,
  target_date date NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  attempt_count integer NOT NULL DEFAULT 0,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  claimed_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT quote_repair_queue_symbol_id_target_date_key
    UNIQUE (symbol_id, target_date),

  CONSTRAINT quote_repair_queue_status_check
    CHECK (
      status IN (
        'pending',
        'in_progress',
        'resolved_exact',
        'non_trading_or_no_exact',
        'terminal_error'
      )
    ),

  CONSTRAINT quote_repair_queue_attempt_count_nonnegative_check
    CHECK (attempt_count >= 0)
);

COMMENT ON TABLE public.quote_repair_queue IS
  'Durable async queue for exact-date quote cache repair jobs.';

COMMENT ON COLUMN public.quote_repair_queue.target_date IS
  'Provider-facing effective quote date to repair.';

COMMENT ON COLUMN public.quote_repair_queue.next_attempt_at IS
  'Earliest time a pending repair job can be claimed.';

COMMENT ON COLUMN public.quote_repair_queue.claimed_at IS
  'Timestamp of the latest worker claim for stale in-progress recovery.';

CREATE INDEX IF NOT EXISTS idx_quote_repair_queue_pending_due
  ON public.quote_repair_queue(next_attempt_at, created_at, id)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_quote_repair_queue_in_progress_claimed_at
  ON public.quote_repair_queue(claimed_at)
  WHERE status = 'in_progress';

DO $$
BEGIN
  CREATE TRIGGER quote_repair_queue_handle_updated_at
    BEFORE UPDATE ON public.quote_repair_queue
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE public.quote_repair_queue ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  CREATE POLICY "Service role can manage quote repair queue"
    ON public.quote_repair_queue
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

REVOKE ALL ON TABLE public.quote_repair_queue FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.quote_repair_queue TO service_role;

COMMIT;
