BEGIN;

ALTER TABLE public.symbols
  ADD COLUMN quote_currency text DEFAULT '';

ALTER TABLE public.symbols
  ADD COLUMN quote_to_currency_rate numeric(20, 10) DEFAULT 1;

UPDATE public.symbols
SET
  quote_currency = currency,
  quote_to_currency_rate = 1
WHERE quote_currency IS NULL
  OR btrim(quote_currency) = ''
  OR quote_to_currency_rate IS NULL;

CREATE OR REPLACE FUNCTION public.set_symbol_quote_unit_defaults()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.quote_currency IS NULL OR btrim(NEW.quote_currency) = '' THEN
    NEW.quote_currency := NEW.currency;
  END IF;

  IF NEW.quote_to_currency_rate IS NULL THEN
    NEW.quote_to_currency_rate := 1;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER symbols_set_quote_unit_defaults
  BEFORE INSERT OR UPDATE OF currency, quote_currency, quote_to_currency_rate
  ON public.symbols
  FOR EACH ROW
  EXECUTE FUNCTION public.set_symbol_quote_unit_defaults();

ALTER TABLE public.symbols
  ALTER COLUMN quote_currency SET NOT NULL,
  ALTER COLUMN quote_to_currency_rate SET NOT NULL,
  ALTER COLUMN quote_to_currency_rate SET DEFAULT 1;

ALTER TABLE public.symbols
  ADD CONSTRAINT symbols_quote_currency_not_empty_check
  CHECK (btrim(quote_currency) <> '');

ALTER TABLE public.symbols
  ADD CONSTRAINT symbols_quote_to_currency_rate_positive_check
  CHECK (quote_to_currency_rate > 0);

COMMENT ON COLUMN public.symbols.quote_currency IS
  'Provider quote unit for symbol prices (may be non-ISO, e.g. GBp, GBX, KWF).';

COMMENT ON COLUMN public.symbols.quote_to_currency_rate IS
  'Multiplier to convert provider quote-unit prices into symbols.currency major units.';

COMMIT;
