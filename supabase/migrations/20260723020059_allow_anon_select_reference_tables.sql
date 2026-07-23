-- Tighten table grants and function EXECUTE privileges flagged by the
-- Supabase advisor (lints 0026-0029). RLS already protects rows; this
-- removes unnecessary privileges from the API roles entirely.

-- 1. Service-role-only tables (cron/admin paths): no API-role access at all.
--    Same pattern as quote_repair_queue (20260703042511).
revoke all on table
  public.automated_email_deliveries,
  public.domain_valuations,
  public.exchange_rates,
  public.news,
  public.quotes,
  public.dividends,
  public.dividend_events
from public, anon, authenticated;

grant all on table
  public.automated_email_deliveries,
  public.domain_valuations,
  public.exchange_rates,
  public.news,
  public.quotes,
  public.dividends,
  public.dividend_events
to service_role;

-- 2. User tables: accessed only with a signed-in session, so anon needs nothing.
revoke all on table
  public.ai_assistant_turn_events,
  public.conversation_messages,
  public.conversations,
  public.email_preferences,
  public.feedback,
  public.financial_profiles,
  public.financial_scenarios,
  public.portfolio_records,
  public.position_categories,
  public.position_snapshots,
  public.positions,
  public.profiles,
  public.public_portfolios,
  public.symbols,
  public.symbol_aliases,
  public.user_position_categories
from anon;

-- The anon policy on position_categories (20251106013152) is unused: no
-- signed-out code path reads it. Public portfolio pages fetch server-side
-- via the service client.
drop policy if exists "Enable read access for anonymous users" on public.position_categories;

-- 3. currencies stays anon-readable (browser currency selector on public
--    portfolio pages), but SELECT only.
revoke all on table public.currencies from anon;
grant select on table public.currencies to anon;

-- 4. Trigger-only functions: never called via RPC, so no API role needs
--    EXECUTE. Triggers keep firing (privilege is checked at trigger
--    creation time, not per firing).
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.sync_symbol_ticker_from_alias() from public, anon, authenticated;

-- check_username_available intentionally keeps anon + authenticated EXECUTE:
-- the sign-up flow (server/auth/sign-up.ts) calls it before a session exists.
-- Harden it instead: pin search_path so the SECURITY DEFINER body can only
-- resolve the schema-qualified table it names.
create or replace function public.check_username_available(name text)
returns boolean as $$
  select not exists (
    select 1 from public.profiles where username = name
  );
$$ language sql stable security definer set search_path = '';

-- 5. GraphQL API is unused; the baseline recreates the extension on every
--    reset. Dropping keeps local in sync with prod (disabled via dashboard).
--    No-op where already disabled.
drop extension if exists pg_graphql cascade;
