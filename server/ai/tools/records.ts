"use server";

import { fetchRecords } from "@/server/records/fetch";

interface GetRecordsParams {
  holdingId: string; // Required - records are always for a specific holding
  startDate?: string;
  endDate?: string;
}

export async function getRecords(params: GetRecordsParams) {
  const { holdingId } = params;

  const startDate = params?.startDate ? new Date(params.startDate) : undefined;
  const endDate = params?.endDate ? new Date(params.endDate) : undefined;

  const records = await fetchRecords({
    holdingId,
    startDate,
    endDate,
  });

  const items = records.map((r) => ({
    id: r.id as string,
    date: r.date as string, // YYYY-MM-DD
    created_at: r.created_at as string,
    quantity: r.quantity as number,
    unit_value: r.unit_value as number,
    total_value: r.total_value as number,
    cost_basis_per_unit: r.cost_basis_per_unit as number,
    currency: r.currency as string,
  }));

  return {
    total: records.length,
    returned: items.length,
    holdingId,
    range: {
      start: startDate ?? null,
      end: endDate ?? null,
    },
    items,
  };
}
