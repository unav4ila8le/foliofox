"use server";

import { fetchPositionSnapshots } from "@/server/position-snapshots/fetch";
import { clampDateRange } from "@/server/ai/tools/helpers/time-range";

interface GetPositionSnapshotsParams {
  positionId: string; // Required - position snapshots are always for a specific position
  startDate: string | null;
  endDate: string | null;
}

export async function getPositionSnapshots(params: GetPositionSnapshotsParams) {
  const { positionId } = params;

  const { startDate: startKey, endDate: endKey } = clampDateRange({
    startDate: params.startDate,
    endDate: params.endDate,
    maxDays: 1095, // allow up to ~3 years for single-position detail
  });
  const startDate = startKey ? new Date(startKey) : undefined;
  const endDate = endKey ? new Date(endKey) : undefined;

  const snapshots = await fetchPositionSnapshots({
    positionId,
    startDate,
    endDate,
  });

  const items = snapshots.map((s) => ({
    id: s.id as string,
    date: s.date as string, // YYYY-MM-DD
    created_at: s.created_at as string,
    quantity: s.quantity as number,
    unit_value: s.unit_value as number,
    total_value: s.total_value as number,
    cost_basis_per_unit: s.cost_basis_per_unit as number,
    currency: s.currency as string,
  }));

  return {
    total: snapshots.length,
    returned: items.length,
    positionId,
    range: {
      start: startDate?.toISOString().split("T")[0] ?? null,
      end: endDate?.toISOString().split("T")[0] ?? null,
    },
    items,
  };
}
