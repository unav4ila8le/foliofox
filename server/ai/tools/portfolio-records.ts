"use server";

import { fetchPortfolioRecords } from "@/server/portfolio-records/fetch";

interface GetPortfolioRecordsParams {
  startDate?: string;
  endDate?: string;
  positionId?: string;
  includeArchived?: boolean;
}

export async function getPortfolioRecords(
  params: GetPortfolioRecordsParams = {},
) {
  const { positionId, includeArchived } = params;

  const startDate = params?.startDate ? new Date(params.startDate) : undefined;
  const endDate = params?.endDate ? new Date(params.endDate) : undefined;

  const portfolioRecords = await fetchPortfolioRecords({
    positionId,
    includeArchived,
    startDate,
    endDate,
  });

  const items = portfolioRecords.map((r) => ({
    id: r.id as string,
    type: r.type as string,
    date: r.date as string, // YYYY-MM-DD
    created_at: r.created_at as string,
    position: {
      id: r.position_id as string,
      name: r.positions?.name as string,
    },
    quantity: (r.quantity as number) ?? 0,
    unit_value: (r.unit_value as number) ?? 0,
    currency: (r.positions?.currency as string | null) ?? null,
  }));

  return {
    total: portfolioRecords.length,
    returned: items.length,
    range: {
      start: startDate ?? null,
      end: endDate ?? null,
    },
    positionId: positionId ?? null,
    includeArchived: includeArchived ?? true,
    items,
  };
}
