BEGIN;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS time_zone text;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS time_zone_mode text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'profiles_time_zone_not_blank_check'
      AND conrelid = 'public.profiles'::regclass
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_time_zone_not_blank_check
      CHECK (time_zone IS NULL OR btrim(time_zone) <> '');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'profiles_time_zone_mode_valid_check'
      AND conrelid = 'public.profiles'::regclass
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_time_zone_mode_valid_check
      CHECK (
        time_zone_mode IS NULL
        OR time_zone_mode IN ('auto', 'manual')
      );
  END IF;
END $$;

-- Backfill existing non-null timezones as manual preference when mode is unknown.
UPDATE public.profiles
SET time_zone_mode = 'manual'
WHERE time_zone IS NOT NULL
  AND btrim(time_zone) <> ''
  AND time_zone_mode IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'profiles_time_zone_and_mode_consistency_check'
      AND conrelid = 'public.profiles'::regclass
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_time_zone_and_mode_consistency_check
      CHECK (
        (time_zone IS NULL AND time_zone_mode IS NULL)
        OR (
          time_zone IS NOT NULL
          AND btrim(time_zone) <> ''
          AND time_zone_mode IN ('auto', 'manual')
        )
      );
  END IF;
END $$;

COMMENT ON COLUMN public.profiles.time_zone IS
  'User IANA timezone (e.g., Asia/Seoul). Null allowed during phased rollout; will become NOT NULL in final hardening phase.';

COMMENT ON COLUMN public.profiles.time_zone_mode IS
  'Timezone preference mode: auto follows browser timezone over time; manual preserves explicit user-selected timezone. Null allowed during phased rollout.';

COMMIT;
