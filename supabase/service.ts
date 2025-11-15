import { createClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database.types";

/**
 * Service role client for server operations without user context.
 * Use ONLY for cron jobs, admin tasks, etc.
 * WARNING: Bypasses RLS - use carefully!
 */
export function createServiceClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!, // This bypasses RLS
  );
}
