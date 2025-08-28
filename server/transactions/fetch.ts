"use server";

import { getCurrentUser } from "@/server/auth/actions";

interface FetchTransactionsOptions {
  holdingId?: string;
  includeArchived?: boolean;
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
  const { holdingId, includeArchived = true } = options;
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
        is_archived
      )
    `,
    )
    .eq("user_id", user.id);

  // Filter by holding if provided
  if (holdingId) {
    query.eq("holding_id", holdingId);
  }

  // Handle archived holdings filtering
  if (!includeArchived) {
    query.eq("holdings.is_archived", false);
  }

  const { data: transactions, error } = await query.order("date", {
    ascending: false,
  });

  if (error) {
    throw new Error(`Failed to fetch transactions: ${error.message}`);
  }

  return transactions;
}
