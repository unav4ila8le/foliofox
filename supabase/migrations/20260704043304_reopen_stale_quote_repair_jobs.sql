BEGIN;

CREATE INDEX IF NOT EXISTS idx_quote_repair_queue_no_exact_updated_at
  ON public.quote_repair_queue(updated_at, id)
  WHERE status = 'non_trading_or_no_exact';

-- Monthly backfill probe: Yahoo can occasionally add historical rows later.
-- Reopen a small, old slice and let the existing hourly worker fetch it.
SELECT cron.schedule_in_database(
  'quote_repair_reopen_stale_no_exact',
  '0 4 15 * *',
  $command$
    WITH jobs_to_reopen AS (
      SELECT id
      FROM public.quote_repair_queue
      WHERE status = 'non_trading_or_no_exact'
        AND updated_at < now() - interval '30 days'
      ORDER BY updated_at ASC, id ASC
      LIMIT 100
    )
    UPDATE public.quote_repair_queue AS q
    SET
      status = 'pending',
      attempt_count = 0,
      next_attempt_at = now(),
      claimed_at = null,
      last_error = null
    FROM jobs_to_reopen
    WHERE q.id = jobs_to_reopen.id;
  $command$,
  current_database()
);

COMMIT;
