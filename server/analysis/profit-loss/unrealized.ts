"use server";

import { fetchSinglePosition } from "@/server/positions/fetch";
import { calculateUnrealizedProfitLoss } from "@/lib/profit-loss/unrealized";

import type { CivilDateKey } from "@/lib/date/date-utils";

export interface PositionUnrealizedProfitLossSummary {
  costBasisPerUnit: number;
  totalCostBasis: number;
  unrealizedProfitLoss: number;
  unrealizedProfitLossPercentage: number;
}

export async function calculatePositionUnrealizedProfitLoss(
  positionId: string,
  asOfDateKey: CivilDateKey,
): Promise<PositionUnrealizedProfitLossSummary> {
  const { position, snapshots } = await fetchSinglePosition(positionId, {
    includeArchived: true,
    includeSnapshots: true,
    asOfDateKey,
  });

  const [positionWithProfitLoss] = calculateUnrealizedProfitLoss(
    [position],
    new Map([[position.id, snapshots]]),
  );

  return {
    costBasisPerUnit: positionWithProfitLoss.cost_basis_per_unit ?? 0,
    totalCostBasis: positionWithProfitLoss.total_cost_basis,
    unrealizedProfitLoss: positionWithProfitLoss.profit_loss,
    unrealizedProfitLossPercentage:
      positionWithProfitLoss.profit_loss_percentage,
  };
}
