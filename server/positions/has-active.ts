"use server";

import { cache } from "react";

import { getCurrentUser } from "@/server/auth/actions";

/**
 * Return whether the current user has at least one non-archived position.
 */
export const hasActivePositions = cache(async (): Promise<boolean> => {
  const { supabase, user } = await getCurrentUser();

  const { data, error } = await supabase
    .from("positions")
    .select("id")
    .eq("user_id", user.id)
    .is("archived_at", null)
    .limit(1);

  if (error) {
    throw new Error(`Failed to check active positions: ${error.message}`);
  }

  return (data?.length ?? 0) > 0;
});
