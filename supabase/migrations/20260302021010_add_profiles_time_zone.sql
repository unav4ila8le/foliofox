BEGIN;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS time_zone text DEFAULT 'UTC';

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS time_zone_mode text DEFAULT 'auto';

ALTER TABLE public.profiles
  ALTER COLUMN time_zone SET DEFAULT 'UTC';

ALTER TABLE public.profiles
  ALTER COLUMN time_zone_mode SET DEFAULT 'auto';

-- 1) Preserve intent for rows that already have a concrete timezone but no valid mode.
UPDATE public.profiles
SET time_zone_mode = 'manual'
WHERE time_zone IS NOT NULL
  AND btrim(time_zone) <> ''
  AND (
    time_zone_mode IS NULL
    OR time_zone_mode NOT IN ('auto', 'manual')
  );

-- 2) Normalize missing/blank timezone rows to the rollout default and auto mode.
UPDATE public.profiles
SET
  time_zone = 'UTC',
  time_zone_mode = 'auto'
WHERE time_zone IS NULL
  OR btrim(time_zone) = '';

-- 3) Final safety pass for any remaining invalid mode values.
UPDATE public.profiles
SET time_zone_mode = 'auto'
WHERE time_zone_mode IS NULL
  OR time_zone_mode NOT IN ('auto', 'manual');

ALTER TABLE public.profiles
  ALTER COLUMN time_zone SET NOT NULL;

ALTER TABLE public.profiles
  ALTER COLUMN time_zone_mode SET NOT NULL;

-- 4) Rebuild checks without noisy IF EXISTS notices in clean environments.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'profiles_time_zone_not_blank_check'
      AND conrelid = 'public.profiles'::regclass
  ) THEN
    ALTER TABLE public.profiles
      DROP CONSTRAINT profiles_time_zone_not_blank_check;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'profiles_time_zone_mode_valid_check'
      AND conrelid = 'public.profiles'::regclass
  ) THEN
    ALTER TABLE public.profiles
      DROP CONSTRAINT profiles_time_zone_mode_valid_check;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'profiles_time_zone_and_mode_consistency_check'
      AND conrelid = 'public.profiles'::regclass
  ) THEN
    ALTER TABLE public.profiles
      DROP CONSTRAINT profiles_time_zone_and_mode_consistency_check;
  END IF;
END $$;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_time_zone_not_blank_check
  CHECK (btrim(time_zone) <> '');

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_time_zone_mode_valid_check
  CHECK (time_zone_mode IN ('auto', 'manual'));

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_time_zone_and_mode_consistency_check
  CHECK (
    time_zone IS NOT NULL
    AND btrim(time_zone) <> ''
    AND time_zone_mode IN ('auto', 'manual')
  );

COMMENT ON COLUMN public.profiles.time_zone IS
  'User IANA timezone (e.g., Asia/Seoul). Stored as concrete value for civil-day business logic. Defaults to UTC and is never null.';

COMMENT ON COLUMN public.profiles.time_zone_mode IS
  'Timezone preference mode: auto follows browser timezone over time; manual preserves explicit user-selected timezone.';

COMMIT;
