BEGIN;

-- 1) Add the new routes array column.
ALTER TABLE public.ai_assistant_turn_events
ADD COLUMN IF NOT EXISTS routes text[];

-- 2) Backfill existing scalar route values into routes[].
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'ai_assistant_turn_events'
      AND column_name = 'route'
  ) THEN
    UPDATE public.ai_assistant_turn_events
    SET routes = ARRAY[route]
    WHERE routes IS NULL;
  END IF;
END $$;

-- Safety fallback for any unexpected null/empty rows.
UPDATE public.ai_assistant_turn_events
SET routes = ARRAY['general']::text[]
WHERE routes IS NULL OR cardinality(routes) = 0;

ALTER TABLE public.ai_assistant_turn_events
ALTER COLUMN routes SET DEFAULT ARRAY['general']::text[];

ALTER TABLE public.ai_assistant_turn_events
ALTER COLUMN routes SET NOT NULL;

-- 3) Remove old route index and old scalar column.
DROP INDEX IF EXISTS idx_ai_turn_events_route_outcome_created_at;

ALTER TABLE public.ai_assistant_turn_events
DROP COLUMN IF EXISTS route;

-- 4) Enforce data quality for routes[].
ALTER TABLE public.ai_assistant_turn_events
ADD CONSTRAINT ai_assistant_turn_events_routes_non_empty_check
CHECK (cardinality(routes) > 0);

ALTER TABLE public.ai_assistant_turn_events
ADD CONSTRAINT ai_assistant_turn_events_routes_allowed_check
CHECK (routes <@ ARRAY['general', 'identifier', 'chart', 'write']::text[]);

ALTER TABLE public.ai_assistant_turn_events
ADD CONSTRAINT ai_assistant_turn_events_routes_no_nulls_check
CHECK (array_position(routes, NULL::text) IS NULL);

-- 5) Add array-friendly indexes for route filters.
CREATE INDEX IF NOT EXISTS idx_ai_turn_events_routes_gin
  ON public.ai_assistant_turn_events USING gin (routes);

CREATE INDEX IF NOT EXISTS idx_ai_turn_events_outcome_created_at
  ON public.ai_assistant_turn_events(outcome, created_at DESC);

COMMIT;
