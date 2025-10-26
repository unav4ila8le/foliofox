"use server";

import { fetchPortfolioRecords } from "@/server/portfolio-records/fetch";

import type { PortfolioRecordWithPosition } from "@/types/global.types";

interface GetPortfolioRecordsParams {
  startDate: string | null;
  endDate: string | null;
  positionId: string | null;
  includeArchived: boolean | null;
}

export async function getPortfolioRecords(params: GetPortfolioRecordsParams) {
  const positionId = params.positionId ?? undefined;
  const includeArchived = params.includeArchived ?? undefined;

  const startDate = params.startDate ? new Date(params.startDate) : undefined;
  const endDate = params.endDate ? new Date(params.endDate) : undefined;

  const pageSize = 100;
  let page = 1;
  let pageCount = 1;
  const allRecords: PortfolioRecordWithPosition[] = [];

  do {
    const result = await fetchPortfolioRecords({
      positionId,
      includeArchived,
      startDate,
      endDate,
      page,
      pageSize,
    });

    allRecords.push(...result.records);
    pageCount = result.pageCount;
    page += 1;
  } while (page <= pageCount);

  const items = allRecords.map((r) => ({
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
    total: allRecords.length,
    returned: items.length,
    range: {
      start: startDate ?? null,
      end: endDate ?? null,
    },
    positionId: params.positionId,
    includeArchived: params.includeArchived ?? true,
    items,
  };
}
