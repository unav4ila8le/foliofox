"use server";

import { fetchPositionSnapshots } from "@/server/position-snapshots/fetch";

interface GetPositionSnapshotsParams {
  positionId: string; // Required - position snapshots are always for a specific position
  startDate: string | null;
  endDate: string | null;
}

export async function getPositionSnapshots(params: GetPositionSnapshotsParams) {
  const { positionId } = params;

  const startDate = params.startDate ? new Date(params.startDate) : undefined;
  const endDate = params.endDate ? new Date(params.endDate) : undefined;

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
      start: startDate ?? null,
      end: endDate ?? null,
    },
    items,
  };
}
