BEGIN;

CREATE TABLE IF NOT EXISTS public.user_position_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL
    REFERENCES auth.users(id)
    ON UPDATE CASCADE
    ON DELETE CASCADE,
  position_type public.position_type NOT NULL,
  name text NOT NULL,
  description text,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT user_position_categories_name_not_blank_check
    CHECK (btrim(name) <> ''),
  CONSTRAINT user_position_categories_display_order_non_negative_check
    CHECK (display_order >= 0)
);

COMMENT ON TABLE public.user_position_categories IS
  'User-owned position categories shown in place of Foliofox system categories.';

COMMENT ON COLUMN public.user_position_categories.position_type IS
  'Scopes custom categories to assets or liabilities.';

COMMENT ON COLUMN public.user_position_categories.display_order IS
  'Per-user ordering hint for custom category selectors.';

CREATE UNIQUE INDEX IF NOT EXISTS uq_user_position_categories_user_type_lower_name
  ON public.user_position_categories(user_id, position_type, lower(btrim(name)));

CREATE INDEX IF NOT EXISTS idx_user_position_categories_user_type_display_order
  ON public.user_position_categories(user_id, position_type, display_order, name);

ALTER TABLE public.positions
  ADD COLUMN IF NOT EXISTS user_category_id uuid;

COMMENT ON COLUMN public.positions.user_category_id IS
  'Optional user-owned display category. When set, category_id remains the system fallback and must be other.';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'positions_user_category_id_fkey'
      AND conrelid = 'public.positions'::regclass
  ) THEN
    ALTER TABLE public.positions
      ADD CONSTRAINT positions_user_category_id_fkey
      FOREIGN KEY (user_category_id)
      REFERENCES public.user_position_categories(id)
      ON UPDATE CASCADE
      ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'positions_custom_category_requires_other_check'
      AND conrelid = 'public.positions'::regclass
  ) THEN
    ALTER TABLE public.positions
      ADD CONSTRAINT positions_custom_category_requires_other_check
      CHECK (user_category_id IS NULL OR category_id = 'other');
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_positions_user_category_id
  ON public.positions(user_category_id);

CREATE INDEX IF NOT EXISTS idx_positions_user_user_category_id
  ON public.positions(user_id, user_category_id);

DO $$
BEGIN
  CREATE TRIGGER user_position_categories_handle_updated_at
    BEFORE UPDATE ON public.user_position_categories
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE public.user_position_categories ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  CREATE POLICY "Users can view their own custom position categories"
    ON public.user_position_categories
    FOR SELECT
    TO authenticated
    USING (user_id = (SELECT auth.uid()));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "Users can insert their own custom position categories"
    ON public.user_position_categories
    FOR INSERT
    TO authenticated
    WITH CHECK (user_id = (SELECT auth.uid()));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "Users can update their own custom position categories"
    ON public.user_position_categories
    FOR UPDATE
    TO authenticated
    USING (user_id = (SELECT auth.uid()))
    WITH CHECK (user_id = (SELECT auth.uid()));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "Users can delete their own custom position categories"
    ON public.user_position_categories
    FOR DELETE
    TO authenticated
    USING (user_id = (SELECT auth.uid()));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "Users can only insert positions with owned custom categories"
    ON public.positions
    AS RESTRICTIVE
    FOR INSERT
    TO authenticated
    WITH CHECK (
      user_category_id IS NULL
      OR EXISTS (
        SELECT 1
        FROM public.user_position_categories AS custom_category
        WHERE custom_category.id = user_category_id
          AND custom_category.user_id = (SELECT auth.uid())
          AND custom_category.user_id = positions.user_id
          AND custom_category.position_type = positions.type
      )
    );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "Users can only update positions with owned custom categories"
    ON public.positions
    AS RESTRICTIVE
    FOR UPDATE
    TO authenticated
    USING (
      user_category_id IS NULL
      OR EXISTS (
        SELECT 1
        FROM public.user_position_categories AS custom_category
        WHERE custom_category.id = user_category_id
          AND custom_category.user_id = (SELECT auth.uid())
          AND custom_category.user_id = positions.user_id
          AND custom_category.position_type = positions.type
      )
    )
    WITH CHECK (
      user_category_id IS NULL
      OR EXISTS (
        SELECT 1
        FROM public.user_position_categories AS custom_category
        WHERE custom_category.id = user_category_id
          AND custom_category.user_id = (SELECT auth.uid())
          AND custom_category.user_id = positions.user_id
          AND custom_category.position_type = positions.type
      )
    );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

COMMIT;
