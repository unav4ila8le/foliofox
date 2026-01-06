-- Add column to track latest available quote date for detecting stale/renamed symbols
ALTER TABLE public.symbols
  ADD COLUMN last_quote_at timestamptz;

-- Backfill from existing quotes
UPDATE symbols s
SET last_quote_at = (
  SELECT MAX(date)::timestamptz 
  FROM quotes q 
  WHERE q.symbol_id = s.id
)
WHERE EXISTS (SELECT 1 FROM quotes q WHERE q.symbol_id = s.id);

COMMENT ON COLUMN public.symbols.last_quote_at IS 'Date of the most recent quote available from Yahoo Finance; stale value indicates symbol may be renamed/delisted';