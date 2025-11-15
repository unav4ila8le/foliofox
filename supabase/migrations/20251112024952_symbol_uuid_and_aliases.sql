BEGIN;

-- 1. Seed UUIDs on symbols
ALTER TABLE public.symbols
  ADD COLUMN symbol_uuid uuid DEFAULT gen_random_uuid();

ALTER TABLE public.symbols
  ALTER COLUMN symbol_uuid SET NOT NULL;

-- 2. Stage UUID FKs on dependent tables
ALTER TABLE public.quotes ADD COLUMN symbol_uuid uuid;
UPDATE public.quotes q
SET symbol_uuid = s.symbol_uuid
FROM public.symbols s
WHERE q.symbol_id = s.id;
DO $$
DECLARE missing_count integer;
BEGIN
  SELECT COUNT(*) INTO missing_count FROM public.quotes WHERE symbol_uuid IS NULL;
  IF missing_count > 0 THEN
    RAISE EXCEPTION 'quotes.symbol_id contains % row(s) that do not match any symbol during UUID backfill', missing_count;
  END IF;
END $$;
ALTER TABLE public.quotes
  ALTER COLUMN symbol_uuid SET NOT NULL;

ALTER TABLE public.dividends ADD COLUMN symbol_uuid uuid;
UPDATE public.dividends d
SET symbol_uuid = s.symbol_uuid
FROM public.symbols s
WHERE d.symbol_id = s.id;
DO $$
DECLARE missing_count integer;
BEGIN
  SELECT COUNT(*) INTO missing_count FROM public.dividends WHERE symbol_uuid IS NULL;
  IF missing_count > 0 THEN
    RAISE EXCEPTION 'dividends.symbol_id contains % row(s) that do not match any symbol during UUID backfill', missing_count;
  END IF;
END $$;
ALTER TABLE public.dividends
  ALTER COLUMN symbol_uuid SET NOT NULL;

ALTER TABLE public.dividend_events ADD COLUMN symbol_uuid uuid;
UPDATE public.dividend_events de
SET symbol_uuid = s.symbol_uuid
FROM public.symbols s
WHERE de.symbol_id = s.id;
DO $$
DECLARE missing_count integer;
BEGIN
  SELECT COUNT(*) INTO missing_count FROM public.dividend_events WHERE symbol_uuid IS NULL;
  IF missing_count > 0 THEN
    RAISE EXCEPTION 'dividend_events.symbol_id contains % row(s) that do not match any symbol during UUID backfill', missing_count;
  END IF;
END $$;
ALTER TABLE public.dividend_events
  ALTER COLUMN symbol_uuid SET NOT NULL;

ALTER TABLE public.positions ADD COLUMN symbol_uuid uuid;
UPDATE public.positions p
SET symbol_uuid = s.symbol_uuid
FROM public.symbols s
WHERE p.symbol_id IS NOT NULL
  AND p.symbol_id = s.id;
DO $$
DECLARE missing_count integer;
BEGIN
  SELECT COUNT(*) INTO missing_count
  FROM public.positions
  WHERE symbol_id IS NOT NULL AND symbol_uuid IS NULL;
  IF missing_count > 0 THEN
    RAISE EXCEPTION 'positions.symbol_id contains % row(s) that do not match any symbol during UUID backfill', missing_count;
  END IF;
END $$;

-- 3. Drop legacy FK/unique/index constraints
ALTER TABLE public.quotes DROP CONSTRAINT symbol_prices_symbol_id_fkey;
ALTER TABLE public.quotes DROP CONSTRAINT unique_symbol_date;

ALTER TABLE public.dividend_events DROP CONSTRAINT dividend_events_symbol_id_fkey;
ALTER TABLE public.dividend_events DROP CONSTRAINT dividend_events_symbol_id_event_date_key;
DROP INDEX IF EXISTS public.idx_dividend_events_symbol_date_desc;

ALTER TABLE public.dividends DROP CONSTRAINT dividends_symbol_id_fkey;
ALTER TABLE public.dividends DROP CONSTRAINT dividends_pkey;

ALTER TABLE public.positions DROP CONSTRAINT positions_symbol_id_fkey;
DROP INDEX IF EXISTS public.idx_positions_symbol_id;

-- 4. Promote UUID to primary key, keep ticker metadata
ALTER TABLE public.symbols DROP CONSTRAINT symbols_pkey;
ALTER TABLE public.symbols RENAME COLUMN id TO ticker;
ALTER TABLE public.symbols RENAME COLUMN symbol_uuid TO id;
ALTER TABLE public.symbols ALTER COLUMN ticker SET NOT NULL;
ALTER TABLE public.symbols ADD CONSTRAINT symbols_pkey PRIMARY KEY (id);
ALTER TABLE public.symbols ADD CONSTRAINT symbols_ticker_key UNIQUE (ticker);

-- 5. Refresh updated-at trigger to cover ticker flips
DROP TRIGGER IF EXISTS symbols_handle_updated_at ON public.symbols;

CREATE OR REPLACE TRIGGER symbols_handle_updated_at
  BEFORE UPDATE ON public.symbols
  FOR EACH ROW
  EXECUTE FUNCTION storage.update_updated_at_column();

-- 6. Finalize dependent tables on UUID FKs
ALTER TABLE public.quotes RENAME COLUMN symbol_id TO symbol_ticker;
ALTER TABLE public.quotes RENAME COLUMN symbol_uuid TO symbol_id;
ALTER TABLE public.quotes ALTER COLUMN symbol_id SET NOT NULL;
ALTER TABLE public.quotes DROP COLUMN symbol_ticker;
ALTER TABLE public.quotes
  ADD CONSTRAINT symbol_prices_symbol_id_fkey FOREIGN KEY (symbol_id) REFERENCES public.symbols(id) ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE public.quotes
  ADD CONSTRAINT unique_symbol_date UNIQUE (symbol_id, date);

