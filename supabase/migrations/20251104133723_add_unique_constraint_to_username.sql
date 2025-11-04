-- Add unique constraint to profiles.username
ALTER TABLE "public"."profiles"
ADD CONSTRAINT "profiles_username_key" UNIQUE ("username");

-- Create function to check username availability
CREATE OR REPLACE FUNCTION public.check_username_available(name text)
RETURNS boolean AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM profiles WHERE username = name
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Grant execute permissions to anon and authenticated roles
GRANT EXECUTE ON FUNCTION public.check_username_available(text) TO anon;
GRANT EXECUTE ON FUNCTION public.check_username_available(text) TO authenticated;
