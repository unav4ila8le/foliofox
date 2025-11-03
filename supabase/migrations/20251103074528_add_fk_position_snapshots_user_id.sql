-- Ensure no orphaned snapshots (safety)
DELETE FROM public.position_snapshots ps
WHERE NOT EXISTS (
  SELECT 1 FROM auth.users u WHERE u.id = ps.user_id
);

-- Add FK for user_id (low-lock, then validate)
ALTER TABLE public.position_snapshots
  ADD CONSTRAINT position_snapshots_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id)
  ON UPDATE CASCADE
  ON DELETE CASCADE
  NOT VALID;

ALTER TABLE public.position_snapshots
  VALIDATE CONSTRAINT position_snapshots_user_id_fkey;