"use server";

import { getCurrentUser } from "@/server/auth/actions";

/**
 * Validates that position names exist in the user's portfolio.
 * Used during portfolio record import to catch missing positions early,
 * before the user attempts to import.
 *
 * @param positionNames - Array of position names to validate
 * @returns Validation result with missing position names if any
 */
export async function validatePortfolioRecordPositionNames(
  positionNames: string[],
): Promise<{ valid: true } | { valid: false; missing: string[] }> {
  if (positionNames.length === 0) {
    return { valid: true };
  }

  const normalizePositionName = (value: string) =>
    value.trim().replace(/\s+/g, " ").toLowerCase();

  const { supabase, user } = await getCurrentUser();

  const { data: positions, error } = await supabase
    .from("positions")
    .select("name")
    .eq("user_id", user.id)
    .eq("type", "asset")
    .is("archived_at", null);

  if (error) {
    console.error("Error validating position names:", error);
    // Return valid to avoid blocking import on DB errors; import will catch it
    return { valid: true };
  }

  const foundNames = new Set(
    positions?.map((p) => normalizePositionName(p.name)) ?? [],
  );
  const missing = positionNames.filter(
    (name) => !foundNames.has(normalizePositionName(name)),
  );

  if (missing.length > 0) {
    return { valid: false, missing };
  }

  return { valid: true };
}
