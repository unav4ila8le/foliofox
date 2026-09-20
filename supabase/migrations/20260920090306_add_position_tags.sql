BEGIN;

CREATE TABLE public.user_position_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON UPDATE CASCADE ON DELETE CASCADE,
  name text NOT NULL,
  color text NOT NULL DEFAULT 'blue',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT user_position_tags_name_check
    CHECK (btrim(name) <> '' AND char_length(name) <= 64),
  CONSTRAINT user_position_tags_color_check
    CHECK (color IN (
      'neutral', 'red', 'orange', 'amber', 'green',
      'teal', 'blue', 'indigo', 'violet', 'pink'
    ))
);

CREATE UNIQUE INDEX uq_user_position_tags_user_lower_name
  ON public.user_position_tags(user_id, lower(btrim(name)));

CREATE TRIGGER user_position_tags_handle_updated_at
  BEFORE UPDATE ON public.user_position_tags
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

CREATE TABLE public.position_tag_assignments (
  position_id uuid NOT NULL REFERENCES public.positions(id) ON UPDATE CASCADE ON DELETE CASCADE,
  tag_id uuid NOT NULL REFERENCES public.user_position_tags(id) ON UPDATE CASCADE ON DELETE CASCADE,
  PRIMARY KEY (position_id, tag_id)
);

CREATE INDEX idx_position_tag_assignments_tag_id
  ON public.position_tag_assignments(tag_id);

ALTER TABLE public.user_position_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.position_tag_assignments ENABLE ROW LEVEL SECURITY;

-- Remove inherited default grants before granting only the client operations needed.
REVOKE ALL ON TABLE public.user_position_tags, public.position_tag_assignments
  FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.user_position_tags TO authenticated;
GRANT SELECT, INSERT, DELETE ON TABLE public.position_tag_assignments TO authenticated;

CREATE POLICY "Users can view their own position tags"
  ON public.user_position_tags FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

CREATE POLICY "Users can insert their own position tags"
  ON public.user_position_tags FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "Users can update their own position tags"
  ON public.user_position_tags FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "Users can delete their own position tags"
  ON public.user_position_tags FOR DELETE TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- Ownership is enforced here; asset-only eligibility is validated in server actions.
CREATE POLICY "Users can view their own position tag assignments"
  ON public.position_tag_assignments FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.positions AS position
      WHERE position.id = position_tag_assignments.position_id
        AND position.user_id = (SELECT auth.uid())
    )
    AND EXISTS (
      SELECT 1 FROM public.user_position_tags AS tag
      WHERE tag.id = position_tag_assignments.tag_id
        AND tag.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "Users can insert their own position tag assignments"
  ON public.position_tag_assignments FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.positions AS position
      WHERE position.id = position_tag_assignments.position_id
        AND position.user_id = (SELECT auth.uid())
    )
    AND EXISTS (
      SELECT 1 FROM public.user_position_tags AS tag
      WHERE tag.id = position_tag_assignments.tag_id
        AND tag.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "Users can delete their own position tag assignments"
  ON public.position_tag_assignments FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.positions AS position
      WHERE position.id = position_tag_assignments.position_id
        AND position.user_id = (SELECT auth.uid())
    )
    AND EXISTS (
      SELECT 1 FROM public.user_position_tags AS tag
      WHERE tag.id = position_tag_assignments.tag_id
        AND tag.user_id = (SELECT auth.uid())
    )
  );

COMMIT;
