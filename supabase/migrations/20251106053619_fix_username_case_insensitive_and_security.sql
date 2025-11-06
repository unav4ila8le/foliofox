ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_username_key;

CREATE UNIQUE INDEX profiles_username_lower_idx
  ON public.profiles (lower(username))
  WHERE username IS NOT NULL;

CREATE OR REPLACE FUNCTION public.check_username_available(name text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT NOT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE lower(public.profiles.username) = lower(name)
  );
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
begin
  insert into public.profiles (user_id, username)
  values (
    new.id,
    new.raw_user_meta_data->>'username'
  );
  return new;
end;
$$;

ALTER POLICY "Users can select own public portfolio"
  ON public.public_portfolios
  USING ((select auth.uid()) = user_id);

ALTER POLICY "Users can insert own public portfolio"
  ON public.public_portfolios
  WITH CHECK ((select auth.uid()) = user_id);

ALTER POLICY "Users can update own public portfolio"
  ON public.public_portfolios
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);