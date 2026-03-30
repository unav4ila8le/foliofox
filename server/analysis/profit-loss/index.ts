"use server";

import {
  calculatePositionUnrealizedProfitLoss,
  type PositionProfitLossSourceData,
} from "./unrealized";
import { calculatePositionRealizedProfitLoss } from "./realized";

import type { CivilDateKey } from "@/lib/date/date-utils";
import type { PositionProfitLossSummary } from "@/lib/profit-loss/types";

interface CalculatePositionProfitLossSummaryOptions {
  positionData?: PositionProfitLossSourceData;
}

export async function calculatePositionProfitLossSummary(
  positionId: string,
  asOfDateKey: CivilDateKey,
  options: CalculatePositionProfitLossSummaryOptions = {},
): Promise<PositionProfitLossSummary> {
  const unrealizedSummaryPromise = options.positionData
    ? calculatePositionUnrealizedProfitLoss(positionId, asOfDateKey, {
        positionData: options.positionData,
      })
    : calculatePositionUnrealizedProfitLoss(positionId, asOfDateKey);

  const [unrealizedSummary, realizedSummary] = await Promise.all([
    unrealizedSummaryPromise,
    calculatePositionRealizedProfitLoss(positionId),
  ]);

  return {
    ...unrealizedSummary,
    ...realizedSummary,
  };
}
