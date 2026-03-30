"use server";

import { fetchSinglePosition } from "@/server/positions/fetch";
import { calculateUnrealizedProfitLoss } from "@/lib/profit-loss/unrealized";

import type { CivilDateKey } from "@/lib/date/date-utils";
import type { PositionUnrealizedProfitLossSummary } from "@/lib/profit-loss/types";
import type {
  PositionSnapshot,
  TransformedPosition,
} from "@/types/global.types";

export interface PositionProfitLossSourceData {
  position: TransformedPosition;
  snapshots: PositionSnapshot[];
}

interface CalculatePositionUnrealizedProfitLossOptions {
  positionData?: PositionProfitLossSourceData;
}

export async function calculatePositionUnrealizedProfitLoss(
  positionId: string,
  asOfDateKey: CivilDateKey,
  options: CalculatePositionUnrealizedProfitLossOptions = {},
): Promise<PositionUnrealizedProfitLossSummary> {
  const { position, snapshots } =
    options.positionData ??
    (await fetchSinglePosition(positionId, {
      includeArchived: true,
      includeSnapshots: true,
      asOfDateKey,
    }));

  const [positionWithProfitLoss] = calculateUnrealizedProfitLoss(
    [position],
    new Map([[position.id, snapshots]]),
  );

  return {
    costBasis: {
      perUnit: positionWithProfitLoss.cost_basis_per_unit ?? 0,
      total: positionWithProfitLoss.total_cost_basis,
    },
    unrealized: {
      amount: positionWithProfitLoss.profit_loss,
      percentage: positionWithProfitLoss.profit_loss_percentage,
    },
  };
}
