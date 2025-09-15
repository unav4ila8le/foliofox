"use server";

import { fetchTransactions } from "@/server/transactions/fetch";

interface GetTransactionsParams {
  startDate?: string;
  endDate?: string;
  holdingId?: string;
  includeArchived?: boolean;
}

export async function getTransactions(params: GetTransactionsParams = {}) {
  const { holdingId, includeArchived } = params;

  const startDate = params?.startDate ? new Date(params.startDate) : undefined;
  const endDate = params?.endDate ? new Date(params.endDate) : undefined;

  const transactions = await fetchTransactions({
    holdingId,
    includeArchived,
    startDate: startDate,
    endDate: endDate,
  });

  const items = transactions.map((t) => ({
    id: t.id as string,
    type: t.type as string,
    date: t.date as string, // YYYY-MM-DD
    created_at: t.created_at as string,
    holding: {
      id: t.holding_id as string,
      name: t.holdings?.name as string,
      symbol_id: (t.holdings?.symbol_id as string | null) ?? null,
    },
    quantity: (t.quantity as number) ?? 0,
    unit_value: (t.unit_value as number) ?? 0,
    currency: (t.holdings?.currency as string | null) ?? null,
  }));

  return {
    total: transactions.length,
    returned: items.length,
    range: {
      start: startDate ?? null,
      end: endDate ?? null,
    },
    holdingId: holdingId ?? null,
    includeArchived: includeArchived ?? true,
    items,
  };
}
