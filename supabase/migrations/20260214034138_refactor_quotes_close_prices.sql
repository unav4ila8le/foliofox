-- Clean-cut quote schema refactor:
-- - rename price -> close_price
-- - add adjusted_close_price
-- - add updated_at + trigger

ALTER TABLE public.quotes
  RENAME COLUMN price TO close_price;

ALTER TABLE public.quotes
  ADD COLUMN adjusted_close_price numeric;

UPDATE public.quotes
SET adjusted_close_price = close_price
WHERE adjusted_close_price IS NULL;

ALTER TABLE public.quotes
  ALTER COLUMN adjusted_close_price SET NOT NULL;

ALTER TABLE public.quotes
  ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();

DROP TRIGGER IF EXISTS quotes_handle_updated_at ON public.quotes;
CREATE TRIGGER quotes_handle_updated_at
  BEFORE UPDATE ON public.quotes
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();