ALTER TABLE public.dividends RENAME COLUMN symbol_id TO symbol_ticker;
ALTER TABLE public.dividends RENAME COLUMN symbol_uuid TO symbol_id;
ALTER TABLE public.dividends ALTER COLUMN symbol_id SET NOT NULL;
ALTER TABLE public.dividends DROP COLUMN symbol_ticker;
ALTER TABLE public.dividends
  ADD CONSTRAINT dividends_pkey PRIMARY KEY (symbol_id);
ALTER TABLE public.dividends
  ADD CONSTRAINT dividends_symbol_id_fkey FOREIGN KEY (symbol_id) REFERENCES public.symbols(id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE public.dividend_events RENAME COLUMN symbol_id TO symbol_ticker;
ALTER TABLE public.dividend_events RENAME COLUMN symbol_uuid TO symbol_id;
ALTER TABLE public.dividend_events ALTER COLUMN symbol_id SET NOT NULL;
ALTER TABLE public.dividend_events DROP COLUMN symbol_ticker;
ALTER TABLE public.dividend_events
  ADD CONSTRAINT dividend_events_symbol_id_event_date_key UNIQUE (symbol_id, event_date);
ALTER TABLE public.dividend_events
  ADD CONSTRAINT dividend_events_symbol_id_fkey FOREIGN KEY (symbol_id) REFERENCES public.symbols(id) ON UPDATE CASCADE ON DELETE CASCADE;
CREATE INDEX idx_dividend_events_symbol_date_desc ON public.dividend_events USING btree (symbol_id, event_date DESC);

ALTER TABLE public.positions RENAME COLUMN symbol_id TO symbol_ticker;
ALTER TABLE public.positions RENAME COLUMN symbol_uuid TO symbol_id;
ALTER TABLE public.positions DROP COLUMN symbol_ticker;
ALTER TABLE public.positions
  ADD CONSTRAINT positions_symbol_id_fkey FOREIGN KEY (symbol_id) REFERENCES public.symbols(id) ON UPDATE CASCADE ON DELETE SET NULL;
CREATE INDEX idx_positions_symbol_id ON public.positions USING btree (symbol_id);

-- 7. Shift news.related_symbol_ids to UUID array
ALTER TABLE public.news ADD COLUMN related_symbol_uuids uuid[] DEFAULT '{}'::uuid[];
UPDATE public.news n
SET related_symbol_uuids = COALESCE(
  (
    SELECT array_agg(s.id ORDER BY t.ord)
    FROM unnest(n.related_symbol_ids) WITH ORDINALITY AS t(symbol_ticker, ord)
    LEFT JOIN public.symbols s ON s.ticker = t.symbol_ticker
  ),
  '{}'
);
DROP INDEX IF EXISTS public.idx_news_related_symbols;
ALTER TABLE public.news RENAME COLUMN related_symbol_ids TO related_symbol_tickers;
ALTER TABLE public.news RENAME COLUMN related_symbol_uuids TO related_symbol_ids;
ALTER TABLE public.news DROP COLUMN related_symbol_tickers;
CREATE INDEX idx_news_related_symbols ON public.news USING gin (related_symbol_ids);

-- 8. Create alias table + policies
CREATE TABLE public.symbol_aliases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  symbol_id uuid NOT NULL REFERENCES public.symbols(id) ON UPDATE CASCADE ON DELETE CASCADE,
  value text NOT NULL,
  type text NOT NULL,
  source text NOT NULL DEFAULT 'yahoo',
  effective_from timestamptz NOT NULL DEFAULT now(),
  effective_to timestamptz,
  is_primary boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_symbol_aliases_symbol_id ON public.symbol_aliases (symbol_id);
CREATE INDEX idx_symbol_aliases_value_lower ON public.symbol_aliases (lower(value));
CREATE UNIQUE INDEX symbol_aliases_primary_unique ON public.symbol_aliases (symbol_id) WHERE is_primary;
CREATE UNIQUE INDEX symbol_aliases_symbol_type_value_effective_to_idx
  ON public.symbol_aliases (symbol_id, type, value, COALESCE(effective_to, 'infinity'::timestamptz));

CREATE OR REPLACE TRIGGER symbol_aliases_handle_updated_at
  BEFORE UPDATE ON public.symbol_aliases
  FOR EACH ROW
  EXECUTE FUNCTION storage.update_updated_at_column();

ALTER TABLE public.symbol_aliases ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  CREATE POLICY "Enable read access for authenticated users"
    ON public.symbol_aliases
    FOR SELECT
    TO authenticated
    USING (true);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

INSERT INTO public.symbol_aliases (
  symbol_id,
  value,
  type,
  source,
  is_primary,
  effective_from
)
SELECT
  id,
  ticker,
  'ticker',
  'yahoo',
  true,
  now()
FROM public.symbols;

-- 9. Sync symbol ticker from alias
CREATE OR REPLACE FUNCTION public.sync_symbol_ticker_from_alias()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.is_primary THEN
    UPDATE public.symbols
    SET ticker = NEW.value,
        updated_at = now()
    WHERE id = NEW.symbol_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS symbol_aliases_sync_primary_ticker ON public.symbol_aliases;

CREATE TRIGGER symbol_aliases_sync_primary_ticker
  AFTER INSERT OR UPDATE OF value, is_primary
  ON public.symbol_aliases
  FOR EACH ROW
  WHEN (NEW.is_primary IS TRUE)
  EXECUTE FUNCTION public.sync_symbol_ticker_from_alias();

COMMIT;