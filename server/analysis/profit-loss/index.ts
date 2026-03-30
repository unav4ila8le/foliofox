"use server";

import {
  calculatePositionUnrealizedProfitLoss,
  type PositionUnrealizedProfitLossSummary,
} from "./unrealized";
import {
  calculatePositionRealizedProfitLoss,
  type PositionRealizedProfitLossSummary,
} from "./realized";

import type { CivilDateKey } from "@/lib/date/date-utils";

export interface PositionProfitLossSummary
  extends
    PositionUnrealizedProfitLossSummary,
    PositionRealizedProfitLossSummary {}

export async function calculatePositionProfitLossSummary(
  positionId: string,
  asOfDateKey: CivilDateKey,
): Promise<PositionProfitLossSummary> {
  const [unrealizedSummary, realizedSummary] = await Promise.all([
    calculatePositionUnrealizedProfitLoss(positionId, asOfDateKey),
    calculatePositionRealizedProfitLoss(positionId),
  ]);

  return {
    ...unrealizedSummary,
    ...realizedSummary,
  };
}
