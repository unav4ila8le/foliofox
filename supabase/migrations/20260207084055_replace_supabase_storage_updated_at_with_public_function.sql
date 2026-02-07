-- Remove two Supabase-specific dependencies:
-- 1. Replace storage.update_updated_at_column() with a custom public.handle_updated_at()
-- 2. Replace extensions.uuid_generate_v4() with built-in gen_random_uuid()

-- 1. Swap exchange_rates.id default from extensions.uuid_generate_v4() to gen_random_uuid()
ALTER TABLE public.exchange_rates
  ALTER COLUMN id SET DEFAULT gen_random_uuid();

-- 2. Create the portable replacement function
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  new.updated_at = now();
  RETURN new;
END;
$$;

-- 3. Re-point every updated_at trigger to the new function
--    (DROP + CREATE is the safest approach — ALTER TRIGGER cannot change the function)

-- conversations
DROP TRIGGER IF EXISTS conversations_handle_updated_at ON public.conversations;
CREATE TRIGGER conversations_handle_updated_at
  BEFORE UPDATE ON public.conversations
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- news
DROP TRIGGER IF EXISTS news_handle_updated_at ON public.news;
CREATE TRIGGER news_handle_updated_at
  BEFORE UPDATE ON public.news
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- portfolio_records
DROP TRIGGER IF EXISTS portfolio_records_handle_updated_at ON public.portfolio_records;
CREATE TRIGGER portfolio_records_handle_updated_at
  BEFORE UPDATE ON public.portfolio_records
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- position_snapshots
DROP TRIGGER IF EXISTS position_snapshots_handle_updated_at ON public.position_snapshots;
CREATE TRIGGER position_snapshots_handle_updated_at
  BEFORE UPDATE ON public.position_snapshots
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- positions
DROP TRIGGER IF EXISTS positions_handle_updated_at ON public.positions;
CREATE TRIGGER positions_handle_updated_at
  BEFORE UPDATE ON public.positions
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- profiles
DROP TRIGGER IF EXISTS profiles_handle_updated_at ON public.profiles;
CREATE TRIGGER profiles_handle_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- symbols
DROP TRIGGER IF EXISTS symbols_handle_updated_at ON public.symbols;
CREATE TRIGGER symbols_handle_updated_at
  BEFORE UPDATE ON public.symbols
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- public_portfolios
DROP TRIGGER IF EXISTS public_portfolios_handle_updated_at ON public.public_portfolios;
CREATE TRIGGER public_portfolios_handle_updated_at
  BEFORE UPDATE ON public.public_portfolios
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- symbol_aliases
DROP TRIGGER IF EXISTS symbol_aliases_handle_updated_at ON public.symbol_aliases;
CREATE TRIGGER symbol_aliases_handle_updated_at
  BEFORE UPDATE ON public.symbol_aliases
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- financial_profiles
DROP TRIGGER IF EXISTS financial_profiles_handle_updated_at ON public.financial_profiles;
CREATE TRIGGER financial_profiles_handle_updated_at
  BEFORE UPDATE ON public.financial_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- financial_scenarios
DROP TRIGGER IF EXISTS financial_scenarios_handle_updated_at ON public.financial_scenarios;
CREATE TRIGGER financial_scenarios_handle_updated_at
  BEFORE UPDATE ON public.financial_scenarios
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();
