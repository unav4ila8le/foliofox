import type { PortfolioRecord } from "@/types/global.types";

interface SnapshotTransitionState {
  runningQuantity: number;
  runningCostBasis: number;
}

interface ApplyPortfolioRecordTransitionOptions {
  recordItem: Pick<PortfolioRecord, "id" | "type" | "quantity" | "unit_value">;
  runningQuantity: number;
  runningCostBasis: number;
  overrideCostBasisPerUnit?: number | null;
}

/**
 * Apply a single portfolio record transition to running snapshot state.
 * Pure helper used by snapshot recalculation and unit tests.
 */
export function applyPortfolioRecordTransition({
  recordItem,
  runningQuantity,
  runningCostBasis,
  overrideCostBasisPerUnit = null,
}: ApplyPortfolioRecordTransitionOptions): SnapshotTransitionState {
  const quantity = Number(recordItem.quantity);
  const unitValue = Number(recordItem.unit_value);
  const nextState: SnapshotTransitionState = {
    runningQuantity,
    runningCostBasis,
  };

  if (recordItem.type === "buy") {
    if (nextState.runningQuantity > 0) {
      const totalCost =
        nextState.runningQuantity * nextState.runningCostBasis +
        quantity * unitValue;
      nextState.runningQuantity += quantity;
      nextState.runningCostBasis = totalCost / nextState.runningQuantity;
    } else {
      nextState.runningQuantity = quantity;
      nextState.runningCostBasis = unitValue;
    }

    return nextState;
  }

  if (recordItem.type === "sell") {
    nextState.runningQuantity = Math.max(
      0,
      nextState.runningQuantity - quantity,
    );
    return nextState;
  }

  nextState.runningQuantity = quantity;
  nextState.runningCostBasis =
    overrideCostBasisPerUnit != null
      ? Number(overrideCostBasisPerUnit)
      : Number(unitValue);

  return nextState;
}
