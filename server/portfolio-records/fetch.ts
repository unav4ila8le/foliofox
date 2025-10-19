"use server";

import { getCurrentUser } from "@/server/auth/actions";

interface FetchPortfolioRecordsOptions {
  positionId?: string;
  includeArchived?: boolean;
  startDate?: Date;
  endDate?: Date;
}

/**
 * Fetch portfolio records with optional filtering.
 * Always scopes to the current user. Optionally filters by position, dates, and archived positions.
 */
export async function fetchPortfolioRecords(
  options: FetchPortfolioRecordsOptions = {},
) {
  const { positionId, includeArchived = true, startDate, endDate } = options;
  const { supabase, user } = await getCurrentUser();

  const query = supabase
    .from("portfolio_records")
    .select(
      `
      *,
      positions!inner (
        id,
        name,
        currency,
        archived_at
      )
    `,
    )
    .eq("user_id", user.id);

  if (positionId) query.eq("position_id", positionId);
  if (startDate) query.gte("date", startDate.toISOString().slice(0, 10));
  if (endDate) query.lte("date", endDate.toISOString().slice(0, 10));
  if (!includeArchived) query.is("positions.archived_at", null);

  const { data: portfolioRecords, error } = await query
    .order("date", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch portfolio records: ${error.message}`);
  }

  return portfolioRecords;
}
