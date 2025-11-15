BEGIN;

-- Ensure pg_cron exists everywhere the migration runs.
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;

GRANT USAGE ON SCHEMA cron TO postgres;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA cron TO postgres;

-- Future cron tables in fresh databases inherit the right privileges.
ALTER DEFAULT PRIVILEGES IN SCHEMA cron
GRANT ALL ON TABLES TO postgres;

-- Nightly news cleanup at 22:00 UTC.
SELECT cron.schedule_in_database(
  'news_cleanup',
  '0 22 * * *',
  $command$
    DELETE FROM public.news
    WHERE created_at < now() - interval '7 days';
  $command$,
  current_database()
);

-- Monthly symbol cleanup (first of the month at 03:00 UTC).
SELECT cron.schedule_in_database(
  'symbols_cleanup',
  '0 3 1 * *',
  $command$
    DELETE FROM public.symbols AS s
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.positions AS p
      WHERE p.symbol_id = s.id
    );
  $command$,
  current_database()
);

COMMIT;
