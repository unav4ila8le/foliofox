"use server";

import { getCurrentUser } from "@/server/auth/actions";

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
): number | null {
  const snapshot = Array.isArray(snapshotSource)
    ? (snapshotSource[0] ?? null)
    : snapshotSource;

  if (!snapshot || snapshot.cost_basis_per_unit == null) {
    return null;
  }

  return Number(snapshot.cost_basis_per_unit);
}

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

  (data as SellRecordRow[] | null)?.forEach((record) => {
    const costBasisPerUnit = extractSnapshotBasis(record.position_snapshots);

    if (costBasisPerUnit == null) {
      return;
    }

    const realizedProfitLoss =
      Number(record.quantity) *
      (Number(record.unit_value) - Number(costBasisPerUnit));

    realizedProfitLossByPositionId.set(
      record.position_id,
      (realizedProfitLossByPositionId.get(record.position_id) ?? 0) +
        realizedProfitLoss,
    );
  });

  return realizedProfitLossByPositionId;
}

export async function calculateRealizedProfitLoss(positionId: string) {
  const realizedProfitLossByPositionId =
    await calculateRealizedProfitLossByPositionIds([positionId]);

  return realizedProfitLossByPositionId.get(positionId) ?? 0;
}
