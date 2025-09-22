"use server";

import { getCurrentUser } from "@/server/auth/actions";

interface FetchTransactionsOptions {
  holdingId?: string;
  includeArchived?: boolean;
  startDate?: Date;
  endDate?: Date;
}

/**
 * Fetch transactions with optional filtering
 *
 * @param options - Optional filtering options
 * @returns An array of transactions
 */
export async function fetchTransactions(
  options: FetchTransactionsOptions = {},
) {
  const { holdingId, includeArchived = true, startDate, endDate } = options;
  const { supabase, user } = await getCurrentUser();

  const query = supabase
    .from("transactions")
    .select(
      `
      *,
      holdings!inner (
        id,
        name,
        symbol_id,
        currency,
        archived_at
      )
    `,
    )
    .eq("user_id", user.id);

  // Filter by holding if provided
  if (holdingId) {
    query.eq("holding_id", holdingId);
  }

  // Add inclusivedate range filters if provided
  if (startDate) query.gte("date", startDate.toISOString());
  if (endDate) query.lte("date", endDate.toISOString());

  // Handle archived holdings filtering
  if (!includeArchived) {
    query.is("holdings.archived_at", null);
  }

  const { data: transactions, error } = await query
    .order("created_at", { ascending: false })
    .order("date", { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch transactions: ${error.message}`);
  }

  return transactions;
}
