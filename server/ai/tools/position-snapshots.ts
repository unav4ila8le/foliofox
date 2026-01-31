"use server";

import { fetchPositionSnapshots } from "@/server/position-snapshots/fetch";
import { resolvePositionLookup } from "@/server/positions/resolve-position-lookup";

import { clampDateRange } from "@/server/ai/tools/helpers/time-range";
import { formatUTCDateKey, parseUTCDateKey } from "@/lib/date/date-utils";

interface GetPositionSnapshotsParams {
  positionId: string; // Required - position snapshots are always for a specific position
  startDate: string | null;
  endDate: string | null;
}

export async function getPositionSnapshots(params: GetPositionSnapshotsParams) {
  const { positionId: lookup } = params;

  // Resolve ticker/ISIN/UUID to actual position UUID
  const { positionId } = await resolvePositionLookup({ lookup });

  const { startDate: startKey, endDate: endKey } = clampDateRange({
    startDate: params.startDate,
    endDate: params.endDate,
    maxDays: 1095, // allow up to ~3 years for single-position detail
  });
  const startDate = startKey ? parseUTCDateKey(startKey) : undefined;
  const endDate = endKey ? parseUTCDateKey(endKey) : undefined;

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
      start: startDate ? formatUTCDateKey(startDate) : null,
      end: endDate ? formatUTCDateKey(endDate) : null,
    },
    items,
  };
}
