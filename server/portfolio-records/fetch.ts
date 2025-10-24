"use server";

import { getCurrentUser } from "@/server/auth/actions";

interface FetchPortfolioRecordsOptions {
  positionId?: string;
  includeArchived?: boolean;
  startDate?: Date;
  endDate?: Date;
  page?: number;
  pageSize?: number;
}

/**
 * Fetch portfolio records with optional filtering.
 * Always scopes to the current user. Optionally filters by position, dates, and archived positions.
 */
export async function fetchPortfolioRecords(
  options: FetchPortfolioRecordsOptions = {},
) {
  const {
    positionId,
    includeArchived = true,
    startDate,
    endDate,
    page = 1,
    pageSize = 50,
  } = options;

  const currentPage = Math.max(1, page);
  const currentPageSize = Math.max(1, pageSize);

  const { supabase, user } = await getCurrentUser();

  const from = (currentPage - 1) * currentPageSize;
  const to = from + currentPageSize - 1;

  const query = supabase
    .from("portfolio_records")
    .select(
      `
      *,
      positions!inner (
        id,
        name,
        currency,
        type,
        archived_at
      ),
      position_snapshots (
        id,
        cost_basis_per_unit,
        date,
        created_at
      )
    `,
      { count: "exact" },
    )
    .eq("user_id", user.id);

  if (positionId) query.eq("position_id", positionId);
  if (startDate) query.gte("date", startDate.toISOString().slice(0, 10));
  if (endDate) query.lte("date", endDate.toISOString().slice(0, 10));
  if (!includeArchived) query.is("positions.archived_at", null);

  const { data, error, count } = await query
    .order("date", { ascending: false })
    .order("created_at", { ascending: false })
    .range(from, to);

  if (error) {
    throw new Error(`Failed to fetch portfolio records: ${error.message}`);
  }

  const total = count ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / currentPageSize));

  return {
    records: data ?? [],
    total,
    page: currentPage,
    pageSize: currentPageSize,
    pageCount,
    hasNextPage: currentPage < pageCount,
    hasPreviousPage: currentPage > 1,
  };
}
