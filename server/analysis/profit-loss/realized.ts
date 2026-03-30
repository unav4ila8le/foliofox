"use server";

import { getCurrentUser } from "@/server/auth/actions";
import {
  calculateRealizedProfitLossTotals,
  type RealizedProfitLossSellRecord,
} from "@/lib/profit-loss/realized";
import type { PositionRealizedProfitLossSummary } from "@/lib/profit-loss/types";

type SnapshotBasisRow = {
  cost_basis_per_unit: number | null;
};

type SellRecordRow = {
  position_id: string;
  quantity: number;
  unit_value: number;
  position_snapshots: SnapshotBasisRow | SnapshotBasisRow[] | null;
};

function extractSnapshotBasis(
  snapshotSource: SellRecordRow["position_snapshots"],
) {
  const snapshot = Array.isArray(snapshotSource)
    ? (snapshotSource[0] ?? null)
    : snapshotSource;

  if (!snapshot || snapshot.cost_basis_per_unit == null) {
    return null;
  }

  return Number(snapshot.cost_basis_per_unit);
}

function normalizeSellRecord(
  record: SellRecordRow,
): RealizedProfitLossSellRecord {
  return {
    positionId: record.position_id,
    quantity: Number(record.quantity),
    unitValue: Number(record.unit_value),
    costBasisPerUnit: extractSnapshotBasis(record.position_snapshots),
  };
}

// Server adapter: fetch auth-scoped sell rows, then delegate pure math to lib.
export async function calculateRealizedProfitLossByPositionIds(
  positionIds: string[],
) {
  const uniquePositionIds = Array.from(
    new Set(positionIds.map((positionId) => positionId.trim()).filter(Boolean)),
  );
  const realizedProfitLossByPositionId = new Map(
    uniquePositionIds.map((positionId) => [positionId, 0]),
  );

  if (uniquePositionIds.length === 0) {
    return realizedProfitLossByPositionId;
  }

  const { supabase, user } = await getCurrentUser();
  const { data, error } = await supabase
    .from("portfolio_records")
    .select(
      `
      position_id,
      quantity,
      unit_value,
      position_snapshots (
        cost_basis_per_unit
      )
    `,
    )
    .eq("user_id", user.id)
    .eq("type", "sell")
    .in("position_id", uniquePositionIds);

  if (error) {
    throw new Error(`Failed to fetch realized profit/loss: ${error.message}`);
  }

  const calculatedRealizedProfitLossByPositionId =
    calculateRealizedProfitLossTotals(
      ((data as SellRecordRow[] | null) ?? []).map(normalizeSellRecord),
    );

  calculatedRealizedProfitLossByPositionId.forEach(
    (realizedProfitLoss, positionId) => {
      realizedProfitLossByPositionId.set(positionId, realizedProfitLoss);
    },
  );

  return realizedProfitLossByPositionId;
}

export async function calculatePositionRealizedProfitLoss(
  positionId: string,
): Promise<PositionRealizedProfitLossSummary> {
  const realizedProfitLossByPositionId =
    await calculateRealizedProfitLossByPositionIds([positionId]);

  return {
    realized: {
      amount: realizedProfitLossByPositionId.get(positionId) ?? 0,
    },
  };
}
