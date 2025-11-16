BEGIN;

-- Add explicit dividend presence + last-check metadata.
ALTER TABLE public.dividends
  ADD COLUMN pays_dividends boolean,
  ADD COLUMN dividends_checked_at timestamptz;

-- Backfill likely dividend payers from existing summary/event data.
UPDATE public.dividends d
SET pays_dividends = true,
    dividends_checked_at = COALESCE(d.updated_at, d.created_at, now())
WHERE (d.forward_annual_dividend IS NOT NULL
    OR d.trailing_ttm_dividend IS NOT NULL
    OR d.dividend_yield IS NOT NULL
    OR d.last_dividend_date IS NOT NULL)
   OR EXISTS (
     SELECT 1
     FROM public.dividend_events de
     WHERE de.symbol_id = d.symbol_id
   );

-- Set dividends_checked_at for all remaining rows (including unknown status)
-- so future logic can use recency to determine if unknown status is stale.
UPDATE public.dividends d
SET dividends_checked_at = COALESCE(d.updated_at, d.created_at, now())
WHERE dividends_checked_at IS NULL;

-- Index to support cache lookups by status + recency.
CREATE INDEX dividends_pays_dividends_checked_at_idx
  ON public.dividends (pays_dividends, dividends_checked_at DESC);

COMMIT;
